import { randomUUID } from 'node:crypto';
import { RULES, WEAPONS, ITEMS } from '../rules.js';
import { requireThat } from './errors.js';

const colors = ['#b7654d', '#527e88', '#8b76a2', '#9d883f', '#6f8a50', '#c2768a'];
export const pick = array => array[Math.floor(Math.random() * array.length)];
export const newItem = () => ({ id: randomUUID(), key: pick(Object.keys(ITEMS)) });

export function record(room, text, details = {}) {
  const entry = { id: randomUUID(), text, round: room.round, ...details };
  room.log.push(entry);
  room.log = room.log.slice(-80);
  return entry;
}

function makeMap() {
  const tiles = Array.from({ length: RULES.size ** 2 }, (_, index) => ({
    x: index % RULES.size, y: Math.floor(index / RULES.size),
    type: 'ground', revealed: false, spent: false,
  }));
  const candidates = tiles.filter(tile => !(tile.x < 2 && tile.y < 2));
  for (const [type, count] of Object.entries(RULES.terrainCounts)) {
    for (let tileCount = 0; tileCount < count; tileCount++) {
      const index = Math.floor(Math.random() * candidates.length);
      candidates.splice(index, 1)[0].type = type;
    }
  }
  return tiles;
}

export function createRoom(id, name) {
  const room = {
    id, phase: 'lobby', players: [], tiles: makeMap(),
    turn: 0, round: 1, pending: null, winnerId: null,
    actions: { moved: false, attacked: false },
    log: [], version: 1, updatedAt: Date.now(),
  };
  const player = addPlayer(room, name);
  room.hostId = player.id;
  return { room, player };
}

export function addPlayer(room, name, isBot = false) {
  requireThat(room.phase === 'lobby', '对局已经开始');
  requireThat(room.players.length < RULES.maxPlayers, '房间已满');
  requireThat(typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 16, '昵称需要 1–16 个字', 400);
  const player = {
    id: randomUUID(), token: randomUUID(), name: name.trim(),
    color: colors[room.players.length], isBot, weapon: null,
    hp: 0, items: [], x: null, y: null, alive: true,
    skillUsed: false, shield: false,
  };
  room.players.push(player);
  record(room, `${player.name}加入房间`);
  return player;
}

export function startRoom(room) {
  requireThat(room.players.filter(player => !player.left).length >= 2, '至少需要两名玩家，可以添加电脑');
  room.players = room.players.filter(player => !player.left);
  room.tiles = makeMap();
  room.phase = 'spawn';
  room.turn = 0;
  room.round = 1;
  room.pending = null;
  room.turnEndsAt = null;
  room.winnerId = null;
  room.actions = { moved: false, attacked: false };
  room.log = [];
  for (const player of room.players) {
    // Weapon and card draws happen on the server, not in the browser.
    player.weapon = pick(Object.keys(WEAPONS));
    player.hp = WEAPONS[player.weapon].hp;
    player.items = [newItem(), newItem(), newItem()];
    player.x = player.y = null;
    player.alive = true;
    player.skillUsed = player.shield = false;
    player.sniperSkillUsed = false;
  }
  record(room, '开始选择出生点');
}
