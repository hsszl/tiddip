import { WEAPONS, ITEMS, RULES } from '../rules.js';
import { itemInRange } from '../range.js';
import { requireThat } from './errors.js';
import { destination, enterTile } from './movement.js';
import { revealTile } from './terrain.js';
import { pick, record } from './model.js';

export function useItem(room, player, itemId, x, y, targetId) {
  const index = player.items.findIndex(item => item.id === itemId);
  requireThat(index >= 0, '没有这张道具牌', 400);
  const item = player.items[index], key = item.key;
  requireThat(ITEMS[key], '道具不存在', 400);
  let tile, target;
  if (key === 'medkit') requireThat(player.hp < WEAPONS[player.weapon].hp, '当前已经满血');
  if (key === 'shield') requireThat(!player.shield, '已经有护盾了');
  if (key === 'sprint') requireThat(!room.actions.moved && !room.actions.sprint, '本回合不能再疾跑');
  if (key === 'ammo') {
    requireThat(player.weapon !== 'sniper', '狙击枪能力不能补充');
    requireThat(WEAPONS[player.weapon].skill && player.skillUsed, '武器能力尚未用过');
  }
  if (ITEMS[key].target === 'cell') {
    tile = destination(room, player, x, y);
    requireThat(itemInRange(player, tile, key), '不是合法的道具目标');
  }
  if (key === 'steal') {
    target = room.players.find(p => p.id === targetId && p.id !== player.id && p.alive);
    requireThat(target && itemInRange(player, target, key) && target.items.length, '附近没有持牌对手');
    requireThat(player.items.length <= RULES.maxHand, '手牌已满');
  }
  player.items.splice(index, 1);
  if (key === 'medkit') player.hp = Math.min(WEAPONS[player.weapon].hp, player.hp + 1);
  if (key === 'shield') player.shield = true;
  if (key === 'sprint') room.actions.sprint = true;
  if (key === 'ammo') player.skillUsed = false;
  if (key === 'defuse') tile.spent = true;
  if (key === 'steal') {
    const stolen = pick(target.items);
    target.items.splice(target.items.indexOf(stolen), 1);
    player.items.push(stolen);
  }
  const from = { x: player.x, y: player.y };
  record(room, `${player.name}使用${ITEMS[key].name}${target ? `，从${target.name}摸走一张牌` : ''}`, {
    kind: key === 'teleport' ? 'teleport' : 'item', actorId: player.id, item: key,
    position: tile ? { x: tile.x, y: tile.y } : from,
    ...(target ? { targetId: target.id } : {}),
    ...(key === 'teleport' ? { from, to: { x, y } } : {}),
  });
  if (key === 'teleport') enterTile(room, player, tile);
  if (key === 'radar') for (const nearby of room.tiles) {
    if (Math.max(Math.abs(nearby.x - player.x), Math.abs(nearby.y - player.y)) <= 1) revealTile(room, player, nearby);
  }
}
