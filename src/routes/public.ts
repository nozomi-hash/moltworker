import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { MOLTBOT_PORT } from '../config';
import { getSandbox } from '@cloudflare/sandbox';
import { findExistingMoltbotProcess, ensureMoltbotGateway } from '../gateway';

/**
 * Public routes - NO Cloudflare Access authentication required
 *
 * These routes are mounted BEFORE the auth middleware is applied.
 * Includes: health checks, static assets, and public API endpoints.
 */
const publicRoutes = new Hono<AppEnv>();

// GET /sandbox-health - Health check endpoint
publicRoutes.get('/sandbox-health', (c) => {
  return c.json({
    status: 'ok',
    service: 'moltbot-sandbox',
    gateway_port: MOLTBOT_PORT,
  });
});

// GET /logo.png - Serve logo from ASSETS binding
publicRoutes.get('/logo.png', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// GET /logo-small.png - Serve small logo from ASSETS binding
publicRoutes.get('/logo-small.png', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// GET /api/status - Public health check for gateway status (no auth required)
publicRoutes.get('/api/status', async (c) => {
  const version = 'v54-FINAL-FIX';
  let sandbox = c.get('sandbox');

  const bindingState = {
    has_sandbox_namespace: !!c.env.Sandbox,
    sandbox_type: typeof c.env.Sandbox,
    has_assets: !!c.env.ASSETS,
    worker_version: version
  };

  if (!sandbox) {
    const sleepAfter = c.env.SANDBOX_SLEEP_AFTER?.toLowerCase() || 'never';
    const options = sleepAfter === 'never' ? { keepAlive: true } : { sleepAfter };
    try {
      sandbox = getSandbox(c.env.Sandbox, 'moltbot', options);
      bindingState.has_sandbox_namespace = true;
    } catch (e) {
      return c.json({ ok: false, diagnostic_code: 'ERR_GET_SANDBOX_FAILED', error: String(e), version, bindingState });
    }
  }

  try {
    console.log(`[DEBUG] /api/status - ${version} - START`);

    let processes = [];
    try {
      processes = await sandbox.listProcesses();
    } catch (lpErr) {
      console.error('[DEBUG] listProcesses failed:', lpErr);
      return c.json({
        ok: false,
        diagnostic_code: 'ERR_SANDBOX_LIST_FAILED',
        error: lpErr instanceof Error ? lpErr.message : String(lpErr),
        version,
        bindingState
      });
    }

    let gatewayProcess = processes.find((p) =>
      p.command.includes('openclaw') || p.command.includes('start-openclaw.sh')
    );

    // AUTO-HEAL: If not running or if we want to ensure a fresh v46 start
    const shouldHeal = !gatewayProcess || new URL(c.req.url).searchParams.has('force');

    let healError = null;
    if (shouldHeal) {
      console.log('[HEAL] Triggering aggressive restart from /api/status');
      try {
        await ensureMoltbotGateway(sandbox, c.env, true); // forceRestart: true
        processes = await sandbox.listProcesses();
        gatewayProcess = processes.find((p) =>
          p.command.includes('openclaw') || p.command.includes('start-openclaw.sh')
        );
      } catch (startErr) {
        console.error('[HEAL] Triggered start failed:', startErr);
        healError = {
          message: startErr instanceof Error ? startErr.message : String(startErr),
          stack: startErr instanceof Error ? startErr.stack : null
        };
      }
    }

    let logs = { stdout: 'n/a', stderr: 'n/a' };
    if (gatewayProcess) {
      logs = await gatewayProcess.getLogs();
    } else if (processes.length > 0) {
      logs = await processes[0].getLogs();
    }

    const workerConfig = {
      gateway_id: c.env.CF_AI_GATEWAY_GATEWAY_ID,
      account_id: c.env.CF_AI_GATEWAY_ACCOUNT_ID,
      cf_account_id: c.env.CF_ACCOUNT_ID,
      model: c.env.CF_AI_GATEWAY_MODEL,
      has_api_key: !!c.env.CLOUDFLARE_AI_GATEWAY_API_KEY
    };

    if (!gatewayProcess) {
      return c.json({
        ok: false,
        diagnostic_code: 'GATEWAY_STOPPED',
        version,
        workerConfig,
        bindingState,
        healError,
        processes: processes.map(p => ({ id: p.id, command: p.command, status: p.status })),
        logs
      });
    }

    // Process exists, check if it's actually responding
    try {
      await gatewayProcess.waitForPort(MOLTBOT_PORT, { mode: 'tcp', timeout: 5000 });
      return c.json({ ok: true, status: 'running', diagnostic_code: 'GATEWAY_RUNNING', version, processId: gatewayProcess.id, workerConfig, bindingState, logs });
    } catch {
      return c.json({ ok: false, status: 'not_responding', diagnostic_code: 'GATEWAY_NOT_RESPONDING', version, processId: gatewayProcess.id, workerConfig, bindingState, logs });
    }
  } catch (err) {
    return c.json({
      ok: false,
      diagnostic_code: 'ERR_UNEXPECTED',
      error: err instanceof Error ? err.message : 'Unknown error',
      version,
      bindingState
    });
  }
});

/**
 * Public process list for debugging matching logic.
 */
publicRoutes.get('/public-ps', async (c) => {
  const sandbox = c.get('sandbox');
  try {
    const processes = await sandbox.listProcesses();
    return c.json(processes);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /debug/startup-log - Read the persistent startup log
publicRoutes.get('/debug/startup-log', async (c) => {
  const sandbox = c.get('sandbox');
  try {
    const result = await sandbox.readFile('/data/moltbot/startup.log');
    const logs = new TextDecoder().decode((result as any).data);
    return c.text(logs);
  } catch (e) {
    return c.text('Startup log not found or error: ' + String(e), 404);
  }
});

// GET /debug/startup-marker - Read the unconditional startup marker from /tmp
publicRoutes.get('/debug/startup-marker', async (c) => {
  const sandbox = c.get('sandbox');
  try {
    const result = await sandbox.readFile('/tmp/startup.marker');
    const marker = new TextDecoder().decode((result as any).data);
    return c.text(marker);
  } catch (e) {
    return c.text('Startup marker not found: ' + String(e), 404);
  }
});

// GET /_admin/assets/* - Admin UI static assets (CSS, JS need to load for login redirect)
// Assets are built to dist/client with base "/_admin/"
publicRoutes.get('/_admin/assets/*', async (c) => {
  const path = c.req.path;
  // Robust rewrite: handle double slashes and ensure it starts with /assets/
  const assetPath = path.replace(/^\/_admin\/assets\//, '/assets/').replace(/\/+/g, '/');
  const url = new URL(c.req.url);
  const assetUrl = new URL(assetPath, url.origin);
  console.log(`[ASSET] Local: ${path} -> Bucket: ${assetPath}`);
  return c.env.ASSETS.fetch(new Request(assetUrl.toString(), c.req.raw));
});

export { publicRoutes };
