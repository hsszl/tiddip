(() => {
  'use strict';
  const { W, H, FLOOR } = Dive;


  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.background = document.createElement('canvas');
      this.foreground = document.createElement('canvas');
      this.width = W;
      this.best = 0;
      this.loaded = false;
      this.rabbit = new Image();
      this.sea = new Image();
      this.lettering = new Image();
      const load = (image, source) => new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      this.ready = Promise.all([
        load(this.rabbit, 'assets/rabbit.svg'),
        load(this.sea, 'assets/sea.svg'),
        load(this.lettering, 'assets/lettering.svg'),
      ]).then(() => { this.loaded = true; this.cacheScene(); });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.background.width = width * 2;
      this.background.height = height;
      this.foreground.width = width * 2;
      this.foreground.height = height;
      this.cacheScene();
      return W;
    }

    cacheScene() {
      if (!this.loaded) return;
      for (const [layer, sy] of [[this.background, 0], [this.foreground, H]]) {
        const ctx = layer.getContext('2d');
        ctx.clearRect(0, 0, layer.width, layer.height);
        ctx.drawImage(this.sea, 0, sy, W * 2, H, 0, 0, layer.width, layer.height);
      }
    }

    pipe(ctx, pipe) {
      const { x, width, top, bottom } = pipe;
      const green = ctx.createLinearGradient(x, 0, x + width, 0);
      green.addColorStop(0, '#81af57'); green.addColorStop(.16, '#c9e67b');
      green.addColorStop(.35, '#d2ed8b'); green.addColorStop(.77, '#b7d66e'); green.addColorStop(1, '#659857');
      ctx.fillStyle = green; ctx.strokeStyle = '#30767e'; ctx.lineWidth = 1.5;
      ctx.fillRect(x, -2, width, top - 5); ctx.strokeRect(x, -2, width, top - 5);
      ctx.fillRect(x, bottom + 6, width, FLOOR - bottom); ctx.strokeRect(x, bottom + 6, width, FLOOR - bottom);
      ctx.fillStyle = '#edfac066'; ctx.fillRect(x + 6, 0, 2, top - 6); ctx.fillRect(x + 6, bottom + 7, 2, FLOOR - bottom);
      for (const y of [top - 7, bottom]) {
        ctx.fillStyle = '#f3b5ac'; ctx.strokeStyle = '#31577d'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - 3, y, width + 6, 7, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff0c7'; ctx.fillRect(x - 1, y + 1.5, width + 2, 2);
      }
    }

    swimmer(ctx, x, y, vy, idleFrame) {
      const frame = idleFrame ?? (vy < -185 ? 2 : vy < 35 ? 0 : 1);
      const scale = .6;
      ctx.drawImage(this.rabbit, frame * 112, 0, 112, 112,
        x - 76 * scale, y - 40 * scale, 112 * scale, 112 * scale);
    }

    number(ctx, value, center, y, white = false) {
      const digits = String(value);
      for (let i = 0; i < digits.length; i++) {
        ctx.drawImage(this.lettering, Number(digits[i]) * 21, white ? 194 : 160, 21, 32,
          center - digits.length * 10.5 + i * 21, y, 21, 32);
      }
    }

    tutorial(ctx) {
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff7df'; ctx.fillStyle = '#e55e99';
      for (const path of ['M48 303H82L89 311 82 319H48Z', 'M131 303H165V319H131L124 311Z']) {
        const arrow = new Path2D(path); ctx.fill(arrow); ctx.stroke(arrow);
      }
      ctx.fillStyle = '#fffbe9'; ctx.textAlign = 'center'; ctx.font = '700 11px Arial';
      ctx.fillText('TAP', 66, 315); ctx.fillText('TAP', 147, 315);
      ctx.fill(new Path2D('M100 338v-18q0-4 3-4t3 4v7q3-3 5 0q5-1 6 4v10q-4 6-10 3l-8-7q-2-4 1-5Z'));
      ctx.fill(new Path2D('m116 286 5-7 5 7h-3v6h-4v-6Z'));
    }

    draw(game, t, reducedMotion = false) {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (!this.loaded) return;
      ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
      const offset = game.time * 116 % (W * 2);
      const layer = image => {
        ctx.drawImage(image, -offset, 0, W * 2, H);
        if (offset > W) ctx.drawImage(image, W * 2 - offset, 0, W * 2, H);
      };
      layer(this.background);
      if (game.state !== 'ready') for (const pipe of game.pipes) this.pipe(ctx, pipe);
      layer(this.foreground);
      const sand = ctx.createLinearGradient(0, FLOOR, 0, H);
      sand.addColorStop(0, '#fffbe9'); sand.addColorStop(1, '#edbac8');
      ctx.fillStyle = sand; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      if (game.state === 'ready') {
        ctx.drawImage(this.lettering, 0, 0, 162, 42, 25, 166, 162, 42);
        this.swimmer(ctx, W / 2, 260, 0, reducedMotion ? 0 : Math.floor(t * 5) % 2);
        this.tutorial(ctx);
      } else {
        this.swimmer(ctx, game.player.x, game.player.y, game.player.vy);
        this.number(ctx, game.score, W / 2, 97);
      }
      if (game.state === 'over') {
        ctx.fillStyle = '#02183220'; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(this.lettering, 0, 52, 204, 30, 4, 215, 204, 30);
        const lineWidth = 71 + String(this.best).length * 21;
        const left = (W - lineWidth) / 2;
        ctx.drawImage(this.lettering, 0, 90, 61, 25, left, 259, 61, 25);
        this.number(ctx, this.best, left + 71 + String(this.best).length * 10.5, 258, true);
        ctx.drawImage(this.lettering, 0, 124, 140, 25, 36, 300, 140, 25);
      } else if (game.state === 'paused') {
        ctx.fillStyle = '#02183233'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '28px SimSun, serif'; ctx.textAlign = 'center';
        ctx.fillText('暂停', W / 2, 243);
      }
    }
  }

  Dive.Renderer = Renderer;
})();
