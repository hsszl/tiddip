// Fixed world coordinates keep the same timing on phones, tablets and desktops.
(() => {
  'use strict';
  const W = 212, H = 520, FLOOR = 476;
  const PIPE_SPEED = 232, PIPE_SPACING = 264, PIPE_WIDTH = 34, GAP = 132;
  const GRAVITY = 1160, FLAP_SPEED = -330, MAX_FALL = 145;

  class Game {
    constructor({ random = Math.random } = {}) {
      this.random = random;
      this.width = W;
      this.reset();
    }

    reset() {
      this.state = 'ready';
      this.player = { x: this.width * .34, y: 260, vy: 0, radius: 9 };
      this.score = 0;
      this.time = 0;
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

    addPipe(x) {
      const last = this.pipes[this.pipes.length - 1];
      const center = last ? 142 + this.random() * 202 : 254;
      this.pipes.push({ x, width: PIPE_WIDTH, top: center - GAP / 2, bottom: center + GAP / 2, scored: false });
    }

    flap() {
      if (this.state === 'ready') this.state = 'playing';
      if (this.state === 'playing') this.player.vy = FLAP_SPEED;
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
      const fallingTime = Math.min(dt, Math.max(0, (MAX_FALL - this.player.vy) / GRAVITY));
      this.player.y += this.player.vy * fallingTime + GRAVITY * fallingTime ** 2 / 2 + MAX_FALL * (dt - fallingTime);
      this.player.vy = Math.min(MAX_FALL, this.player.vy + GRAVITY * dt);
      const p = this.player;
      if (p.y - p.radius <= 0 || p.y + p.radius >= FLOOR) {
        this.state = 'over';
        return;
      }
      const speed = PIPE_SPEED;
      for (const pipe of this.pipes) {
        pipe.x -= speed * dt;
        const nearestX = Math.max(pipe.x - 3.75, Math.min(pipe.x + pipe.width + 3.75, p.x));
        const dy = Math.max(0, Math.min(p.y - pipe.top - .75, pipe.bottom - .75 - p.y));
        if ((p.x - nearestX) ** 2 + dy ** 2 < p.radius ** 2) {
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

  globalThis.Dive = { Game, W, H, FLOOR };
})();
