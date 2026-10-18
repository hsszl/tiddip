import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from './model.js';
import { spawn, move, land, enterTile } from './movement.js';
import { canAttack, attack } from './combat.js';
import { roomView } from './view.js';

function game() {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  startRoom(room);
  room.tiles.forEach(tile => { tile.type = 'ground'; });
  spawn(room, a, 0, 0); spawn(room, b, 1, 0);
  for (const player of [a, b]) { player.weapon = 'rifle'; player.hp = 4; }
  return { room, a, b, tile: (x, y) => room.tiles[y * 8 + x] };
}

test('blast rejects fog without clearing pending and accepts revealed legal ground', () => {
  const { room, a, tile } = game();
  tile(0, 1).type = 'mine';
  move(room, a, 0, 1);
  assert.throws(() => land(room, a, 7, 7), /翻开/);
  assert.equal(room.pending.playerId, a.id);
  assert.deepEqual([a.x, a.y], [0, 1]);
  land(room, a, 0, 0);
  assert.equal(room.pending, null);
  assert.deepEqual([a.x, a.y], [0, 0]);
});

test('tower reveals four neighbours without triggering them; clinic respects HP cap', () => {
  const { room, a, tile } = game();
  tile(3, 3).type = 'tower'; tile(3, 2).type = 'mine';
  enterTile(room, a, tile(3, 3));
  for (const [x, y] of [[3, 2], [3, 4], [2, 3], [4, 3]]) assert.equal(tile(x, y).revealed, true);
  assert.equal(a.hp, 4);
  assert.equal(tile(3, 2).spent, false);
  tile(4, 4).type = 'clinic';
  enterTile(room, a, tile(4, 4));
  assert.equal(tile(4, 4).spent, false, 'full HP leaves the clinic available');
  a.hp = 3;
  enterTile(room, a, tile(4, 4));
  assert.equal(a.hp, 4);
  assert.equal(tile(4, 4).spent, true);
  a.hp = 2;
  enterTile(room, a, tile(4, 4));
  assert.equal(a.hp, 2);
});

test('bow hits cardinal 1–4; boomerang hits diagonal 1–2, both damage one', () => {
  const { room, a, b } = game();
  a.weapon = 'bow'; b.x = 4; b.y = 0;
  assert.equal(canAttack(a, b), true);
  b.x = 5;
  assert.equal(canAttack(a, b), false);
  a.weapon = 'boomerang'; b.x = b.y = 2;
  assert.equal(canAttack(a, b), true);
  b.y = 0;
  assert.equal(canAttack(a, b), false);
  b.x = b.y = 1;
  attack(room, a, b.id);
  assert.equal(b.hp, 3);
});

test('opponents receive movement coordinates and attack details in the action record', () => {
  const { room, a, b } = game();
  move(room, a, 0, 1);
  const movement = roomView(room, b.id).log.findLast(entry => entry.kind === 'move');
  assert.equal(movement.actorId, a.id);
  assert.deepEqual(movement.from, { x: 0, y: 0 });
  assert.deepEqual(movement.to, { x: 0, y: 1 });
  b.x = 1; b.y = 1;
  attack(room, a, b.id);
  const shot = roomView(room, b.id).log.findLast(entry => entry.kind === 'attack');
  assert.equal(shot.targetId, b.id);
  assert.match(shot.text, /步枪/);
});
