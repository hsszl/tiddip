const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../game.js');

// Exercise the actual app event handlers; graphics and browser I/O are inert.
function inputHarness() {
  const events = new Map(), nodes = new Map();
  let game;
  const buttons = new Set(['action', 'pause', 'sound', 'fullscreen']);
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      dataset: {}, classList: { remove() {} }, textContent: '', hidden: false,
      closest(selector) { return buttons.has(id) && selector.split(',').map(x => x.trim()).includes('button') ? this : null; },
      addEventListener(type, fn) { events.set(`${id}:${type}`, fn); },
      setAttribute() {}, focus() {},
    });
    return nodes.get(id);
  };
  const context = {
    URL, location: { href: 'https://tiddip.com/dive/' }, history: { replaceState() {} },
    navigator: {}, performance: { now: () => 1000 },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
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
    game,
    click(id) { events.get(`${id}:click`)({ target: node(id) }); },
    key(key, target = 'stage') {
      events.get('document:keydown')({ key, target: node(target), repeat: false, preventDefault() {} });
    },
  };
}

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
