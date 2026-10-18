import { eventContents, feedKinds } from './activity.js';
import { icon } from './icons.js';
import { center, pulse, reduced } from './effects.js';
import { revealCard, clearReveals } from './reveal.js';
import { playMovement, afterMotion, clearMovements, reconcilePieces } from './motion.js';
import { playAttack } from './impact.js';
import { showOutcome, clearOutcomes, floatingAmount } from './outcome.js';
export { reconcilePieces };

const layer = document.querySelector('#feedback-root');
const notices = document.querySelector('#action-notices');
let generation = 0;
let nextEventAt = 0;

function show(entry, state) {
  if (entry.kind === 'reveal') revealCard(entry.position);
  const actor = state.players.find(player => player.id === entry.actorId);
  const color = actor?.color || '#a7b6c9';
  const from = center(entry.from), to = center(entry.to || entry.position);
  if (['move', 'blast', 'teleport'].includes(entry.kind) && from && to) playMovement(entry, state, from, to);
  else if (entry.kind === 'attack') afterMotion(entry.actorId, () => playAttack(entry, from, to, state.id));
  else if (['damage', 'shield', 'eliminated', 'revived', 'victory'].includes(entry.kind)) showOutcome(entry, state);
  else if (entry.kind === 'item') pulse(to, '#6ad6cf', icon({ medkit: 'revived', shield: 'shield', radar: 'reveal', sprint: 'move', ammo: 'skill', steal: 'draw', defuse: 'end' }[entry.item]));
  else if (entry.kind === 'skill') pulse(to, '#b39bff', icon('skill'));
  else if (entry.kind === 'terrain') {
    const symbol = entry.gained === false || entry.count === 0 ? 'info'
      : entry.outcome ? entry.outcome === 'blocked' ? 'shield' : entry.outcome
      : { camp: 'shield', clinic: 'revived', tower: 'reveal', armory: 'swap' }[entry.terrain] || 'draw';
    pulse(to, color, icon(symbol));
  } else if (entry.kind === 'reveal' || entry.kind === 'spawn') pulse(to, color, icon('reveal'));
  if (entry.kind === 'item' && entry.item === 'medkit' || entry.kind === 'terrain' && entry.terrain === 'clinic' && entry.gained) floatingAmount(to, '+1', '#629d7d');
  if (entry.kind === 'terrain' && entry.count > 0) floatingAmount(to, `+${entry.count}`, '#8f7c46');
  if (!feedKinds.has(entry.kind) && entry.kind !== 'turn') return;
  const notice = document.createElement('button');
  notice.type = 'button';
  notice.className = `feed-row action-notice notice-${entry.kind}`;
  notice.dataset.eventId = notice.dataset.event = entry.id;
  notice.innerHTML = eventContents(entry, state);
  notice.setAttribute('aria-label', entry.text);
  notices.append(notice);
  while (notices.children.length > 4) notices.firstElementChild.remove();
  setTimeout(() => notice.remove(), 2800);
}

export function playEvents(entries, state) {
  const current = generation;
  const visible = entries.filter(entry => feedKinds.has(entry.kind) || ['damage', 'shield', 'reveal', 'turn'].includes(entry.kind));
  for (const entry of visible) {
    const delay = reduced.matches ? 0 : Math.max(0, nextEventAt - performance.now());
    if (!delay) show(entry, state);
    else setTimeout(() => { if (generation === current) show(entry, state); }, delay);
    const duration = { move: 280, blast: 280, teleport: 180, skill: 300, item: 220, attack: 240, reveal: 75, terrain: 100, spawn: 80, eliminated: 1050, revived: 450, victory: 500 }[entry.kind] || 0;
    nextEventAt = performance.now() + delay + (reduced.matches ? 0 : duration);
  }
}

export function clearFeedback() {
  generation++;
  nextEventAt = 0;
  clearReveals();
  clearMovements();
  clearOutcomes();
  layer.replaceChildren();
  notices.replaceChildren();
}
