import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from './model.js';
import { spawn } from './movement.js';
import { attack, damage } from './combat.js';
import { createRoomStore } from './rooms.js';

test('lethal hit broadcasts elimination and victory with their board position', () => {
  const { room, player: a } = createRoom('ABC123', '甲'), b = addPlayer(room, '乙');
  startRoom(room); room.tiles.forEach(t => { t.type = 'ground'; });
  spawn(room, a, 0, 0); spawn(room, b, 1, 0);
  a.weapon = b.weapon = 'rifle'; b.hp = 1;
  attack(room, a, b.id);
  const death = room.log.find(e => e.kind === 'eliminated'), victory = room.log.find(e => e.kind === 'victory');
  assert.equal(death.actorId, b.id); assert.deepEqual(death.position, { x: 1, y: 0 });
  assert.equal(victory.actorId, a.id); assert.equal(room.phase, 'finished');
});

test('revival broadcasts restoration instead of elimination', () => {
  const { room, player } = createRoom('ABC123', '甲');
  player.weapon = 'pistol'; player.hp = 1; player.x = player.y = 0;
  damage(room, player, '地雷伤害');
  assert.equal(room.log.at(-1).kind, 'revived');
  assert.equal(room.log.some(e => e.kind === 'eliminated'), false);
  assert.equal(player.alive, true);
});

test('leaving ignores a stale turn version but revokes only the authenticated player', () => {
  const store = createRoomStore(), a = store.create('甲'), b = store.join(a.roomId, '乙');
  assert.doesNotThrow(() => store.act(a.roomId, a.token, { type: 'leave', expectedVersion: a.state.version }));
  assert.throws(() => store.read(a.roomId, a.token), e => e.status === 401);
  assert.deepEqual(store.read(a.roomId, b.token).players.map(p => p.id), [b.playerId]);
});

test('leaving cannot name another player or use an invalid session', () => {
  const store = createRoomStore(), a = store.create('甲'), b = store.join(a.roomId, '乙');
  assert.throws(() => store.act(a.roomId, a.token, { type: 'leave', expectedVersion: b.state.version, playerId: b.playerId }), e => e.status === 400);
  assert.throws(() => store.act(a.roomId, null, { type: 'leave', expectedVersion: b.state.version }), e => e.status === 401);
  assert.equal(store.read(a.roomId, b.token).players.length, 2);
});
