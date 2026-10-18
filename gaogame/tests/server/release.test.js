import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../../server/rooms.js';

function fixture() {
  let time = 100000;
  const store = createRoomStore({ now: () => time });
  const a = store.create('甲', '192.0.2.1'), b = store.join(a.roomId, '乙');
  const read = () => store.read(a.roomId, a.token);
  const act = (session, command) => store.act(a.roomId, session.token, { ...command, expectedVersion: read().version });
  act(a, { type: 'start' }); act(a, { type: 'spawn', x: 0, y: 0 }); act(b, { type: 'spawn', x: 1, y: 0 });
  return { store, a, b, read, act, clock: value => { time = value; } };
}

test('deadline is server enforced on reads and rejects a late action', () => {
  const f = fixture(), before = f.read();
  assert.equal(before.turnEndsAt, 130000);
  f.clock(129999); assert.equal(f.read().currentPlayerId, f.a.playerId);
  f.clock(130000);
  assert.throws(() => f.store.act(f.a.roomId, f.a.token, { type: 'move', x: 0, y: 1, expectedVersion: before.version }), e => e.status === 409);
  const after = f.read();
  assert.equal(after.currentPlayerId, f.b.playerId); assert.equal(after.turnEndsAt, 160000);
  assert.equal(after.players.find(p => p.id === f.a.playerId).y, 0);
});

test('background tick advances an offline player without a client request', () => {
  const f = fixture(); f.clock(130001); f.store.tick();
  assert.equal(f.read().currentPlayerId, f.b.playerId);
});

test('three retained rooms per source, independent peers and expiry unaffected by reads', () => {
  let time = 0; const store = createRoomStore({ now: () => time });
  const rooms = Array.from({ length: 3 }, () => store.create('甲', '192.0.2.1'));
  assert.throws(() => store.create('第四间', '192.0.2.1'), e => e.status === 429);
  assert.doesNotThrow(() => store.create('乙', '192.0.2.2'));
  time = 14 * 60000; store.read(rooms[0].roomId, rooms[0].token);
  time = 15 * 60000; store.tick();
  assert.throws(() => store.read(rooms[0].roomId, rooms[0].token), e => e.status === 404);
  assert.doesNotThrow(() => store.create('新房间', '192.0.2.1'));
});

test('failed creation consumes no quota and creator departure cannot transfer quota', () => {
  const store = createRoomStore();
  assert.throws(() => store.create('', '192.0.2.1'));
  const rooms = Array.from({ length: 3 }, () => store.create('甲', '192.0.2.1'));
  const guest = store.join(rooms[0].roomId, '乙');
  store.act(rooms[0].roomId, rooms[0].token, { type: 'leave', expectedVersion: guest.state.version });
  assert.throws(() => store.create('绕过配额', '192.0.2.1'), e => e.status === 429);
  store.act(rooms[1].roomId, rooms[1].token, { type: 'leave', expectedVersion: rooms[1].state.version });
  assert.doesNotThrow(() => store.create('空房已释放', '192.0.2.1'));
});
