import { reduced } from './effects.js';

const pending = new Set();
const coordinate = point => `${point.x},${point.y}`;

// Keep the authoritative snapshot current; only delay its visual card reveal.
export function prepareReveals(entries, previous) {
  if (reduced.matches) return;
  for (const entry of entries) {
    if (entry.kind !== 'reveal') continue;
    const key = coordinate(entry.position);
    const old = previous?.tiles.find(tile => coordinate(tile) === key);
    if (!old?.revealed || pending.has(key)) pending.add(key);
  }
}

export const isRevealPending = tile => pending.has(coordinate(tile));

export function revealCover() {
  return '<span class="reveal-cover" aria-hidden="true"><img src="/gaogame/client/assets/fog.svg" alt=""><img class="night-fog" src="/gaogame/client/assets/fog-night.svg" alt=""></span>';
}

export function revealCard(point) {
  const key = coordinate(point);
  pending.delete(key);
  const cell = document.querySelector(`[data-cell="${key}"]`);
  if (!cell) return;
  cell.classList.remove('reveal-pending');
  cell.querySelector('.reveal-cover')?.remove();
  if (!reduced.matches) cell.animate([
    { opacity: .55, transform: 'scale(.96)' },
    { opacity: 1, transform: 'scale(1)' },
  ], { duration: 160, easing: 'ease-out' });
}

export function clearReveals() {
  for (const key of [...pending]) {
    const [x, y] = key.split(',').map(Number);
    revealCard({ x, y });
  }
}
