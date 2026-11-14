const test = require('node:test');
const assert = require('node:assert/strict');
require('../model.js');
const M = globalThis.PhoneModel;

test('page-defined size classes include the exact small and large boundaries', () => {
  assert.equal(typeof M.screenSizeClass, 'function', 'Size classification is not implemented');
  assert.equal(M.screenSizeClass(6.32), '小屏');
  assert.equal(M.screenSizeClass(6.4), '小屏');
  assert.equal(M.screenSizeClass(6.41), '中屏');
  assert.equal(M.screenSizeClass(6.69), '中屏');
  assert.equal(M.screenSizeClass(6.7), '大屏');
  assert.equal(M.screenSizeClass(6.9), '大屏');
  assert.equal(M.screenSizeClass(null), '');
  assert.equal(M.screenSizeClass(0), '');
});
