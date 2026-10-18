import { GameError } from './errors.js';

// Per-connection address, never an untrusted X-Forwarded-For header.
// Separate reads from writes so ordinary polling cannot exhaust actions.
export function createRequestLimiter() {
  const buckets = new Map();
  return (request, pathname) => {
    const now = Date.now();
    const kind = request.method === 'POST' ? pathname === '/game/api/rooms' ? 'create' : 'write' : 'read';
    const limit = { create: 10, write: 120, read: 600 }[kind];
    const key = `${request.socket.remoteAddress}:${kind}`;
    if (buckets.size > 2000) for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if (buckets.size >= 6000) throw new GameError('服务器繁忙，请稍后再试', 429);
      bucket = { count: 0, until: now + 60000 };
      buckets.set(key, bucket);
    }
    if (++bucket.count > limit) throw new GameError('请求太快，请稍后再试', 429);
  };
}
