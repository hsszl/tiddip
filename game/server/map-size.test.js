import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from './rooms.js';
import { createRoom, addPlayer, startRoom } from './model.js';
import { destination, enterTile } from './movement.js';
import { roomView } from './view.js';

function lobby() {
  const store = createRoomStore();
  const host = store.create('房主'), guest = store.join(host.roomId, '玩家');
  const read = () => store.read(host.roomId, host.token);
  const act = (session, action) => store.act(host.roomId, session.token, { expectedVersion: read().version, ...action });
  return { host, guest, read, act };
}

test('rectangular dimensions determine the actual map and persist when starting', () => {
  const { host, read, act } = lobby();
  act(host, { type: 'resize', width: 6, height: 10 });
  const preview = read();
  assert.equal(preview.width, 6); assert.equal(preview.height, 10);
  assert.equal(preview.tiles.length, 60);
  assert.deepEqual(preview.tiles.at(-1), { x: 5, y: 9, revealed: false });
  act(host, { type: 'start' });
  act(host, { type: 'spawn', x: 5, y: 9 });
  assert.equal(read().players.find(p => p.id === host.playerId).y, 9);
  assert.equal(read().tiles.length, 60);
});

test('only the host can resize in the lobby and malformed sizes leave the room unchanged', () => {
  const { host, guest, read, act } = lobby();
  const before = read();
  assert.throws(() => act(guest, { type: 'resize', width: 6, height: 10 }), e => e.status === 403);
  for (const [width, height] of [[3, 8], [8, 17], [6.5, 8], ['6', 8], [null, 8]]) {
    assert.throws(() => act(host, { type: 'resize', width, height }), e => e.status === 400);
  }
  assert.deepEqual(read(), before);
  act(host, { type: 'start' });
  assert.throws(() => act(host, { type: 'resize', width: 6, height: 10 }), /开始后/);
});

test('the smallest map supports five bots without out-of-bounds or overlapping spawns', () => {
  const store = createRoomStore(), host = store.create('房主');
  const act = action => store.act(host.roomId, host.token, {
    expectedVersion: store.read(host.roomId, host.token).version, ...action,
  });
  act({ type: 'resize', width: 4, height: 4 });
  for (let i = 0; i < 5; i++) act({ type: 'addBot' });
  const view = act({ type: 'start' });
  assert.equal(view.tiles.length, 16);
  const bots = view.players.filter(p => p.isBot);
  assert.equal(new Set(bots.map(p => `${p.x},${p.y}`)).size, 5);
  assert.ok(bots.every(p => p.x >= 0 && p.x < 4 && p.y >= 0 && p.y < 4));
});

test('rectangular edge movement and tower reveal use row width, not a square stride', () => {
  const { room, player } = createRoom('ABC123', '甲');
  room.width = 4; room.height = 9;
  addPlayer(room, '乙'); startRoom(room);
  const edge = destination(room, player, 3, 8);
  assert.equal(edge.x, 3); assert.equal(edge.y, 8);
  assert.throws(() => destination(room, player, 4, 8));
  assert.throws(() => destination(room, player, 3, 9));
  edge.type = 'tower';
  enterTile(room, player, edge);
  const revealed = room.tiles.filter(t => t.revealed).map(t => `${t.x},${t.y}`).sort();
  assert.deepEqual(revealed, ['2,8', '3,7', '3,8']);
});

test('legacy rooms without dimensions remain 8 by 8 when viewed and restarted', () => {
  const { room, player } = createRoom('ABC123', '甲');
  delete room.width; delete room.height;
  addPlayer(room, '乙'); startRoom(room);
  const view = roomView(room, player.id);
  assert.equal(view.width, 8); assert.equal(view.height, 8);
  assert.equal(destination(room, player, 7, 7).x, 7);
});
