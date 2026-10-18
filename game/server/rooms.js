import { randomBytes } from 'node:crypto';
import { createRoom, addPlayer } from './model.js';
import { applyAction } from './actions.js';
import { runBots } from './bots.js';
import { roomView } from './view.js';
import { requireThat } from './errors.js';
import { validateCommand } from './action-input.js';
import { expireTurn } from './timeout.js';
import { roomExpired } from './room-lifetime.js';
import { openRoomStorage } from './storage.js';
import { sourceQuotaKey } from './source.js';

export function createRoomStore({ now = Date.now, dataDir } = {}) {
  const storage = openRoomStorage(dataDir);
  let rooms;
  try { rooms = new Map(storage.load().map(room => { room.now = now; return [room.id, room]; })); }
  catch (error) { storage.close(); throw error; }
  function remove(id) { storage.remove(id); rooms.delete(id); }
  function prune() {
    for (const [id, room] of rooms) if (roomExpired(room, now())) remove(id);
  }
  function get(id) {
    prune();
    const room = rooms.get(id.toUpperCase());
    requireThat(room, '房间不存在，或已因空闲回收', 404);
    return room;
  }
  function member(room, token) {
    const player = room.players.find(item => item.token === token && !item.isBot);
    requireThat(player, '请先加入房间', 401);
    return player;
  }
  function touch(room, human = false) {
    room.version++;
    room.updatedAt = now();
    if (human) room.activityAt = now();
    storage.save(room);
  }
  function settle(room) {
    if (room.phase !== 'playing' || !(now() >= room.turnEndsAt || room.players[room.turn].isBot)) return room;
    return mutate(room, next => { expireTurn(next, now()); runBots(next); });
  }
  function mutate(room, operation, human = false) {
    const next = JSON.parse(JSON.stringify(room));
    next.now = now;
    operation(next);
    touch(next, human);
    rooms.set(next.id, next);
    return next;
  }
  function session(room, player) {
    return { roomId: room.id, playerId: player.id, token: player.token, state: roomView(room, player.id) };
  }
  return {
    close() { storage.close(); },
    tick() { prune(); for (const room of rooms.values()) settle(room); },
    authorize(id, token) { const room = get(id); return `${room.id}:${member(room, token).id}`; },
    create(name, source = 'local') {
      prune();
      source = sourceQuotaKey(source);
      requireThat([...rooms.values()].filter(room => room.creatorSource === source).length < 3, '最多保留三个房间，请先离开空房或等待回收', 429);
      requireThat(rooms.size < 200, '房间数量已达上限', 503);
      let id;
      do { id = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(id));
      const { room, player } = createRoom(id, name);
      room.now = now;
      room.creatorSource = source;
      room.createdAt = room.activityAt = room.updatedAt = now();
      storage.save(room);
      rooms.set(id, room);
      return session(room, player);
    },
    join(id, name) {
      let player;
      const room = mutate(get(id), next => { player = addPlayer(next, name); }, true);
      return session(room, player);
    },
    read(id, token) {
      let room = get(id);
      const player = member(room, token);
      room = settle(room);
      return roomView(room, player.id);
    },
    act(id, token, action) {
      let room = get(id);
      const player = member(room, token);
      room = settle(room);
      validateCommand(action, room.version);
      room = mutate(room, next => { applyAction(next, member(next, token), action); runBots(next); }, true);
      const view = roomView(room, player.id);
      if (roomExpired(room, now())) remove(room.id);
      return view;
    },
  };
}
