import { RULES, mapDimensions } from '/game/rules.js';

const dialog = document.querySelector('#map-size-dialog');
const form = document.querySelector('#map-size-form');
const grid = document.querySelector('#map-size-grid');
const columns = document.querySelector('#map-width');
const rows = document.querySelector('#map-height');
const apply = document.querySelector('#map-size-apply');
const error = document.querySelector('#map-size-error');
const min = RULES.mapMin, max = RULES.mapMax;
let draft, anchor, onApply, signature = '';

grid.style.setProperty('--extent', max);
grid.setAttribute('aria-rowcount', max);
grid.setAttribute('aria-colcount', max);
grid.innerHTML = Array.from({ length: max }, (_, y) => `<div role="row">${Array.from({ length: max }, (_, x) =>
  `<span role="gridcell" data-x="${x}" data-y="${y}" aria-selected="false"></span>`).join('')}</div>`).join('');
const cells = [...grid.querySelectorAll('[role="gridcell"]')];
for (const input of [columns, rows]) { input.min = min; input.max = max; }
const clamp = value => Math.max(min, Math.min(max, value));

function paint() {
  const { x, y, width, height } = draft;
  columns.value = width;
  rows.value = height;
  grid.setAttribute('aria-label', `${width} 列，${height} 行；方向键调整`);
  const next = `${x},${y},${width},${height}`;
  if (next === signature) return;
  signature = next;
  for (const [name, value] of Object.entries({ column: x + 1, row: y + 1, width, height })) {
    grid.style.setProperty(`--pick-${name}`, value);
  }
  for (const cell of cells) {
    const cx = Number(cell.dataset.x), cy = Number(cell.dataset.y);
    const selected = cx >= x && cx < x + width && cy >= y && cy < y + height;
    if (cell.classList.contains('selected') !== selected) {
      cell.setAttribute('aria-selected', selected);
      cell.classList.toggle('selected', selected);
    }
  }
}

export function openMapSize(state, save) {
  draft = { x: 0, y: 0, ...mapDimensions(state) };
  onApply = save;
  anchor = null;
  error.textContent = '';
  apply.disabled = false;
  dialog.showModal();
  paint();
}

export function closeMapSize() { if (dialog.open) dialog.close(); }

function cellAt(event) {
  const first = cells[0].getBoundingClientRect();
  const last = cells.at(-1).getBoundingClientRect();
  const stepX = (last.left - first.left) / (max - 1);
  const stepY = (last.top - first.top) / (max - 1);
  return {
    x: Math.max(0, Math.min(max - 1, Math.floor((event.clientX - first.left) / stepX))),
    y: Math.max(0, Math.min(max - 1, Math.floor((event.clientY - first.top) / stepY))),
  };
}

function dragTo(event) {
  const point = cellAt(event);
  const width = clamp(Math.abs(point.x - anchor.x) + 1);
  const height = clamp(Math.abs(point.y - anchor.y) + 1);
  draft = { width, height, x: Math.min(Math.min(point.x, anchor.x), max - width), y: Math.min(Math.min(point.y, anchor.y), max - height) };
  error.textContent = '';
  paint();
}

grid.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || apply.disabled) return;
  event.preventDefault();
  grid.focus();
  anchor = cellAt(event);
  grid.setPointerCapture(event.pointerId);
  dragTo(event);
});
grid.addEventListener('pointermove', event => { if (anchor) dragTo(event); });
grid.addEventListener('pointerup', event => {
  if (!anchor) return;
  dragTo(event);
  anchor = null;
  grid.releasePointerCapture(event.pointerId);
});
grid.addEventListener('pointercancel', () => { anchor = null; });
grid.addEventListener('lostpointercapture', () => { anchor = null; });
grid.addEventListener('keydown', event => {
  const changes = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!changes || apply.disabled) return;
  event.preventDefault();
  draft = { x: 0, y: 0, width: clamp(draft.width + changes[0]), height: clamp(draft.height + changes[1]) };
  paint();
});
form.addEventListener('input', () => {
  if (!columns.validity.valid || !rows.validity.valid) return;
  const width = columns.valueAsNumber, height = rows.valueAsNumber;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return;
  draft = { x: 0, y: 0, width, height };
  error.textContent = '';
  paint();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (apply.disabled || !form.reportValidity()) return;
  apply.disabled = columns.disabled = rows.disabled = true;
  try {
    const success = await onApply({ width: columns.valueAsNumber, height: rows.valueAsNumber });
    if (success) closeMapSize();
    else error.textContent = '未保存，请重试';
  } finally { apply.disabled = columns.disabled = rows.disabled = false; }
});
