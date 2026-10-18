import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(gameRoot, 'client');
const sharedFiles = new Set(['rules.js', 'range.js'].map(name => resolve(gameRoot, name)));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// Keep server code, documents and session data outside the public directory.
function publicFile(pathname) {
  if (['/', '/gaogame', '/gaogame/'].includes(pathname)) return resolve(clientRoot, 'index.html');
  if (pathname === '/gaogame/rules.js' || pathname === '/gaogame/range.js') return resolve(gameRoot, pathname.split('/').at(-1));
  if (!pathname.startsWith('/gaogame/client/')) return null;
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice('/gaogame/client/'.length));
  } catch {
    return null;
  }
  if (relative.split(/[\\/]/).some(part => part === '..' || part.startsWith('.'))) return null;
  const file = resolve(clientRoot, relative);
  if (!file.startsWith(clientRoot + sep) || !types[extname(file)]) return null;
  return file;
}

export async function serveStatic(pathname, request, response) {
  const file = publicFile(pathname);
  if (!file) return false;
  try {
    const canonical = await realpath(file);
    if (!sharedFiles.has(canonical) && !canonical.startsWith(clientRoot + sep)) return false;
    const content = await readFile(canonical);
    response.writeHead(200, {
      'Content-Type': types[extname(file)],
      'Cache-Control': 'no-cache',
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
    return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return false;
    throw error;
  }
}
