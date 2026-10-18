import test from 'node:test';
import assert from 'node:assert/strict';
import { savedSession, saveSession } from './network.js';

// Browser storage is unavailable in Node; each Map models a separate storage area.
const storage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
};
const a = { roomId: 'ABC123', playerId: 'player-a', token: 'token-a' };
const b = { roomId: 'ABC123', playerId: 'player-b', token: 'token-b' };

test('an invitation opened in a fresh tab recovers that room identity', () => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  saveSession(a);
  globalThis.sessionStorage = storage();
  assert.deepEqual(savedSession('ABC123'), a);
  assert.equal(savedSession('DEF456'), null);
  assert.equal(savedSession(), null);
});

test('existing tabs keep separate players and leaving one does not erase the other', () => {
  globalThis.localStorage = storage();
  const first = storage(), second = storage();
  globalThis.sessionStorage = first;
  saveSession(a);
  globalThis.sessionStorage = second;
  saveSession(b);
  globalThis.sessionStorage = first;
  assert.deepEqual(savedSession('ABC123'), a);
  saveSession(null);
  globalThis.sessionStorage = storage();
  assert.deepEqual(savedSession('ABC123'), b);
});

test('corrupt stored credentials are ignored and denied shared storage preserves the tab', () => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  sessionStorage.setItem('tiddip-game-session', '{');
  assert.equal(savedSession('ABC123'), null);
  sessionStorage.setItem('tiddip-game-session', JSON.stringify({ roomId: 'ABC123' }));
  assert.equal(savedSession('ABC123'), null);
  globalThis.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  saveSession(a);
  assert.deepEqual(savedSession('ABC123'), a);
});
