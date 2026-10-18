import { readFileSync, readlinkSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { hostname } from 'node:os';

function linuxStart(pid) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const ticks = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
    return `${readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${ticks}`;
  } catch { return null; }
}
const start = linuxStart(process.pid) || String(Math.round(Date.now() - process.uptime() * 1000));
const namespace = process.platform === 'linux' ? readlinkSync('/proc/self/ns/pid') : null;

export function acquireStorageLock(path) {
  // Serialize stale-lock recovery so simultaneous starts cannot unlink a new lock.
  const guard = `${path}.guard`;
  let descriptor;
  try { descriptor = openSync(guard, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('数据目录正在启动，或上次启动中断；确认所有实例已停止后检查 process.lock.guard');
    throw error;
  }
  closeSync(descriptor);
  try { claim(path); }
  finally { unlinkSync(guard); }
  let closed = false;
  return () => { if (!closed) { unlinkSync(path); closed = true; } };
}

function claim(path) {
  if (existsSync(path)) {
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    if (owner.host !== hostname()) throw new Error('数据目录锁来自另一主机；确认旧实例已停止后再手动移除 process.lock');
    if (owner.namespace && owner.namespace !== namespace) throw new Error('数据目录锁来自另一 PID 命名空间；确认旧实例已停止后再手动移除 process.lock');
    const actualStart = owner.pid === process.pid ? start : linuxStart(owner.pid);
    // A PID can be reused after a crash, notably PID 1 in a restarted container.
    if (!(owner.start && actualStart && owner.start !== actualStart)) {
      try { process.kill(owner.pid, 0); throw new Error('数据目录已被另一个进程占用，只允许单进程'); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    unlinkSync(path);
  }
  const descriptor = openSync(path, 'wx', 0o600);
  try { writeFileSync(descriptor, JSON.stringify({ pid: process.pid, host: hostname(), start, namespace })); }
  finally { closeSync(descriptor); }
}
