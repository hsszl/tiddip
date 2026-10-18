import { WEAPONS, ITEMS, TERRAIN } from '/game/rules.js';
import { attackInRange, skillInRange, skillMode } from '/game/range.js';
import { escapeHTML as e } from './helpers.js';
import { eventContents } from './activity.js';
import { icon } from './icons.js';

const catalogs = { weapons: WEAPONS, items: ITEMS, terrain: TERRAIN };
const dialog = document.querySelector('#inspect-dialog');
const tooltip = document.querySelector('#card-tooltip');
let anchor = null;

function cardContent(category, key, used, note = '') {
  const card = catalogs[category]?.[key];
  if (!card) return '';
  const stats = category === 'weapons' ? `<div class="card-stats"><span aria-label="血量上限 ${card.hp}">${icon('revived')}${card.hp}</span><span aria-label="伤害 1">${icon('attack')}1</span></div>` : '';
  const skillText = used === 'true' ? '已用' : skillMode(key) === 'passive' ? '被动' : key === 'sniper' ? '每局一次' : '';
  return `<img class="inspect-art" src="/game/client/assets/${category}/${key}.svg" alt="">
    <h2>${e(card.name)}</h2>${stats}<p>${e(category === 'weapons' && key === 'sniper' ? '近身射击：同格攻击一次。' : card.description)}</p>
    ${card.skill && skillText ? `<p class="skill-description">${skillText}</p>` : ''}
    ${card.detail ? `<p>${e(card.detail)}</p>` : ''}
    ${note ? `<p class="quiet">${e(note)}</p>` : ''}`;
}

function rangeDiagram(key) {
  const attacker = { id: 'self', alive: true, weapon: key, x: 4, y: 4 };
  const cells = Array.from({ length: 81 }, (_, index) => {
    const x = index % 9, y = Math.floor(index / 9);
    const valid = attackInRange(attacker, { id: 'target', alive: true, x, y });
    const center = x === 4 && y === 4;
    const skill = skillInRange(attacker, { x, y });
    return `<span class="${valid ? 'in-range' : ''} ${skill ? 'skill-in-range' : ''} ${center ? 'range-center' : ''}">${center ? '●' : ''}</span>`;
  }).join('');
  return `<figure class="range-diagram"><div class="range-grid" role="img" aria-label="圆点是自己，蓝色为攻击，紫色边框为能力">${cells}</div><figcaption>● 自己　<span class="range-key"></span> 攻击　<span class="skill-key"></span> 能力</figcaption></figure>`;
}

export function hideCardTooltip() { tooltip.hidden = true; anchor = null; }

export function inspectCard(button) {
  const [category, key] = button.dataset.cardInfo.split(':');
  const source = button.closest('[data-card-kind]');
  const content = cardContent(category, key, source?.dataset.cardUsed, source?.dataset.cardNote);
  if (!content) return;
  hideCardTooltip();
  document.querySelector('#inspect-title').textContent = catalogs[category][key].name;
  document.querySelector('#inspect-content').innerHTML = `<div class="inspect-card">${content}</div>${category === 'weapons' ? rangeDiagram(key) : ''}`;
  if (!dialog.open) dialog.showModal();
}

export function inspectEvent(entry, state) {
  if (!entry) return;
  hideCardTooltip();
  document.querySelector('#inspect-title').textContent = `第 ${entry.round} 轮`;
  // This is the original event snapshot, never the tile's current state.
  document.querySelector('#inspect-content').innerHTML = `<div class="event-detail"><div class="feed-row">${eventContents(entry, state)}</div><p>${e(entry.text)}</p></div>`;
  if (!dialog.open) dialog.showModal();
}

function show(source) {
  if (anchor === source || dialog.open) return;
  anchor = source;
  tooltip.innerHTML = cardContent(source.dataset.cardKind, source.dataset.cardKey, source.dataset.cardUsed, source.dataset.cardNote);
  tooltip.hidden = !tooltip.innerHTML;
  const rect = source.getBoundingClientRect(), bounds = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.right + 10))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(innerHeight - bounds.height - 8, rect.top))}px`;
}

document.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  const source = event.target.closest('[data-card-kind]');
  if (source) show(source); else hideCardTooltip();
});
document.addEventListener('focusin', event => {
  const source = event.target.closest('[data-card-kind]');
  if (source) show(source); else hideCardTooltip();
});
document.addEventListener('pointerout', event => {
  if (anchor && !anchor.contains(event.relatedTarget)) hideCardTooltip();
});
document.addEventListener('focusout', hideCardTooltip);
document.addEventListener('scroll', hideCardTooltip, true);
window.addEventListener('resize', hideCardTooltip);
