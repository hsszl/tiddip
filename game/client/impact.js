import { effect, animate, pulse, reduced } from './effects.js';
import { icon } from './icons.js';

function impact(entry, to) {
  const blocked = entry.outcome === 'blocked';
  const color = blocked ? '#72c9ed' : '#ff865c';
  const symbol = blocked ? 'shield' : entry.outcome === 'eliminated' ? 'eliminated' : entry.outcome === 'revived' ? 'revived' : 'attack';
  pulse(to, color, icon(symbol));
  if (reduced.matches) return;
  animate(effect('impact-ring', to, '', color), [
    { transform: 'translate(-50%, -50%) scale(.12)', opacity: 1 },
    { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 },
  ], 480);
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const spark = effect('impact-spark', to, '', color);
    animate(spark, [
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * to.size * .7}px), calc(-50% + ${Math.sin(angle) * to.size * .7}px)) scale(.1)`, opacity: 0 },
    ], 360 + index * 12);
  }
  const tile = document.elementFromPoint(to.x, to.y)?.closest('.tile');
  tile?.animate([{ filter: 'brightness(1.65)' }, { filter: 'brightness(1)' }], { duration: 220 });
  const piece = tile?.querySelector(`[data-player-id="${entry.targetId}"]`);
  piece?.animate([
    { transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-4px) scale(.88)' },
    { transform: 'translateX(4px) scale(1.12)' }, { transform: 'translateX(0) scale(1)' },
  ], { duration: 240 });
}

export function playAttack(entry, from, to, roomId) {
  if (!from || !to) return;
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (reduced.matches) { impact(entry, to); return; }
  if (['axe', 'dagger'].includes(entry.weapon) || distance === 0) {
    animate(effect('melee-slash', to, '', '#ffe5b5'), [
      { transform: 'translate(-50%, -50%) rotate(-60deg) scale(.2)', opacity: 1 },
      { transform: 'translate(-50%, -50%) rotate(35deg) scale(1.1)', opacity: 0 },
    ], 230);
  } else if (['boomerang', 'mortar'].includes(entry.weapon)) {
    const shot = effect(`attack-shot shot-${entry.weapon}`, from, entry.weapon === 'boomerang' ? '<img src="/game/client/assets/weapons/boomerang.svg" alt="">' : '', '#ffce82');
    animate(shot, [
      { transform: 'translate(-50%, -50%) rotate(0deg)' },
      { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - 40}px)) rotate(180deg)` },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(360deg)` },
    ], 190);
  } else {
    for (let index = 0; index < (entry.weapon === 'rifle' ? 3 : 1); index++) {
      const tracer = effect('attack-tracer', { ...from, y: from.y + (index - 1) * 3 }, '', '#ffe1a4');
      tracer.style.width = `${distance}px`;
      tracer.style.rotate = `${Math.atan2(dy, dx)}rad`;
      animate(tracer, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1', offset: .2 }, { opacity: 0 }], 200 + index * 45);
    }
    pulse(from, '#ffc869');
  }
  setTimeout(() => {
    const match = document.querySelector('#match');
    if (!match.hidden && match.dataset.roomId === roomId && ['playing', 'finished'].includes(match.dataset.phase)) impact(entry, to);
  }, 170);
}
