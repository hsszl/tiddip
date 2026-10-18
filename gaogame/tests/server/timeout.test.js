import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from '../../server/model.js';
import { spawn, move } from '../../server/movement.js';
import { expireTurn } from '../../server/timeout.js';

function mineFixture() {
  const { room, player } = createRoom('ABC123', '甲');
  const other = addPlayer(room, '乙');
  room.now = () => 100;
  startRoom(room); player.weapon = other.weapon = 'sniper'; player.hp = other.hp = 5;
  spawn(room, player, 0, 0); spawn(room, other, 1, 0);
  room.tiles[8].type = 'mine';
  move(room, player, 0, 1);
  room.now = () => 30100;
  return { room, player, other };
}

test('mine timeout lands only on revealed legal ground before changing turn', () => {
  const { room, player, other } = mineFixture();
  assert.equal(expireTurn(room, 30100), true);
  assert.equal(room.pending, null); assert.equal(room.players[room.turn].id, other.id);
  assert.equal(player.x, 0); assert.equal(player.y, 0); assert.equal(player.hp, 4);
  assert.equal(room.turnEndsAt, 60100);
});

test('no legal mine landing does not reveal fog or freeze the turn', () => {
  const { room, player, other } = mineFixture();
  for (const tile of room.tiles) tile.revealed = tile.y === 1 && tile.x === 0;
  assert.equal(expireTurn(room, 30100), true);
  assert.equal(room.pending, null); assert.equal(player.y, 1);
  assert.equal(room.players[room.turn].id, other.id);
  assert.equal(room.tiles.filter(tile => tile.revealed).length, 1);
});
