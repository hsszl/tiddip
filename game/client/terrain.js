import { TERRAIN } from '/game/rules.js';
import { escapeHTML as e } from './helpers.js';

export function tileDetails(state, me, selected) {
  const position = selected;
  const tile = position && state.tiles.find(tile => tile.x === position.x && tile.y === position.y);
  if (!tile) return '';
  if (!tile.revealed) return `<section class="tile-details"><h2>${tile.x + 1},${tile.y + 1} · 迷雾</h2><p class="quiet">进入后才会知道这里是什么。</p></section>`;
  const terrain = TERRAIN[tile.type];
  return `<section class="tile-details terrain-${tile.type}">
    <img class="terrain-preview" src="/game/client/assets/terrain/${tile.type}.svg" alt="">
    <div><h2>${e(terrain.name)} <small>${tile.x + 1},${tile.y + 1}</small></h2>
    <p>${tile.type === 'armory' && tile.usedByMe ? '你已在这里换过武器。' : tile.spent ? '已用 · 不再触发' : e(terrain.description)}</p></div>
  </section>`;
}
