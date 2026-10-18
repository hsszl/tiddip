import { RULES } from '../rules.js';
import { requireThat } from './errors.js';
import { record } from './model.js';
import { revealTile, resolveTerrain } from './terrain.js';
import { startIfReady } from './turns.js';
import { moveInRange } from '../range.js';

export function destination(room, player, x, y) {
  requireThat(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < RULES.size && y < RULES.size, '位置超出地图', 400);
  const tile = room.tiles[y * RULES.size + x];
  const occupied = room.players.some(other => other.id !== player.id && other.alive && other.x === x && other.y === y);
  requireThat(tile.type !== 'toilet' || !occupied, '厕所已经有人');
  return tile;
}

export function enterTile(room, player, tile) {
  player.x = tile.x;
  player.y = tile.y;
  revealTile(room, player, tile);
  resolveTerrain(room, player, tile);
}

export function spawn(room, player, x, y) {
  requireThat(player.x === null, '已经选过出生点');
  const tile = destination(room, player, x, y);
  player.x = x;
  player.y = y;
  revealTile(room, player, tile);
  record(room, `${player.name}选择了 ${x + 1},${y + 1}`, { kind: 'spawn', actorId: player.id, position: { x, y } });
  startIfReady(room);
}

export function move(room, player, x, y) {
  requireThat(!room.actions.moved, '这回合已经移动过');
  requireThat(moveInRange(player, { x, y }, room.actions.sprint), room.actions.sprint ? '只能直线移动一至两格' : '只能上下左右移动一格');
  const tile = destination(room, player, x, y);
  record(room, `${player.name}从 ${player.x + 1},${player.y + 1} 移动到 ${x + 1},${y + 1}`, {
    kind: 'move', actorId: player.id, from: { x: player.x, y: player.y }, to: { x, y },
  });
  room.actions.moved = true;
  enterTile(room, player, tile);
}

export function land(room, player, x, y) {
  requireThat(room.pending?.playerId === player.id, '现在不需要选择落点');
  requireThat(x !== player.x || y !== player.y, '请选择其他格子');
  const tile = destination(room, player, x, y);
  requireThat(tile.revealed, '地雷只能炸到已翻开的格子');
  record(room, `${player.name}被炸飞到 ${x + 1},${y + 1}`, {
    kind: 'blast', actorId: player.id, from: { x: player.x, y: player.y }, to: { x, y },
  });
  room.pending = null;
  enterTile(room, player, tile);
}
