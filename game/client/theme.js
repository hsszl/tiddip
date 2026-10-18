import { icon } from './icons.js';

const button = document.querySelector('#theme-toggle');
const system = matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = localStorage.getItem('tiddip-theme'); } catch { /* Storage can be disabled. */ }

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  button.innerHTML = icon(dark ? 'sun' : 'moon');
  button.setAttribute('aria-label', dark ? '切换浅色模式' : '切换黑暗模式');
  button.title = dark ? '浅色模式' : '黑暗模式';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#111111' : '#e9e3d7';
}
apply(preference === 'dark' || preference === 'light' ? preference : system.matches ? 'dark' : 'light');
button.addEventListener('click', () => {
  preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  apply(preference);
  try { localStorage.setItem('tiddip-theme', preference); } catch { /* Optional preference. */ }
});
system.addEventListener('change', () => { if (!preference) apply(system.matches ? 'dark' : 'light'); });
