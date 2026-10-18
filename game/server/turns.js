import { record } from './model.js';
import { RULES } from '../rules.js';

export const activePlayer = room => room.players[room.turn];
const deadline = room => (room.now?.() ?? Date.now()) + RULES.turnSeconds * 1000;

export function startIfReady(room) {
  if (!room.players.every(player => player.x !== null)) return;
  room.phase = 'playing';
  room.turn = Math.max(0, room.players.findIndex(player => player.alive));
  room.turnEndsAt = deadline(room);
  checkVictory(room);
  if (room.phase === 'playing') record(room, `武器已公开，轮到${activePlayer(room).name}`);
}

export function checkVictory(room) {
  if (room.phase !== 'playing') return;
  const alive = room.players.filter(player => player.alive);
  if (alive.length > 1) return;
  room.phase = 'finished';
  room.pending = null;
  room.turnEndsAt = null;
  room.winnerId = alive[0]?.id || null;
  record(room, alive[0] ? `${alive[0].name}获胜` : '无人存活，平局', { kind: 'victory', actorId: alive[0]?.id || null, position: alive[0] ? { x: alive[0].x, y: alive[0].y } : null });
}

export function advanceTurn(room, expired = false) {
  if (room.phase !== 'playing') return;
  record(room, `${activePlayer(room).name}的回合${expired ? '超时' : '结束'}`, { kind: 'turn', actorId: activePlayer(room).id, expired });
  for (let count = 0; count < room.players.length; count++) {
    room.turn = (room.turn + 1) % room.players.length;
    if (room.turn === 0) room.round++;
    if (activePlayer(room).alive) break;
  }
  room.actions = { moved: false, attacked: false };
  room.turnEndsAt = deadline(room);
  record(room, `轮到${activePlayer(room).name}`);
}
