import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestLimiter } from '../../server/request-limit.js';

test('room creation bursts are limited without blocking polling or other connections', () => {
  const limit = createRequestLimiter();
  const request = { method: 'POST', socket: { remoteAddress: '127.0.0.1' } };
  for (let index = 0; index < 10; index++) limit(request, '/gaogame/api/rooms');
  assert.throws(() => limit(request, '/gaogame/api/rooms'), error => error.status === 429);
  assert.doesNotThrow(() => limit({ ...request, method: 'GET' }, '/gaogame/api/health'));
  assert.doesNotThrow(() => limit({ ...request, socket: { remoteAddress: '127.0.0.2' } }, '/gaogame/api/rooms'));
});
