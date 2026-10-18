const test = require('node:test');
const assert = require('node:assert/strict');
require('../game.js');
const { Game } = globalThis.Loopland;

test('two humans can close a loop and gain territory', () => {
  const game = new Game();
  assert.equal(game.players.length, 2);
  const initial = game.counts()[1];
  for (const direction of [0, 1, 2, 3]) {
    game.turn(1, direction);
    for (let i = 0; i < 8; i++) game.step();
  }
  assert.ok(game.counts()[1] > initial);
  assert.equal(game.players[0].path.length, 0);
});

test('wall waits, an exposed trail cannot reverse, and timeout decides the winner', () => {
  const game = new Game({ limit: 2 });
  const player = game.players[0];
  player.x = 0;
  game.turn(1, 2);
  game.step();
  assert.equal(player.x, 0);
  player.path.push(80);
  assert.equal(game.turn(1, 0), false);
  game.step();
  assert.equal(game.over, true);
  assert.equal(game.winReason, 'timeout');
});
