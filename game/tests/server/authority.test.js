import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../../server/rooms.js';

function match() {
  const store = createRoomStore();
  const a = store.create('甲'), b = store.join(a.roomId, '乙');
  const read = session => store.read(a.roomId, session.token);
  const act = (session, action) => store.act(a.roomId, session.token, { expectedVersion: read(session).version, ...action });
  act(a, { type: 'start' });
  act(a, { type: 'spawn', x: 0, y: 0 });
  act(b, { type: 'spawn', x: 1, y: 0 });
  return { store, a, b, read, act };
}

test('weapons and health are public before anyone selects a starting tile, hands stay private', () => {
  const store = createRoomStore();
  const a = store.create('甲'), b = store.join(a.roomId, '乙');
  store.act(a.roomId, a.token, { type: 'start', expectedVersion: b.state.version });
  const own = store.read(a.roomId, a.token).players.find(player => player.id === a.playerId);
  const view = store.read(a.roomId, b.token);
  const opponent = view.players.find(player => player.id === a.playerId);
  assert.equal(view.phase, 'spawn');
  assert.equal(opponent.weapon, own.weapon);
  assert.equal(opponent.hp, own.hp);
  assert.equal(opponent.maxHp, own.maxHp);
  assert.equal(opponent.x, null);
  assert.equal(opponent.items, undefined);
  assert.equal(JSON.stringify(view).includes(a.token), false);
});

test('private hands expose counts but no other player’s cards or credentials', () => {
  const { a, b, read } = match();
  const view = read(b), own = read(a).players.find(player => player.id === a.playerId);
  assert.equal(view.players.find(player => player.id === a.playerId).items, undefined);
  assert.equal(view.players.find(player => player.id === a.playerId).itemCount, own.items.length);
  assert.equal(JSON.stringify(view).includes(a.token), false);
  assert.equal(view.tiles.find(tile => !tile.revealed).type, undefined);
});

test('replayed actions cannot advance a later turn or mutate the room', () => {
  const { store, a, b, read, act } = match();
  const original = { type: 'end', expectedVersion: read(a).version };
  store.act(a.roomId, a.token, original);
  act(b, { type: 'end' });
  const before = read(a);
  assert.throws(() => store.act(a.roomId, a.token, original), error => error.status === 409);
  assert.deepEqual(read(a), before);
});

test('forged player state and another player’s card cannot change the match', () => {
  const { a, b, read, act } = match();
  const before = read(a);
  assert.throws(() => act(a, { type: 'end', hp: 99, playerId: b.playerId }), error => error.status === 400);
  assert.throws(() => act(a, { type: 'end', name: '乙' }), error => error.status === 400);
  assert.deepEqual(read(a), before);
  const stolen = read(b).players.find(player => player.id === b.playerId).items[0].id;
  assert.throws(() => act(a, { type: 'item', itemId: stolen }), /没有这张/);
  assert.deepEqual(read(a), before);
});

test('turn, movement and identity remain server-authoritative', () => {
  const { store, a, b, read, act } = match();
  const before = read(a);
  assert.throws(() => act(b, { type: 'move', x: 1, y: 1 }), /轮到你/);
  assert.throws(() => act(a, { type: 'move', x: 7, y: 7 }), /一格/);
  assert.throws(() => store.act(a.roomId, 'fake-token', { type: 'end', expectedVersion: before.version }), error => error.status === 401);
  assert.deepEqual(read(a), before);
});
