import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PKG_ROOT } from './util.js';

/**
 * When run through `npx`, the kit lives in `<npm cache>/_npx/<hash>/node_modules/agent-work-kit`.
 * Everything the project needs is copied into the project, so after the command the kit removes
 * its own npx folder and its own entries in npm's download cache. Nothing else in the cache is touched.
 * Returns the removed paths/keys (empty when not run from the npx cache). Never throws.
 */
export function selfClean({ root = PKG_ROOT, env = process.env } = {}) {
  const removed = [];
  if (env.AGENTKIT_KEEP_CACHE) return removed;
  const parts = path.resolve(root).split(path.sep);
  const i = parts.lastIndexOf('_npx');
  if (i < 1 || parts[i + 2] !== 'node_modules') return removed;
  const npxDir = parts.slice(0, i + 2).join(path.sep);
  const cacheDir = parts.slice(0, i).join(path.sep);
  try {
    fs.rmSync(npxDir, { recursive: true, force: true });
    removed.push(npxDir);
  } catch {
    /* best effort */
  }
  // Downloaded tarball entries for this kit only (keys name the package or its GitHub repo).
  const npm = (args) =>
    spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [...args, '--cache', cacheDir], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 20000,
    });
  try {
    const ls = npm(['cache', 'ls']);
    const keys = (ls.stdout || '').split('\n').map((s) => s.trim()).filter((k) => /agent-work-kit/.test(k));
    if (keys.length && npm(['cache', 'clean', ...keys]).status === 0) removed.push(...keys);
  } catch {
    /* npm not reachable; the npx folder is already gone */
  }
  return removed;
}
