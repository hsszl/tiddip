const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../game.js');

// Exercise the actual app event handlers; graphics and browser I/O are inert.
function inputHarness(saved = new Map()) {
  const events = new Map(), nodes = new Map();
  let game, scheduled;
  const buttons = new Set(['action', 'pause', 'sound', 'fullscreen', 'hellMode']);
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      dataset: {}, attributes: {}, classList: { remove() {} }, textContent: '', hidden: false,
      closest(selector) { return buttons.has(id) && selector.split(',').map(x => x.trim()).includes('button') ? this : null; },
      addEventListener(type, fn) { events.set(`${id}:${type}`, fn); },
      setAttribute(name, value) { this.attributes[name] = value; }, focus() {},
    });
    return nodes.get(id);
  };
  const context = {
    URL, location: { href: 'https://tiddip.com/dive/' }, history: { replaceState() {} },
    navigator: {}, performance: { now: () => 1000 },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem(key, value) { saved.set(key, value); } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame(callback) { scheduled = callback; return 1; }, cancelAnimationFrame() {},
    window: { addEventListener() {} },
    document: {
      getElementById: node, hidden: false, body: { dataset: {} }, documentElement: {},
      addEventListener(type, fn) { events.set(`document:${type}`, fn); },
    },
    Dive: {
      Game: class extends Dive.Game { constructor() { super({ random: () => .5 }); game = this; } },
      Renderer: class {
        constructor() { this.loaded = true; this.ready = Promise.resolve(); }
        resize() { return Dive.W; }
        draw() {}
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  return {
    game, saved, node,
    get pageState() { return context.document.body.dataset.state; },
    tick(now = 1000) { const callback = scheduled; scheduled = null; callback(now); },
    click(id) { events.get(`${id}:click`)({ target: node(id) }); },
    key(key, target = 'stage') {
      events.get('document:keydown')({ key, target: node(target), repeat: false, preventDefault() {} });
    },
  };
}

test('the result menu opens settings, preserves the round, and persists the difficulty switch', () => {
  const app = inputHarness();
  app.click('action');
  app.game.player.y = Dive.FLOOR;
  app.game.step(1 / 120);
  const frozen = JSON.stringify(app.game.player);
  app.click('pause');
  assert.equal(app.pageState, 'settings');
  app.key(' ');
  assert.equal(app.game.state, 'over');
  assert.equal(JSON.stringify(app.game.player), frozen);
  app.click('hellMode');
  assert.equal(app.game.hellMode, false);
  assert.equal(app.node('hellMode').attributes['aria-checked'], 'false');
  app.key('escape');
  assert.equal(app.pageState, 'over');
  assert.equal(inputHarness(app.saved).game.hellMode, false);
});

test('MAX persists only in local browser storage across reloads and never decreases', () => {
  const app = inputHarness();
  app.click('action');
  app.game.pipes = [{ x: -60, width: 34, top: 100, bottom: 400, scored: false }];
  app.game.step(1 / 120);
  app.tick();
  assert.equal(app.saved.get('tiddip.dive.best.v1'), '1');
  const reloaded = inputHarness(app.saved);
  assert.equal(Number(reloaded.node('best').textContent), 1);
  reloaded.click('action');
  reloaded.game.player.y = Dive.FLOOR;
  reloaded.game.step(1 / 120);
  reloaded.tick();
  assert.equal(reloaded.node('result').textContent, 'MAX 1');
  assert.equal(app.saved.get('tiddip.dive.best.v1'), '1', 'a lower-scoring round must not overwrite MAX');
  assert.equal(Number(inputHarness().node('best').textContent), 0, 'another browser has its own MAX');
});

test('blocked local storage still allows a session-only MAX without a backend fallback', () => {
  const blocked = { get() { throw Error('blocked'); }, set() { throw Error('blocked'); } };
  const app = inputHarness(blocked);
  app.click('action');
  app.game.pipes = [{ x: -60, width: 34, top: 100, bottom: 400, scored: false }];
  app.game.step(1 / 120);
  app.tick();
  assert.equal(Number(app.node('best').textContent), 1);
  assert.equal(Number(inputHarness(blocked).node('best').textContent), 0);
});

for (const target of ['stage', 'pause']) {
  test(`pause/resume preserves velocity when focus is on ${target}`, () => {
    const app = inputHarness();
    app.click('action');
    for (let i = 0; i < 60; i++) app.game.step(1 / 120);
    const { y, vy } = app.game.player;
    if (target === 'pause') app.click('pause');
    else app.key('p');
    assert.equal(app.game.state, 'paused');
    app.key('p', target);
    assert.equal(app.game.state, 'playing');
    assert.equal(app.game.player.y, y);
    assert.equal(app.game.player.vy, vy);
  });
}
