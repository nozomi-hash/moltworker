import type { Sandbox, Process } from '@cloudflare/sandbox';
import type { MoltbotEnv } from '../types';
import { MOLTBOT_PORT, STARTUP_TIMEOUT_MS } from '../config';
import { buildEnvVars } from './env';
import { mountR2Storage } from './r2';

/**
 * Find an existing OpenClaw gateway process
 *
 * @param sandbox - The sandbox instance
 * @returns The process if found and running/starting, null otherwise
 */
export async function findExistingMoltbotProcess(sandbox: Sandbox): Promise<Process | null> {
  try {
    const processes = await sandbox.listProcesses();
    for (const proc of processes) {
      // Robust matching: check for binary names or script names
      const cmd = proc.command.toLowerCase();
      const isGatewayProcess =
        cmd.includes('start-openclaw.sh') ||
        cmd.includes('openclaw gateway') ||
        cmd.includes('start-moltbot.sh') ||
        cmd.includes('clawdbot gateway') ||
        // Sandbox sometimes shows the full path
        cmd.includes('/usr/local/bin/start-openclaw.sh');

      const isCliCommand =
        cmd.includes('openclaw devices') ||
        cmd.includes('openclaw --version') ||
        cmd.includes('openclaw onboard') ||
        cmd.includes('clawdbot devices');

      if (isGatewayProcess && !isCliCommand) {
        if (proc.status === 'starting' || proc.status === 'running') {
          console.log(`[Process] Found gateway: ${proc.id} (${proc.status})`);
          return proc;
        }
      }
    }
  } catch (e) {
    console.log('[Process] Could not list processes:', e);
  }
  return null;
}

/**
 * Ensure the OpenClaw gateway is running
 *
 * This will:
 * 1. Mount R2 storage if configured
 * 2. Check for an existing gateway process
 * 3. Wait for it to be ready, or start a new one
 *
 * @param sandbox - The sandbox instance
 * @param env - Worker environment bindings
 * @returns The running gateway process
 */
export async function ensureMoltbotGateway(sandbox: Sandbox, env: MoltbotEnv, forceRestart = false): Promise<Process> {
  // Mount R2 storage for persistent data (non-blocking if not configured)
  await mountR2Storage(sandbox, env);

  // Check if gateway is already running or starting
  const existingProcess = await findExistingMoltbotProcess(sandbox);

  if (existingProcess) {
    if (forceRestart) {
      console.log(`[HEAL] Explicitly killing existing process ${existingProcess.id} for v46 clean start...`);
      try {
        await existingProcess.kill();
      } catch (kErr) {
        console.warn('[HEAL] Kill failed (maybe already dead):', kErr);
      }
    } else {
      console.log('Found existing gateway process:', existingProcess.id, 'status:', existingProcess.status);
      try {
        console.log('Waiting for gateway on port', MOLTBOT_PORT, 'timeout:', STARTUP_TIMEOUT_MS);
        await existingProcess.waitForPort(MOLTBOT_PORT, { mode: 'tcp', timeout: STARTUP_TIMEOUT_MS });
        console.log('Gateway is reachable');
        return existingProcess;
      } catch (_e) {
        console.log('Existing process not reachable after full timeout, killing and restarting...');
        try {
          await existingProcess.kill();
        } catch (killError) {
          console.log('Failed to kill process:', killError);
        }
      }
    }
  }

  // Start a new OpenClaw gateway
  console.log('Starting new OpenClaw gateway...');
  const envVars = buildEnvVars(env);
  // Explicitly use bash -c to avoid shebang/exec issues in sandbox
  const command = 'bash -c /usr/local/bin/start-openclaw.sh';

  console.log('Starting process with command:', command);
  console.log('Environment vars being passed:', Object.keys(envVars));

  let process: Process;
  try {
    process = await sandbox.startProcess(command, {
      env: Object.keys(envVars).length > 0 ? envVars : undefined,
    });
    console.log(`[Gateway] Process started. ID: ${process.id}, Status: ${process.status}`);
  } catch (startErr) {
    console.error('[Gateway] CRITICAL: sandbox.startProcess failed:', startErr);
    throw startErr;
  }

  // Wait for the gateway to be ready
  try {
    console.log('[Gateway] Waiting for OpenClaw gateway to be ready on port', MOLTBOT_PORT);
    await process.waitForPort(MOLTBOT_PORT, { mode: 'tcp', timeout: STARTUP_TIMEOUT_MS });
    console.log('[Gateway] OpenClaw gateway is ready!');

    const logs = await process.getLogs();
    if (logs.stdout) console.log('[Gateway] stdout:', logs.stdout);
    if (logs.stderr) console.log('[Gateway] stderr:', logs.stderr);
  } catch (e) {
    console.error('[Gateway] waitForPort failed:', e);
    try {
      const logs = await process.getLogs();
      console.error('[Gateway] startup failed. Stderr:', logs.stderr);
      console.error('[Gateway] startup failed. Stdout:', logs.stdout);
      throw new Error(`OpenClaw gateway failed to start. Stderr: ${logs.stderr || '(empty)'}`, {
        cause: e,
      });
    } catch (logErr) {
      console.error('[Gateway] Failed to get logs:', logErr);
      throw e;
    }
  }

  // Verify gateway is actually responding
  console.log('[Gateway] Verifying gateway health...');

  return process;
}
