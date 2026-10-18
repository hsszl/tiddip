// Original Loopland rules, reduced to two human players. No network or AI.
(() => {
  'use strict';
  const W = 80, H = 80, N = W * H;
  const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  class Game {
    constructor({ limit = 1440 } = {}) {
      this.grid = new Uint8Array(N);
      this.trails = new Uint8Array(N);
      this.tick = 0;
      this.limit = limit;
      this.over = false;
      this.events = [];
      this.players = [[6, 6], [W - 7, H - 7]].map(([x, y], i) => ({
        id: i + 1, name: i ? '粉方' : '蓝方', x, y,
        dir: i ? 2 : 0, next: i ? 2 : 0, path: [], trailStart: null,
        respawnAt: 0, shield: 0, cuts: 0, falls: 0, captured: 0,
      }));
      for (const p of this.players) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.grid[(p.y + dy) * W + p.x + dx] = p.id;
        }
      }
    }

    counts() {
      const counts = [0, 0, 0];
      for (const id of this.grid) counts[id]++;
      return counts;
    }

    turn(id, direction) {
      const p = this.players[id - 1];
      if (!p || this.over || p.respawnAt || !Number.isInteger(direction) || direction < 0 || direction > 3) return false;
      if (p.path.length && direction === (p.dir + 2) % 4) return false;
      p.next = direction;
      return true;
    }

    clearTrail(p) {
      for (const at of p.path) if (this.trails[at] === p.id) this.trails[at] = 0;
      p.path = [];
      p.trailStart = null;
    }

    respawn(p, reason, killer) {
      if (p.respawnAt > this.tick || (p.shield > this.tick && reason === '撞头')) return;
      this.clearTrail(p);
      p.falls++;
      p.respawnAt = this.tick + 6;
      p.shield = this.tick + 22;
      if (killer && killer !== p) killer.cuts++;
      this.events.push(`${p.name}${reason}，重生中`);
    }

    place(p) {
      let best = -Infinity, at = -1;
      for (let i = 0; i < N; i++) {
        if (this.grid[i] !== p.id || this.trails[i]) continue;
        const x = i % W, y = Math.floor(i / W);
        let safe = Math.min(x, W - 1 - x, y, H - 1 - y);
        for (const enemy of this.players) {
          if (enemy !== p) safe = Math.min(safe, Math.abs(x - enemy.x) + Math.abs(y - enemy.y));
        }
        if (safe > best) { best = safe; at = i; }
      }
      // A player who lost all land receives a small new spawn patch.
      if (at < 0) {
        for (let y = 2; y < H - 2; y += 3) {
          for (let x = 2; x < W - 2; x += 3) {
            const distance = this.players.reduce((sum, enemy) => sum + (enemy === p ? 0 : Math.abs(x - enemy.x) + Math.abs(y - enemy.y)), 0);
            if (distance > best) { best = distance; at = y * W + x; }
          }
        }
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cell = at + dy * W + dx;
            this.grid[cell] = p.id;
            const victim = this.players[this.trails[cell] - 1];
            if (victim && victim !== p) this.respawn(victim, '线被切断', p);
          }
        }
      }
      p.x = at % W;
      p.y = Math.floor(at / W);
      p.dir = p.next = p.x < W / 2 ? 0 : 2;
      p.respawnAt = 0;
    }

    capture(p) {
      if (!p.path.length) return;
      // Flood-fill the outside; unvisited cells are inside the closed loop.
      const seen = new Uint8Array(N), queue = new Int32Array(N);
      let head = 0, tail = 0;
      const push = cell => {
        if (!seen[cell] && this.grid[cell] !== p.id && this.trails[cell] !== p.id) {
          seen[cell] = 1;
          queue[tail++] = cell;
        }
      };
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
      for (let y = 1; y < H - 1; y++) { push(y * W); push(y * W + W - 1); }
      while (head < tail) {
        const cell = queue[head++], x = cell % W;
        if (x) push(cell - 1);
        if (x < W - 1) push(cell + 1);
        if (cell >= W) push(cell - W);
        if (cell < N - W) push(cell + W);
      }
      let gain = 0;
      const victims = new Set();
      for (let cell = 0; cell < N; cell++) {
        if (this.grid[cell] === p.id || (this.trails[cell] !== p.id && seen[cell])) continue;
        gain++;
        if (this.trails[cell] && this.trails[cell] !== p.id) victims.add(this.trails[cell]);
        this.grid[cell] = p.id;
      }
      this.clearTrail(p);
      p.captured += gain;
      for (const id of victims) this.respawn(this.players[id - 1], '线被切断', p);
      if (gain) this.events.push(`${p.name} +${gain} 格`);
    }

    finish(reason) {
      this.over = true;
      this.winReason = reason;
      const counts = this.counts(), best = Math.max(counts[1], counts[2]);
      const winners = this.players.filter(p => counts[p.id] === best);
      this.winner = winners.length === 1 ? winners[0] : null;
    }

    step() {
      if (this.over) return;
      this.tick++;
      this.events = [];
      for (const p of this.players) if (p.respawnAt && p.respawnAt <= this.tick) this.place(p);
      const moves = [];
      for (const p of this.players) {
        if (p.respawnAt) continue;
        p.dir = p.next;
        const [dx, dy] = DIR[p.dir], x = p.x + dx, y = p.y + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        moves.push({ p, x, y, at: y * W + x });
      }
      // Resolve head collisions and cuts before changing ownership.
      const blocked = new Set();
      const positions = this.players.map(p => ({ x: p.x, y: p.y }));
      for (const move of moves) {
        for (const enemy of this.players) {
          if (enemy === move.p || enemy.respawnAt) continue;
          const otherMove = moves.find(m => m.p === enemy);
          const target = otherMove || enemy;
          const swap = otherMove && move.x === enemy.x && move.y === enemy.y && otherMove.x === move.p.x && otherMove.y === move.p.y;
          if ((move.x !== target.x || move.y !== target.y) && !swap) continue;
          if (move.p.shield > this.tick || enemy.shield > this.tick) {
            blocked.add(move.p); blocked.add(enemy);
          } else {
            this.respawn(move.p, '撞头'); this.respawn(enemy, '撞头');
          }
        }
      }
      for (const move of moves) {
        if (move.p.respawnAt || blocked.has(move.p)) continue;
        const owner = this.trails[move.at];
        if (owner) this.respawn(this.players[owner - 1], owner === move.p.id ? '碰到自己的线' : '线被切断', move.p);
      }
      for (const move of moves) {
        const p = move.p;
        if (p.respawnAt || blocked.has(p)) continue;
        p.x = move.x; p.y = move.y;
        if (this.grid[move.at] === p.id) {
          if (p.path.length) this.capture(p);
        } else {
          if (!p.path.length) p.trailStart = positions[p.id - 1];
          this.trails[move.at] = p.id;
          p.path.push(move.at);
        }
      }
      for (const p of this.players) if (!p.respawnAt && !this.grid.includes(p.id)) this.respawn(p, '领地被占');
      const counts = this.counts();
      if (counts[1] >= N / 2 || counts[2] >= N / 2) this.finish('dominance');
      else if (this.tick >= this.limit) this.finish('timeout');
    }
  }
  globalThis.Loopland = { Game, W, H, N, DIR };
})();
