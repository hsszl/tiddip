import { effect, pulse, reduced } from './effects.js';

const motions = new Map();

export function reconcilePieces() {
  for (const piece of document.querySelectorAll('.piece[data-player-id]')) {
    piece.style.visibility = motions.has(piece.dataset.playerId) ? 'hidden' : '';
  }
}

export function afterMotion(playerId, callback) {
  const motion = motions.get(playerId);
  if (motion) motion.after.push(callback); else callback();
}

export function playMovement(entry, state, from, to) {
  const actor = state.players.find(p => p.id === entry.actorId);
  const job = { entry, actor, number: state.players.indexOf(actor) + 1, from, to };
  if (reduced.matches) { pulse(to, actor.color); return; }
  const pending = motions.get(entry.actorId);
  if (pending) { pending.jobs.push(job); return; }
  const motion = { jobs: [], after: [] };
  motions.set(entry.actorId, motion);
  reconcilePieces();
  run(job, motion);
}

function run(job, motion) {
  const { entry, actor, number, from, to } = job;
  const piece = effect('moving-piece', from, String(number), actor.color);
  motion.element = piece;
  motion.animation = piece.animate([
    { transform: 'translate(-50%, -50%) scale(1)' },
    { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(1.08)` },
  ], { duration: entry.kind === 'teleport' ? 160 : 260, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
  motion.animation.onfinish = () => {
    piece.remove();
    if (motions.get(entry.actorId) !== motion) return;
    pulse(to, actor.color);
    if (motion.jobs.length) run(motion.jobs.shift(), motion);
    else {
      motions.delete(entry.actorId);
      reconcilePieces();
      for (const callback of motion.after) callback();
    }
  };
}

export function clearMovements() {
  for (const motion of motions.values()) { motion.animation?.cancel(); motion.element?.remove(); }
  motions.clear();
  reconcilePieces();
}

window.addEventListener('resize', clearMovements);
window.addEventListener('scroll', clearMovements, { passive: true });
