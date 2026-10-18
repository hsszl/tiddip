import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSource } from '../../server/source.js';
import { createRequestLimiter } from '../../server/request-limit.js';
import { createRoomStore } from '../../server/rooms.js';

const req = (ip, chain) => ({ method: 'GET', socket: { remoteAddress: ip }, headers: { 'x-forwarded-for': chain } });
test('address aliases normalize and untrusted forwarding cannot bypass source quotas', () => {
  assert.equal(requestSource(req('::ffff:192.0.2.1', '198.51.100.1')), '192.0.2.1');
  assert.equal(requestSource(req('192.0.2.1', '198.51.100.1')), '192.0.2.1');
  const trusted = ['127.0.0.1'];
  assert.equal(requestSource(req('127.0.0.1', '203.0.113.9, 192.0.2.1'), trusted), '192.0.2.1');
  assert.equal(requestSource(req('127.0.0.1', 'garbage, 192.0.2.1'), trusted), '127.0.0.1');
});
test('authenticated sessions have independent read budgets behind one proxy', () => {
  const limit = createRequestLimiter(), request = req('127.0.0.1');
  for (let i = 0; i < 600; i++) limit(request, '/gaogame/api/rooms/ABC123', 'member-a');
  assert.throws(() => limit(request, '/gaogame/api/rooms/ABC123', 'member-a'), e => e.status === 429);
  assert.doesNotThrow(() => limit(request, '/gaogame/api/rooms/ABC123', 'member-b'));
});

test('IPv6 aliases and rotating addresses in one /64 share room quota', () => {
  const store = createRoomStore();
  store.create('一', '2001:0db8:0001:0002::1');
  store.create('二', '2001:db8:1:2::2');
  store.create('三', '2001:db8:1:2:ffff::3');
  assert.throws(() => store.create('四', '2001:db8:1:2::4'), e => e.status === 429);
  assert.doesNotThrow(() => store.create('邻居', '2001:db8:1:3::1'));
  assert.equal(requestSource(req('::ffff:c000:201')), '192.0.2.1');
});
