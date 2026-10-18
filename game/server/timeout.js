import { destination, land } from './movement.js';
import { activePlayer, advanceTurn } from './turns.js';
import { record } from './model.js';

export function expireTurn(room, now) {
  if (room.phase !== 'playing' || !room.turnEndsAt || now < room.turnEndsAt) return false;
  const player = activePlayer(room), visited = new Set([`${player.x},${player.y}`]);
  // A pending mine landing must never freeze the deadline. Prefer safe tiles.
  while (room.pending && room.phase === 'playing' && player.alive) {
    const candidates = room.tiles.filter(tile => {
      if (!tile.revealed || visited.has(`${tile.x},${tile.y}`)) return false;
      try { destination(room, player, tile.x, tile.y); return true; } catch { return false; }
    }).sort((a, b) => Number(['mine', 'brambles'].includes(a.type) && !a.spent) - Number(['mine', 'brambles'].includes(b.type) && !b.spent));
    if (!candidates.length) {
      room.pending = null;
      record(room, `${player.name}没有合法落点，留在原格`);
      break;
    }
    const tile = candidates[0];
    visited.add(`${tile.x},${tile.y}`);
    land(room, player, tile.x, tile.y);
  }
  advanceTurn(room, true);
  return true;
}
