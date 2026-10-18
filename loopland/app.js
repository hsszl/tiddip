(() => {
  const { Game, draw, N } = Loopland;
  const $ = selector => document.querySelector(selector);
  const canvas = $('#board'), overlay = $('#overlay');
  const pause = $('#pause'), status = $('#status');
  let speed = 8;
  let game = new Game(), running = false, paused = false;
  let lastStep = performance.now(), previous = [];

  function updateScore() {
    const counts = game.counts();
    $('#blue-score').textContent = (counts[1] / N * 100).toFixed(1) + '%';
    $('#pink-score').textContent = (counts[2] / N * 100).toFixed(1) + '%';
    const seconds = Math.max(0, Math.ceil((game.limit - game.tick) / 8));
    $('#clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function start() {
    game = new Game();
    previous = [];
    running = true; paused = false;
    lastStep = performance.now();
    overlay.hidden = true;
    pause.disabled = false;
    pause.textContent = '暂停';
    status.textContent = '围一圈，回到自己的领地。';
    updateScore();
    canvas.focus({ preventScroll: true });
  }
  function togglePause() {
    if (!running) return;
    paused = !paused;
    lastStep = performance.now();
    pause.textContent = paused ? '继续' : '暂停';
    status.textContent = paused ? '已暂停' : '围一圈，回到自己的领地。';
  }
  // From the original applySpeed: apply immediately and reset the step clock.
  function applySpeed(value) {
    speed = Math.max(1, Math.min(25, Math.round(Number(value) || 8)));
    $('#speed').value = speed;
    $('#speed-val').textContent = `${speed} 格/秒`;
    lastStep = performance.now();
  }
  function finish() {
    running = false;
    pause.disabled = true;
    $('#result').textContent = game.winner ? `${game.winner.name}获胜` : '平局';
    $('#summary').textContent = game.winReason === 'dominance' ? '领地达到 50%' : '时间到';
    $('#start').textContent = '再来';
    overlay.hidden = false;
    status.textContent = '';
  }
  function frame(now) {
    const stepMs = 1000 / speed;
    let steps = 0;
    if (running && !paused) {
      while (now - lastStep >= stepMs && steps < 8 && !game.over) {
        previous = game.players.map(p => ({ x: p.x, y: p.y, respawnAt: p.respawnAt }));
        game.step();
        lastStep += stepMs;
        steps++;
        if (game.events.length) status.textContent = game.events.join(' · ');
      }
      if (now - lastStep > 1000) lastStep = now;
      if (steps) updateScore();
      if (game.over) finish();
    }
    const progress = running && !paused ? Math.min(1, (now - lastStep) / stepMs) : 1;
    draw(canvas, game, previous, progress);
    requestAnimationFrame(frame);
  }
  $('#start').addEventListener('click', start);
  $('#restart').addEventListener('click', start);
  pause.addEventListener('click', togglePause);
  const settings = $('#settings-dialog');
  $('#settings').addEventListener('click', () => {
    if (running && !paused) togglePause();
    settings.showModal();
  });
  $('#close-settings').addEventListener('click', () => settings.close());
  $('#speed').addEventListener('input', event => applySpeed(event.target.value));
  settings.addEventListener('click', event => {
    if (event.target !== settings) return;
    const bounds = settings.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settings.close();
  });
  const keys = {
    d: [1, 0], s: [1, 1], a: [1, 2], w: [1, 3],
    arrowright: [2, 0], arrowdown: [2, 1], arrowleft: [2, 2], arrowup: [2, 3],
  };
  document.addEventListener('keydown', event => {
    if (settings.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (key === 'enter' && !running) { event.preventDefault(); start(); return; }
    if (key === ' ') { event.preventDefault(); if (!event.repeat) togglePause(); return; }
    if (!keys[key]) return;
    event.preventDefault();
    if (running && !paused) game.turn(...keys[key]);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause();
  });
  updateScore();
  requestAnimationFrame(frame);
})();
