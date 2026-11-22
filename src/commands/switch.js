import { sync } from '../lib/engine.js';
import { printReport } from '../lib/report.js';
import { color } from '../lib/util.js';
import { pickFlags } from '../cli.js';
import { requireInstall } from './common.js';

export default async function switchCmd(opts) {
  const { ctx, manifest } = requireInstall(opts);
  const { nghe, harnesses } = pickFlags(opts);
  if (!nghe && !harnesses.length) throw new Error('Usage: agent-work-kit switch --<profession> [--cursor …]');
  const next = { ...ctx, nghe: nghe ?? ctx.nghe, harnesses: [...new Set([...ctx.harnesses, ...harnesses])] };
  const res = sync(next, { force: opts.force, dryRun: opts.dryRun });
  console.log(color.bold(nghe && nghe !== manifest.nghe.name ? `Desk switched: ${manifest.nghe.title} → ${res.manifest.nghe.title}` : `Harnesses: ${next.harnesses.join(', ')}`));
  printReport(res, { verbose: opts.verbose });
  return 0;
}
