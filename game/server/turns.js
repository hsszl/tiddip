import { record } from './model.js';

export const activePlayer = room => room.players[room.turn];

export function startIfReady(room) {
  if (!room.players.every(player => player.x !== null)) return;
  room.phase = 'playing';
  room.turn = Math.max(0, room.players.findIndex(player => player.alive));
  checkVictory(room);
  if (room.phase === 'playing') record(room, `武器已公开，轮到${activePlayer(room).name}`);
}

export function checkVictory(room) {
  if (room.phase !== 'playing') return;
  const alive = room.players.filter(player => player.alive);
  if (alive.length > 1) return;
  room.phase = 'finished';
  room.pending = null;
  room.winnerId = alive[0]?.id || null;
  record(room, alive[0] ? `${alive[0].name}获胜` : '无人存活，平局');
}

export function advanceTurn(room) {
  if (room.phase !== 'playing') return;
  record(room, `${activePlayer(room).name}的回合结束`, { kind: 'turn', actorId: activePlayer(room).id });
  for (let count = 0; count < room.players.length; count++) {
    room.turn = (room.turn + 1) % room.players.length;
    if (room.turn === 0) room.round++;
    if (activePlayer(room).alive) break;
  }
  room.actions = { moved: false, attacked: false };
  record(room, `轮到${activePlayer(room).name}`);
}
