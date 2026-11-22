import { sync, kitVersion } from '../lib/engine.js';
import { printReport } from '../lib/report.js';
import { color } from '../lib/util.js';
import { requireInstall } from './common.js';

export default async function update(opts) {
  const { ctx, manifest } = requireInstall(opts);
  const res = sync(ctx, { force: opts.force, dryRun: opts.dryRun });
  console.log(color.bold(`agent-work-kit ${manifest.version} → ${kitVersion()}${opts.dryRun ? ' (dry run)' : ''}`));
  printReport(res, { verbose: opts.verbose });
  return 0;
}
