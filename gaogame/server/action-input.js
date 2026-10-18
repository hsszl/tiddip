import { requireThat } from './errors.js';

const fields = {
  leave: [], addBot: [], start: [], restart: [], end: [], terrain: [],
  resize: ['width', 'height'],
  spawn: ['x', 'y'], move: ['x', 'y'], land: ['x', 'y'],
  attack: ['targetId'], skill: ['targetId', 'x', 'y'], item: ['itemId', 'x', 'y', 'targetId'],
};

// Commands carry intent only. The server owns HP, inventory, rolls and turns.
export function validateCommand(action, version) {
  requireThat(action && Object.hasOwn(fields, action.type), '不认识这个行动', 400);
  const allowed = new Set(['type', 'expectedVersion', ...fields[action.type]]);
  requireThat(Object.keys(action).every(key => allowed.has(key)), '行动包含不允许的字段', 400);
  requireThat(Number.isSafeInteger(action.expectedVersion), '缺少有效的对局版本', 400);
  // Leaving acts only on the authenticated session and is safe across turn changes.
  requireThat(action.type === 'leave' || action.expectedVersion === version, '对局已更新，请重新操作', 409);
}
