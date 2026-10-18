import { request, savedSession, saveSession } from './network.js';
import { render } from './render.js';
import { meIn, myTurn, inRange, escapeHTML as e } from './helpers.js';
import { selectable } from './board.js';
import { ITEMS } from '/game/rules.js';
import { skillMode, itemInRange } from '/game/range.js';
import './catalog.js';
import './theme.js';
import { inspectCard, inspectEvent, hideCardTooltip } from './inspect.js';
import { playEvents, clearFeedback, reconcilePieces } from './feedback.js';
import { showInvite } from './invite.js';
import { prepareReveals } from './reveal.js';
import { syncTurnClock, paintTurnClock } from './turn-clock.js';

let session = savedSession(), state = null, mode = {}, selected = null, busy = false, polling = false;
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
  if (!sameRoom) clearFeedback();
  prepareReveals(events, state);
  state = next;
  syncTurnClock(next);
  if (!myTurn(state, meIn(state, session)) || state.pending) {
    mode = {};
    const targets = document.querySelector('#targets-dialog');
    if (targets.open) targets.close();
  }
  draw();
  playEvents(events, next);
}

function welcome() {
  clearFeedback();
  hideCardTooltip();
  state = session = null;
  mode = {};
  selected = null;
  saveSession(null);
  document.querySelector('#match').hidden = true;
  document.querySelector('#welcome').hidden = false;
}

async function act(action) {
  if (busy || !session) return;
  const attemptedVersion = state.version;
  busy = true;
  document.body.classList.add('busy');
  message('');
  try {
    const next = await request(`/rooms/${session.roomId}/actions`, { ...action, expectedVersion: state.version }, session.token);
    if (action.type === 'leave') welcome();
    else { mode = {}; selected = null; accept(next); }
  } catch (error) {
    message(error.message);
    if (error.status === 409) {
      try {
        const latest = await request(`/rooms/${session.roomId}`, undefined, session.token);
        accept(latest);
        // Concurrent birth selections do not invalidate another player's choice.
        // Never retry turn actions: a repeated 'end' could skip a later turn.
        if (action.type === 'spawn' && latest.version > attemptedVersion && latest.phase === 'spawn' && meIn(latest, session).x === null) {
          selected = null;
          accept(await request(`/rooms/${session.roomId}/actions`, { ...action, expectedVersion: latest.version }, session.token));
          message('');
        }
      } catch (syncError) {
        message(syncError.message);
        if (!syncError.status) connection('连接中断');
      }
    }
  }
  finally { busy = false; document.body.classList.remove('busy'); }
}

async function enter(event) {
  event.preventDefault();
  if (busy) return;
  const intent = event.submitter?.value || 'create';
  const name = document.querySelector('#nickname').value.trim();
  const code = document.querySelector('#room-code').value.trim().toUpperCase();
  if (intent === 'join' && !/^[A-F0-9]{6}$/.test(code)) return message('输入 6 位房间号');
  busy = true;
  message('');
  try {
    const result = await request(intent === 'join' ? `/rooms/${code}/join` : '/rooms', { name });
    viewingInvite = false;
    document.querySelector('#resume-session').hidden = true;
    session = { roomId: result.roomId, playerId: result.playerId, token: result.token };
    selected = null;
    saveSession(session);
    history.replaceState(null, '', `/game/?room=${session.roomId}`);
    accept(result.state);
    if (intent === 'solo') {
      accept(await request(`/rooms/${session.roomId}/actions`, { type: 'addBot', expectedVersion: state.version }, session.token));
      accept(await request(`/rooms/${session.roomId}/actions`, { type: 'start', expectedVersion: state.version }, session.token));
    }
  } catch (error) { message(error.message); }
  finally { busy = false; }
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

document.querySelector('#entry-form').addEventListener('submit', enter);
document.querySelector('#rules-open').addEventListener('click', () => document.querySelector('#rules-dialog').showModal());
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.hasAttribute('data-close')) return button.closest('dialog').close();
  if (button.dataset.cardInfo) return inspectCard(button);
  if (button.dataset.event && state) return inspectEvent(state.log.find(entry => entry.id === button.dataset.event), state);
  if (button.hasAttribute('data-invite') && state) return showInvite(state);
  if (busy || !state) return;
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

const code = new URLSearchParams(location.search).get('room');
if (code) document.querySelector('#room-code').value = code;
document.querySelector('#resume-session').addEventListener('click', () => {
  viewingInvite = false;
  document.querySelector('#resume-session').hidden = true;
  history.replaceState(null, '', `/game/?room=${session.roomId}`);
  message('');
  poll();
});
try {
  await request('/health');
  connection('已连接');
  if (session && /^[A-Fa-f0-9]{6}$/.test(code || '') && code.toUpperCase() !== session.roomId) {
    viewingInvite = true;
    document.querySelector('#welcome').hidden = false;
    document.querySelector('#resume-session').hidden = false;
  } else if (session) {
    await poll();
    if (!state) document.querySelector('#welcome').hidden = false;
  } else welcome();
} catch { welcome(); connection('连接中断'); message('连接不上服务器，请稍后再试'); }
setInterval(poll, 1000);
