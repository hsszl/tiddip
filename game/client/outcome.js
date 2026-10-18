import { effect, animate, center, pulse, reduced } from './effects.js';
import { icon } from './icons.js';
import { escapeHTML as e } from './helpers.js';

const notice = document.querySelector('#outcome-notice');
let dismiss;

function announce(symbol, text, kind) {
  clearTimeout(dismiss);
  notice.innerHTML = `${icon(symbol)}<span>${e(text)}</span>`;
  notice.dataset.kind = kind;
  notice.hidden = false;
  dismiss = setTimeout(() => { notice.hidden = true; }, kind === 'victory' ? 4000 : 2600);
}

export function clearOutcomes() { clearTimeout(dismiss); notice.hidden = true; }

export function showOutcome(entry, state) {
  const player = state.players.find(p => p.id === entry.actorId);
  const point = center(entry.position);
  if (entry.kind === 'eliminated') {
    if (point && player) {
      const number = state.players.indexOf(player) + 1;
      const ghost = effect('fallen-piece', point, `<span>${number}</span>${icon('eliminated')}`, player.color);
      animate(ghost, [
        { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1 },
        { transform: 'translate(-50%, -65%) rotate(-10deg) scale(.8)', opacity: .8, offset: .6 },
        { transform: 'translate(-50%, -85%) rotate(-15deg) scale(.55)', opacity: 0 },
      ], 1000);
    }
    announce('eliminated', `${player?.name || '玩家'} · 淘汰`, 'eliminated');
  } else if (entry.kind === 'victory') {
    announce('trophy', player ? `${player.name}获胜` : '平局', 'victory');
  } else if (entry.kind === 'revived') {
    pulse(point, '#629d7d', icon('revived'));
    announce('revived', `${player?.name || '玩家'} · 急救`, 'revived');
  } else if (entry.kind === 'shield') {
    pulse(point, '#6e9eb4', icon('shield'));
  } else if (entry.kind === 'damage') {
    floatingAmount(point, `−${entry.amount ?? 1}`, '#b94d38');
    const panel = document.querySelector(`.player[data-player-id="${entry.actorId}"]`);
    if (!reduced.matches) panel?.animate([{ boxShadow: 'inset 4px 0 #c46d54', background: '#c46d5430' }, { boxShadow: 'inset 0 0 transparent', background: 'transparent' }], { duration: 650 });
  }
}

export function floatingAmount(point, text, color) {
  animate(effect('damage-number', point, e(text), color), [
    { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 1 },
    { transform: 'translate(-50%, -160%) scale(.95)', opacity: 0 },
  ], 1000);
}
