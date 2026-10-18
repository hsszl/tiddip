import { WEAPONS, ITEMS } from '/game/rules.js';
import { skillMode } from '/game/range.js';
import { escapeHTML as e, hearts, myTurn } from './helpers.js';
import { weaponCard, itemCard } from './cards.js';
import { icon } from './icons.js';

export function status(state, me, mode) {
  if (state.phase === 'lobby') return '等待开始';
  if (state.phase === 'spawn') return me.x === null ? '选择出生点' : '等待其他玩家';
  if (state.phase === 'finished') return `${state.players.find(player => player.id === state.winnerId)?.name || '无人'}获胜`;
  if (!me.alive) return '观战';
  if (!myTurn(state, me)) return `${state.players.find(player => player.id === state.currentPlayerId)?.name}的回合`;
  if (state.pending) return '选一个已翻开的格子落地';
  return { move: '选择位置', attack: '选择目标', skill: `选择${WEAPONS[me.weapon].skillName}目标`, 'item-cell': '选择位置', 'item-player': '选择对手' }[mode.type] || '你的回合';
}

export function playersPanel(state, me) {
  return `<ol class="players">${state.players.map((player, index) => `<li data-player-id="${player.id}" class="player ${player.alive ? '' : 'dead'} ${state.currentPlayerId === player.id ? 'current' : ''}">
    <span class="player-number" style="--player:${player.color}">${index + 1}</span>
    <div class="player-detail"><div class="player-name">${e(player.name)}${player.id === me.id ? '<span class="quiet"> · 你</span>' : ''}${player.isBot ? `<span title="电脑" aria-label="电脑">${icon('bot')}</span>` : ''}${player.shield ? `<span title="护盾" aria-label="护盾">${icon('shield')}</span>` : ''}${!player.alive ? '<span class="quiet"> · 淘汰</span>' : ''}</div>${hearts(player)}
      <span class="hidden-hand" aria-label="${e(player.name)}有 ${player.itemCount} 张手牌">${icon('bag')}${player.itemCount}</span>
    </div>
    ${player.weapon ? `<button class="mini-card weapon-preview" data-card-kind="weapons" data-card-key="${player.weapon}" data-card-used="${player.skillUsed}" data-card-info="weapons:${player.weapon}" aria-label="${e(WEAPONS[player.weapon].name)}"><img class="player-weapon" src="/game/client/assets/weapons/${player.weapon}.svg" alt=""></button>` : ''}
  </li>`).join('')}</ol>`;
}

export function controls(state, me, mode) {
  const host = state.hostId === me.id;
  if (state.phase === 'lobby') return `<div class="lobby-controls"><p>${state.players.length} / 6 人</p>${host
    ? `<button data-action="addBot" ${state.players.length >= 6 ? 'disabled' : ''}>添加电脑</button><button class="primary" data-action="start" ${state.players.length < 2 ? 'disabled' : ''}>开始</button>`
    : '<span class="quiet">等待房主开始</span>'}</div>`;
  if (state.phase === 'finished') {
    const winner = state.players.find(player => player.id === state.winnerId);
    return `<div class="result-panel"><strong>${icon('trophy')}${winner ? `${e(winner.name)}获胜` : '平局'}</strong><div>${host ? '<button data-action="restart">重新开始</button>' : ''}<button data-action="leave">退出房间</button></div></div>`;
  }
  if (state.phase !== 'playing') return '';
  if (!me.alive) return `<div class="observer-controls"><span>${icon('eliminated')}已淘汰 · 观战中</span><button data-action="leave">退出房间</button></div>`;
  const canAct = myTurn(state, me) && !state.pending;
  const weapon = WEAPONS[me.weapon], kind = skillMode(me.weapon);
  const skill = weapon?.skill && kind !== 'passive';
  const skillBlocked = !canAct || me.skillUsed || kind === 'attack' && state.actions.attacked || kind === 'move' && state.actions.moved || weapon?.skill === 'guard' && me.shield;
  const tile = state.tiles.find(tile => tile.x === me.x && tile.y === me.y);
  return `<div class="turn-controls">
    <button data-mode="move" title="上下左右移动一格，每回合一次" aria-pressed="${mode.type === 'move'}" ${!canAct || state.actions.moved ? 'disabled' : ''}>${icon('move')}<span>移动${myTurn(state, me) && state.actions.moved ? ' ✓' : ''}</span></button>
    <button data-mode="attack" title="按武器射程攻击，每回合一次" aria-pressed="${mode.type === 'attack'}" ${!canAct || state.actions.attacked ? 'disabled' : ''}>${icon('attack')}<span>攻击${myTurn(state, me) && state.actions.attacked ? ' ✓' : ''}</span></button>
    ${skill ? `<button ${kind === 'self' ? 'data-action="skill"' : 'data-mode="skill"'} data-skill-preview title="${e(weapon.description)}" aria-label="技能：${e(weapon.skillName)}" aria-pressed="${mode.type === 'skill'}" ${skillBlocked ? 'disabled' : ''}>${icon('skill')}<span>${e(weapon.skillName)}</span></button>` : ''}
    <button class="primary" data-action="end" ${!canAct ? 'disabled' : ''}>${icon('end')}<span>结束回合</span></button>
  </div>${tile?.type === 'armory' ? `<button class="terrain-action" data-action="terrain" ${!canAct || tile.usedByMe ? 'disabled' : ''}><img src="/game/client/assets/terrain/armory.svg" alt="">${tile.usedByMe ? '这座已用过' : '换武器'}</button>` : ''}${mode.type && canAct ? '<button class="text-button cancel" data-mode="">取消</button>' : ''}`;
}

export function hand(state, me, mode) {
  if (!me.weapon) return '';
  const usable = myTurn(state, me) && !state.pending;
  return `<section class="hand" aria-label="你的手牌">
    <div class="equipment">${weaponCard(me)}</div>
    <div class="hand-items"><div class="hand-heading"><h2 class="section-label">${icon('bag')}${me.items.length} / 5</h2></div>
      <div class="items">${me.items.map(item => itemCard(item, usable, mode.itemId === item.id, me, state.actions)).join('') || '<p class="empty-hand">手牌用完了</p>'}</div>
    </div>
  </section>`;
}
