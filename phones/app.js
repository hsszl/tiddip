(() => {
  'use strict';
  const M = globalThis.PhoneModel;
  const data = globalThis.PHONE_DATA;
  const phones = data.phones.map(M.normalizePhone);
  const bounds = M.buildBounds(phones);
  const byId = new Map(phones.map(phone => [phone.id, phone]));
  const state = { ranges: {}, brands: [], facets: {}, search: '', sort: 'price', direction: 'asc', pricedOnly: false };
  const rangeNodes = new Map();
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmt = value => value == null ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
  const decimal = value => Number(Number(value).toFixed(4));
  let renderFrame = 0;

  function createRanges() {
    for (const field of M.numericFields) {
      const limit = bounds[field.key];
      if (!limit.count) continue;
      const min = decimal(Math.floor(limit.min / field.step + 1e-8) * field.step);
      const max = decimal(Math.ceil(limit.max / field.step - 1e-8) * field.step);
      const box = document.createElement('fieldset');
      box.className = 'range-field';
      box.dataset.field = field.key;
      box.setAttribute('aria-label', field.label);
      const title = [field.tip, `${limit.count} 款有数据；滑块仅筛选已知数值，缺失数据的机型仍保留。`].filter(Boolean).join(' ');
      box.innerHTML = `<div class="range-top"><span class="range-label" title="${esc(title)}">${esc(field.label)}<span class="range-unit">${esc(field.unit)}</span></span><button class="range-clear" type="button" aria-label="重置${esc(field.label)}" title="重置此项">×</button></div>
        <div class="range-values"><input type="number" data-edge="0" min="${min}" max="${max}" step="${field.step}" value="${min}" aria-label="${esc(field.label)}下限"><span>–</span><input type="number" data-edge="1" min="${min}" max="${max}" step="${field.step}" value="${max}" aria-label="${esc(field.label)}上限"></div>
        <div class="dual-range"><span class="range-track"></span><span class="range-fill"></span><input type="range" data-edge="0" min="${min}" max="${max}" step="${field.step}" value="${min}" aria-label="${esc(field.label)}最小值滑块"><input type="range" data-edge="1" min="${min}" max="${max}" step="${field.step}" value="${max}" aria-label="${esc(field.label)}最大值滑块"></div>`;
      const node = { box, min, max, field };
      if (field.key === 'screenSize') {
        const guide = document.createElement('div');
        guide.className = 'size-guide';
        guide.title = M.screenSizeHint;
        guide.innerHTML = '<span>小 ≤6.4</span><span>中 &lt;6.7</span><span>大 ≥6.7</span>';
        box.append(guide);
      }
      rangeNodes.set(field.key, node);
      $(field.primary ? 'primary-ranges' : 'extra-ranges').append(box);
      box.addEventListener('input', event => {
        if (event.target.type === 'range') updateRange(field.key, Number(event.target.dataset.edge), Number(event.target.value));
      });
      box.addEventListener('change', event => {
        if (event.target.type !== 'number') return;
        if (!event.target.value.trim() || !Number.isFinite(Number(event.target.value))) syncRange(field.key);
        else updateRange(field.key, Number(event.target.dataset.edge), Number(event.target.value));
      });
      box.querySelector('.range-clear').addEventListener('click', () => {
        delete state.ranges[field.key];
        syncRange(field.key);
        scheduleRender();
      });
      if (min === max) box.querySelectorAll('input[type="range"]').forEach(input => { input.disabled = true; });
    }
  }

  function updateRange(key, edge, value) {
    const node = rangeNodes.get(key);
    const range = [...(state.ranges[key] || [node.min, node.max])];
    range[edge] = decimal(Math.min(node.max, Math.max(node.min, value)));
    if (range[0] > range[1]) range[1 - edge] = range[edge];
    if (range[0] === node.min && range[1] === node.max) delete state.ranges[key];
    else state.ranges[key] = range;
    syncRange(key);
    scheduleRender();
  }

  function syncRange(key) {
    const node = rangeNodes.get(key);
    const range = state.ranges[key] || [node.min, node.max];
    node.box.classList.toggle('active', Boolean(state.ranges[key]));
    node.box.querySelectorAll('input').forEach(input => { input.value = range[Number(input.dataset.edge)]; });
    const track = node.box.querySelector('.dual-range');
    const span = node.max - node.min;
    track.style.setProperty('--low', `${span ? (range[0] - node.min) / span * 100 : 0}%`);
    track.style.setProperty('--high', `${span ? (range[1] - node.min) / span * 100 : 100}%`);
    // When handles meet at the far end, keep the lower handle reachable.
    track.querySelector('[data-edge="0"]').style.zIndex = range[0] === node.max ? '3' : '1';
    track.querySelector('[data-edge="1"]').style.zIndex = range[0] === node.max ? '2' : '3';
  }

  function createSelectors() {
    const brands = [...new Set(phones.map(phone => phone.brand))];
    $('brands').innerHTML = ['全部', ...brands].map(brand => `<button type="button" data-brand="${esc(brand === '全部' ? '' : brand)}" aria-pressed="${brand === '全部'}">${esc(brand)}</button>`).join('');
    $('brands').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const brand = button.dataset.brand;
      state.brands = !brand ? [] : state.brands.includes(brand) ? state.brands.filter(value => value !== brand) : [...state.brands, brand];
      syncBrands();
      scheduleRender();
    });
    for (const field of M.facetFields) {
      const options = [...new Set(phones.map(phone => phone.facets[field.key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
      if (!options.length) continue;
      const label = document.createElement('label');
      label.className = 'facet-label';
      label.innerHTML = `<span>${esc(field.label)}</span><select data-facet="${field.key}" aria-label="${esc(field.label)}筛选"><option value="">不限</option>${options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select>`;
      label.querySelector('select').addEventListener('change', event => {
        state.facets[field.key] = event.target.value;
        scheduleRender();
      });
      $('facet-filters').append(label);
    }
    $('sort').innerHTML = M.numericFields.filter(field => bounds[field.key].count).map(field => `<option value="${field.key}">${esc(field.label)}排序</option>`).join('') + '<option value="release">发布时间排序</option><option value="name">名称排序</option>';
    $('sort').addEventListener('change', event => { state.sort = event.target.value; scheduleRender(); });
    $('direction').addEventListener('click', () => {
      state.direction = state.direction === 'asc' ? 'desc' : 'asc';
      syncDirection();
      scheduleRender();
    });
  }

  function syncBrands() {
    $('brands').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.brand ? state.brands.includes(button.dataset.brand) : state.brands.length === 0)));
  }

  function syncDirection() {
    $('direction').textContent = state.direction === 'asc' ? '↑' : '↓';
    $('direction').setAttribute('aria-label', state.direction === 'asc' ? '当前升序，点击降序' : '当前降序，点击升序');
  }

  function imageUrl(phone) {
    return /^img\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(phone.img || '')
      ? `https://mingqimiao.cn/${phone.img}` : '';
  }

  function priceColumn(offers) {
    if (!offers.length) return '<div class="price-line"><span class="unpriced" title="来源仅收录了这款机型的参数，没有提供配置和报价。">未收录报价</span></div>';
    const lines = offers.map(offer => {
      const label = offer.price != null ? `<strong>${fmt(offer.price)}<small>（${esc(offer.config)}）</small></strong>`
        : `<span class="unpriced">${esc(offer.text || '—')}<small>（${esc(offer.config)}）</small></span>`;
      return `<div class="price-line" title="${esc(offer.date || '暂无记录')}">${label}</div>`;
    }).join('');
    const dates = [...new Set(offers.map(offer => offer.date).filter(Boolean))];
    return lines + `<div class="price-date">${esc(dates.join(' / ') || '—')}</div>`;
  }

  function spec(label, value) {
    return `<div class="spec-line" title="${esc(value || '未收录')}"><span class="label">${esc(label)}</span>${esc(value || '—')}</div>`;
  }

  function screenSpec(phone) {
    const raw = phone.screen || (phone.screenSize != null ? `${phone.screenSize}英寸` : '—');
    const screen = esc(raw).replace(/(\d+(?:\.\d+)?)\s*英寸/g, (text, size) =>
      `${text}<span class="screen-size-class" title="${esc(M.screenSizeHint)}">${M.screenSizeClass(Number(size))}</span>`);
    return `<div class="spec-line screen-line"><span class="label">屏幕</span>${screen}</div>`;
  }

  function renderRow(row) {
    const p = row.phone;
    const src = imageUrl(p);
    const image = src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : esc((p.brand || p.name || '·').slice(0, 1));
    const configs = row.offers.map(offer => offer.config).join(' / ');
    const physical = [p.weightRaw || (p.metrics.weight != null ? `${p.metrics.weight}g` : ''), p.thicknessRaw || (p.metrics.thickness != null ? `${p.metrics.thickness}mm` : '')].filter(Boolean).join(' · ');
    const benchmark = p.gbSingle != null || p.gbMulti != null ? `GB6 单核 ${fmt(p.gbSingle)} / 多核 ${fmt(p.gbMulti)}` : 'GB6 暂无数据';
    return `<details class="phone-row" data-id="${esc(p.id)}"><summary class="row-grid" aria-label="${esc(p.name)}，展开全部参数">
      <div class="phone-id"><div class="thumbnail">${image}</div><div class="identity-text"><div class="phone-name">${esc(p.name)}</div><div class="phone-sub">${esc([p.brand, configs].filter(Boolean).join(' · '))}</div><div class="phone-sub physical" title="多配色筛选采用最重、最厚值">${esc(physical || '重量 / 厚度未收录')}</div></div></div>
      <div class="prices current" data-label="最近价">${priceColumn(row.offers)}</div>
      <div class="spec-stack"><div class="spec-line chip-line"><span class="label">芯片</span>${esc(p.soc || '—')}<span class="benchmark-inline"> · ${esc(benchmark)}</span></div>${spec('电池', p.battery)}${spec('后摄', p.rear)}</div>
      <div class="spec-stack">${screenSpec(p)}${spec('充电', p.charge)}${spec('前摄', p.front)}</div>
      </summary><div class="row-details"></div></details>`;
  }

  function renderDetails(phone, target) {
    const entries = [
      ['芯片', phone.socRaw || phone.soc], ['CPU', phone.cpu],
      ['GB6 单核 / 多核', phone.gbSingle != null || phone.gbMulti != null ? `${fmt(phone.gbSingle)} / ${fmt(phone.gbMulti)}` : ''],
      ['GB7 单核 / 多核', phone.gb7Single != null || phone.gb7Multi != null ? `${fmt(phone.gb7Single)} / ${fmt(phone.gb7Multi)}` : ''],
      ['安兔兔（原表，版本未标注）', phone.antutu != null ? fmt(phone.antutu) : ''],
      ['屏幕', phone.screen], ['触控采样', phone.touch], ['重量', phone.weightRaw], ['厚度', phone.thicknessRaw],
      ['电池', phone.battery], ['充电', phone.charge], ['后摄', phone.rear], ['前摄', phone.front],
      ['运行内存', phone.ramType], ['闪存', phone.romType], ['防护', phone.waterproof], ['其他', phone.others],
      ['发布时间', phone.releaseYM], ['报价口径', phone.priceSource],
      ['SIM', phone.sim], ['系统', phone.os], ['二手', phone.used], ['评分', phone.rating],
      ['发布记录', phone.pubTime], ['备注', phone.note],
    ];
    target.innerHTML = `<dl class="detail-grid">${entries.filter(([, value]) => value != null && value !== '').map(([label, value]) => `<div class="detail-pair"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
    if (/^https?:\/\//i.test(phone.gbUrl || '')) {
      const link = document.createElement('a');
      link.className = 'score-source';
      link.textContent = '跑分原始来源 ↗';
      link.href = phone.gbUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      target.append(link);
    }

  }

  function render() {
    renderFrame = 0;
    const rows = M.queryPhones(phones, state);
    $('results').innerHTML = rows.map(renderRow).join('');
    $('count').textContent = `${rows.length} / ${phones.length} 款`;
    $('empty').hidden = rows.length !== 0;
    const extra = M.numericFields.filter(field => !field.primary && state.ranges[field.key]).length + Object.values(state.facets).filter(Boolean).length;
    $('more-active').textContent = extra ? `· ${extra} 项` : '';
    $('results').querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', () => {
      const target = detail.querySelector('.row-details');
      if (detail.open && !target.childElementCount) renderDetails(byId.get(detail.dataset.id), target);
    }));
    $('results').querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
      const phone = byId.get(image.closest('.phone-row').dataset.id);
      image.parentElement.textContent = (phone.brand || '·').slice(0, 1);
    }, { once: true }));
  }

  function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(render);
  }

  function reset() {
    state.ranges = {};
    state.brands = [];
    state.facets = {};
    state.search = '';
    state.sort = 'price';
    state.direction = 'asc';
    state.pricedOnly = false;
    $('priced-only').checked = false;
    $('search').value = '';
    $('sort').value = 'price';
    $('facet-filters').querySelectorAll('select').forEach(select => { select.value = ''; });
    rangeNodes.forEach((_, key) => syncRange(key));
    syncBrands();
    syncDirection();
    scheduleRender();
  }

  createRanges();
  createSelectors();
  $('search').addEventListener('input', event => { state.search = event.target.value; scheduleRender(); });
  $('priced-only').addEventListener('change', event => { state.pricedOnly = event.target.checked; scheduleRender(); });
  $('reset').addEventListener('click', reset);
  $('empty-reset').addEventListener('click', reset);
  $('updated').textContent = data.meta.updatedAt || data.meta.latestLabel;
  render();
})();
