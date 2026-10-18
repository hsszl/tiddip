import { WEAPONS } from '../rules.js';
import { skillInRange, skillMode } from '../range.js';
import { requireThat } from './errors.js';
import { record } from './model.js';
import { attack } from './combat.js';
import { destination, enterTile } from './movement.js';
import { revealTile } from './terrain.js';

export function useWeaponSkill(room, player, action) {
  const weapon = WEAPONS[player.weapon], mode = skillMode(player.weapon);
  requireThat(weapon?.skill && !player.skillUsed && mode !== 'passive', '能力不可用');
  if (mode === 'attack') return attack(room, player, action.targetId, true);
  if (mode === 'move') {
    requireThat(!room.actions.moved, '这回合已经移动过');
    requireThat(skillInRange(player, action), '不在能力范围内');
    const tile = destination(room, player, action.x, action.y);
    const from = { x: player.x, y: player.y };
    player.skillUsed = room.actions.moved = true;
    record(room, `${player.name}使用${weapon.skillName}`, { kind: 'move', actorId: player.id, weapon: player.weapon, skill: true, from, to: { x: tile.x, y: tile.y } });
    enterTile(room, player, tile);
    return;
  }
  if (weapon.skill === 'guard') {
    requireThat(!player.shield, '已有护盾');
    player.shield = true;
  }
  player.skillUsed = true;
  record(room, `${player.name}使用${weapon.skillName}`, { kind: 'skill', actorId: player.id, weapon: player.weapon, position: { x: player.x, y: player.y } });
  if (weapon.skill === 'scout') {
    for (const tile of room.tiles) if (Math.max(Math.abs(tile.x - player.x), Math.abs(tile.y - player.y)) <= 1) revealTile(room, player, tile);
  }
}
