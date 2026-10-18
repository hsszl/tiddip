import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, startRoom } from './model.js';
import { spawn } from './movement.js';
import { applyAction } from './actions.js';
import { canAttack, damage } from './combat.js';
import { runBots } from './bots.js';

function fixture(count = 2) {
  const { room, player: a } = createRoom('ABC123', '甲');
  for (let index = 1; index < count; index++) addPlayer(room, `玩家${index + 1}`);
  startRoom(room);
  room.tiles.forEach(tile => { tile.type = 'ground'; });
  room.players.forEach((player, index) => spawn(room, player, index, 0));
  room.players.forEach(player => { player.weapon = 'rifle'; player.hp = 4; });
  return { room, a, b: room.players[1], tile: (x, y) => room.tiles[y * 8 + x] };
}

test('sniper only hits cardinal distance 2/3; close shot is once and uses attack', () => {
  const { room, a, b } = fixture();
  a.weapon = 'sniper';
  for (const [x, y, valid] of [[0, 0, false], [1, 0, false], [2, 0, true], [3, 0, true], [4, 0, false], [1, 1, false], [0, 3, true]]) {
    b.x = x; b.y = y;
    assert.equal(canAttack(a, b), valid, `${x},${y}`);
  }
  b.x = b.y = 0;
  applyAction(room, a, { type: 'skill', targetId: b.id });
  assert.equal(b.hp, 3);
  assert.equal(a.skillUsed, true);
  assert.throws(() => applyAction(room, a, { type: 'attack', targetId: b.id }));
  applyAction(room, a, { type: 'end' });
  applyAction(room, b, { type: 'end' });
  assert.throws(() => applyAction(room, a, { type: 'skill', targetId: b.id }));
});

test('zero health resolves survival skill, then elimination and winner', () => {
  const { room, a, b } = fixture();
  b.weapon = 'pistol'; b.hp = 1;
  damage(room, b, '测试');
  assert.equal(b.hp, 1);
  assert.equal(b.alive, true);
  assert.equal(b.skillUsed, true);
  damage(room, b, '测试');
  assert.equal(b.alive, false);
  assert.equal(room.phase, 'finished');
  assert.equal(room.winnerId, a.id);
});

test('mine landing belongs to victim, blocks other actions, reveals and chains once', () => {
  const { room, a, b, tile } = fixture();
  tile(0, 1).type = tile(0, 2).type = 'mine';
  tile(0, 2).revealed = true;
  applyAction(room, a, { type: 'move', x: 0, y: 1 });
  assert.equal(a.hp, 3);
  assert.equal(tile(0, 1).revealed, true);
  assert.equal(room.pending.playerId, a.id);
  assert.throws(() => applyAction(room, b, { type: 'land', x: 0, y: 3 }));
  assert.throws(() => applyAction(room, a, { type: 'end' }));
  applyAction(room, a, { type: 'land', x: 0, y: 2 });
  assert.equal(a.hp, 2);
  assert.equal(room.pending.playerId, a.id);
  applyAction(room, a, { type: 'land', x: 0, y: 1 });
  assert.equal(a.hp, 2);
  assert.equal(room.pending, null);
  assert.equal(room.actions.moved, true);
});

test('blocked toilet and invalid item do not consume actions or cards', () => {
  const { room, a, b, tile } = fixture();
  tile(1, 0).type = 'toilet';
  assert.throws(() => applyAction(room, a, { type: 'move', x: 1, y: 0 }));
  assert.equal(a.x, 0);
  assert.equal(room.actions.moved, false);
  a.items = [{ id: 'heal', key: 'medkit' }, { id: 'shield', key: 'shield' }];
  assert.throws(() => applyAction(room, a, { type: 'item', itemId: 'heal' }));
  assert.equal(a.items.length, 2);
  a.hp = 2;
  applyAction(room, a, { type: 'item', itemId: 'heal' });
  assert.equal(a.hp, 3);
  assert.equal(a.items.length, 1);
  applyAction(room, a, { type: 'item', itemId: 'shield' });
  assert.equal(a.shield, true);
  applyAction(room, a, { type: 'attack', targetId: b.id });
  assert.equal(b.hp, 3);
});

test('several held items can be used in one turn without exceeding weapon HP', () => {
  for (const [weapon, maxHp] of [['pistol', 3], ['rifle', 4], ['sniper', 5]]) {
    const { room, a, b } = fixture();
    a.weapon = weapon;
    a.hp = maxHp - 2;
    a.items = [
      { id: 'heal-1', key: 'medkit' }, { id: 'heal-2', key: 'medkit' },
      { id: 'heal-3', key: 'medkit' }, { id: 'shield', key: 'shield' },
    ];
    applyAction(room, a, { type: 'item', itemId: 'heal-1' });
    applyAction(room, a, { type: 'item', itemId: 'heal-2' });
    assert.equal(a.hp, maxHp);
    assert.throws(() => applyAction(room, a, { type: 'item', itemId: 'heal-3' }), /满血/);
    assert.equal(a.hp, maxHp);
    assert.equal(a.items.some(item => item.id === 'heal-3'), true);
    applyAction(room, a, { type: 'item', itemId: 'shield' });
    assert.equal(a.shield, true);
    assert.throws(() => applyAction(room, b, { type: 'item', itemId: b.items[0].id }), /轮到你/);
    applyAction(room, a, { type: 'move', x: 0, y: 1 });
    assert.equal(room.actions.moved, true);
  }
});

test('terrain is present in every map; birth reveals it but entry applies the effect', () => {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  applyAction(room, a, { type: 'start' });
  for (const [type, count] of [['mine', 8], ['toilet', 5], ['supply', 6], ['clinic', 4], ['tower', 3], ['brambles', 5], ['camp', 3], ['ruins', 3], ['armory', 3]]) {
    assert.equal(room.tiles.filter(tile => tile.type === type).length, count);
  }
  const supply = room.tiles.find(tile => tile.type === 'supply');
  applyAction(room, a, { type: 'spawn', x: supply.x, y: supply.y });
  applyAction(room, b, { type: 'spawn', x: 0, y: 0 });
  assert.equal(supply.revealed, true);
  assert.equal(supply.spent, false);
  a.items = [{ id: 'warp-1', key: 'teleport' }, { id: 'warp-2', key: 'teleport' }];
  applyAction(room, a, { type: 'item', itemId: 'warp-1', x: 0, y: 1 });
  applyAction(room, a, { type: 'item', itemId: 'warp-2', x: supply.x, y: supply.y });
  assert.equal(supply.spent, true);
  assert.equal(a.items.length, 1, 'supply draws an item on entering');
});

test('shield blocks one hit; teleport reveals destination and can trigger mine', () => {
  const { room, a, tile } = fixture();
  a.shield = true;
  damage(room, a, '测试');
  assert.equal(a.hp, 4);
  assert.equal(a.shield, false);
  a.items = [{ id: 'warp', key: 'teleport' }];
  tile(7, 7).type = 'mine';
  applyAction(room, a, { type: 'item', itemId: 'warp', x: 7, y: 7 });
  assert.equal(a.hp, 3);
  assert.equal(tile(7, 7).revealed, true);
  assert.equal(room.pending.playerId, a.id);
  assert.equal(room.actions.moved, false);
});

test('a bot killed by a chain mine cannot attack after dying', () => {
  const { room, a, b, tile } = fixture(3);
  a.x = 0; a.y = 0;
  b.isBot = true; b.weapon = 'sniper'; b.hp = 2; b.items = [];
  b.x = 3; b.y = 3;
  room.players[2].x = 7; room.players[2].y = 7;
  room.turn = 1;
  tile(3, 2).type = tile(2, 3).type = tile(0, 0).type = 'mine';
  const hp = a.hp;
  runBots(room);
  assert.equal(b.alive, false);
  assert.equal(a.hp, hp, 'dead bot must not fire a close shot');
});

test('leaving during spawn does not stall others or require departed player on restart', () => {
  const { room, a, b } = fixture(3);
  room.phase = 'spawn';
  b.x = b.y = null;
  applyAction(room, b, { type: 'leave' });
  assert.equal(room.phase, 'playing');
  room.phase = 'finished';
  applyAction(room, a, { type: 'restart' });
  assert.equal(room.players.length, 2);
  assert.equal(room.players.some(player => player.id === b.id), false);
});

test('five computer opponents have distinct legal birth positions', () => {
  const { room, player } = createRoom('ABC123', '甲');
  for (let index = 0; index < 5; index++) applyAction(room, player, { type: 'addBot' });
  applyAction(room, player, { type: 'start' });
  const bots = room.players.filter(player => player.isBot);
  assert.equal(new Set(bots.map(bot => `${bot.x},${bot.y}`)).size, 5);
});

test('sniper computer steps back into range after its close shot is spent', () => {
  const { room, a, b } = fixture();
  a.x = 0; a.y = 0;
  b.isBot = true; b.weapon = 'sniper'; b.skillUsed = true;
  b.x = 1; b.y = 0; b.items = [];
  room.turn = 1;
  runBots(room);
  assert.equal(a.hp, 3);
});

test('departed first player is skipped when others finish selecting birth tiles', () => {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  const c = addPlayer(room, '丙');
  applyAction(room, a, { type: 'start' });
  applyAction(room, a, { type: 'leave' });
  applyAction(room, b, { type: 'spawn', x: 0, y: 0 });
  applyAction(room, c, { type: 'spawn', x: 1, y: 0 });
  assert.equal(room.phase, 'playing');
  assert.equal(room.players[room.turn].id, b.id);
  assert.doesNotThrow(() => applyAction(room, b, { type: 'end' }));
});

test('last player wins if the other player leaves during setup', () => {
  const { room, player: a } = createRoom('ABC123', '甲');
  const b = addPlayer(room, '乙');
  applyAction(room, a, { type: 'start' });
  applyAction(room, a, { type: 'leave' });
  applyAction(room, b, { type: 'spawn', x: 0, y: 0 });
  assert.equal(room.phase, 'finished');
  assert.equal(room.winnerId, b.id);
});
