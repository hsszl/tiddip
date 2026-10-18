const minute = 60000;
const idleLimits = { lobby: 15 * minute, spawn: 10 * minute, playing: 30 * minute, finished: 10 * minute };

export function roomExpired(room, now) {
  return now - room.createdAt >= 6 * 60 * minute
    || now - room.activityAt >= idleLimits[room.phase]
    || !room.players.some(player => !player.isBot && !player.left);
}
