import { createServer } from 'node:http';
import { handleApi } from './http-api.js';
import { serveStatic } from './static.js';
import { createRoomStore } from './rooms.js';
import { createRequestLimiter } from './request-limit.js';

export function createApp({ trustedProxies = [], ...storeOptions } = {}) {
  const store = createRoomStore(storeOptions);
  const limit = createRequestLimiter({ trustedProxies });
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/game' || pathname.startsWith('/game/')) {
        response.writeHead(308, { Location: '/gaogame' + request.url.slice('/game'.length) });
        response.end();
        return;
      }
      if (await handleApi(pathname, request, response, store, limit, trustedProxies)) return;
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end('Method not allowed');
        return;
      }
      if (await serveStatic(pathname, request, response)) return;
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      console.error('Request failed:', error.message);
      if (!response.headersSent) response.writeHead(500);
      response.end('Internal server error');
    }
  });
  // Continue computer turns even after the last human is eliminated.
  const timer = setInterval(() => {
    try { store.tick(); } catch (error) { console.error('Computer turn failed:', error); }
  }, 1000);
  timer.unref();
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => { clearInterval(timer); store.close?.(); });
  return server;
}
