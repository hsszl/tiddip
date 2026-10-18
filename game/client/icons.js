// Small UI symbols; illustrations live separately in assets/.
const paths = {
  share: '<path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
  moon: '<path d="M20 14a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  move: '<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  attack: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  damage: '<path d="m12 6-3-3H5L2 6v5l10 10 10-10V6l-3-3h-4Z"/><path d="M8 11h8"/>',
  skill: '<path d="m14 2-9 12h6l-1 8 9-12h-6Z"/>',
  end: '<path d="M4 12h15m-6-6 6 6-6 6M21 4v16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  shield: '<path d="m12 3 8 3v6q0 6-8 9-8-3-8-9V6Z"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12v2m8-2v2m-7 3h6M1 11v5m22-5v5"/>',
  bag: '<rect x="5" y="7" width="14" height="14" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  eliminated: '<path d="M7 17a9 9 0 1 1 10 0v5H7Z"/><circle cx="8" cy="11" r="1.5"/><circle cx="16" cy="11" r="1.5"/><path d="m11 15 1-2 1 2m-3 4v3m4-3v3"/>',
  hit: '<path d="M12 20 4 12C-2 5 7-1 12 6c5-7 14-1 8 6Z"/><path d="M8 11h8"/>',
  revived: '<path d="M12 20 4 12C-2 5 7-1 12 6c5-7 14-1 8 6Z"/><path d="M8 11h8m-4-4v8"/>',
  reveal: '<path d="M2 12q10-15 20 0-10 15-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  swap: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
  draw: '<rect x="7" y="6" width="13" height="16" rx="2"/><path d="M16 3H5a2 2 0 0 0-2 2v12m7-5h7m-7 4h7"/>',
  blast: '<path d="m12 2 2 6 6-3-3 6 5 3-7 1 1 7-5-5-5 4 1-7-5-3 7-1Z"/>',
};

export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}
