import { isIP } from 'node:net';

function normalize(value) {
  if (isIP(value) !== 6) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const bits = mapped.slice(1).map(hex => parseInt(hex, 16));
  return [bits[0] >> 8, bits[0] & 255, bits[1] >> 8, bits[1] & 255].join('.');
}

// IPv6 interface addresses rotate easily; admission shares one budget per /64.
export function sourceQuotaKey(value) {
  const address = normalize(value);
  if (isIP(address) !== 6) return address;
  const [left, right = ''] = address.split('::');
  const head = left ? left.split(':') : [], tail = right ? right.split(':') : [];
  const groups = address.includes('::') ? [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail] : head;
  return `${groups.slice(0, 4).map(hex => parseInt(hex, 16).toString(16)).join(':')}::/64`;
}

export function requestSource(request, trusted = []) {
  const peer = normalize(request.socket.remoteAddress) || 'unknown';
  const proxies = new Set(trusted.map(normalize));
  if (!proxies.has(peer)) return peer;
  const header = request.headers?.['x-forwarded-for'];
  if (typeof header !== 'string' || header.length > 2048) return peer;
  const chain = header.split(',').map(value => normalize(value.trim()));
  if (!chain.length || chain.some(value => !isIP(value))) return peer;
  // Only peel known proxies from the trusted end; never take a spoofable leftmost IP.
  let source = peer;
  for (let i = chain.length - 1; i >= 0 && proxies.has(source); i--) source = chain[i];
  return source;
}
