import { WEAPONS, RULES } from '../rules.js';
import { requireThat } from './errors.js';
import { record, newItem } from './model.js';
import { checkVictory } from './turns.js';
import { attackInRange } from '../range.js';

export const canAttack = attackInRange;

export function damage(room, player, cause) {
  if (player.shield) {
    player.shield = false;
    record(room, `${player.name}的护盾挡住了${cause}`, { kind: 'shield', actorId: player.id, position: { x: player.x, y: player.y } });
    return;
  }
  player.hp = Math.max(0, player.hp - 1);
  record(room, `${player.name}受到${cause}，损失 1 血（剩 ${player.hp}）`, {
    kind: 'damage', actorId: player.id, amount: 1, position: { x: player.x, y: player.y },
  });
  if (player.hp > 0) return;
  if (WEAPONS[player.weapon].skill === 'revive' && !player.skillUsed) {
    player.skillUsed = true;
    player.hp = 1;
    record(room, `${player.name}触发急救，恢复 1 血`, { kind: 'revived', actorId: player.id, position: { x: player.x, y: player.y } });
  } else {
    player.alive = false;
    if (room.pending?.playerId === player.id) room.pending = null;
    record(room, `${player.name}被淘汰`, { kind: 'eliminated', actorId: player.id, position: { x: player.x, y: player.y }, weapon: player.weapon });
    checkVictory(room);
  }
}

export function attack(room, player, targetId, skill = false) {
  requireThat(!room.actions.attacked, '这回合已经攻击过');
  const target = room.players.find(item => item.id === targetId);
  requireThat(canAttack(player, target, skill), skill ? '能力不可用，或目标不在范围内' : '目标不在攻击范围内');
  room.actions.attacked = true;
  if (skill) player.skillUsed = true;
  if (skill && player.weapon === 'sniper') player.sniperSkillUsed = true;
  const pierced = skill && WEAPONS[player.weapon].skill === 'pierce' && target.shield;
  if (pierced) target.shield = false;
  const blocked = target.shield, skillWasUsed = target.skillUsed;
  const event = record(room, `${player.name}用${WEAPONS[player.weapon].name}${skill ? WEAPONS[player.weapon].skillName : '攻击'}${target.name}（${target.x + 1},${target.y + 1}）`, {
    kind: 'attack', actorId: player.id, targetId: target.id, weapon: player.weapon,
    skill, pierced, from: { x: player.x, y: player.y }, to: { x: target.x, y: target.y },
  });
  damage(room, target, `${player.name}的攻击`);
  event.outcome = blocked ? 'blocked' : !target.alive ? 'eliminated' : !skillWasUsed && target.skillUsed ? 'revived' : 'hit';
  event.text += { blocked: '，护盾挡住', eliminated: '，击杀', revived: '，触发急救', hit: '，损失 1 血' }[event.outcome];
  if (!blocked && WEAPONS[player.weapon].skill === 'loot' && !player.skillUsed && player.items.length < RULES.maxHand) {
    player.skillUsed = true;
    player.items.push(newItem());
    record(room, `${player.name}回收一张道具`, { kind: 'skill', actorId: player.id, weapon: player.weapon, position: { x: player.x, y: player.y } });
  }
}
