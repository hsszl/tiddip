// Fixed world coordinates keep the same timing on phones, tablets and desktops.
(() => {
  'use strict';
  const W = 212, H = 520, FLOOR = 476;
  const PIPE_SPEED = 232, PIPE_SPACING = 264, PIPE_WIDTH = 34, GAP = 132;
  const GRAVITY = 1160, FLAP_SPEED = -330, MAX_FALL = 145;
  const KICK_RECOVERY = .3;
  const SWIMMER = Object.freeze({ size: 112, anchorX: 76, anchorY: 40, scale: .65 });
  // Convex hulls of the actual SVG paths, in each frame's unscaled coordinates.
  // Transforming these vertices gives tight bounds without transparent frame padding.
  const OUTLINES = [
    [[20,54],[66,8],[68,8],[84,12],[88,14],[90,16],[98,30],[100,34],[102,62],[102,66],[100,68],[96,70],[50,82],[40,82],[34,80],[28,74],[20,60]],
    [[10,60],[14,56],[64,12],[72,12],[86,14],[88,16],[98,34],[100,40],[100,46],[96,52],[90,58],[72,74],[68,76],[26,76],[18,74],[12,70],[10,66]],
    [[34,94],[48,24],[50,22],[70,12],[82,12],[90,20],[94,26],[98,34],[98,44],[94,52],[78,74],[70,84],[52,104],[40,104],[36,102],[34,100]],
  ];

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

    playerBounds() {
      const { frame, angle } = swimmerPose(this.player);
      const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const [sx, sy] of OUTLINES[frame]) {
        const x = (sx - SWIMMER.anchorX) * SWIMMER.scale;
        const y = (sy - SWIMMER.anchorY) * SWIMMER.scale;
        const rx = this.player.x + x * cos - y * sin;
        const ry = this.player.y + x * sin + y * cos;
        left = Math.min(left, rx); right = Math.max(right, rx);
        top = Math.min(top, ry); bottom = Math.max(bottom, ry);
      }
      return { left, top, right, bottom };
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
      const box = this.playerBounds();
      if (box.top <= 0 || box.bottom >= FLOOR) {
        this.state = 'over';
        return;
      }
      // Normal mode is confirmed slower; its exact rate still needs a reference clip.
      const speed = this.hellMode ? PIPE_SPEED : PIPE_SPEED / 2;
      this.distance += speed * dt;
      for (const pipe of this.pipes) {
        pipe.x -= speed * dt;
        if (box.right >= pipe.x - 3.75 && box.left <= pipe.x + pipe.width + 3.75 &&
            (box.top <= pipe.top + .75 || box.bottom >= pipe.bottom - .75)) {
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

  globalThis.Dive = { Game, W, H, FLOOR, SWIMMER, swimmerPose };
})();
