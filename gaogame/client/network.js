const KEY = 'tiddip-game-session';
const ROOM_KEY = 'tiddip-game-room:';
const NAME_KEY = 'tiddip-game-nickname';

function readSession(key, shared = false) {
  try {
    const value = JSON.parse((shared ? localStorage : sessionStorage).getItem(key));
    return value && /^[A-F0-9]{6}$/.test(value.roomId) &&
      typeof value.playerId === 'string' && value.playerId.length > 0 &&
      typeof value.token === 'string' && value.token.length > 0 ? value : null;
  } catch { return null; }
}

export function savedSession(roomId) {
  const tab = readSession(KEY);
  // An existing tab keeps its player, even if another tab joined the same room.
  if (!roomId || tab?.roomId === roomId) return tab;
  const remembered = readSession(`${ROOM_KEY}${roomId}`, true);
  return remembered?.roomId === roomId ? remembered : tab;
}

export function saveSession(session) {
  const previous = readSession(KEY);
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch { /* The game still works when browser storage is unavailable. */ }
  try {
    if (session) localStorage.setItem(`${ROOM_KEY}${session.roomId}`, JSON.stringify(session));
    // An older tab leaving must not erase a newer player's remembered identity.
    else if (previous && readSession(`${ROOM_KEY}${previous.roomId}`, true)?.token === previous.token) {
      localStorage.removeItem(`${ROOM_KEY}${previous.roomId}`);
    }
  } catch { /* Cross-tab recovery is optional; the current session still works. */ }
}

export function savedName() {
  try { return localStorage.getItem(NAME_KEY)?.trim().slice(0, 16) || '玩家'; }
  catch { return '玩家'; }
}

export function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); }
  catch { /* Nickname memory is optional. */ }
}

export async function request(path, body, token) {
  const response = await fetch(`/gaogame/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(7000), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || '请求失败');
    error.status = response.status;
    throw error;
  }
  return data;
}
