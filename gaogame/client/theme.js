// Independent of the game module graph and its API connection.
(() => {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('tiddip-theme'); } catch { /* Optional storage. */ }
  const symbols = {
    moon: '<path d="M20 14a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  };
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark';
    button.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[dark ? 'sun' : 'moon']}</svg>`;
    button.setAttribute('aria-label', dark ? '切换浅色模式' : '切换黑暗模式');
    button.title = dark ? '浅色模式' : '黑暗模式';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#111111' : '#fafafa';
  }
  apply(preference === 'dark' || preference === 'light' ? preference : system.matches ? 'dark' : 'light');
  button.addEventListener('click', () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(preference);
    try { localStorage.setItem('tiddip-theme', preference); } catch { /* Optional storage. */ }
  });
  system.addEventListener('change', () => { if (!preference) apply(system.matches ? 'dark' : 'light'); });
})();
