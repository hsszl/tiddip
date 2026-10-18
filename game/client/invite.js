import { icon } from './icons.js';

const dialog = document.querySelector('#invite-dialog');
const link = document.querySelector('#invite-link');
const status = document.querySelector('#invite-status');
const share = document.querySelector('#invite-share');
let data;

export function showInvite(state) {
  const url = new URL('/game/', location.origin);
  url.searchParams.set('room', state.id);
  data = { title: 'tiddip · 迷雾棋盘', text: `来玩一局？房间 ${state.id}`, url: url.href };
  link.value = url.href;
  document.querySelector('#invite-code').textContent = state.id;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const supported = typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data));
  share.hidden = !supported;
  share.disabled = local || state.phase !== 'lobby';
  share.innerHTML = `${icon('share')}分享`;
  status.textContent = '';
  document.querySelector('#invite-note').textContent = local ? '这是本机地址，其他设备打不开。部署后才能通过链接联机。'
    : state.phase !== 'lobby' ? '这局已开始。创建新房间后再邀请朋友。'
    : supported ? '分享面板中有哪些应用，取决于你的设备。' : '当前浏览器不支持系统分享，可以复制链接。';
  dialog.showModal();
}

link.addEventListener('click', () => link.select());
document.querySelector('#invite-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(link.value); status.textContent = '链接已复制'; }
  catch { link.focus(); link.select(); status.textContent = '请复制选中的链接'; }
});
share.addEventListener('click', async () => {
  // Keep this directly in the click handler to retain browser user activation.
  try { await navigator.share(data); status.textContent = '分享面板已打开'; }
  catch (error) { if (error.name !== 'AbortError') status.textContent = '无法打开分享面板，请复制链接'; }
});
