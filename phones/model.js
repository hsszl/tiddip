(() => {
  'use strict';

  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const priceNumber = value => number(value) != null && value > 0 ? value : null;
  const screenSizeHint = '本页按屏幕对角线分档：小屏 ≤ 6.4 英寸；中屏 > 6.4 且 < 6.7 英寸；大屏 ≥ 6.7 英寸。';

  function screenSizeClass(size) {
    if (number(size) == null || size <= 0) return '';
    return size <= 6.4 ? '小屏' : size < 6.7 ? '中屏' : '大屏';
  }
  const offerKeys = new Set(['price', 'ram', 'storage']);
  const numericFields = [
    { key: 'price', label: '价格', unit: '元', step: 1, primary: true },
    { key: 'gbMulti', label: 'GB6 多核', unit: '分', step: 1, primary: true },
    { key: 'weight', label: '重量', unit: 'g', step: 0.1, primary: true,
      tip: '多配色按最重版本筛选；列表保留原始重量范围。' },
    { key: 'battery', label: '电池', unit: 'mAh', step: 1, primary: true },
    { key: 'screenSize', label: '屏幕', unit: '英寸', step: 0.01, primary: true },
    { key: 'charge', label: '有线充电', unit: 'W', step: 1, primary: true },
    { key: 'gbSingle', label: 'GB6 单核', unit: '分', step: 1 },
    { key: 'antutu', label: '安兔兔', unit: '万分', step: 0.01,
      tip: '沿用原表跑分；原表未提供测试版本，不作跨版本、跨平台比较。' },
    { key: 'gb7Single', label: 'GB7 单核', unit: '分', step: 1 },
    { key: 'gb7Multi', label: 'GB7 多核', unit: '分', step: 1 },
    { key: 'thickness', label: '厚度', unit: 'mm', step: 0.01,
      tip: '多配色按最厚版本筛选；列表保留原始厚度范围。' },
    { key: 'refresh', label: '刷新率', unit: 'Hz', step: 1 },
    { key: 'wireless', label: '无线充电', unit: 'W', step: 1,
      tip: '只解析原表明确列出的无线功率；没有标注不等于不支持。' },
    { key: 'ram', label: '运行内存', unit: 'GB', step: 1 },
    { key: 'storage', label: '存储', unit: 'GB', step: 1 },
    { key: 'mainCamera', label: '主摄', unit: 'MP', step: 1 },
    { key: 'telephoto', label: '长焦', unit: 'MP', step: 1 },
    { key: 'ultrawide', label: '超广角', unit: 'MP', step: 1 },
    { key: 'frontCamera', label: '前摄', unit: 'MP', step: 1 },
    { key: 'touch', label: '触控采样', unit: 'Hz', step: 1 },
    { key: 'touchInstant', label: '瞬时触控', unit: 'Hz', step: 1 },
    { key: 'bluetooth', label: '蓝牙版本', unit: '', step: 0.1 },
    { key: 'cpuFrequency', label: 'CPU 最高频率', unit: 'GHz', step: 0.01 },
  ];
  const facetFields = [
    { key: 'soc', label: '芯片' }, { key: 'res', label: '分辨率' },
    { key: 'screenForm', label: '屏幕形态' }, { key: 'waterproof', label: '防护' },
    { key: 'ramType', label: '内存类型' }, { key: 'romType', label: '闪存类型' },
    { key: 'usb', label: 'USB' }, { key: 'releaseYear', label: '发布年份' },
  ];
  const collator = new Intl.Collator('zh-CN', { numeric: true });
  const matchNumber = (text, pattern) => {
    const match = String(text || '').match(pattern);
    return match ? Number(match[1]) : null;
  };
  const measurementMaximum = (text, unit, fallback) => {
    const pattern = new RegExp('(\\d+(?:\\.\\d+)?(?:\\s*[-–~]\\s*\\d+(?:\\.\\d+)?)?)\\s*' + unit + '\\b', 'gi');
    const values = [...text.matchAll(pattern)].flatMap(match => match[1].match(/\d+(?:\.\d+)?/g).map(Number));
    return values.length ? Math.max(...values) : number(fallback);
  };

  function quote(entry = {}) {
    return { price: entry.out ? null : priceNumber(entry.value), date: entry.label || '',
      out: Boolean(entry.out), text: entry.outText || (entry.out ? '无货' : '') };
  }

  function makeOffers(raw) {
    const history = raw.histByCfg || {};
    const configs = [...new Set([...(raw.configs || []), ...Object.keys(history), raw.priceCfg].filter(Boolean))];
    return configs.map(config => {
      const memory = config.match(/^(?:(\d+)\+)?(\d+(?:\.\d+)?)(T|G|GB)?$/i);
      const entries = history[config] || [];
      const latest = entries.length ? quote(entries.at(-1))
        : quote(config === raw.priceCfg ? { value: raw.price, label: raw.priceDate } : {});
      const earlier = entries.slice(0, -1).findLast(entry => priceNumber(entry.value) != null || entry.out);
      return { config, ram: memory && memory[1] ? Number(memory[1]) : null,
        storage: memory ? Number(memory[2]) * (/^t$/i.test(memory[3] || '') ? 1024 : 1) : null,
        ...latest, previous: earlier ? quote(earlier) : null };
    });
  }

  function normalizePhone(raw) {
    const touchValues = [...String(raw.touch || '').matchAll(/(\d+(?:\.\d+)?)\s*Hz/gi)].map(match => Number(match[1]));
    const frequencies = [...String(raw.cpu || '').matchAll(/(\d+(?:\.\d+)?)\s*GHz/gi)].map(match => Number(match[1]));
    const measurements = `${raw.weightRaw || ''} ${raw.thicknessRaw || ''}`;
    const metrics = {
      weight: measurementMaximum(measurements, 'g', raw.weight),
      thickness: measurementMaximum(measurements, 'mm', raw.thickness),
      gbSingle: number(raw.gbSingle), gbMulti: number(raw.gbMulti),
      gb7Single: number(raw.gb7Single), gb7Multi: number(raw.gb7Multi),
      antutu: number(raw.antutu) == null ? null : raw.antutu / 10000,
      battery: number(raw.batteryNum), screenSize: number(raw.screenSize),
      refresh: number(raw.refresh), charge: number(raw.chargeNum),
      wireless: matchNumber(raw.charge, /(\d+(?:\.\d+)?)\s*W\s*无线/i),
      mainCamera: matchNumber(raw.rear, /(?:主|三摄)(\d+(?:\.\d+)?)\s*MP/i),
      telephoto: matchNumber(raw.rear, /(?:长|中焦|潜望)(\d+(?:\.\d+)?)\s*MP/i),
      ultrawide: matchNumber(raw.rear, /广(\d+(?:\.\d+)?)\s*MP/i),
      frontCamera: matchNumber(raw.front, /(\d+(?:\.\d+)?)\s*MP/i),
      touch: touchValues[0] ?? null, touchInstant: touchValues[1] ?? null,
      bluetooth: matchNumber(raw.others, /蓝牙\s*(\d+(?:\.\d+)?)/),
      cpuFrequency: frequencies.length ? Math.max(...frequencies) : null,
    };
    const facets = Object.fromEntries(facetFields.map(field => [field.key, raw[field.key] || '']));
    facets.screenForm = String(raw.screen || '').match(/微曲屏|曲屏|直屏|折叠屏/)?.[0] || '';
    facets.usb = String(raw.others || '').match(/USB\s*[\d.]+(?:\s*Gen\s*\d+)?/i)?.[0].replace(/\s+/g, ' ') || '';
    facets.releaseYear = String(raw.releaseYM || '').match(/\d{4}/)?.[0] || '';
    const searchText = Object.values(raw).filter(value => typeof value === 'string').join(' ').toLowerCase();
    return { ...raw, offers: makeOffers(raw), metrics, facets, searchText };
  }

  function buildBounds(phones) {
    return Object.fromEntries(numericFields.map(field => {
      const perPhone = phones.map(phone => offerKeys.has(field.key)
        ? phone.offers.map(offer => offer[field.key]).filter(value => value != null)
        : phone.metrics[field.key] == null ? [] : [phone.metrics[field.key]]);
      const values = perPhone.flat();
      return [field.key, { min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null, count: perPhone.filter(values => values.length).length }];
    }));
  }

  function queryPhones(phones, state = {}) {
    const ranges = Object.entries(state.ranges || {});
    const within = (value, range) => value == null || (value >= range[0] && value <= range[1]);
    const words = String(state.search || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = phones.flatMap(phone => {
      if (state.brands?.length && !state.brands.includes(phone.brand)) return [];
      if (!words.every(word => phone.searchText.includes(word))) return [];
      if (!Object.entries(state.facets || {}).every(([key, value]) => !value || phone.facets[key] === value)) return [];
      if (!ranges.filter(([key]) => !offerKeys.has(key)).every(([key, range]) => within(phone.metrics[key], range))) return [];
      const variantRanges = ranges.filter(([key]) => offerKeys.has(key));
      const offers = phone.offers.filter(offer => (!state.pricedOnly || offer.price != null)
        && variantRanges.every(([key, range]) => within(offer[key], range)));
      if (!offers.length && (state.pricedOnly || (variantRanges.length && phone.offers.length))) return [];
      const prices = offers.map(offer => offer.price).filter(value => value != null);
      return [{ phone, offers, sortPrice: prices.length ? Math.min(...prices) : null }];
    });
    const sortKey = state.sort || 'price';
    const valueOf = row => {
      if (sortKey === 'price') return row.sortPrice;
      if (sortKey === 'name') return row.phone.name || '';
      if (sortKey === 'release') {
        const match = String(row.phone.releaseYM || '').match(/(\d{4})年(\d{1,2})月/);
        return match ? Number(match[1]) * 12 + Number(match[2]) : null;
      }
      if (offerKeys.has(sortKey)) {
        const values = row.offers.map(offer => offer[sortKey]).filter(value => value != null);
        return values.length ? Math.max(...values) : null;
      }
      return row.phone.metrics[sortKey];
    };
    return rows.sort((left, right) => {
      const a = valueOf(left), b = valueOf(right);
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
      const compared = typeof a === 'string' ? collator.compare(a, b) : a - b;
      return compared * (state.direction === 'desc' ? -1 : 1) || collator.compare(left.phone.name || '', right.phone.name || '');
    });
  }

  globalThis.PhoneModel = { normalizePhone, queryPhones, buildBounds, numericFields, facetFields, screenSizeClass, screenSizeHint };
})();
