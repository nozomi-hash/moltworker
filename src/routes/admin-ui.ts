import { Hono } from 'hono';
import type { AppEnv } from '../types';

/**
 * Admin UI routes
 * Serves the SPA from the ASSETS binding.
 *
 * Note: Static assets (/_admin/assets/*) are handled by publicRoutes.
 * Auth is applied centrally in index.ts before this app is mounted.
 */
const adminUi = new Hono<AppEnv>();

// Serve index.html for all admin routes (SPA)
adminUi.get('*', async (c) => {
  const path = c.req.path;
  const acceptsHtml = c.req.header('Accept')?.includes('text/html');

  // If it's explicitly a file request (has extension) AND not an HTML request, 
  // we should let it 404 so assets from /_admin/assets/* aren't masked.
  const isFile = path.includes('.') && !path.endsWith('.html');

  if (isFile || !acceptsHtml) {
    return c.notFound();
  }

  // Serve the SPA entry point for all other browser paths under /_admin/
  const url = new URL(c.req.url);
  return c.env.ASSETS.fetch(new Request(new URL('/index.html', url.origin).toString()));
});

export { adminUi };
