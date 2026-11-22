import fs from 'node:fs';
import path from 'node:path';
import { uninstall } from '../lib/engine.js';
import { printReport } from '../lib/report.js';
import { interactive, confirm } from '../lib/prompt.js';
import { color } from '../lib/util.js';
import { requireInstall } from './common.js';

export default async function remove(opts) {
  const { ctx } = requireInstall(opts);
  if (interactive() && !opts.yes && !opts.dryRun && !(await confirm(`Remove agent-work-kit from ${ctx.root}?`, false))) return 1;
  printReport(uninstall(ctx, { force: opts.force, dryRun: opts.dryRun }));
  const desk = path.join(ctx.root, '.desk');
  if (fs.existsSync(desk)) {
    if (opts.purgeDesk) {
      if (!opts.dryRun) fs.rmSync(desk, { recursive: true, force: true });
      console.log(`  ${color.yellow('-')} .desk/`);
    } else console.log(color.dim('  .desk/ kept (your goal, tasks, memory, lessons). --purge-desk deletes it.'));
  }
  console.log(color.green(opts.dryRun ? 'Dry run complete.' : 'Removed.'));
  return 0;
}
