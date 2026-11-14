const test = require('node:test');
const assert = require('node:assert/strict');
require('../data.js');
require('../model.js');
const M = globalThis.PhoneModel;
const raw = globalThis.PHONE_DATA.phones.find(phone => phone.id === 'm49');

// The additional controls must work with the source snapshot, not mock totals.
test('brand multi-select intersects with ranges and case-insensitive search', () => {
  const phones = [M.normalizePhone(raw), M.normalizePhone({ ...raw, id: 'b', brand: '小米', weightRaw: '210g' })];
  assert.equal(M.queryPhones(phones, { brands: ['一加', '小米'] }).length, 2);
  assert.equal(M.queryPhones(phones, { brands: ['小米'], ranges: { weight: [0, 200] } }).length, 0);
  assert.equal(M.queryPhones(phones, { search: '15t 一加' }).length, 2);
  assert.equal(M.queryPhones(phones, { search: '不存在的型号' }).length, 0);
});

test('sorting keeps unknown values last in both directions without mutating input', () => {
  const phones = [M.normalizePhone({ id: 'n', name: '未知' }), M.normalizePhone(raw),
    M.normalizePhone({ ...raw, id: 'b', weightRaw: '180g' })];
  assert.deepEqual(M.queryPhones(phones, { sort: 'weight', direction: 'asc' }).map(r => r.phone.id), ['b', 'm49', 'n']);
  assert.deepEqual(M.queryPhones(phones, { sort: 'weight', direction: 'desc' }).map(r => r.phone.id), ['m49', 'b', 'n']);
  assert.equal(phones[0].id, 'n');
});

test('finish ranges use the heaviest and thickest version and preserve original strings', () => {
  const phone = M.normalizePhone({ ...raw, weightRaw: '198-206g', thicknessRaw: '7.8-8.3mm' });
  assert.equal(phone.metrics.weight, 206);
  assert.equal(phone.metrics.thickness, 8.3);
  assert.equal(phone.weightRaw, '198-206g');
  assert.equal(M.queryPhones([phone], { ranges: { weight: [0, 200] } }).length, 0);
});

test('camera, charging, touch, Bluetooth, and benchmark versions stay separate', () => {
  const phone = M.normalizePhone({ ...raw, rear: '主50MP + 长50MP + 广8MP', gb7Multi: 750 });
  assert.equal(phone.metrics.wireless, 50);
  assert.equal(phone.metrics.mainCamera, 50);
  assert.equal(phone.metrics.telephoto, 50);
  assert.equal(phone.metrics.ultrawide, 8);
  assert.equal(phone.metrics.frontCamera, 16);
  assert.equal(phone.metrics.touch, 330);
  assert.equal(phone.metrics.touchInstant, 3200);
  assert.equal(phone.metrics.bluetooth, 6);
  assert.equal(phone.metrics.gbMulti, 11033);
  assert.equal(phone.metrics.gb7Multi, 750);
  assert.equal(M.normalizePhone({ id: 'b', charge: '100W' }).metrics.wireless, null);
});

test('categorical filters and all numeric bounds are derived from the source dataset', () => {
  const phones = globalThis.PHONE_DATA.phones.map(M.normalizePhone);
  const only = M.queryPhones(phones, { facets: { res: '1.5K', screenForm: '直屏' } });
  assert.ok(only.length > 0 && only.length < phones.length);
  assert.ok(only.every(row => row.phone.facets.res === '1.5K' && row.phone.facets.screenForm === '直屏'));
  assert.ok(M.numericFields.some(field => field.key === 'thickness'));
  assert.ok(M.numericFields.some(field => field.key === 'frontCamera'));
  const bounds = M.buildBounds(phones);
  assert.equal(bounds.weight.count, 158);
  assert.equal(bounds.gbMulti.count, 95);
  assert.equal(bounds.gb7Multi.count, 10);
  assert.equal(phones.length, globalThis.PHONE_DATA.meta.count);
  assert.equal(new Set(phones.map(p => p.id)).size, phones.length);
});

test('storage-only Apple variants do not acquire invented RAM; terabytes use GB', () => {
  const p = M.normalizePhone({ id: 'a', configs: ['256', '16+1T'] });
  assert.equal(p.offers[0].ram, null);
  assert.equal(p.offers[0].storage, 256);
  assert.equal(p.offers[1].storage, 1024);
});
