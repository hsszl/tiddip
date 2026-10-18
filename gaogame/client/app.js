import { request, savedSession, saveSession, savedName, saveName } from './network.js';
import { render } from './render.js';
import { meIn, myTurn, inRange, escapeHTML as e } from './helpers.js';
import { selectable } from './board.js';
import { ITEMS } from '/gaogame/rules.js';
import { skillMode, itemInRange } from '/gaogame/range.js';
import './catalog.js';
import { inspectCard, inspectEvent, hideCardTooltip } from './inspect.js';
import { playEvents, clearFeedback, reconcilePieces } from './feedback.js';
import { showInvite } from './invite.js';
import { prepareReveals } from './reveal.js';
import { syncTurnClock, paintTurnClock } from './turn-clock.js';
import { openMapSize, closeMapSize } from './map-size.js';

const invitedCode = new URLSearchParams(location.search).get('room')?.toUpperCase();
const invitation = /^[A-F0-9]{6}$/.test(invitedCode || '') ? invitedCode : null;
let session = savedSession(invitation), state = null, mode = {}, selected = null, busy = false, polling = false;
let generation = 0;
let viewingInvite = false;
const message = text => { document.querySelector('#message').textContent = text; };
const connection = text => { document.querySelector('#connection').textContent = text; };
const draw = () => {
  hideCardTooltip();
  document.body.classList.remove('preview-skill');
  document.body.classList.remove('preview-attack');
  if (state) { render(state, session, mode, selected); reconcilePieces(); paintTurnClock(); }
};

function accept(next) {
  const sameRoom = state?.id === next.id;
  const previous = new Set(sameRoom ? state.log.map(entry => entry.id) : []);
  const events = sameRoom ? next.log.filter(entry => !previous.has(entry.id)) : [];
  if (!sameRoom || state.phase === 'finished' && next.phase === 'spawn') clearFeedback();
  prepareReveals(events, state);
  state = next;
  if (next.phase !== 'lobby') closeMapSize();
  syncTurnClock(next, myTurn(next, meIn(next, session)));
  if (!myTurn(state, meIn(state, session)) || state.pending) {
    mode = {};
    const targets = document.querySelector('#targets-dialog');
    if (targets.open) targets.close();
  }
  draw();
  playEvents(events, next);
}

function welcome() {
  generation++;
  busy = false;
  document.body.classList.remove('busy');
  clearFeedback();
  closeMapSize();
  hideCardTooltip();
  document.querySelector('#turn-notice').hidden = true;
  state = session = null;
  mode = {};
  selected = null;
  saveSession(null);
  document.querySelector('#match').hidden = true;
  document.querySelector('#welcome').hidden = false;
}

function leaveRoom() {
  if (!session || !state) return;
  const leaving = session, version = state.version;
  welcome();
  viewingInvite = false;
  document.querySelector('#resume-session').hidden = true;
  document.querySelector('#room-code').value = '';
  history.replaceState(null, '', '/gaogame/');
  message('');
  const ticket = generation;
  request(`/rooms/${leaving.roomId}/actions`, { type: 'leave', expectedVersion: version }, leaving.token).catch(error => {
    if (generation === ticket && ![401, 404].includes(error.status)) message('已退出页面；服务器未确认离开，房间稍后自动回收');
  });
}

async function act(action) {
  if (busy || !session) return;
  const ticket = generation, current = session;
  const attemptedVersion = state.version;
  busy = true;
  document.body.classList.add('busy');
  if (action.type === 'addBot') {
    const button = document.querySelector('[data-action="addBot"]');
    if (button) {
      button.style.minWidth = `${button.getBoundingClientRect().width}px`;
      button.textContent = '添加中…';
      button.setAttribute('aria-busy', 'true');
    }
    for (const control of document.querySelectorAll('.lobby-controls button')) control.disabled = true;
  }
  message('');
  try {
    const next = await request(`/rooms/${current.roomId}/actions`, { ...action, expectedVersion: state.version }, current.token);
    if (ticket !== generation) return;
    if (action.type === 'leave') welcome();
    else { mode = {}; selected = null; accept(next); }
    return true;
  } catch (error) {
    if (ticket !== generation) return;
    message(error.message);
    if (error.status === 409) {
      try {
        const latest = await request(`/rooms/${current.roomId}`, undefined, current.token);
        if (ticket !== generation) return;
        accept(latest);
        // Concurrent birth selections do not invalidate another player's choice.
        // Never retry turn actions: a repeated 'end' could skip a later turn.
        if (action.type === 'spawn' && latest.version > attemptedVersion && latest.phase === 'spawn' && meIn(latest, session).x === null) {
          selected = null;
          const retried = await request(`/rooms/${current.roomId}/actions`, { ...action, expectedVersion: latest.version }, current.token);
          if (ticket !== generation) return;
          accept(retried);
          message('');
        }
      } catch (syncError) {
        if (ticket !== generation) return;
        message(syncError.message);
        if (!syncError.status) connection('连接中断');
      }
    }
  }
  finally {
    if (ticket === generation) {
      busy = false;
      document.body.classList.remove('busy');
      // Rebuild lobby controls after success or failure; keep the server's capacity check.
      if (action.type === 'addBot') draw();
    }
  }
}

async function enter(intent = 'create', requestedCode) {
  if (busy) return;
  const name = document.querySelector('#nickname').value.trim();
  const code = requestedCode || document.querySelector('#room-code').value.trim().toUpperCase();
  if (intent === 'join' && !/^[A-F0-9]{6}$/.test(code)) return message('输入 6 位房间号');
  busy = true;
  const ticket = ++generation;
  message('');
  try {
    const result = await request(intent === 'join' ? `/rooms/${code}/join` : '/rooms', { name });
    if (ticket !== generation) return;
    viewingInvite = false;
    document.querySelector('#resume-session').hidden = true;
    session = { roomId: result.roomId, playerId: result.playerId, token: result.token };
    selected = null;
    saveSession(session);
    saveName(name);
    history.replaceState(null, '', `/gaogame/?room=${session.roomId}`);
    accept(result.state);
    if (intent === 'solo') {
      const current = session;
      for (const type of ['addBot', 'start']) {
        const next = await request(`/rooms/${current.roomId}/actions`, { type, expectedVersion: state.version }, current.token);
        if (ticket !== generation) return;
        accept(next);
      }
    }
  } catch (error) { if (ticket === generation) message(error.message); }
  finally { if (ticket === generation) busy = false; }
}

function attackCell(x, y) {
  const me = meIn(state, session);
  const targets = state.players.filter(player => player.x === x && player.y === y && (mode.type === 'item-player'
    ? player.id !== me.id && player.alive && player.itemCount && itemInRange(me, player, mode.key)
    : inRange(me, player, mode.type === 'skill')));
  if (targets.length === 1) return act(targetAction(targets[0].id));
  const dialog = document.querySelector('#targets-dialog');
  document.querySelector('#targets-title').textContent = mode.type === 'item-player' ? '选择对手' : '攻击谁？';
  document.querySelector('#targets').innerHTML = targets.map(player => `<button data-target="${player.id}">${e(player.name)}</button>`).join('');
  dialog.showModal();
}

function targetAction(targetId) {
  return mode.type === 'item-player' ? { type: 'item', itemId: mode.itemId, targetId } : { type: mode.type, targetId };
}

function cellClick(coordinate) {
  const [x, y] = coordinate.split(',').map(Number);
  const me = meIn(state, session), tile = state.tiles.find(tile => tile.x === x && tile.y === y);
  selected = { x, y };
  draw();
  if (!selectable(state, me, tile, mode)) {
    if (mode.type) return message('这个格子不能用于当前行动');
    return message('');
  }
  if (state.phase === 'spawn') return act({ type: 'spawn', x, y });
  if (state.pending) return act({ type: 'land', x, y });
  if (mode.type === 'item-cell') return act({ type: 'item', itemId: mode.itemId, x, y });
  if (mode.type === 'move') return act({ type: 'move', x, y });
  if (mode.type === 'skill' && skillMode(me.weapon) === 'move') return act({ type: 'skill', x, y });
  return attackCell(x, y);
}

document.querySelector('#entry-form').addEventListener('submit', event => {
  event.preventDefault();
  enter(event.submitter?.value || (viewingInvite ? 'join' : 'create'));
});
document.querySelector('#rules-open').addEventListener('click', () => document.querySelector('#rules-dialog').showModal());
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.hasAttribute('data-close')) return button.closest('dialog').close();
  if (button.dataset.cardInfo) return inspectCard(button);
  if (button.dataset.event && state) return inspectEvent(state.log.find(entry => entry.id === button.dataset.event), state);
  if (button.hasAttribute('data-invite') && state) return showInvite(state);
  if (button.dataset.action === 'leave') return leaveRoom();
  if (busy || !state) return;
  if (button.hasAttribute('data-map-size')) {
    hideCardTooltip();
    return openMapSize(state, dimensions => act({ type: 'resize', ...dimensions }));
  }
  if (button.dataset.action) return act({ type: button.dataset.action });
  if (button.hasAttribute('data-mode')) {
    mode = mode.type === button.dataset.mode ? {} : { type: button.dataset.mode };
    message(''); draw(); return;
  }
  if (button.dataset.cell) return cellClick(button.dataset.cell);
  if (button.dataset.item) {
    const item = meIn(state, session).items.find(item => item.id === button.dataset.item);
    if (ITEMS[item.key].target) { mode = { type: ITEMS[item.key].target === 'cell' ? 'item-cell' : 'item-player', key: item.key, itemId: item.id }; message(''); draw(); }
    else act({ type: 'item', itemId: item.id });
    return;
  }
  if (button.dataset.target) {
    document.querySelector('#targets-dialog').close();
    return act(targetAction(button.dataset.target));
  }
});

for (const name of ['pointerover', 'focusin']) document.addEventListener(name, event => {
  if (event.target.closest('[data-skill-preview]:not(:disabled)')) document.body.classList.add('preview-skill');
  if (event.target.closest('[data-mode="attack"]:not(:disabled)')) document.body.classList.add('preview-attack');
});
for (const name of ['pointerout', 'focusout']) document.addEventListener(name, event => {
  if (event.target.closest('[data-skill-preview]') && !event.relatedTarget?.closest?.('[data-skill-preview]')) document.body.classList.remove('preview-skill');
  if (event.target.closest('[data-mode="attack"]') && !event.relatedTarget?.closest?.('[data-mode="attack"]')) document.body.classList.remove('preview-attack');
});

// An old poll must never overwrite a newer action result.
async function poll() {
  if (!session || busy || polling || viewingInvite) return;
  polling = true;
  const current = session;
  try {
    const next = await request(`/rooms/${current.roomId}`, undefined, current.token);
    if (session !== current || busy) return;
    connection('已连接');
    if (!state || next.version > state.version) accept(next);
  } catch (error) {
    if (session !== current) return;
    connection('连接中断');
    if ([401, 404].includes(error.status)) { welcome(); message(error.message); }
  } finally { polling = false; }
}

document.querySelector('#nickname').value = savedName();
if (invitation) document.querySelector('#room-code').value = invitation;
// Migrate older tab-only sessions and select a remembered invitation identity.
if (session) saveSession(session);
document.querySelector('#resume-session').addEventListener('click', () => {
  viewingInvite = false;
  document.querySelector('#resume-session').hidden = true;
  history.replaceState(null, '', `/gaogame/?room=${session.roomId}`);
  message('');
  poll();
});
try {
  await request('/health');
  connection('已连接');
  if (invitation && session?.roomId !== invitation) {
    viewingInvite = true;
    document.querySelector('#resume-session').hidden = !session;
    await enter('join', invitation);
    if (viewingInvite) document.querySelector('#welcome').hidden = false;
  } else if (session) {
    await poll();
    if (!state) document.querySelector('#welcome').hidden = false;
  } else welcome();
} catch { welcome(); connection('连接中断'); message('连接不上服务器，请稍后再试'); }
setInterval(poll, 1000);
