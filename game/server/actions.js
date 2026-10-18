import { addPlayer, record, startRoom } from './model.js';
import { requireThat } from './errors.js';
import { attack } from './combat.js';
import { spawn, move, land } from './movement.js';
import { useItem } from './items.js';
import { useWeaponSkill } from './skills.js';
import { activateTerrain } from './armory.js';
import { activePlayer, advanceTurn, checkVictory, startIfReady } from './turns.js';

function start(room) {
  startRoom(room);
  for (const bot of room.players.filter(player => player.isBot)) {
    const index = room.players.indexOf(bot);
    spawn(room, bot, 3 + index % 3, 3 + Math.floor(index / 3));
  }
}

export function applyAction(room, player, action) {
  requireThat(action && typeof action.type === 'string', '缺少行动类型', 400);
  const host = () => requireThat(player.id === room.hostId, '只有房主可以操作', 403);
  if (action.type === 'leave') {
    record(room, `${player.name}离开房间`, { kind: 'leave', actorId: player.id, actorName: player.name });
    player.left = true;
    player.token = null;
    if (room.phase === 'lobby') room.players = room.players.filter(item => item.id !== player.id);
    else {
      player.alive = false;
      if (player.x === null) {
        const tile = room.tiles.find(item => item.type === 'ground');
        player.x = tile.x; player.y = tile.y; tile.revealed = true;
      }
      if (room.pending?.playerId === player.id) room.pending = null;
      if (room.phase === 'spawn') startIfReady(room);
      checkVictory(room);
      if (room.phase === 'playing' && activePlayer(room).id === player.id) advanceTurn(room);
    }
    if (room.hostId === player.id) room.hostId = room.players.find(item => !item.isBot && !item.left && item.id !== player.id)?.id || null;
    return;
  }
  if (action.type === 'addBot') {
    host();
    addPlayer(room, `电脑${room.players.filter(item => item.isBot).length + 1}`, true);
    return;
  }
  if (action.type === 'start' || action.type === 'restart') {
    host();
    requireThat(action.type === 'start' ? room.phase === 'lobby' : room.phase === 'finished', '现在不能开始新对局');
    start(room);
    return;
  }
  if (action.type === 'spawn') {
    requireThat(room.phase === 'spawn', '现在不是选出生点阶段');
    spawn(room, player, action.x, action.y);
    return;
  }
  requireThat(room.phase === 'playing', '对局还没开始或已经结束');
  requireThat(player.alive && activePlayer(room).id === player.id, '还没轮到你');
  if (room.pending) {
    requireThat(action.type === 'land', '请先选择炸飞落点');
    land(room, player, action.x, action.y);
  } else {
    const handlers = {
      move: () => move(room, player, action.x, action.y),
      attack: () => attack(room, player, action.targetId),
      skill: () => useWeaponSkill(room, player, action),
      terrain: () => activateTerrain(room, player),
      item: () => useItem(room, player, action.itemId, action.x, action.y, action.targetId),
      end: () => advanceTurn(room),
    };
    requireThat(Object.hasOwn(handlers, action.type), '不认识这个行动', 400);
    handlers[action.type]();
  }
  if (room.phase === 'playing' && !activePlayer(room).alive) advanceTurn(room);
}
