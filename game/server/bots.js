import { WEAPONS } from '../rules.js';
import { canAttack, attack } from './combat.js';
import { destination, move, land } from './movement.js';
import { activePlayer, advanceTurn } from './turns.js';
import { useItem } from './items.js';
import { activateTerrain } from './armory.js';
import { useWeaponSkill } from './skills.js';

function nearest(room, bot) {
  return room.players.filter(player => player.alive && player.id !== bot.id)
    .sort((a, b) => distance(bot, a) - distance(bot, b))[0];
}

const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function legalTiles(room, bot) {
  return room.tiles.filter(tile => {
    try { destination(room, bot, tile.x, tile.y); return true; }
    catch { return false; }
  });
}

function moveScore(tile, target, firingPositions) {
  return firingPositions.length ? Math.min(...firingPositions.map(position => distance(tile, position))) : distance(tile, target);
}

function settleBlast(room, bot) {
  for (let count = 0; room.pending?.playerId === bot.id && count < room.tiles.length; count++) {
    const target = nearest(room, bot);
    const candidates = legalTiles(room, bot).filter(tile => tile.revealed && distance(tile, bot) > 0)
      .sort((a, b) => distance(a, target) - distance(b, target));
    land(room, bot, candidates[0].x, candidates[0].y);
  }
}

export function runBots(room) {
  for (let count = 0; count < room.players.length && room.phase === 'playing' && activePlayer(room).isBot; count++) {
    const bot = activePlayer(room);
    const tile = room.tiles.find(tile => tile.x === bot.x && tile.y === bot.y);
    if (tile?.type === 'armory' && !tile.usedBy?.includes(bot.id)) activateTerrain(room, bot);
    if (!bot.skillUsed && ['guard', 'scout'].includes(WEAPONS[bot.weapon].skill) && !(WEAPONS[bot.weapon].skill === 'guard' && bot.shield)) useWeaponSkill(room, bot, { type: 'skill' });
    for (const heal of bot.items.filter(item => item.key === 'medkit')) {
      if (bot.hp < WEAPONS[bot.weapon].hp) useItem(room, bot, heal.id);
    }
    let target = nearest(room, bot);
    if (canAttack(bot, target)) attack(room, bot, target.id);
    else if (canAttack(bot, target, true)) attack(room, bot, target.id, true);
    if (room.phase !== 'playing') break;
    target = nearest(room, bot);
    const legal = legalTiles(room, bot);
    const firingPositions = legal.filter(tile => canAttack({ ...bot, x: tile.x, y: tile.y }, target));
    const choices = legal.filter(tile => distance(tile, bot) === 1)
      .sort((a, b) => moveScore(a, target, firingPositions) - moveScore(b, target, firingPositions));
    if (choices.length) move(room, bot, choices[0].x, choices[0].y);
    if (room.phase !== 'playing') break;
    if (bot.alive) {
      settleBlast(room, bot);
      target = nearest(room, bot);
      if (bot.alive && room.phase === 'playing' && !room.actions.attacked && canAttack(bot, target)) attack(room, bot, target.id);
      else if (bot.alive && room.phase === 'playing' && !room.actions.attacked && canAttack(bot, target, true)) attack(room, bot, target.id, true);
    }
    advanceTurn(room);
  }
}
