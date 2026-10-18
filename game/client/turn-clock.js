let deadline = null, offset = 0;
let previousTurn = '', noticeTimeout;

export function syncTurnClock(state, isMine = false) {
  deadline = state.phase === 'playing' ? state.turnEndsAt : null;
  if (Number.isFinite(state.serverNow)) offset = Date.now() - state.serverNow;
  const key = `${state.id}:${state.currentPlayerId}:${deadline}`;
  const notice = document.querySelector('#turn-notice');
  if (notice && key !== previousTurn) {
    clearTimeout(noticeTimeout);
    notice.hidden = !isMine;
    if (isMine) noticeTimeout = setTimeout(() => { notice.hidden = true; }, 2200);
  }
  previousTurn = key;
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
