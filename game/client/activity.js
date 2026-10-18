import { WEAPONS, ITEMS, TERRAIN } from '/game/rules.js';
import { escapeHTML as e } from './helpers.js';
import { icon } from './icons.js';

export const feedKinds = new Set(['move', 'teleport', 'attack', 'item', 'blast', 'terrain', 'spawn', 'skill']);
const coordinates = point => `<span class="feed-coordinate">${point.x + 1},${point.y + 1}</span>`;

function image(category, key) {
  const catalog = category === 'weapons' ? WEAPONS : category === 'items' ? ITEMS : TERRAIN;
  if (!catalog[key]) return icon('info');
  return `<img class="feed-image feed-${category}" src="/game/client/assets/${category}/${key}.svg" alt="${e(catalog[key].name)}">`;
}

function playerName(state, id) {
  const player = state.players.find(player => player.id === id);
  return `<span class="feed-name" style="--player:${player?.color || '#81765f'}">${e(player?.name || '玩家')}</span>`;
}

function result(outcome) {
  const symbol = outcome === 'blocked' ? 'shield' : outcome || 'hit';
  return `<span class="feed-result result-${symbol}">${icon(symbol)}</span>`;
}

function terrainResult(entry) {
  if (entry.terrain === 'armory') return `${image('weapons', entry.oldWeapon)}${icon('swap')}${image('weapons', entry.weapon)}`;
  if (entry.terrain === 'ruins' || entry.terrain === 'supply') return `${icon('draw')}<small>+${entry.count ?? 1}</small>`;
  if (entry.terrain === 'clinic') return entry.gained === false ? '<small>—</small>' : result('revived');
  if (entry.terrain === 'camp') return entry.gained === false ? '<small>—</small>' : icon('shield');
  if (entry.terrain === 'tower') return icon('reveal');
  if (entry.terrain === 'brambles' || entry.terrain === 'mine') return result(entry.outcome);
  return icon('blast');
}

export function eventContents(entry, state) {
  const actor = playerName(state, entry.actorId);
  if (entry.kind === 'attack') return `${actor}${image('weapons', entry.weapon)}${result(entry.outcome)}${playerName(state, entry.targetId)}`;
  if (entry.kind === 'move') return `${actor}${icon('move')}${coordinates(entry.from)}<span class="feed-arrow">→</span>${coordinates(entry.to)}`;
  if (entry.kind === 'teleport') return `${actor}${image('items', 'teleport')}${coordinates(entry.to)}`;
  if (entry.kind === 'blast') return `${actor}${image('terrain', 'mine')}${icon('blast')}${coordinates(entry.to)}`;
  if (entry.kind === 'spawn') return `${actor}${icon('draw')}${coordinates(entry.position)}`;
  if (entry.kind === 'item') return `${actor}${image('items', entry.item)}${entry.item === 'medkit' ? result('revived') : icon({ shield: 'shield', radar: 'reveal', sprint: 'move', ammo: 'skill', steal: 'draw', defuse: 'end' }[entry.item] || 'skill')}${entry.targetId ? playerName(state, entry.targetId) : ''}`;
  if (entry.kind === 'skill') return `${actor}${image('weapons', entry.weapon)}${icon('skill')}`;
  if (entry.kind === 'terrain') return `${actor}${image('terrain', entry.terrain)}${terrainResult(entry)}`;
  if (entry.kind === 'reveal') return `${actor}${icon('reveal')}${image('terrain', entry.terrain)}${coordinates(entry.position)}`;
  if (entry.kind === 'turn') return `${actor}${icon('end')}`;
  if (entry.kind === 'shield') return `${actor}${icon('shield')}`;
  if (entry.kind === 'damage') return `${actor}${result('hit')}`;
  return '';
}

function eventRow(entry, state, me) {
  const attributes = `class="feed-row ${entry.actorId === me.id ? 'own-event' : ''}" title="${e(entry.text)}" aria-label="${e(entry.text)}"`;
  const contents = eventContents(entry, state);
  return `<li><button ${attributes} data-event="${entry.id}">${contents}</button></li>`;
}

export function actionRecord(state, me) {
  const entries = state.log.toReversed().filter(entry => feedKinds.has(entry.kind));
  const recent = entries.slice(0, 4);
  if (!recent.length) return '';
  return `<section class="activity-panel" aria-label="行动动态" aria-live="polite">
    <ol class="recent-events">${recent.map(entry => eventRow(entry, state, me)).join('')}</ol>
    <details class="older-events" data-persist="history"><summary>记录</summary><ol>${entries.map(entry => eventRow(entry, state, me)).join('')}</ol></details>
  </section>`;
}
