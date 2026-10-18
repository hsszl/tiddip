import { WEAPONS } from '../rules.js';
import { requireThat } from './errors.js';
import { pick, record } from './model.js';

export function activateTerrain(room, player) {
  const tile = room.tiles.find(tile => tile.x === player.x && tile.y === player.y);
  requireThat(tile?.type === 'armory', '脚下没有军械库');
  requireThat(!tile.usedBy?.includes(player.id), '这座军械库已经用过');
  const oldWeapon = player.weapon;
  player.weapon = pick(Object.keys(WEAPONS).filter(key => key !== oldWeapon));
  if (player.weapon === 'sniper' && player.sniperSkillUsed) player.skillUsed = true;
  player.hp = Math.min(player.hp, WEAPONS[player.weapon].hp);
  (tile.usedBy ||= []).push(player.id);
  record(room, `${player.name}把${WEAPONS[oldWeapon].name}换成${WEAPONS[player.weapon].name}`, {
    kind: 'terrain', actorId: player.id, terrain: 'armory', position: { x: tile.x, y: tile.y }, weapon: player.weapon, oldWeapon,
  });
}
