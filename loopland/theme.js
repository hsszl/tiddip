(() => {
  const button = document.querySelector('#theme-toggle');
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('loopland-theme'); } catch { /* Optional storage. */ }
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === 'dark' ? '☀' : '◐';
    button.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换黑暗模式');
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#111111' : '#fafafa';
  }
  apply(['dark', 'light'].includes(preference) ? preference : system.matches ? 'dark' : 'light');
  button.addEventListener('click', () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(preference);
    try { localStorage.setItem('loopland-theme', preference); } catch { /* Optional storage. */ }
  });
  system.addEventListener('change', () => { if (!preference) apply(system.matches ? 'dark' : 'light'); });
})();
