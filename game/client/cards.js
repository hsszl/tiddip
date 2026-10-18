import { WEAPONS, ITEMS } from '/game/rules.js';
import { escapeHTML as e, hearts } from './helpers.js';
import { icon } from './icons.js';

const weaponColors = { sniper: '#64889d', rifle: '#718b75', pistol: '#9d7c77', bow: '#9b915e', boomerang: '#a88b59', dagger: '#9a7dab', axe: '#b37d64', crossbow: '#648e8e', mortar: '#7e859b', revolver: '#b88b55' };

export function itemBlocked(item, player, actions = {}) {
  return item.key === 'medkit' && player.hp === player.maxHp ? '已满血'
    : item.key === 'shield' && player.shield ? '已有护盾'
    : item.key === 'ammo' && player.weapon === 'sniper' ? '狙击枪不可用'
    : item.key === 'ammo' && !player.skillUsed ? '能力未使用'
    : item.key === 'sprint' && (actions.moved || actions.sprint) ? '本回合不能疾跑' : '';
}

function artwork(category, key) {
  return `<span class="card-art"><img src="/game/client/assets/${category}/${key}.svg" alt="" draggable="false"></span>`;
}

function description(category, key) {
  return `<button class="card-info" data-card-info="${category}:${key}" aria-label="查看卡牌效果">${icon('info')}</button>`;
}

export function weaponCard(player) {
  const weapon = WEAPONS[player.weapon];
  return `<article class="game-card weapon-card" style="--card-accent:${weaponColors[player.weapon]}" data-card-kind="weapons" data-card-key="${player.weapon}" data-card-used="${player.skillUsed}" tabindex="0" aria-label="装备：${e(weapon.name)}">
    ${artwork('weapons', player.weapon)}
    <div class="card-body"><h2>${e(weapon.name)}</h2><span class="weapon-damage" title="伤害" aria-label="伤害 ${weapon.damage ?? 1}">${icon('damage')}${weapon.damage ?? 1}</span>${hearts(player)}</div>
    ${weapon.skill ? `<span class="skill-tag ${player.skillUsed ? 'used' : ''}" title="军械库可恢复技能">${icon('skill')}${e(weapon.skillName)}${player.skillUsed ? ' · 已用' : ''}</span>` : ''}
    ${description('weapons', player.weapon)}
  </article>`;
}

export function itemCard(item, usable, selected, player, actions) {
  const blocked = itemBlocked(item, player, actions);
  const reason = !usable ? '等待回合' : blocked || (selected ? '选择目标' : '使用');
  return `<div class="card-slot" data-card-kind="items" data-card-key="${item.key}" data-card-note="${reason}" ${!usable || blocked ? 'tabindex="0"' : ''}><button class="game-card item ${selected ? 'selected' : ''}" style="--card-accent:${ITEMS[item.key].color}" data-item="${item.id}" ${!usable || blocked ? 'disabled' : ''} aria-label="${e(ITEMS[item.key].name)}：${reason}">
    ${artwork('items', item.key)}
    <span class="card-body"><strong>${e(ITEMS[item.key].name)}</strong><small>${e(ITEMS[item.key].description)}</small></span>
    ${blocked || selected ? `<span class="card-bottom">${reason}</span>` : ''}
  </button></div>`;
}
