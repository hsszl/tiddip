const test = require('node:test');
const assert = require('node:assert/strict');
require('../game.js');
require('../render.js');

test('green kelp belongs to the foreground atlas and covers pipes with the corals', () => {
  const svg = require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/sea.svg'), 'utf8');
  const foreground = svg.match(/<g\b[^>]*transform="translate\(0 520\)"[^>]*>/);
  assert.ok(foreground);
  const plants = [...svg.matchAll(/<use\s+href="#plant"/g)];
  assert.ok(plants.length >= 2);
  assert.ok(plants.every(plant => plant.index > foreground.index), 'green kelp must not be baked into the layer behind pipes');
  const renderer = Object.create(Dive.Renderer.prototype), order = [];
  Object.assign(renderer, { loaded: true, canvas: { width: Dive.W, height: Dive.H }, background: {}, foreground: {} });
  renderer.ctx = {
    setTransform() {}, clearRect() {}, fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    drawImage(image) { order.push(image === renderer.background ? 'background' : 'foreground'); },
  };
  renderer.pipe = () => order.push('pipe');
  renderer.swimmer = () => order.push('rabbit');
  renderer.number = () => order.push('score');
  const game = new Dive.Game(); game.flap(); renderer.draw(game, 0);
  assert.deepEqual(order, ['background', 'pipe', 'foreground', 'rabbit', 'score']);
});

test('collision bounds match the actual SVG outline at the rendered pose and angle', () => {
  const svg = require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/rabbit.svg'), 'utf8');
  assert.ok(svg.includes('transform="scale(2)"'));
  const vertices = [[], [], []];
  for (const [, data] of svg.matchAll(/<path[^>]+\bd="([^"]+)"/g)) {
    const tokens = data.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g);
    let i = 0, x, y, startX, startY, frame;
    while (i < tokens.length) {
      const command = tokens[i++];
      if (command === 'M') { x = +tokens[i++]; y = +tokens[i++]; startX = x; startY = y; frame = Math.floor(x / 56); }
      else if (command === 'h') x += +tokens[i++];
      else if (command === 'v') y += +tokens[i++];
      else if (command === 'z') { x = startX; y = startY; }
      else assert.fail(`unsupported SVG command: ${command}`);
      vertices[frame].push([x * 2 - frame * 112, y * 2]);
    }
  }
  const renderer = Object.create(Dive.Renderer.prototype);
  renderer.rabbit = {};
  const game = new Dive.Game();
  let destination, rotation, frame;
  const ctx = {
    save() {}, restore() {}, translate() {}, rotate(angle) { rotation = angle; },
    drawImage(image, sx, sy, sw, sh, dx, dy, width, height) { frame = sx / sw; destination = { dx, dy, width, height, sw, sh }; },
  };
  for (const kickAge of [0, .4, .56, .85]) for (const tilt of [0, -12, -28]) for (const tiltPose of [false, true]) {
    Object.assign(game.player, { kickAge, tilt, tiltPose });
    renderer.swimmer(ctx, game.player.x, game.player.y, game.player);
    const points = vertices[frame].map(([sx, sy]) => {
      const x = destination.dx + sx * destination.width / destination.sw;
      const y = destination.dy + sy * destination.height / destination.sh;
      return [game.player.x + x * Math.cos(rotation) - y * Math.sin(rotation), game.player.y + x * Math.sin(rotation) + y * Math.cos(rotation)];
    });
    const expected = {
      left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
      top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])),
    };
    const box = game.playerBounds();
    for (const side of ['left', 'top', 'right', 'bottom']) assert.ok(Math.abs(box[side] - expected[side]) < 1e-9, `${frame}/${tilt}/${side}`);
  }
});

test('the pose selector preserves an existing raised pose through recovery instead of switching on velocity alone', () => {
  const renderer = Object.create(Dive.Renderer.prototype);
  renderer.rabbit = {};

  let frame;
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, drawImage(image, sx) { frame = sx / 112; } };
  const game = new Dive.Game();
  game.flap();
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 0, 'fold the limbs before extending');
  game.player.tilt = -28;
  game.player.tiltPose = true;
  game.player.kickAge = .4;
  game.player.vy = 145;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 2, 'do not snap flat as soon as downward velocity becomes positive');
  game.player.kickAge = .56;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 0, 'fold again while recovering');
  game.player.kickAge = .85;
  game.player.tilt = -5;
  renderer.swimmer(ctx, 100, 200, game.player);
  assert.equal(frame, 1, 'extend while coasting');
});

test('each accepted kick restarts folding in the real physics and render loop', () => {
  const renderer = Object.create(Dive.Renderer.prototype);
  Object.assign(renderer, {
    canvas: { width: Dive.W, height: Dive.H }, loaded: true,
    background: {}, foreground: {}, rabbit: {}, lettering: {},
    best: 0,
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
