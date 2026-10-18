import { board } from './board.js';
import { status, playersPanel, controls, hand } from './panels.js';
import { meIn, myTurn, escapeHTML as e } from './helpers.js';
import { tileDetails } from './terrain.js';
import { actionRecord } from './activity.js';

export function render(state, session, mode, selected) {
  const me = meIn(state, session);
  if (!me) return;
  document.querySelector('#welcome').hidden = true;
  const match = document.querySelector('#match');
  const sameRoom = match.dataset.roomId === state.id;
  const sameVersion = match.dataset.version === String(state.version);
  const scroll = match.querySelector('.activity-panel ol')?.scrollTop || 0;
  const handScroll = sameRoom ? match.querySelector('.items')?.scrollLeft || 0 : 0;
  const openDetails = sameRoom ? [...match.querySelectorAll('details[data-persist][open]')].map(details => details.dataset.persist) : [];
  match.hidden = false;
  match.innerHTML = `
    <div class="match-header">
      <div class="room-label">房间 <strong>${e(state.id)}</strong><button class="text-button" data-invite>邀请</button></div>
      <button class="text-button" data-action="leave">退出房间</button>
    </div>
    <div class="game-layout">
      <section class="map-section">
        <div class="board-heading ${myTurn(state, me) ? 'your-turn' : ''}"><h1>${e(status(state, me, mode))}</h1><span class="quiet">${state.phase === 'playing' ? `<span id="turn-clock" role="timer" aria-live="off"></span>第 ${state.round} 轮` : `${state.size} × ${state.size}`}</span></div>
        ${board(state, me, mode, selected)}
        ${controls(state, me, mode)}
        ${hand(state, me, mode)}
      </section>
      <aside class="sidebar">
        ${actionRecord(state, me)}${playersPanel(state, me)}${tileDetails(state, me, selected)}
      </aside>
    </div>`;
  match.dataset.roomId = state.id;
  match.dataset.version = state.version;
  match.dataset.phase = state.phase;
  for (const details of match.querySelectorAll('details[data-persist]')) details.open = openDetails.includes(details.dataset.persist);
  const items = match.querySelector('.items');
  if (items) items.scrollLeft = handScroll;
  const activity = match.querySelector('.activity-panel ol');
  if (activity && sameRoom && sameVersion) activity.scrollTop = scroll;
}
