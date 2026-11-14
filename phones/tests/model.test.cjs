const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modelPath = path.resolve(__dirname, '../model.js');

function model() {
  assert.ok(fs.existsSync(modelPath), 'The phone filter model is not implemented');
  require(modelPath);
  return globalThis.PhoneModel;
}

const sample = {
  id: 'sample', name: '一加 15T', brand: '一加', weight: 194,
  weightRaw: '194g', thickness: 8.35, gbMulti: 11033,
  configs: ['12+256', '16+512'],
  histByCfg: {
    '12+256': [{ label: '11/9', value: 3398 }, { label: '11/11', value: 3398 }],
    '16+512': [{ label: '11/9', value: 4015 }, { label: '11/11', value: 4020 }],
  },
};

// First vertical slice: real data normalization through the filter engine.
test('weight and performance ranges combine inclusively; missing scores are not zero', () => {
  const { normalizePhone, queryPhones } = model();
  const phones = [normalizePhone(sample), normalizePhone({ id: 'unknown', name: '未知' })];
  assert.equal(queryPhones(phones, {}).length, 2);
  const found = queryPhones(phones, { ranges: { weight: [190, 194], gbMulti: [11000, 11033] } });
  assert.deepEqual(found.map(row => row.phone.id), ['sample']);
  assert.equal(queryPhones(phones, { ranges: { gbMulti: [0, 100] } }).length, 0);
});

test('price, RAM, and storage bounds must match the same configuration', () => {
  const { normalizePhone, queryPhones } = model();
  const phones = [normalizePhone(sample)];
  assert.equal(queryPhones(phones, { ranges: { price: [0, 3500], storage: [512, 1024] } }).length, 0);
  const result = queryPhones(phones, { ranges: { price: [4000, 4100], ram: [16, 24] } });
  assert.equal(result.length, 1);
  assert.equal(result[0].offers.length, 1);
  assert.equal(result[0].offers[0].config, '16+512');
  assert.equal(result[0].offers[0].previous.price, 4015);
  assert.equal(result[0].offers[0].price, 4020);
  assert.equal(result[0].sortPrice, 4020);
});

test('out of stock and missing latest quotes never fall back to old prices', () => {
  const { normalizePhone, queryPhones } = model();
  const phone = normalizePhone({ ...sample, histByCfg: {
    '12+256': [{ label: '11/9', value: 1000 }, { label: '11/11', value: null, out: true, outText: '基本无货' }],
    '16+512': [{ label: '11/9', value: 1500 }, { label: '11/11', value: null }],
  } });
  assert.equal(phone.offers[0].price, null);
  assert.equal(phone.offers[0].previous.price, 1000);
  assert.equal(queryPhones([phone], { ranges: { price: [0, 5000] } }).length, 0);
  assert.equal(queryPhones([phone], {}).length, 1);
});
