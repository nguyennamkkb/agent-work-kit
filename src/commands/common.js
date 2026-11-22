import path from 'node:path';
import { makeCtx, loadManifest, MANIFEST } from '../lib/engine.js';

export const rootOf = (opts) => (opts.dir ? path.resolve(opts.dir) : process.cwd());

export function requireInstall(opts) {
  const root = rootOf(opts);
  const m = loadManifest(makeCtx({ root }));
  if (!m) throw new Error(`No ${MANIFEST} in ${root}. Run \`npx github:nguyennamkkb/agent-work-kit init --<profession>\` first.`);
  return { ctx: makeCtx({ root, harnesses: m.harnesses, nghe: m.nghe.name }), manifest: m };
}
