import { mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { acquireStorageLock } from './storage-lock.js';

export function openRoomStorage(directory) {
  if (!directory) return { load: () => [], save() {}, remove() {}, close() {} };
  const root = resolve(directory);
  if (root.split(/[\\/]/).some(part => ['public_html', 'public_ftp', 'www', 'client'].includes(part))) throw new Error('房间数据必须放在非公开目录');
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const close = acquireStorageLock(join(root, 'process.lock'));
  const path = id => {
    if (!/^[A-F0-9]{6}$/.test(id)) throw new Error('房间存储 ID 无效');
    return join(root, `${id}.json`);
  };
  return {
    load() {
      return readdirSync(root).filter(name => /^[A-F0-9]{6}\.json$/.test(name)).map(name => {
        const data = JSON.parse(readFileSync(join(root, name), 'utf8'));
        if (data.format !== 1 || data.room?.id !== name.slice(0, 6) || !Array.isArray(data.room.players) || !Array.isArray(data.room.tiles)) throw new Error(`房间数据损坏：${name}`);
        return data.room;
      });
    },
    save(room) {
      const target = path(room.id), temp = `${target}.tmp`;
      writeFileSync(temp, JSON.stringify({ format: 1, room }), { mode: 0o600 });
      renameSync(temp, target);
    },
    remove(id) { try { unlinkSync(path(id)); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
    close,
  };
}
