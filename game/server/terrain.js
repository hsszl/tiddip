import { RULES, TERRAIN, WEAPONS } from '../rules.js';
import { damage } from './combat.js';
import { newItem, record } from './model.js';

const position = tile => ({ x: tile.x, y: tile.y });

export function revealTile(room, player, tile) {
  if (tile.revealed) return;
  tile.revealed = true;
  record(room, `${player.name}翻开 ${tile.x + 1},${tile.y + 1}：${TERRAIN[tile.type].name}`, {
    kind: 'reveal', actorId: player.id, terrain: tile.type, position: position(tile),
  });
}

export function resolveTerrain(room, player, tile) {
  if (tile.spent) return;
  const details = { kind: 'terrain', actorId: player.id, terrain: tile.type, position: position(tile) };
  if (tile.type === 'mine') {
    tile.spent = true;
    const blocked = player.shield, skillWasUsed = player.skillUsed;
    damage(room, player, '地雷伤害');
    if (player.alive && room.phase === 'playing') {
      room.pending = { kind: 'blast', playerId: player.id };
    }
    record(room, `${player.name}踩中地雷${blocked ? '，护盾挡住伤害' : '，损失 1 血'}${!player.alive ? '，被淘汰' : room.pending ? '，需选择一个已翻开的落点' : ''}`, {
      ...details, outcome: blocked ? 'blocked' : !player.alive ? 'eliminated' : !skillWasUsed && player.skillUsed ? 'revived' : 'hit',
    });
  } else if (tile.type === 'supply') {
    tile.spent = true;
    if (player.items.length < RULES.maxHand) {
      player.items.push(newItem());
      record(room, `${player.name}从补给获得一张道具牌`, { ...details, count: 1 });
    } else record(room, `${player.name}的手牌已满，补给消耗`, { ...details, count: 0 });
  } else if (tile.type === 'clinic') {
    const maximum = WEAPONS[player.weapon].hp;
    if (player.hp >= maximum) {
      record(room, `${player.name}已满血，医疗站保留`, { ...details, gained: false });
    } else {
      player.hp = Math.min(maximum, player.hp + 1);
      tile.spent = true;
      record(room, `${player.name}在医疗站回复 1 血（${player.hp}/${maximum}）`, { ...details, gained: true });
    }
  } else if (tile.type === 'brambles') {
    const blocked = player.shield, skillWasUsed = player.skillUsed;
    damage(room, player, '荆棘伤害');
    record(room, `${player.name}穿过荆棘地${blocked ? '，护盾挡住伤害' : '，损失 1 血'}`, {
      ...details, outcome: blocked ? 'blocked' : !player.alive ? 'eliminated' : !skillWasUsed && player.skillUsed ? 'revived' : 'hit',
    });
  } else if (tile.type === 'camp') {
    if (player.shield) record(room, `${player.name}已有护盾，营地保留`, { ...details, gained: false });
    else {
      player.shield = tile.spent = true;
      record(room, `${player.name}在营地获得护盾`, { ...details, gained: true });
    }
  } else if (tile.type === 'ruins') {
    const count = Math.min(2, RULES.maxHand - player.items.length);
    if (count > 0) {
      player.items.push(...Array.from({ length: count }, newItem));
      tile.spent = true;
    }
    record(room, count ? `${player.name}从遗迹获得 ${count} 张道具牌` : `${player.name}手牌已满，遗迹保留`, { ...details, count });
  } else if (tile.type === 'tower') {
    tile.spent = true;
    record(room, `${player.name}登上瞭望塔，翻开相邻四格`, details);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const x = tile.x + dx, y = tile.y + dy;
      if (x >= 0 && y >= 0 && x < RULES.size && y < RULES.size) {
        revealTile(room, player, room.tiles[y * RULES.size + x]);
      }
    }
  }
}
