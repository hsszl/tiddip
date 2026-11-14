(() => {
  'use strict';
  const { W, H, FLOOR, SWIMMER, swimmerPose } = Dive;
  // Natural glyph bounds: a serif title and MiSans UI, without nonuniform stretching.
  const LETTERS = {
    title: [0, 0, 157, 39], over: [0, 52, 205, 29], max: [0, 90, 65, 24],
    hell: [0, 124, 128, 27], settingsTitle: [0, 232, 126, 32],
    version: [0, 274, 73, 29], author: [0, 316, 160, 28],
    designer: [0, 358, 126, 31], settingHell: [0, 400, 126, 31],
    paused: [0, 442, 57, 29], tap: [0, 478, 22, 10],
  };

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
      green.addColorStop(0, '#82a456'); green.addColorStop(.2, '#b0c96d');
      green.addColorStop(.65, '#b9ce73'); green.addColorStop(1, '#85a65c');
      ctx.fillStyle = '#508d79'; ctx.strokeStyle = '#31566d'; ctx.lineWidth = 1.5;
      ctx.fillRect(x, -2, width, top - 5); ctx.strokeRect(x, -2, width, top - 5);
      ctx.fillRect(x, bottom + 6, width, FLOOR - bottom); ctx.strokeRect(x, bottom + 6, width, FLOOR - bottom);
      ctx.fillStyle = green;
      ctx.beginPath(); ctx.roundRect(x + 3, -4, width - 6, top - 14, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x + 3, bottom + 18, width - 6, FLOOR - bottom - 14, 3); ctx.fill();
      ctx.fillStyle = '#dae48c33'; ctx.fillRect(x + 5, 0, 1.5, top - 20); ctx.fillRect(x + 5, bottom + 21, 1.5, FLOOR - bottom);
      for (const y of [top - 7, bottom]) {
        const cap = ctx.createLinearGradient(x - 3, y, x + width + 3, y);
        cap.addColorStop(0, '#9cbb98'); cap.addColorStop(.28, '#e2c38e');
        cap.addColorStop(.72, '#e2c38e'); cap.addColorStop(1, '#99b899');
        ctx.fillStyle = cap; ctx.strokeStyle = '#31546c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x - 3, y, width + 6, 7, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6c918166'; ctx.fillRect(x + 6, y + 1, 1, 5); ctx.fillRect(x + width - 7, y + 1, 1, 5);
        ctx.fillStyle = '#ffd4bcbb'; ctx.fillRect(x, y + 5.5, width, .8);
      }
    }

    swimmer(ctx, x, y, player, idleFrame, scale = SWIMMER.scale) {
      const { frame, angle } = swimmerPose(player, idleFrame);
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle * Math.PI / 180);
      ctx.drawImage(this.rabbit, frame * SWIMMER.size, 0, SWIMMER.size, SWIMMER.size,
        -SWIMMER.anchorX * scale, -SWIMMER.anchorY * scale, SWIMMER.size * scale, SWIMMER.size * scale);
      ctx.restore();
    }

    label(ctx, name, center, y, alignLeft = false, scale = 1) {
      const [sx, sy, width, height] = LETTERS[name];
      ctx.drawImage(this.lettering, sx, sy, width, height,
        alignLeft ? center : center - width * scale / 2, y, width * scale, height * scale);
    }

    settings(ctx) {
      ctx.fillStyle = '#111722'; ctx.fillRect(0, 0, W, H);
      const card = ctx.createLinearGradient(14, 104, 198, 292);
      card.addColorStop(0, '#29374b'); card.addColorStop(1, '#203247');
      ctx.fillStyle = card; ctx.strokeStyle = '#45577177'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(14, 104, 184, 188, 34); ctx.fill(); ctx.stroke();
      this.label(ctx, 'settingsTitle', 30, 129, true);
      this.label(ctx, 'version', 30, 176, true);
      this.swimmer(ctx, 147, 220, { kickAge: 1 }, 0, .9);
      this.label(ctx, 'author', W / 2, 309);
      this.label(ctx, 'designer', W / 2, 347);
      this.label(ctx, 'settingHell', W / 2, 389);
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
      ctx.fillStyle = '#fffbe9';
      this.label(ctx, 'tap', 66, 307); this.label(ctx, 'tap', 147, 307);
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
      if (this.settingsOpen) { this.settings(ctx); return; }
      const offset = game.distance * .5 % (W * 2);
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
        this.label(ctx, 'title', W / 2, 166);
        this.swimmer(ctx, W / 2 + 8, 260, game.player, reducedMotion ? 0 : Math.floor(t * 5) % 2);
        this.tutorial(ctx);
      } else {
        this.swimmer(ctx, game.player.x, game.player.y, game.player);
        this.number(ctx, game.score, W / 2, 97);
      }
      if (game.state === 'over') {
        this.label(ctx, 'over', W / 2, 225);
        const lineWidth = 74 + String(this.best).length * 21;
        const left = (W - lineWidth) / 2;
        this.label(ctx, 'max', left, 270, true);
        this.number(ctx, this.best, left + 74 + String(this.best).length * 10.5, 269, true);
        if (game.hellMode) this.label(ctx, 'hell', W / 2, 307, false, 1.12);
      } else if (game.state === 'paused') {
        ctx.fillStyle = '#02183233'; ctx.fillRect(0, 0, W, H);
        this.label(ctx, 'paused', W / 2, 219);
      }
    }
  }

  Dive.Renderer = Renderer;
})();
