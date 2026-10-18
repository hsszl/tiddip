import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createApp } from '../../server/app.js';

async function withServer(run) {
  const server = createApp();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('config supplies demo rules without exposing hidden game state', () => withServer(async base => {
  const response = await fetch(`${base}/gaogame/api/config`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.rules.size, 8);
  assert.equal(Object.keys(body.weapons).length, 10);
  assert.equal(body.designs, undefined);
  assert.equal(body.players, undefined);
}));

test('health is live JSON and unsupported methods are rejected', () => withServer(async base => {
  const response = await fetch(`${base}/gaogame/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
  const post = await fetch(`${base}/gaogame/api/health`, { method: 'DELETE' });
  assert.equal(post.status, 405);
}));

test('public page and shared rules load with correct content types', () => withServer(async base => {
  const page = await fetch(`${base}/gaogame/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /type="module"/);
  const catalog = await fetch(`${base}/gaogame/rules.js`);
  assert.equal(catalog.status, 200);
  assert.match(catalog.headers.get('content-type'), /javascript/);
  const head = await fetch(`${base}/gaogame/`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
}));

test('server code, config, documents and missing assets remain private', () => withServer(async base => {
  for (const path of ['server/app.js', 'package.json', 'CHECKLIST.md', 'client/missing.svg']) {
    assert.equal((await fetch(`${base}/gaogame/${path}`)).status, 404, path);
  }
}));

test('encoded traversal cannot expose files outside the public client', () => withServer(async base => {
  const response = await new Promise((resolve, reject) => {
    request(`${base}/gaogame/client/%2e%2e%2fserver/app.js`, result => {
      result.resume();
      resolve(result.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(response, 404);
}));

test('old game path is reserved rather than redirected to gaogame', () => withServer(async base => {
  for (const path of ['/game/?room=ABC123', '/game/api/health']) {
    const response = await fetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
  }
}));
