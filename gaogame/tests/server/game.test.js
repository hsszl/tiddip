import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../server/app.js';

async function withGame(run) {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/gaogame/api`;
  async function call(path, body, token) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    return { status: response.status, data };
  }
  try { await run(call); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('two authenticated players share tiles while hands and credentials stay private', () => withGame(async call => {
  const first = await call('/rooms', { name: '甲' });
  assert.equal(first.status, 201);
  const a = first.data;
  const second = await call(`/rooms/${a.roomId}/join`, { name: '乙' });
  assert.equal(second.status, 201);
  const b = second.data;
  const action = async (session, body) => {
    const latest = await call(`/rooms/${a.roomId}`, undefined, session.token);
    return call(`/rooms/${a.roomId}/actions`, { expectedVersion: latest.data.version, ...body }, session.token);
  };
  assert.equal((await action(b, { type: 'start' })).status, 403);
  assert.equal((await action(a, { type: 'start' })).status, 200);
  await action(a, { type: 'spawn', x: 0, y: 0 });
  const started = await action(b, { type: 'spawn', x: 1, y: 0 });
  assert.equal(started.data.phase, 'playing');
  assert.equal(started.data.tiles.filter(tile => tile.revealed).length, 2);
  assert.equal(started.data.tiles.find(tile => !tile.revealed).type, undefined);
  assert.equal(started.data.players.find(player => player.id === a.playerId).items, undefined);
  assert.equal(started.data.players.find(player => player.id === b.playerId).items.length, 3);
  assert.equal(JSON.stringify(started.data).includes(a.token), false);
  assert.equal((await action(b, { type: 'move', x: 2, y: 0 })).status, 409);
  assert.equal((await action(a, { type: 'move', x: 0, y: 1 })).status, 200);
  assert.equal((await action(a, { type: 'move', x: 0, y: 2 })).status, 409);
  const synced = await call(`/rooms/${a.roomId}`, undefined, b.token);
  assert.equal(synced.data.tiles.find(tile => tile.x === 0 && tile.y === 1).revealed, true);
  for (const player of synced.data.players) {
    assert.equal(synced.data.tiles.find(tile => tile.x === player.x && tile.y === player.y).revealed, true);
  }
  assert.equal((await action(a, { type: 'end' })).data.currentPlayerId, b.playerId);
  assert.equal((await call(`/rooms/${a.roomId}`)).status, 401);
}));

test('computer opponent makes a solo demo usable without pretending to be a human', () => withGame(async call => {
  const created = await call('/rooms', { name: '试玩者' });
  assert.equal(created.status, 201);
  const session = created.data;
  const path = `/rooms/${session.roomId}/actions`;
  const action = async body => {
    const latest = await call(`/rooms/${session.roomId}`, undefined, session.token);
    return call(path, { expectedVersion: latest.data.version, ...body }, session.token);
  };
  assert.equal((await action({ type: 'addBot' })).data.players.filter(player => player.isBot).length, 1);
  await action({ type: 'start' });
  const playing = await action({ type: 'spawn', x: 0, y: 0 });
  assert.equal(playing.data.phase, 'playing');
  const next = await action({ type: 'end' });
  assert.equal(next.data.currentPlayerId, session.playerId);
  assert.ok(next.data.log.some(entry => entry.text.includes('电脑')));
}));
