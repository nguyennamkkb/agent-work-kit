import { sync, makeCtx, loadManifest } from '../lib/engine.js';
import { availableNghe } from '../lib/bundle.js';
import { HARNESSES, detectHarnesses } from '../adapters/index.js';
import { interactive, ask, confirm, pick } from '../lib/prompt.js';
import { printReport } from '../lib/report.js';
import { color } from '../lib/util.js';
import { pickFlags } from '../cli.js';
import { rootOf } from './common.js';

export default async function init(opts) {
  const tty = interactive() && !opts.yes;
  const root = rootOf(opts);
  const existing = loadManifest(makeCtx({ root }));
  if (existing && !opts.force) {
    console.log(`This project already has a ${existing.nghe.title} desk. Use \`update\`, \`switch --<profession>\`, or \`init --force\`.`);
    return 0;
  }
  let { nghe, harnesses } = pickFlags(opts);

  if (!nghe) {
    const all = availableNghe();
    if (!tty) throw new Error(`Choose a profession: ${all.map((n) => '--' + n.name).join(' or ')}`);
    all.forEach((n, i) => console.log(`  ${i + 1}. ${n.name} — ${n.description}`));
    const a = await ask('Profession for this desk', '1');
    nghe = /^\d+$/.test(a) ? all[Number(a) - 1]?.name : a;
    if (!nghe) throw new Error('No profession chosen.');
  }

  if (!harnesses.length) {
    const detected = detectHarnesses(root);
    const preset = detected.length ? detected : ['claude'];
    if (tty) {
      if (detected.length) console.log(`Detected: ${detected.map((d) => HARNESSES[d].label).join(', ')}`);
      harnesses = await pick('Harnesses (AGENTS.md is always written):', Object.values(HARNESSES).map((a) => ({ id: a.id, label: a.label })), preset);
    } else harnesses = preset;
  }

  const ctx = makeCtx({ root, harnesses, nghe });
  if (tty && !(await confirm(`Set up a ${nghe} desk in ${root} for ${harnesses.join(', ') || 'AGENTS.md only'}?`))) return 1;
  const res = sync(ctx, { force: opts.force, dryRun: opts.dryRun });
  console.log(color.bold(opts.dryRun ? 'Would change:' : 'Desk installed:'));
  printReport(res, { verbose: opts.verbose });
  if (!opts.dryRun) console.log(`\n${color.green('Ready.')} Just start working with your agent; the desk fills and sorts itself.`);
  return 0;
}
