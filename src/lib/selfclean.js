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

/**
 * Remove this kit's entries from npm's download cache (`_cacache`): the index bucket files whose every entry
 * is ours, and the content blobs they point to. Buckets shared with any other key are left untouched.
 * (`npm cache clean <key>` leaves tombstones that make the next npx run report a corrupted tarball.)
 */
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
  try {
    fs.rmSync(npxDir, { recursive: true, force: true });
    removed.push(npxDir);
    removed.push(...cleanCacache(parts.slice(0, i).join(path.sep)));
  } catch {
    /* best effort */
  }
  return removed;
}
