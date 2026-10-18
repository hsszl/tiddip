import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { createRoomStore } from './rooms.js';

test('private disk state restores tokens, hidden cards, deadlines and source quota', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tiddip-store-'));
  let store;
  try {
    store = createRoomStore({ dataDir });
    const a = store.create('甲', '192.0.2.1'), b = store.join(a.roomId, '乙');
    const act = (s, command) => store.act(a.roomId, s.token, { ...command, expectedVersion: store.read(a.roomId, a.token).version });
    act(a, { type: 'start' }); act(a, { type: 'spawn', x: 0, y: 0 }); act(b, { type: 'spawn', x: 1, y: 0 });
    const before = store.read(a.roomId, a.token);
    store.create('二', '192.0.2.1'); store.create('三', '192.0.2.1');
    store.close();
    store = createRoomStore({ dataDir });
    assert.deepEqual(store.read(a.roomId, a.token), before);
    assert.equal(store.read(a.roomId, b.token).players.find(p => p.id === a.playerId).items, undefined);
    assert.throws(() => store.create('四', '192.0.2.1'), e => e.status === 429);
    assert.throws(() => createRoomStore({ dataDir }), /已被另一个进程/);
  } finally {
    store?.close?.();
    assert.ok(dataDir.startsWith(join(tmpdir(), 'tiddip-store-')));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('a stale lock with a reused current PID can be recovered', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tiddip-store-'));
  let store;
  try {
    writeFileSync(join(dataDir, 'process.lock'), JSON.stringify({ pid: process.pid, host: hostname(), start: 'previous-process' }));
    store = createRoomStore({ dataDir });
    assert.doesNotThrow(() => store.create('恢复'));
  } finally {
    store?.close();
    assert.ok(dataDir.startsWith(join(tmpdir(), 'tiddip-store-')));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('a different PID namespace cannot have its live lock stolen', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tiddip-store-'));
  try {
    writeFileSync(join(dataDir, 'process.lock'), JSON.stringify({ pid: process.pid, host: hostname(), start: 'other-start', namespace: 'another-namespace' }));
    assert.throws(() => createRoomStore({ dataDir }), /另一 PID 命名空间/);
  } finally {
    assert.ok(dataDir.startsWith(join(tmpdir(), 'tiddip-store-')));
    rmSync(dataDir, { recursive: true, force: true });
  }
});
