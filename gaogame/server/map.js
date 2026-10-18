import { RULES, mapDimensions } from '../rules.js';
import { requireThat } from './errors.js';

export function makeMap(shape) {
  const { width, height } = mapDimensions(shape);
  const tiles = Array.from({ length: width * height }, (_, index) => ({
    x: index % width, y: Math.floor(index / width),
    type: 'ground', revealed: false, spent: false,
  }));
  const candidates = tiles.filter(tile => !(tile.x < 2 && tile.y < 2));
  const scale = width * height / RULES.size ** 2;
  for (const [type, originalCount] of Object.entries(RULES.terrainCounts)) {
    const count = Math.max(1, Math.round(originalCount * scale));
    for (let i = 0; i < count && candidates.length; i++) {
      const index = Math.floor(Math.random() * candidates.length);
      candidates.splice(index, 1)[0].type = type;
    }
  }
  return tiles;
}

export function resizeMap(room, width, height) {
  requireThat(room.phase === 'lobby', '开始后不能修改地图');
  requireThat([width, height].every(value => Number.isInteger(value) && value >= RULES.mapMin && value <= RULES.mapMax),
    `宽和高需要是 ${RULES.mapMin}–${RULES.mapMax} 的整数`, 400);
  room.width = width;
  room.height = height;
  room.tiles = makeMap(room);
}
