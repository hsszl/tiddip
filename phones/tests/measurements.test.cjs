const test = require('node:test');
const assert = require('node:assert/strict');
require('../data.js');
require('../model.js');

test('foldable measurements mixed across source columns retain units and use folded thickness', () => {
  const raw = PHONE_DATA.phones.find(p => p.name === '小米 18 Fold');
  assert.ok(raw);
  const phone = PhoneModel.normalizePhone(raw);
  assert.equal(phone.metrics.weight, 219);
  assert.equal(phone.metrics.thickness, 10.68);
  assert.equal(phone.weightRaw, raw.weightRaw);
  assert.equal(phone.thicknessRaw, raw.thicknessRaw);
});

test('a millimetre value in the weight text cannot be mistaken for grams', () => {
  const phone = PhoneModel.normalizePhone({ id: 'mixed', weightRaw: '展开7.5mm', weight: null });
  assert.equal(phone.metrics.weight, null);
});
