import { RULES, WEAPONS, ITEMS, TERRAIN } from '../rules.js';
import { GameError } from './errors.js';

function send(response, status, body, head = false) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(head ? undefined : JSON.stringify(body));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 16384) throw new GameError('请求过大', 413);
  }
  try { return JSON.parse(body); }
  catch { throw new GameError('请求内容不是有效 JSON', 400); }
}

export async function handleApi(pathname, request, response, store, limit) {
  if (!pathname.startsWith('/game/api/')) return false;
  try {
    limit(request, pathname);
    const token = request.headers.authorization?.replace(/^Bearer /, '') || '';
    if (request.method === 'GET' || request.method === 'HEAD') {
      let body;
      if (pathname === '/game/api/config') body = { rules: RULES, weapons: WEAPONS, items: ITEMS, terrain: TERRAIN };
      else if (pathname === '/game/api/health') body = { status: 'ok', time: new Date().toISOString() };
      else {
        const match = pathname.match(/^\/game\/api\/rooms\/([A-Fa-f0-9]{6})$/);
        if (!match) throw new GameError('接口不存在', 404);
        body = store.read(match[1], token);
      }
      send(response, 200, body, request.method === 'HEAD');
      return true;
    }
    if (request.method !== 'POST') throw new GameError('不支持这个请求方法', 405);
    const origin = request.headers.origin;
    if (origin) {
      let source;
      try { source = new URL(origin); } catch { throw new GameError('请求来源不正确', 403); }
      if (!['http:', 'https:'].includes(source.protocol) || source.host !== request.headers.host) throw new GameError('请求来源不正确', 403);
    }
    const body = await readJson(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GameError('请求内容不正确', 400);
    if (pathname === '/game/api/rooms') send(response, 201, store.create(body.name));
    else {
      const match = pathname.match(/^\/game\/api\/rooms\/([A-Fa-f0-9]{6})\/(join|actions)$/);
      if (!match) throw new GameError('接口不存在', 404);
      const result = match[2] === 'join' ? store.join(match[1], body.name) : store.act(match[1], token, body);
      send(response, match[2] === 'join' ? 201 : 200, result);
    }
  } catch (error) {
    if (!(error instanceof GameError)) console.error(error);
    send(response, error.status || 500, { error: error instanceof GameError ? error.message : '服务器出错，请稍后重试' });
  }
  return true;
}
