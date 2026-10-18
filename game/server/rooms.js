import { randomBytes } from 'node:crypto';
import { createRoom, addPlayer } from './model.js';
import { applyAction } from './actions.js';
import { runBots } from './bots.js';
import { roomView } from './view.js';
import { requireThat } from './errors.js';
import { validateCommand } from './action-input.js';

export function createRoomStore() {
  const rooms = new Map();
  function get(id) {
    const room = rooms.get(id.toUpperCase());
    requireThat(room, '房间不存在，或服务已经重启', 404);
    return room;
  }
  function member(room, token) {
    const player = room.players.find(item => item.token === token && !item.isBot);
    requireThat(player, '请先加入房间', 401);
    return player;
  }
  function touch(room) {
    room.version++;
    room.updatedAt = Date.now();
  }
  function session(room, player) {
    return { roomId: room.id, playerId: player.id, token: player.token, state: roomView(room, player.id) };
  }
  return {
    tick() {
      for (const room of rooms.values()) {
        if (room.phase !== 'playing' || !room.players[room.turn].isBot) continue;
        runBots(room);
        touch(room);
      }
    },
    create(name) {
      for (const [id, room] of rooms) if (Date.now() - room.updatedAt > 12 * 60 * 60 * 1000) rooms.delete(id);
      requireThat(rooms.size < 200, '房间数量已达上限', 503);
      let id;
      do { id = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(id));
      const { room, player } = createRoom(id, name);
      rooms.set(id, room);
      return session(room, player);
    },
    join(id, name) {
      const room = get(id);
      const player = addPlayer(room, name);
      touch(room);
      return session(room, player);
    },
    read(id, token) {
      const room = get(id);
      const player = member(room, token);
      room.updatedAt = Date.now();
      return roomView(room, player.id);
    },
    act(id, token, action) {
      const room = get(id);
      const player = member(room, token);
      validateCommand(action, room.version);
      applyAction(room, player, action);
      runBots(room);
      touch(room);
      return roomView(room, player.id);
    },
  };
}
