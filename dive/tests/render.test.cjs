const test = require('node:test');
const assert = require('node:assert/strict');
require('../game.js');
require('../render.js');

test('the fixed collision square covers the full rendered frame at the shared off-center anchor', () => {
  const renderer = Object.create(Dive.Renderer.prototype);
  renderer.rabbit = {};
  const game = new Dive.Game();
  const box = game.playerBounds();
  let destination;
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    drawImage(image, sx, sy, sw, sh, dx, dy, width, height) { destination = { dx, dy, width, height }; },
  };
  for (const frame of [0, 1, 2]) {
    renderer.swimmer(ctx, game.player.x, game.player.y, game.player, frame);
    assert.ok(box.left <= game.player.x + destination.dx);
    assert.ok(box.top <= game.player.y + destination.dy);
    assert.ok(box.right >= game.player.x + destination.dx + destination.width);
    assert.ok(box.bottom >= game.player.y + destination.dy + destination.height);
    assert.equal(destination.width, Dive.SWIMMER.size * Dive.SWIMMER.scale);
    assert.equal(destination.width, destination.height);
  }
});

test('the pose selector preserves an existing raised pose through recovery instead of switching on velocity alone', () => {
  const renderer = Object.create(Dive.Renderer.prototype);
  renderer.rabbit = {};
  renderer.tilt = 0;
  renderer.tiltPose = false;
  let frame;
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, drawImage(image, sx) { frame = sx / 112; } };
  const game = new Dive.Game();
  game.flap();
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 0, 'fold the limbs before extending');
  renderer.tilt = -28;
  renderer.tiltPose = true;
  game.player.kickAge = .4;
  game.player.vy = 145;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 2, 'do not snap flat as soon as downward velocity becomes positive');
  game.player.kickAge = .56;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 0, 'fold again while recovering');
  game.player.kickAge = .85;
  renderer.tilt = -5;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 1, 'extend while coasting');
});

test('each accepted kick restarts folding in the real physics and render loop', () => {
  const renderer = Object.create(Dive.Renderer.prototype);
  Object.assign(renderer, {
    canvas: { width: Dive.W, height: Dive.H }, loaded: true,
    background: {}, foreground: {}, rabbit: {}, lettering: {},
    best: 0, tilt: 0, tiltPose: false, lastMotionTime: 0,
  });
  let frame;
  const frames = new Set();
  renderer.ctx = {
    save() {}, restore() {}, translate() {}, rotate() {}, setTransform() {},
    clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage(image, sx) { if (image === renderer.rabbit) { frame = sx / 112; frames.add(frame); } },
  };
  const game = new Dive.Game({ random: () => .5, hellMode: false });
  game.flap();
  renderer.draw(game, game.time);
  const startingFrames = [frame];
  for (let step = 1; step <= 84; step++) {
    game.step(1 / 120);
    if (step === 36 || step === 72) {
      assert.equal(game.flap(), true);
      renderer.draw(game, game.time);
      startingFrames.push(frame);
    } else if (step % 2 === 0) renderer.draw(game, game.time);
  }
  assert.deepEqual(startingFrames, [0, 0, 0], 'a new accepted input must not inherit the preceding raised pose');
  assert.ok(frames.has(2), 'the raised pose is reached through real successive kicks, not injected flags');
  assert.equal(game.state, 'playing');
});
