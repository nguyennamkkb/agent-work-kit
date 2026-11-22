import fs from 'node:fs';
import path from 'node:path';
import { listReview, setStatus, removeRuleSection, read, DESK, LOCAL_RULES } from '../../kit/method/hooks/_lib.mjs';
import { interactive, ask } from '../lib/prompt.js';
import { color } from '../lib/util.js';
import { rootOf } from './common.js';

function archive(root, item) {
  const dest = path.join(root, DESK, 'archive', path.basename(item.file));
  fs.renameSync(item.file, dest);
}

/** Apply a decision. P: approve|reject. U: keep|drop. */
export function decide(root, item, decision, note = '') {
  if (item.kind === 'P') {
    if (decision === 'approve') setStatus(item.file, 'approved', note);
    else if (decision === 'reject') (setStatus(item.file, 'rejected', note), archive(root, item));
    else throw new Error(`${item.id} is a proposal: use --approve or --reject`);
  } else {
    const ruleId = /^U-([A-Z]+-\d+)/.exec(item.id)?.[1];
    if (decision === 'drop') {
      const p = path.join(root, DESK, LOCAL_RULES);
      fs.writeFileSync(p, removeRuleSection(read(p) ?? '', ruleId));
      setStatus(item.file, 'applied', note || `dropped project rule ${ruleId}; the kit rule applies`);
    } else if (decision === 'keep') setStatus(item.file, 'applied', note || `kept project rule ${ruleId}`);
    else throw new Error(`${item.id} is a kit update: use --keep or --drop`);
    if (!item.archived) archive(root, item);
  }
}

export default async function review(opts) {
  const root = rootOf(opts);
  const all = listReview(root);
  const items = all.filter((r) => !r.archived);
  const note = typeof opts.note === 'string' ? opts.note : '';
  for (const decision of ['approve', 'reject', 'keep', 'drop']) {
    if (!opts[decision]) continue;
    const item = all.find((r) => r.id.toLowerCase() === String(opts[decision]).toLowerCase() && (!r.archived || r.kind === 'U'));
    if (!item) throw new Error(`${opts[decision]} not found in .desk/review/`);
    decide(root, item, decision, note);
    console.log(`${item.id} → ${decision}`);
    return 0;
  }
  if (!items.length) {
    console.log('Nothing to review in .desk/review/.');
    return 0;
  }
  const badge = { pending: color.yellow, approved: color.green, applied: color.dim, rejected: color.red };
  for (const r of items) console.log(`  ${r.id.padEnd(20)} ${(badge[r.status] ?? String)(r.status.padEnd(9))} ${r.title}`);
  const pending = items.filter((r) => r.status === 'pending');
  if (!pending.length || !interactive() || opts.yes) {
    if (pending.length) console.log(color.dim('\nDecide with --approve/--reject P-… or --keep/--drop U-…'));
    return 0;
  }
  for (const r of pending) {
    console.log('\n' + color.bold(`${r.id}: ${r.title}`));
    console.log(r.text.split('\n').slice(1, 45).join('\n'));
    const q = r.kind === 'P' ? '[a]pprove / [r]eject / [s]kip' : '[k]eep my rule / [d]rop it / [s]kip';
    const a = (await ask(q, 's')).toLowerCase()[0];
    const map = r.kind === 'P' ? { a: 'approve', r: 'reject' } : { k: 'keep', d: 'drop' };
    if (!map[a]) continue;
    decide(root, r, map[a], await ask('Note (optional)'));
    console.log(`${r.id} → ${map[a]}`);
  }
  console.log(color.dim('\nThe agent applies approved proposals at the start of its next session.'));
  return 0;
}
