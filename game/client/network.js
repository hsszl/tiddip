const KEY = 'tiddip-game-session';

export function savedSession() {
  try { return JSON.parse(sessionStorage.getItem(KEY)); }
  catch { return null; }
}

export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  } catch { /* The game still works when browser storage is unavailable. */ }
}

export async function request(path, body, token) {
  const response = await fetch(`/game/api${path}`, {
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
