import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('theme toggles without game modules, API requests or browser storage', () => {
  const html = readFileSync(new URL('../../client/index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="\/gaogame\/client\/theme.js"><\/script>/);
  let click;
  const root = { dataset: {} };
  const button = { setAttribute() {}, addEventListener(name, fn) { if (name === 'click') click = fn; } };
  const meta = {};
  const document = { documentElement: root, querySelector: selector => selector === '#theme-toggle' ? button : meta };
  const storage = { getItem() { throw Error('storage blocked'); }, setItem() { throw Error('storage blocked'); } };
  runInNewContext(readFileSync(new URL('../../client/theme.js', import.meta.url), 'utf8'), {
    document, localStorage: storage, matchMedia: () => ({ matches: false, addEventListener() {} }),
  });
  assert.equal(root.dataset.theme, 'light');
  click();
  assert.equal(root.dataset.theme, 'dark');
  click();
  assert.equal(root.dataset.theme, 'light');
});
