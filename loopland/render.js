(() => {
  const { W, H, DIR } = Loopland;
  const colors = ['#000000', '#4269e6', '#de7087'];

  function draw(canvas, game, previous, progress) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width / W;
    const dark = document.documentElement.dataset.theme === 'dark';
    ctx.fillStyle = dark ? '#191919' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Merge horizontal ownership runs to keep the large board inexpensive.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W;) {
        const id = game.grid[y * W + x];
        let end = x + 1;
        while (end < W && game.grid[y * W + end] === id) end++;
        if (id) {
          ctx.fillStyle = colors[id] + (dark ? '42' : '30');
          ctx.fillRect(x * size, y * size, (end - x) * size, size);
        }
        x = end;
      }
    }
    ctx.lineWidth = 1;
    for (const p of game.players) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors[p.id] + '85';
      ctx.beginPath();
      for (let cell = 0; cell < game.grid.length; cell++) {
        if (game.grid[cell] !== p.id) continue;
        const x = cell % W, y = Math.floor(cell / W), sx = x * size, sy = y * size;
        if (!x || game.grid[cell - 1] !== p.id) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + size); }
        if (x === W - 1 || game.grid[cell + 1] !== p.id) { ctx.moveTo(sx + size, sy); ctx.lineTo(sx + size, sy + size); }
        if (!y || game.grid[cell - W] !== p.id) { ctx.moveTo(sx, sy); ctx.lineTo(sx + size, sy); }
        if (y === H - 1 || game.grid[cell + W] !== p.id) { ctx.moveTo(sx, sy + size); ctx.lineTo(sx + size, sy + size); }
      }
      ctx.stroke();
      if (p.respawnAt) continue;
      const before = previous[p.id - 1];
      const interpolate = before && !before.respawnAt && Math.abs(before.x - p.x) + Math.abs(before.y - p.y) <= 1;
      const x = interpolate ? before.x + (p.x - before.x) * progress : p.x;
      const y = interpolate ? before.y + (p.y - before.y) * progress : p.y;
      ctx.strokeStyle = colors[p.id];
      ctx.lineWidth = size * 0.52;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (p.path.length) {
        ctx.beginPath();
        const start = p.trailStart || { x: p.path[0] % W, y: Math.floor(p.path[0] / W) };
        ctx.moveTo((start.x + 0.5) * size, (start.y + 0.5) * size);
        for (const cell of p.path.slice(0, -1)) ctx.lineTo((cell % W + 0.5) * size, (Math.floor(cell / W) + 0.5) * size);
        ctx.lineTo((x + 0.5) * size, (y + 0.5) * size);
        ctx.stroke();
      }
      ctx.fillStyle = colors[p.id];
      ctx.fillRect(x * size - 1, y * size - 1, size + 2, size + 2);
      ctx.fillStyle = '#fff';
      const [dx, dy] = DIR[p.dir];
      ctx.beginPath();
      ctx.arc((x + 0.5 + dx * 0.22) * size, (y + 0.5 + dy * 0.22) * size, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      if (p.shield > game.tick) {
        ctx.strokeStyle = colors[p.id] + '80'; ctx.lineWidth = 1;
        ctx.strokeRect(x * size - 4, y * size - 4, size + 8, size + 8);
      }
    }
  }
  Object.assign(Loopland, { draw, colors });
})();
