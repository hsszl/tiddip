import { TERRAIN, WEAPONS, ITEMS } from '/gaogame/rules.js';
import { escapeHTML as e } from './helpers.js';

// Put the full reference in the rules dialog, away from the board.
for (const [id, category, catalog] of [['weapon-catalog', 'weapons', WEAPONS], ['terrain-catalog', 'terrain', TERRAIN], ['item-catalog', 'items', ITEMS]]) {
  document.getElementById(id).innerHTML = Object.entries(catalog).map(([key, entry]) => `
    <div class="catalog-entry"><img src="/gaogame/client/assets/${category}/${key}.svg" alt="">
      <div><strong>${e(entry.name)}${entry.hp ? ` · ${entry.hp} 血` : ''}</strong><p>${e(entry.description)}${e(entry.detail || '')}</p></div>
    </div>`).join('');
}
