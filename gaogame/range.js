import { WEAPONS } from './rules.js';

export const skillMode = key => WEAPONS[key]?.skillMode || (WEAPONS[key]?.skill === 'closeShot' ? 'attack' : 'passive');

function normalRange(weapon, dx, dy) {
  if (weapon.pattern === 'diagonal') return dx === dy && weapon.ranges.includes(dx);
  if (weapon.pattern === 'adjacent') return weapon.ranges.includes(Math.max(dx, dy));
  if (weapon.pattern === 'manhattan') return weapon.ranges.includes(dx + dy);
  return (dx === 0 || dy === 0) && weapon.ranges.includes(dx + dy);
}

export function attackInRange(attacker, target, skill = false) {
  if (!attacker?.alive || !target?.alive || target.id === attacker.id) return false;
  if (attacker.x === null || target.x === null) return false;
  const weapon = WEAPONS[attacker.weapon];
  if (!weapon) return false;
  const dx = Math.abs(attacker.x - target.x), dy = Math.abs(attacker.y - target.y);
  if (!skill) return normalRange(weapon, dx, dy);
  if (attacker.skillUsed || skillMode(attacker.weapon) !== 'attack') return false;
  if (weapon.skill === 'closeShot') return !attacker.sniperSkillUsed && dx + dy === 0;
  if (weapon.skill === 'closeShell') return dx + dy > 0 && dx + dy <= 2;
  if (weapon.skill === 'suppress') return normalRange(weapon, dx, dy) || dx === 1 && dy === 1;
  return weapon.skill === 'pierce' && normalRange(weapon, dx, dy);
}

export function moveInRange(player, point, extended = false) {
  const dx = Math.abs(player.x - point.x), dy = Math.abs(player.y - point.y);
  return (dx === 0 || dy === 0) && dx + dy > 0 && dx + dy <= (extended ? 2 : 1);
}

export function skillInRange(player, point) {
  if (player.x === null || player.skillUsed) return false;
  const weapon = WEAPONS[player.weapon];
  const dx = Math.abs(player.x - point.x), dy = Math.abs(player.y - point.y);
  if (skillMode(player.weapon) === 'attack') return attackInRange(player, { ...point, id: 'range-preview', alive: true }, true);
  if (weapon?.skill === 'dash') return moveInRange(player, point, true);
  if (weapon?.skill === 'sidestep') return dx === 1 && dy === 1;
  if (weapon?.skill === 'scout') return Math.max(dx, dy) <= 1;
  return weapon?.skill === 'guard' && dx + dy === 0;
}

export function itemInRange(player, point, key) {
  const distance = Math.abs(player.x - point.x) + Math.abs(player.y - point.y);
  if (key === 'teleport') return distance > 0;
  if (key === 'defuse') return distance <= 1 && point.revealed && point.type === 'mine' && !point.spent;
  if (key === 'steal') return distance <= 1;
  return false;
}
