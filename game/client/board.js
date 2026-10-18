import { TERRAIN } from '/game/rules.js';
import { escapeHTML as e, distance, inRange, canStand, myTurn } from './helpers.js';
import { skillInRange, skillMode, moveInRange, itemInRange } from '/game/range.js';
import { isRevealPending, revealCover } from './reveal.js';
import { icon } from './icons.js';

export function selectable(state, me, tile, mode) {
  if (state.phase === 'spawn') return me.x === null && canStand(state, me, tile);
  if (!myTurn(state, me)) return false;
  if (state.pending) return state.pending.playerId === me.id && tile.revealed && distance(me, tile) > 0 && canStand(state, me, tile);
  if (mode.type === 'move') return !state.actions.moved && moveInRange(me, tile, state.actions.sprint) && canStand(state, me, tile);
  if (mode.type === 'item-cell') return itemInRange(me, tile, mode.key) && canStand(state, me, tile);
  if (mode.type === 'item-player') return itemInRange(me, tile, mode.key) && state.players.some(p => p.id !== me.id && p.alive && p.x === tile.x && p.y === tile.y && p.itemCount);
  if (mode.type === 'skill' && skillMode(me.weapon) === 'move') return !state.actions.moved && skillInRange(me, tile) && canStand(state, me, tile);
  if (mode.type === 'attack' || mode.type === 'skill') {
    return !state.actions.attacked && state.players.some(player => player.x === tile.x && player.y === tile.y && inRange(me, player, mode.type === 'skill'));
  }
  return false;
}

export function board(state, me, mode, selected) {
  const cells = state.tiles.map(tile => {
    const occupants = state.players.filter(player => player.alive && player.x === tile.x && player.y === tile.y);
    const fallen = state.players.filter(player => !player.alive && !player.left && player.x === tile.x && player.y === tile.y);
    const available = selectable(state, me, tile, mode);
    const rangeVisible = myTurn(state, me) && !state.pending;
    const attackRange = rangeVisible && !state.actions.attacked && inRange(me, { ...tile, id: 'preview', alive: true });
    const kind = skillMode(me.weapon);
    const skillRange = rangeVisible && !(kind === 'attack' && state.actions.attacked || kind === 'move' && state.actions.moved) && skillInRange(me, tile);
    const terrain = tile.revealed ? TERRAIN[tile.type].name : '迷雾';
    const label = `${tile.x + 1},${tile.y + 1} ${terrain}${tile.spent ? '（已触发）' : ''}${occupants.length ? ` · ${occupants.map(player => player.name).join('、')}` : ''}`;
    const ownTile = occupants.some(player => player.id === me.id);
    const chosen = selected?.x === tile.x && selected?.y === tile.y;
    const pending = isRevealPending(tile);
    return `<button class="tile ${tile.revealed ? `revealed terrain-${tile.type}` : 'fog'} ${pending ? 'reveal-pending' : ''} ${available ? 'available' : ''} ${ownTile ? 'own-tile' : ''} ${chosen ? 'inspected' : ''}"
      data-cell="${tile.x},${tile.y}" data-attack-range="${attackRange}" data-skill-range="${skillRange}" aria-label="${e(label)}" title="${e(label)}" ${tile.revealed ? `data-card-kind="terrain" data-card-key="${tile.type}" data-card-note="${tile.type === 'armory' ? tile.usedByMe ? '你已使用' : '每人一次，手动使用' : tile.spent ? '已触发' : ''}"` : ''}>
      <img class="tile-art" src="/game/client/assets/${tile.revealed ? `terrain/${tile.type}` : 'fog'}.svg" alt="" draggable="false">
      ${!tile.revealed ? '<img class="tile-art night-fog" src="/game/client/assets/fog-night.svg" alt="" draggable="false">' : ''}
      ${pending ? revealCover() : ''}
      ${tile.revealed ? `<span class="terrain ${tile.spent ? 'spent' : ''}">${e(terrain)}${tile.spent ? ' · 已用' : ''}</span>` : ''}
      <span class="range-overlay" aria-hidden="true"></span>
      <span class="pieces">${occupants.map(player => `<span class="piece ${player.id === me.id ? 'self' : ''}" data-player-id="${player.id}" style="--player:${player.color}" title="${e(player.name)}">${state.players.indexOf(player) + 1}</span>`).join('')}</span>
      ${fallen.length ? `<span class="fallen-marker" role="img" aria-label="${e(fallen.map(p => p.name).join('、'))}已淘汰">${icon('eliminated')}<small>${fallen.map(p => state.players.indexOf(p) + 1).join('·')}</small></span>` : ''}
      <span class="cell-coordinate" aria-hidden="true">${tile.x + 1}.${tile.y + 1}</span>
    </button>`;
  }).join('');
  return `<div class="board" data-mode="${mode.type || 'idle'}" style="--size:${state.size}" role="group" aria-label="${state.size} 乘 ${state.size} 地图">${cells}</div>`;
}
