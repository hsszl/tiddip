const layer = document.querySelector('#feedback-root');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function center(point) {
  if (!point) return null;
  const cell = document.querySelector(`[data-cell="${point.x},${point.y}"]`);
  if (!cell) return null;
  const rect = cell.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
}

export function effect(className, point, content, color) {
  if (!point) return null;
  const element = document.createElement('span');
  element.className = className;
  element.innerHTML = content;
  element.style.cssText = `left:${point.x}px;top:${point.y}px;--effect-color:${color};--cell-size:${point.size}px`;
  layer.append(element);
  return element;
}

export function animate(element, frames, duration = 800) {
  if (!element) return;
  if (reduced.matches) { setTimeout(() => element.remove(), 700); return; }
  const animation = element.animate(frames, { duration, easing: 'ease-out', fill: 'forwards' });
  animation.onfinish = () => element.remove();
}

export function pulse(point, color, symbol = '') {
  animate(effect('action-pulse', point, symbol, color), [
    { transform: 'translate(-50%, -50%) scale(.7)', opacity: 1 },
    { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 0 },
  ], 550);
}
