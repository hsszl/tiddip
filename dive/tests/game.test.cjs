const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../game.js');
if (fs.existsSync(source)) require(source);

test('pipe travel follows the measured long-video track rather than the old slow layout', () => {
  assert.equal(Dive.W, 212);
  assert.equal(Dive.H, 520);
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  const pipe = game.pipes[0];
  const start = pipe.x;
  for (let i = 0; i < 30; i++) game.step(1 / 120);
  assert.ok(Math.abs(start - pipe.x - 58) < .01, '232 logical px/s, measured over 0.25 seconds');
  assert.equal(pipe.width, 34);
  assert.equal(pipe.bottom - pipe.top, 132);
  assert.equal(game.pipes[1].x - pipe.x, 264);
});

test('tap starts a round and gives an upward impulse; gravity brings the swimmer down', () => {
  assert.ok(globalThis.Dive, 'the standalone game engine exists');
  const game = new Dive.Game({ random: () => 0.5 });
  assert.equal(game.state, 'ready');
  const start = game.player.y;
  game.flap();
  assert.equal(game.state, 'playing');
  for (let i = 0; i < 12; i++) game.step(1 / 120);
  assert.ok(game.player.y < start);
  for (let i = 0; i < 60; i++) game.step(1 / 120);
  assert.ok(game.player.vy > 0);
});

test('rapid taps do not restart the current swim kick or its animation', () => {
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  for (let i = 0; i < 12; i++) game.step(1 / 120);
  const before = { ...game.player };
  for (let i = 0; i < 8; i++) game.flap();
  assert.equal(game.player.vy, before.vy);
  assert.equal(game.player.kickAge, before.kickAge);
  for (let i = 0; i < 30; i++) game.step(1 / 120);
  assert.equal(game.flap(), true);
  assert.equal(game.player.vy, -330);
  assert.equal(game.player.kickAge, 0);
});

test('normal mode slows pipes without removing the shared kick recovery', () => {
  const hard = new Dive.Game({ random: () => .5, hellMode: true });
  const normal = new Dive.Game({ random: () => .5, hellMode: false });
  for (const game of [hard, normal]) {
    game.flap();
    for (let i = 0; i < 12; i++) game.step(1 / 120);
    assert.equal(game.flap(), false, 'both modes reject a rapid second tap');
  }
  assert.ok(normal.pipes[0].x > hard.pipes[0].x, 'normal pipes travel less in the same time');
  assert.equal(normal.pipes[0].bottom - normal.pipes[0].top, hard.pipes[0].bottom - hard.pipes[0].top);
  normal.reset();
  assert.equal(normal.hellMode, false);
});

test('ascent follows the tracked head arc and falling reaches the observed speed limit', () => {
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  assert.equal(game.player.vy, -330);
  game.pipes = [];
  const scale = 212 / 192;
  const track = [192.216, 187.399, 178.799, 173.897, 168.691, 166.954, 163.056, 162.65, 163.471, 166.187];
  game.player.y = track[0] * scale;
  game.player.vy = -254.8 * scale;
  for (const y of track.slice(1)) {
    for (let i = 0; i < 4; i++) game.step(1 / 120);
    assert.ok(Math.abs(game.player.y - y * scale) < 4.5, 'within tracked video uncertainty');
  }
  game.pipes = [];
  game.player.y = 100;
  game.player.vy = 0;
  for (let i = 0; i < 70; i++) game.step(1 / 120);
  assert.equal(game.player.vy, 145);
});

test('passing a pipe awards one point; hitting a pipe or the seabed ends the round', () => {
  const game = new Dive.Game({ random: () => 0.5 });
  game.flap();
  assert.ok(game.pipes.length, 'a round contains pipe obstacles');
  game.pipes = [{ x: -60, width: 34, top: 170, bottom: 390, scored: false }];
  game.step(1 / 120);
  assert.equal(game.score, 1);
  game.step(1 / 120);
  assert.equal(game.score, 1);
  game.pipes = [{ x: game.player.x, width: 34, top: 340, bottom: 450, scored: false }];
  game.step(1 / 120);
  assert.equal(game.state, 'over');
  game.reset();
  game.flap();
  game.player.y = Dive.FLOOR;
  game.step(1 / 120);
  assert.equal(game.state, 'over');
});

test('transparent margins of the sprite frame no longer cause a collision', () => {
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  game.player.vy = 0;
  const dt = 1 / 120;
  const nextY = game.player.y + 1160 * dt ** 2 / 2;
  game.pipes = [{
    x: game.player.x + 20 + 3.75 + 232 * dt, width: 34,
    top: nextY - 20 - .75, bottom: 400, scored: false,
  }];
  game.step(dt);
  assert.equal(game.state, 'playing', 'the pipe only touches padding outside the visible rabbit');
});

test('ears above the dark head do not collide with a pipe', () => {
  const game = new Dive.Game();
  game.flap();
  game.player.vy = 0;
  const dt = 1 / 120;
  game.pipes = [{ x: game.player.x - 35 + 232 * dt, width: 34,
    top: game.player.y - 15, bottom: 400, scored: false }];
  game.step(dt);
  assert.equal(game.state, 'playing', 'only the ears overlap, not the body or dark head');
});

test('pause freezes a round, resume preserves it, and reset clears the score', () => {
  const game = new Dive.Game({ random: () => 0.5 });
  game.flap();
  game.step(1 / 120);
  game.pause();
  assert.equal(game.state, 'paused');
  const frozen = JSON.stringify(game.player);
  game.flap();
  game.step(1);
  assert.equal(JSON.stringify(game.player), frozen);
  game.resume();
  assert.equal(game.state, 'playing');
  game.score = 9;
  game.reset();
  assert.equal(game.score, 0);
  assert.equal(game.state, 'ready');
  assert.equal(game.pipes.length, 1);
});

test('the video score advances when the pipe leaves the screen, not at the rabbit', () => {
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  game.pipes = [{ x: game.player.x - 60, width: 34, top: 100, bottom: 400, scored: false }];
  game.step(1 / 120);
  assert.equal(game.score, 0);
  game.pipes[0].x = -37.1;
  game.step(.001);
  assert.ok(game.pipes[0].x + 34 + 3.75 > 0, 'the cap stroke is still visible');
  assert.equal(game.score, 0);
  game.pipes[0].x = -40;
  game.step(1 / 120);
  assert.equal(game.score, 1);
});

test('rectangle collision uses the visible cap edges without extra padding inside the opening', () => {
  const game = new Dive.Game({ random: () => .5 });
  game.flap();
  game.pipes = [{ x: game.player.x - 17, width: 34, top: 180, bottom: 312, scored: false }];
  const topOffset = game.playerBounds().top - game.player.y;
  game.player.y = 181.75 - topOffset;
  game.player.vy = 0;
  game.step(1 / 120);
  assert.equal(game.state, 'playing');
  game.player.y -= 2;
  game.step(1 / 120);
  assert.equal(game.state, 'over');
});

test('fullscreen resize expands the world without stretching height or changing nearby collisions', () => {
  const game = new Dive.Game({ random: () => 0.5 });
  game.flap();
  game.step(1 / 120);
  const relative = game.pipes[0].x - game.player.x;
  const y = game.player.y;
  game.resize(1024);
  assert.equal(game.width, 1024);
  assert.equal(game.player.y, y);
  assert.equal(game.pipes[0].x - game.player.x, relative);
  game.reset();
  assert.ok(game.pipes[0].x - game.player.x < 360, 'first obstacle is not delayed by a wide display');
});

test('tilted rectangles ignore their empty enclosing corners but count edge contact', () => {
  const diamond = [[0, 2], [2, 0], [4, 2], [2, 4]];
  assert.equal(Dive.hitboxOverlapsRect(diamond, { left: 0, top: 0, right: .5, bottom: .5 }), false);
  assert.equal(Dive.hitboxOverlapsRect(diamond, { left: 4, top: 2, right: 5, bottom: 3 }), true);
  assert.equal(Dive.hitboxOverlapsRect(diamond, { left: 4.01, top: 2, right: 5, bottom: 3 }), false);
  assert.equal(Dive.hitboxOverlapsRect(diamond, { left: 1.9, top: -1, right: 2.1, bottom: 5 }), true);
  assert.equal(Dive.hitboxOverlapsRect(diamond, { left: 1, top: 1, right: 3, bottom: 3 }), true);
});

test('the empty corner between body and head does not become a third collision box', () => {
  const game = new Dive.Game(); game.flap(); game.player.vy = 0;
  const dt = 1 / 120, right = game.player.x - 13;
  game.pipes = [{ x: right - 34 - 3.75 + 232 * dt, width: 34,
    top: game.player.y + 3 - .75, bottom: 400, scored: false }];
  assert.ok(game.playerBounds().left < right && game.playerBounds().top < game.pipes[0].top);
  game.step(dt);
  assert.equal(game.state, 'playing');
});

test('both body and head independently end a round when touched by a pipe', () => {
  for (const part of ['body', 'head']) {
    const game = new Dive.Game(); game.flap(); game.player.vy = 0;
    const box = game.playerHitboxes().find(box => box.part === part);
    const x = box.points.reduce((s, p) => s + p[0], 0) / 4;
    const y = box.points.reduce((s, p) => s + p[1], 0) / 4;
    const obstacle = { left: x - 20.75, right: x + 20.75,
      top: part === 'body' ? y : 0, bottom: part === 'body' ? Dive.FLOOR : y };
    const other = game.playerHitboxes().find(box => box.part !== part);
    assert.equal(Dive.hitboxOverlapsRect(other.points, obstacle), false, 'the other part is clear');
    game.pipes = [{ x: x - 17 + 232 / 120, width: 34,
      top: part === 'head' ? y - .75 : 0, bottom: part === 'body' ? y + .75 : 400, scored: false }];
    game.step(1 / 120);
    assert.equal(game.state, 'over', part);
  }
});

test('the visible rectangle reaches ceiling and floor before the old head-only circle', () => {
  for (const edge of ['top', 'bottom']) {
    const game = new Dive.Game();
    game.flap();
    game.pipes = [];
    game.player.vy = 0;
    const box = game.playerBounds();
    game.player.y += edge === 'top' ? -box.top - .1 : Dive.FLOOR - box.bottom;
    game.step(1 / 120);
    assert.equal(game.state, 'over', edge);
  }
});

test('bounds follow the visible pose and rotation instead of a fixed square', () => {
  const game = new Dive.Game();
  game.flap();
  const folded = game.playerBounds();
  game.player.kickAge = .4;
  const extended = game.playerBounds();
  assert.notDeepEqual(extended, folded);
  assert.ok(extended.left < folded.left, 'extended limbs change the visible bounds');
  assert.notEqual(extended.right - extended.left, extended.bottom - extended.top);
  game.player.tilt = -25;
  const rotated = game.playerBounds();
  assert.notDeepEqual(rotated, extended, 'the same pose changes bounds as it rotates');
  for (const mode of [false, true]) {
    game.hellMode = mode;
    assert.deepEqual(game.playerBounds(), rotated);
  }
});
