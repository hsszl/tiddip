const test = require('node:test');
const assert = require('node:assert/strict');
require('../model.js');
const M = globalThis.PhoneModel;

test('supplement values have explicit parentheses and never replace known values', () => {
  const phone = { supplement: { fields: {
    weight: { value: 210, unit: 'g', kind: 'estimate', method: '同类机型参考', sources: ['https://example.com/spec'] },
    wireless: { value: 0, unit: 'W', kind: 'reference', method: '规格明确不支持', sources: ['https://example.com/spec'] },
    cpu: { value: '最高4.6GHz', unit: '文本' },
    ram: { value: '12 / 16', unit: 'GB' },
  } } };
  assert.equal(M.valueText(phone, 'weight', null, 'g'), '（预估210g）');
  assert.equal(M.valueText(phone, 'weight', 195, 'g'), '195g');
  assert.equal(M.valueText(phone, 'weight', '193–195g', 'g'), '193–195g');
  assert.equal(M.valueText(phone, 'wireless', null, 'W'), '（预估0W）');
  assert.equal(M.valueText(phone, 'gb7Multi', null), '');
  assert.equal(M.valueText(phone, 'cpu', null), '（预估最高4.6GHz）');
  assert.equal(M.valueText(phone, 'ram', null), '（预估12 / 16GB）');
});

test('display supplements do not change missing-value filtering or original data', () => {
  const raw = { id: 'unpriced', name: '未报价机型', configs: [], gbMulti: null };
  const original = structuredClone(raw);
  const phone = { ...M.normalizePhone(raw), supplement: {
    fields: { gbMulti: { value: 1000 } }, prices: { default: { value: 500 } },
  } };
  assert.equal(phone.metrics.gbMulti, null);
  assert.deepEqual(phone.offers, []);
  assert.equal(M.queryPhones([phone], { ranges: { price: [5000, 6000], gbMulti: [10000, 20000] } }).length, 1);
  assert.equal(M.queryPhones([phone], { pricedOnly: true }).length, 0);
  assert.deepEqual(raw, original);
});
