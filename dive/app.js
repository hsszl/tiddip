(() => {
  'use strict';
  const address = new URL(location.href);
  if (address.searchParams.has('v')) {
    address.searchParams.delete('v');
    history.replaceState(null, '', address.href);
  }
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = $('canvas');
  const game = new Dive.Game();
  const renderer = new Dive.Renderer(canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storage = {
    get(key) { try { return localStorage.getItem(`tiddip.dive.${key}.v1`); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(`tiddip.dive.${key}.v1`, String(value)); } catch { /* Private browsing still works. */ } },
  };
  game.hellMode = storage.get('hellMode') !== 'false';
  let settingsOpen = false;
  let best = Math.max(0, Math.floor(Number(storage.get('best')) || 0));
  if (!Number.isFinite(best)) best = 0;
  let sound = storage.get('sound') === 'true';
  let audio;
  let lastTime = 0, accumulator = 0, animationTime = 0, frame = 0;
  let previousState = '', previousScore = -1;
  let switchingFullscreen = false, overAt = 0;
  const STEP = 1 / 120;

  function tone(frequency, duration = 0.07) {
    if (!sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, audio.currentTime + duration);
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio is optional; unsupported devices keep playing. */ }
  }

  function updateSound() {
    $('sound').textContent = `声音：${sound ? '开' : '关'}`;
    $('sound').setAttribute('aria-pressed', String(sound));
  }

  function syncUI() {
    if (game.score !== previousScore) {
      if (game.score > previousScore && previousScore >= 0) tone(820, 0.12);
      previousScore = game.score;
      $('score').textContent = `得分 ${game.score}`;
      if (game.score > best) { best = game.score; storage.set('best', best); }
      $('best').textContent = best;
      renderer.best = best;
    }
    const viewState = settingsOpen ? 'settings' : game.state;
    if (viewState === previousState) return;
    const oldView = previousState;
    previousState = viewState;
    stage.dataset.state = viewState;
    document.body.dataset.state = viewState;
    $('overlay').hidden = settingsOpen || game.state === 'playing';
    $('settings').hidden = !settingsOpen;
    $('pause').setAttribute('aria-label', settingsOpen ? '返回结算页面' : game.state === 'over' ? '关于与设置' : game.state === 'ready' ? '返回首页' : game.state === 'playing' ? '暂停游戏' : '返回游戏菜单');
    if (settingsOpen) return;
    $('result').hidden = game.state !== 'over';
    if (game.state === 'over') {
      overAt = performance.now();
      $('title').textContent = 'GAME OVER';
      $('message').textContent = game.hellMode ? '（地狱模式）' : '';
      $('result').textContent = `MAX ${best}`;
      $('action').setAttribute('aria-label', '重新开始');
      $('hint').textContent = '';
      if (oldView !== 'settings') tone(145, 0.18);
    } else if (game.state === 'paused') {
      $('title').textContent = '暂停';
      $('message').textContent = game.hellMode ? '（地狱模式）' : '';
      $('action').setAttribute('aria-label', '继续游戏');
      $('hint').textContent = '点击继续 · 空格 · P';
    } else if (game.state === 'ready') {
      $('title').textContent = '兔潜奇境';
      $('message').textContent = '';
      $('action').setAttribute('aria-label', '开始游戏');
      $('hint').textContent = '点击 / 空格上浮';
    }
  }

  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
    lastTime = now;
    if (game.state === 'playing') {
      accumulator += elapsed;
      while (accumulator >= STEP && game.state === 'playing') {
        game.step(STEP);
        accumulator -= STEP;
      }
    } else accumulator = 0;
    if (game.state === 'playing' || game.state === 'ready') animationTime += elapsed;
    syncUI();
    renderer.draw(game, animationTime, reducedMotion.matches);
    if (game.state === 'playing' || (game.state === 'ready' && !reducedMotion.matches)) schedule();
  }

  function play() {
    if (!renderer.loaded || settingsOpen) return;
    if (game.state === 'ready' && navigator.userActivation?.isActive) enterFullscreen();
    if (game.state === 'over') game.reset();
    if (game.state === 'paused') game.resume();
    else game.flap();
    lastTime = 0;
    accumulator = 0;
    stage.focus({ preventScroll: true });
    tone(480);
    syncUI();
    schedule();
  }

  function pause() {
    game.pause();
    lastTime = 0;
    accumulator = 0;
    syncUI();
    renderer.draw(game, animationTime, reducedMotion.matches);
  }

  function showSettings(open) {
    settingsOpen = open;
    renderer.settingsOpen = open;
    syncUI();
    renderer.draw(game, animationTime, reducedMotion.matches);
    $('pause').focus({ preventScroll: true });
  }

  function resize() {
    game.resize(renderer.resize());
    renderer.draw(game, animationTime, reducedMotion.matches);
  }

  async function enterFullscreen() {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    switchingFullscreen = true;
    try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); }
    catch { /* Unsupported native fullscreen leaves the edge-to-edge page usable. */ }
    finally { switchingFullscreen = false; resize(); }
  }

  $('fullscreen').hidden = !document.fullscreenEnabled;
  $('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
    resize();
  });

  stage.addEventListener('pointerdown', event => {
    if (settingsOpen || event.target.closest('button, a') || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    if (game.state === 'paused' || (game.state === 'over' && performance.now() - overAt < 280)) return;
    if (game.state === 'ready' || game.state === 'over') play();
    else { if (game.flap()) tone(480); stage.focus({ preventScroll: true }); }
  });
  $('action').addEventListener('click', play);
  $('pause').addEventListener('click', () => {
    if (settingsOpen) showSettings(false);
    else if (game.state === 'over') showSettings(true);
    else if (game.state === 'ready') location.href = '../';
    else if (game.state === 'playing') pause();
    else { game.reset(); lastTime = 0; syncUI(); schedule(); }
  });
  $('hellMode').setAttribute('aria-checked', String(game.hellMode));
  $('hellMode').addEventListener('click', () => {
    game.hellMode = !game.hellMode;
    storage.set('hellMode', game.hellMode);
    $('hellMode').setAttribute('aria-checked', String(game.hellMode));
    renderer.draw(game, animationTime, reducedMotion.matches);
  });
  $('sound').addEventListener('click', () => {
    sound = !sound;
    storage.set('sound', sound);
    updateSound();
    tone(660);
  });
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (event.target.closest('input, textarea, select')) return;
    if (event.target.closest('button, a') && key !== 'p' && key !== 'escape') return;
    if (![' ', 'arrowup', 'w', 'enter', 'p', 'escape'].includes(key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (settingsOpen) {
      if (key === 'escape') showSettings(false);
      return;
    }
    if (key === 'p' || key === 'escape') {
      if (game.state === 'playing') pause();
      else if (game.state === 'paused') play();
    } else if (game.state === 'over') {
      if (key === 'enter') play();
    } else if (game.state === 'playing') { if (game.flap()) tone(480); }
    else play();
  });
  window.addEventListener('blur', () => { if (!switchingFullscreen) pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      cancelAnimationFrame(frame);
      frame = 0;
    } else { lastTime = 0; schedule(); }
  });
  window.addEventListener('resize', resize);
  reducedMotion.addEventListener('change', schedule);
  resize();
  updateSound();
  syncUI();
  renderer.ready.then(() => {
    $('action').disabled = false;
    $('action').setAttribute('aria-label', '开始游戏');
    schedule();
  }).catch(() => {
    $('message').classList.remove('sr-only');
    $('message').textContent = '矢量素材加载失败，请刷新页面';
    $('action').disabled = true;
  });
  schedule();
})();
