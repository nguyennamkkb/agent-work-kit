import { color } from './util.js';

const ICON = { create: '+', seed: '+', update: '~', merge: '~', 'insert-block': '~', remove: '-', keep: '!', conflict: '!', ok: '=' };

export function printReport(res, { verbose = false } = {}) {
  const { report = [], notes = [], rules = [], from, manifest, orphans = [] } = res;
  for (const r of report) {
    if (r.action === 'ok' && !verbose) continue;
    const icon = ICON[r.action] ?? '?';
    const c = icon === '+' || icon === '~' ? color.green : icon === '=' ? color.dim : color.yellow;
    console.log(`  ${c(icon)} ${r.path}${r.extra ? color.dim(`  (${r.extra})`) : ''}`);
  }
  const same = report.filter((r) => r.action === 'ok').length;
  if (same && !verbose) console.log(color.dim(`  = ${same} file(s) unchanged`));
  if (manifest?.nghe) {
    const n = manifest.nghe;
    if (from == null) console.log(`\n${color.bold(n.title)} rules ${n.version}: ${Object.keys(n.rules).length} rules installed`);
    else {
      console.log(`\n${color.bold(n.title)} rules ${from} → ${n.version}${rules.length ? '' : ': no rule changes'}`);
      const sym = { added: color.green('+'), changed: color.yellow('~'), removed: color.red('-') };
      for (const r of rules) console.log(`  ${sym[r.change]} ${r.id.padEnd(9)} ${r.change.padEnd(8)} → ${r.action}`);
    }
  }
  if (orphans.length) console.log(color.yellow(`\n! .desk/rules.local.md refers to rules this profession does not have: ${orphans.join(', ')}`));
  for (const n of notes) console.log(`\n${color.yellow('note')} ${n}`);
}
