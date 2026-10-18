let deadline = null, offset = 0;

export function syncTurnClock(state) {
  deadline = state.phase === 'playing' ? state.turnEndsAt : null;
  if (Number.isFinite(state.serverNow)) offset = Date.now() - state.serverNow;
  paintTurnClock();
}

export function paintTurnClock() {
  const element = document.querySelector('#turn-clock');
  if (!element || !deadline) return;
  const seconds = Math.max(0, Math.ceil((deadline - (Date.now() - offset)) / 1000));
  element.textContent = `${seconds}s`;
  element.dataset.urgent = seconds <= 5;
  element.setAttribute('aria-label', `本回合剩余 ${seconds} 秒`);
}

setInterval(paintTurnClock, 200);
