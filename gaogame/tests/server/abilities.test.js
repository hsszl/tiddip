import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from '../../server/model.js';
import { spawn } from '../../server/movement.js';
import { applyAction } from '../../server/actions.js';
import { canAttack } from '../../server/combat.js';
import { roomView } from '../../server/view.js';

function game() {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  startRoom(room);
  room.tiles.forEach(tile => { tile.type = 'ground'; });
  spawn(room, a, 0, 0); spawn(room, b, 1, 0);
  for (const p of [a, b]) { p.weapon = 'rifle'; p.hp = 4; p.items = []; }
  return { room, a, b };
}

test('opponents see hand count, never card types or IDs', () => {
  const { room, a, b } = game();
  a.items = [{ id: 'secret-card', key: 'ammo' }];
  const other = roomView(room, b.id).players.find(p => p.id === a.id);
  assert.equal(other.itemCount, 1);
  assert.equal(other.items, undefined);
  assert.equal(JSON.stringify(other).includes('ammo'), false);
});

test('revolver hits one diagonal but not distant tiles', () => {
  const { a, b } = game(); a.weapon = 'revolver';
  b.x = b.y = 1; assert.equal(canAttack(a, b), true);
  b.x = b.y = 2; assert.equal(canAttack(a, b), false);
  b.x = b.y = 0; assert.equal(canAttack(a, b), false);
});

test('dagger dash consumes the move and skill without granting an extra move', () => {
  const { room, a } = game(); a.weapon = 'dagger';
  applyAction(room, a, { type: 'skill', x: 0, y: 2 });
  assert.deepEqual([a.x, a.y, a.skillUsed, room.actions.moved], [0, 2, true, true]);
  assert.throws(() => applyAction(room, a, { type: 'move', x: 0, y: 3 }));
});

test('crossbow pierces one shield with one damage and spends the attack', () => {
  const { room, a, b } = game(); a.weapon = 'crossbow'; b.x = 2; b.shield = true;
  applyAction(room, a, { type: 'skill', targetId: b.id });
  assert.equal(b.hp, 3); assert.equal(b.shield, false);
  assert.equal(a.skillUsed, true); assert.equal(room.actions.attacked, true);
});

test('armory is manual and each visitor can use the same tile once', () => {
  const { room, a, b } = game(); room.tiles[0].type = 'armory';
  const weapon = a.weapon;
  applyAction(room, a, { type: 'terrain' });
  assert.notEqual(a.weapon, weapon); assert.equal(room.tiles[0].spent, false);
  assert.throws(() => applyAction(room, a, { type: 'terrain' }));
  applyAction(room, a, { type: 'end' });
  b.x = 0; b.y = 0;
  assert.doesNotThrow(() => applyAction(room, b, { type: 'terrain' }));
  assert.equal(roomView(room, a.id).tiles[0].usedByMe, true);
});

test('new items respect movement, skill, hand and fog constraints', () => {
  const { room, a, b } = game();
  a.skillUsed = true; a.weapon = 'axe';
  a.items = ['ammo', 'sprint', 'radar', 'steal', 'defuse'].map(key => ({ id: key, key }));
  b.items = [{ id: 'stolen-secret', key: 'shield' }];
  applyAction(room, a, { type: 'item', itemId: 'ammo' }); assert.equal(a.skillUsed, false);
  applyAction(room, a, { type: 'item', itemId: 'steal', targetId: b.id });
  assert.equal(b.items.length, 0); assert.equal(a.items.at(-1).key, 'shield');
  applyAction(room, a, { type: 'item', itemId: 'radar' }); assert.equal(room.tiles[9].revealed, true);
  room.tiles[8].type = 'mine';
  applyAction(room, a, { type: 'item', itemId: 'defuse', x: 0, y: 1 }); assert.equal(room.tiles[8].spent, true);
  applyAction(room, a, { type: 'item', itemId: 'sprint' });
  applyAction(room, a, { type: 'move', x: 0, y: 2 }); assert.equal(a.y, 2);
  assert.equal(room.actions.moved, true);
});

test('sniper close shot cannot be restored by ammunition or a flag reset without an armory', () => {
  const { room, a, b } = game(); a.weapon = 'sniper'; b.x = 0;
  applyAction(room, a, { type: 'skill', targetId: b.id });
  a.items = [{ id: 'ammo', key: 'ammo' }];
  assert.throws(() => applyAction(room, a, { type: 'item', itemId: 'ammo' }), /不能补充/);
  assert.equal(a.items.length, 1);
  // Only the armory may explicitly reset the persistent close-shot flag.
  a.skillUsed = false;
  assert.equal(canAttack(a, b, true), false);
});
