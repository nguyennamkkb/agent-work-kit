import { sync } from '../lib/engine.js';
import { printReport } from '../lib/report.js';
import { color } from '../lib/util.js';
import { pickFlags } from '../cli.js';
import { requireInstall } from './common.js';

export default async function switchCmd(opts) {
  const { ctx, manifest } = requireInstall(opts);
  const { profession, harnesses } = pickFlags(opts);
  if (!profession && !harnesses.length) throw new Error('Usage: agent-work-kit switch --<profession> [--cursor …]');
  const next = { ...ctx, profession: profession ?? ctx.profession, harnesses: [...new Set([...ctx.harnesses, ...harnesses])] };
  const res = sync(next, { force: opts.force, dryRun: opts.dryRun });
  console.log(color.bold(profession && profession !== manifest.profession.name ? `Desk switched: ${manifest.profession.title} → ${res.manifest.profession.title}` : `Harnesses: ${next.harnesses.join(', ')}`));
  printReport(res, { verbose: opts.verbose });
  return 0;
}
