import { WEAPONS, RULES } from '../rules.js';

export function roomView(room, viewerId) {
  return {
    id: room.id, phase: room.phase, hostId: room.hostId,
    size: RULES.size, round: room.round, version: room.version,
    turnEndsAt: room.turnEndsAt ?? null,
    currentPlayerId: room.phase === 'playing' ? room.players[room.turn].id : null,
    actions: { ...room.actions }, pending: room.pending,
    winnerId: room.winnerId, log: room.log,
    tiles: room.tiles.map(tile => {
      if (!tile.revealed) return { x: tile.x, y: tile.y, revealed: false };
      const { usedBy, ...visible } = tile;
      return { ...visible, ...(tile.type === 'armory' ? { usedByMe: !!usedBy?.includes(viewerId) } : {}) };
    }),
    players: room.players.map(player => {
      return {
        id: player.id, name: player.name, color: player.color, isBot: player.isBot,
        x: player.x, y: player.y, alive: player.alive, left: !!player.left,
        hp: player.hp, weapon: player.weapon,
        maxHp: player.weapon ? WEAPONS[player.weapon].hp : null,
        shield: player.shield, skillUsed: player.skillUsed,
        itemCount: player.items.length,
        ...(player.id === viewerId ? { items: player.items.map(item => ({ ...item })) } : {}),
      };
    }),
  };
}
