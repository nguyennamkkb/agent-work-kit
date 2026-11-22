import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT } from './util.js';

const OURS = /agent-work-kit/;

const walk = (d) => {
  try {
    return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  } catch {
    return [];
  }
};

export function cleanCacache(cacheDir) {
  const removed = [];
  const cacache = path.join(cacheDir, '_cacache');
  for (const f of walk(path.join(cacache, 'index-v5'))) {
    let entries;
    try {
      entries = fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l.slice(l.indexOf('\t') + 1)));
    } catch {
      continue;
    }
    if (!entries.length || !entries.every((e) => OURS.test(e.key ?? ''))) continue;
    for (const e of entries) {
      if (!e.integrity) continue;
      for (const one of e.integrity.split(/\s+/)) {
        const dash = one.indexOf('-');
        const hex = Buffer.from(one.slice(dash + 1), 'base64').toString('hex');
        if (hex.length > 4) fs.rmSync(path.join(cacache, 'content-v2', one.slice(0, dash), hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)), { force: true });
      }
    }
    fs.rmSync(f, { force: true });
    removed.push(entries[0].key);
  }
  return removed;
}

const markerDir = (npxDir) => path.join(npxDir, '.agentkit-in-use');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
export function claim({ root = PKG_ROOT } = {}) {
  const parts = path.resolve(root).split(path.sep);
  const i = parts.lastIndexOf('_npx');
  if (i < 1 || parts[i + 2] !== 'node_modules') return;
  try {
    const d = markerDir(parts.slice(0, i + 2).join(path.sep));
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, String(process.pid)), '');
  } catch {
  }
}
function inUse(npxDir) {
  try {
    return fs.readdirSync(markerDir(npxDir)).map(Number).filter((pid) => pid && alive(pid));
  } catch {
    return [];
  }
}
function release(npxDir) {
  try {
    fs.rmSync(path.join(markerDir(npxDir), String(process.pid)), { force: true });
  } catch {
  }
}

export function selfClean({ root = PKG_ROOT, env = process.env } = {}) {
  const removed = [];
  if (env.AGENTKIT_KEEP_CACHE) return removed;
  const parts = path.resolve(root).split(path.sep);
  const i = parts.lastIndexOf('_npx');
  if (i < 1 || parts[i + 2] !== 'node_modules') return removed;
  const npxDir = parts.slice(0, i + 2).join(path.sep);
  const others = inUse(npxDir).filter((pid) => pid !== process.pid);
  release(npxDir);
  if (others.length) return removed;
  try {
    fs.rmSync(npxDir, { recursive: true, force: true });
    removed.push(npxDir);
    removed.push(...cleanCacache(parts.slice(0, i).join(path.sep)));
  } catch {
  }
  return removed;
}
