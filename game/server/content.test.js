import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from './model.js';
import { enterTile, spawn } from './movement.js';
import { attack, canAttack } from './combat.js';
import { runBots } from './bots.js';
import { activateTerrain } from './armory.js';

function game() {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  startRoom(room);
  room.tiles.forEach(tile => { tile.type = 'ground'; });
  spawn(room, a, 0, 0); spawn(room, b, 1, 0);
  for (const player of [a, b]) { player.weapon = 'rifle'; player.hp = 4; player.items = []; }
  return { room, a, b, tile: room.tiles[8] };
}

test('new weapons enforce same-cell, adjacent, distant-line and Manhattan rings', () => {
  const { a, b } = game();
  for (const [weapon, positions] of Object.entries({
    dagger: [[0, 0, true], [1, 0, false]],
    axe: [[0, 0, true], [1, 1, true], [2, 0, false]],
    crossbow: [[1, 0, false], [2, 0, true], [0, 4, true], [1, 1, false], [5, 0, false]],
    mortar: [[3, 0, true], [2, 1, true], [1, 2, true], [1, 1, false], [2, 2, false]],
  })) {
    a.weapon = weapon;
    for (const [x, y, valid] of positions) {
      b.x = x; b.y = y;
      assert.equal(canAttack(a, b), valid, `${weapon} at ${x},${y}`);
    }
  }
});

test('brambles repeat, consume a shield and resolve pistol survival', () => {
  const { room, a, tile } = game();
  tile.type = 'brambles'; a.weapon = 'pistol'; a.hp = 1; a.shield = true;
  enterTile(room, a, tile);
  assert.equal(a.hp, 1); assert.equal(a.shield, false);
  enterTile(room, a, tile);
  assert.equal(a.hp, 1); assert.equal(a.skillUsed, true);
  assert.equal(room.log.findLast(entry => entry.kind === 'terrain').outcome, 'revived');
  enterTile(room, a, tile);
  assert.equal(a.alive, false); assert.equal(room.phase, 'finished');
  assert.equal(tile.spent, false);
});

test('camp and ruins preserve unused effects and never stack shield or overflow hand', () => {
  const { room, a, tile } = game();
  tile.type = 'camp'; a.shield = true;
  enterTile(room, a, tile); assert.equal(tile.spent, false);
  a.shield = false;
  enterTile(room, a, tile); assert.equal(a.shield, true); assert.equal(tile.spent, true);
  tile.type = 'ruins'; tile.spent = false;
  a.items = Array.from({ length: 5 }, (_, index) => ({ id: String(index), key: 'shield' }));
  enterTile(room, a, tile); assert.equal(tile.spent, false); assert.equal(a.items.length, 5);
  a.items.splice(0, 2);
  enterTile(room, a, tile); assert.equal(a.items.length, 5); assert.equal(tile.spent, true);
  a.items.pop(); enterTile(room, a, tile); assert.equal(a.items.length, 4);
});

test('armory changes weapon once, clamps HP and does not restore spent skills', context => {
  const { room, a, tile } = game();
  tile.type = 'armory'; a.weapon = 'sniper'; a.hp = 5; a.skillUsed = true;
  context.mock.method(Math, 'random', () => 0);
  enterTile(room, a, tile);
  assert.equal(a.weapon, 'sniper');
  activateTerrain(room, a);
  assert.equal(a.weapon, 'rifle'); assert.equal(a.hp, 4); assert.equal(a.skillUsed, true);
  enterTile(room, a, tile); assert.equal(a.weapon, 'rifle'); assert.equal(tile.spent, false);
  assert.throws(() => activateTerrain(room, a));
});

test('image feed distinguishes blocked hits, revival and elimination', () => {
  const { room, a, b } = game();
  b.shield = true;
  attack(room, a, b.id);
  assert.equal(room.log.findLast(entry => entry.kind === 'attack').outcome, 'blocked');
  room.actions.attacked = false; b.weapon = 'pistol'; b.hp = 1;
  attack(room, a, b.id);
  assert.equal(room.log.findLast(entry => entry.kind === 'attack').outcome, 'revived');
  room.actions.attacked = false;
  attack(room, a, b.id);
  const event = room.log.findLast(entry => entry.kind === 'attack');
  assert.equal(event.outcome, 'eliminated'); assert.equal(event.weapon, 'rifle');
});

test('mortar bot moves into its firing ring instead of closing to melee', () => {
  const { room, a, b } = game();
  a.x = 0; a.y = 0; b.x = 2; b.y = 0;
  b.isBot = true; b.weapon = 'mortar'; room.turn = 1;
  runBots(room);
  assert.equal(a.hp, 3);
});
