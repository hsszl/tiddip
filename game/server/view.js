import { WEAPONS, RULES } from '../rules.js';

export function roomView(room, viewerId) {
  return {
    id: room.id, phase: room.phase, hostId: room.hostId,
    size: RULES.size, round: room.round, version: room.version,
    currentPlayerId: room.phase === 'playing' ? room.players[room.turn].id : null,
    actions: { ...room.actions }, pending: room.pending,
    winnerId: room.winnerId, log: room.log,
    tiles: room.tiles.map(tile => {
      if (!tile.revealed) return { x: tile.x, y: tile.y, revealed: false };
      const { usedBy, ...visible } = tile;
      return { ...visible, ...(tile.type === 'armory' ? { usedByMe: !!usedBy?.includes(viewerId) } : {}) };
    }),
    players: room.players.map(player => {
      const weaponVisible = room.phase !== 'spawn' || player.id === viewerId;
      return {
        id: player.id, name: player.name, color: player.color, isBot: player.isBot,
        x: player.x, y: player.y, alive: player.alive,
        hp: weaponVisible ? player.hp : null,
        weapon: weaponVisible ? player.weapon : null,
        maxHp: weaponVisible && player.weapon ? WEAPONS[player.weapon].hp : null,
        shield: player.shield, skillUsed: weaponVisible ? player.skillUsed : null,
        itemCount: player.items.length,
        ...(player.id === viewerId ? { items: player.items.map(item => ({ ...item })) } : {}),
      };
    }),
  };
}
