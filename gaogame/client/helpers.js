import { attackInRange } from '/gaogame/range.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
export const meIn = (state, session) => state.players.find(player => player.id === session.playerId);
export const myTurn = (state, me) => state.phase === 'playing' && me.alive && state.currentPlayerId === me.id;
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Hints only. The server checks every action against its private state.
export const inRange = attackInRange;

export function canStand(state, me, tile) {
  return tile.type !== 'toilet' || !state.players.some(player => player.alive && player.id !== me.id && player.x === tile.x && player.y === tile.y);
}

export function hearts(player) {
  if (!player.maxHp) return '';
  return `<span class="health"><span class="hearts" aria-label="${player.hp} / ${player.maxHp} 血">${Array.from({ length: player.maxHp }, (_, index) =>
    `<img src="/gaogame/client/assets/heart.svg" alt="" class="${index < player.hp ? '' : 'empty-heart'}">`).join('')}</span><span class="hp-number">${player.hp} / ${player.maxHp}</span></span>`;
}
