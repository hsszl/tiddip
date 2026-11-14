// Fixed world coordinates keep the same timing on phones, tablets and desktops.
(() => {
  'use strict';
  const W = 212, H = 520, FLOOR = 476;
  const PIPE_SPEED = 232, PIPE_SPACING = 264, PIPE_WIDTH = 34, GAP = 132;
  const GRAVITY = 1160, FLAP_SPEED = -330, MAX_FALL = 145;
  const KICK_RECOVERY = .3;
  const SWIMMER = Object.freeze({ size: 112, anchorX: 76, anchorY: 40, scale: .65 });
  // Body and dark head only, fitted to each SVG pose; ears are decorative.
  // Each rectangle is [centerX, centerY, width, height, local angle in degrees].
  const HITBOXES = [
    { body: [43, 63, 44, 32, 0], head: [79, 42, 42, 36, 0] },
    { body: [43.951, 62.886, 60.573, 21.079, 3.18], head: [78.515, 42.851, 43.384, 36.219, 5.711] },
    { body: [60.676, 75.51, 55.474, 22.09, -41.634], head: [77, 42, 42, 36, 0] },
  ];

  function hitboxOverlapsRect(points, rect) {
    const corners = [[rect.left, rect.top], [rect.right, rect.top],
      [rect.right, rect.bottom], [rect.left, rect.bottom]];
    const axes = [[1, 0], [0, 1]];
    for (let i = 0; i < 2; i++) {
      const dx = points[i + 1][0] - points[i][0], dy = points[i + 1][1] - points[i][1];
      const length = Math.hypot(dx, dy);
      axes.push([-dy / length, dx / length]);
    }
    // SAT preserves the empty corners of a tilted box; touching counts as a hit.
    return axes.every(([x, y]) => {
      const a = points.map(p => p[0] * x + p[1] * y);
      const b = corners.map(p => p[0] * x + p[1] * y);
      return Math.max(...a) >= Math.min(...b) - 1e-9 && Math.max(...b) >= Math.min(...a) - 1e-9;
    });
  }

  function swimmerPose(player, idleFrame) {
    const raised = player.tiltPose && player.kickAge >= .08 && player.kickAge < .52;
    const recovering = player.kickAge >= .52 && player.kickAge < .7;
    const frame = idleFrame ?? (raised ? 2 : player.kickAge < .3 || recovering ? 0 : 1);
    const angle = idleFrame === undefined ? player.tilt + (frame === 2 ? 30 : 0) : 0;
    return { frame, angle };
  }

  class Game {
    constructor({ random = Math.random, hellMode = true } = {}) {
      this.random = random;
      this.hellMode = hellMode;
      this.width = W;
      this.reset();
    }

    reset() {
      this.state = 'ready';
      this.player = { x: this.width * .34, y: 260, vy: 0, kickAge: KICK_RECOVERY, tilt: 0, tiltPose: false };
      this.score = 0;
      this.time = 0;
      this.distance = 0;
      this.pipes = [];
      this.addPipe(this.player.x + 140);
    }

    resize(width) {
      if (!Number.isFinite(width) || width <= 0) return;
      const nextX = width * .34;
      const shift = nextX - this.player.x;
      for (const pipe of this.pipes) pipe.x += shift;
      this.player.x = nextX;
      this.width = width;
    }

    playerHitboxes() {
      const { frame, angle } = swimmerPose(this.player);
      const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
      return Object.entries(HITBOXES[frame]).map(([part, [cx, cy, width, height, localAngle]]) => {
        const a = localAngle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
          const dx = u * width / 2, dy = v * height / 2;
          const x = (cx + dx * c - dy * s - SWIMMER.anchorX) * SWIMMER.scale;
          const y = (cy + dx * s + dy * c - SWIMMER.anchorY) * SWIMMER.scale;
          return [this.player.x + x * cos - y * sin, this.player.y + x * sin + y * cos];
        });
        return { part, points };
      });
    }

    playerBounds() {
      // Enclosing bounds are for inspection only, never the collision shape.
      const points = this.playerHitboxes().flatMap(box => box.points);
      return {
        left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
        top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])),
      };
    }

    addPipe(x) {
      const last = this.pipes[this.pipes.length - 1];
      const center = last ? 142 + this.random() * 202 : 254;
      this.pipes.push({ x, width: PIPE_WIDTH, top: center - GAP / 2, bottom: center + GAP / 2, scored: false });
    }

    flap() {
      if (this.state === 'ready') this.state = 'playing';
      if (this.state !== 'playing' || this.player.kickAge + 1e-9 < KICK_RECOVERY) return false;
      this.player.vy = FLAP_SPEED;
      this.player.kickAge = 0;
      this.player.tiltPose = false;
      return true;
    }

    pause() {
      if (this.state === 'playing') this.state = 'paused';
    }

    resume() {
      if (this.state === 'paused') this.state = 'playing';
    }

    step(dt) {
      if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 1 / 30);
      this.time += dt;
      this.player.kickAge += dt;
      const fallingTime = Math.min(dt, Math.max(0, (MAX_FALL - this.player.vy) / GRAVITY));
      this.player.y += this.player.vy * fallingTime + GRAVITY * fallingTime ** 2 / 2 + MAX_FALL * (dt - fallingTime);
      this.player.vy = Math.min(MAX_FALL, this.player.vy + GRAVITY * dt);
      // Physics and drawing consume the same pose; rendering never advances motion.
      const p = this.player, rising = p.vy < 0;
      p.tilt += ((rising ? -32 : 0) - p.tilt) * (1 - Math.exp(-dt / (rising ? .25 : .55)));
      if (p.kickAge < .08 || p.kickAge >= .52) p.tiltPose = false;
      else if (p.tilt < -23) p.tiltPose = true;
      const boxes = this.playerHitboxes();
      if (boxes.some(box => box.points.some(([, y]) => y <= 0 || y >= FLOOR))) {
        this.state = 'over';
        return;
      }
      // Normal mode is confirmed slower; its exact rate still needs a reference clip.
      const speed = this.hellMode ? PIPE_SPEED : PIPE_SPEED / 2;
      this.distance += speed * dt;
      for (const pipe of this.pipes) {
        pipe.x -= speed * dt;
        const upper = { left: pipe.x - 3.75, right: pipe.x + pipe.width + 3.75, top: 0, bottom: pipe.top + .75 };
        const lower = { left: upper.left, right: upper.right, top: pipe.bottom - .75, bottom: FLOOR };
        if (boxes.some(box => hitboxOverlapsRect(box.points, upper) || hitboxOverlapsRect(box.points, lower))) {
          this.state = 'over';
          return;
        }
        if (!pipe.scored && pipe.x + pipe.width + 3.75 < 0) {
          pipe.scored = true;
          this.score++;
        }
      }
      this.pipes = this.pipes.filter(pipe => pipe.x + pipe.width > -10);
      const last = this.pipes[this.pipes.length - 1];
      if (!last || last.x < this.width) this.addPipe(last ? last.x + PIPE_SPACING : this.width);
    }
  }

  globalThis.Dive = { Game, W, H, FLOOR, SWIMMER, swimmerPose, hitboxOverlapsRect };
})();
