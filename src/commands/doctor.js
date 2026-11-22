import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeCtx, loadManifest, kitVersion, MANIFEST } from '../lib/engine.js';
import { loadKit } from '../lib/bundle.js';
import { extractBlock } from '../lib/markers.js';
import { isPatchApplied } from '../lib/jsonmerge.js';
import { readText, exists, sha, which, color } from '../lib/util.js';
import { lintDesk, git, parseRules, listReview, DESK, ZONES } from '../../kit/method/hooks/_lib.mjs';
import { rootOf } from './common.js';

export default async function doctor(opts) {
  const root = rootOf(opts);
  let errors = 0;
  let warns = 0;
  const ok = (s) => console.log(`  ${color.green('✓')} ${s}`);
  const warn = (s) => (warns++, console.log(`  ${color.yellow('!')} ${s}`));
  const err = (s) => (errors++, console.log(`  ${color.red('✗')} ${s}`));
  console.log(color.bold('agent-work-kit doctor'));

  Number(process.versions.node.split('.')[0]) >= 18 ? ok(`node ${process.versions.node}`) : err('Node 18+ required for hooks');
  const m = loadManifest(makeCtx({ root }));
  if (!m) {
    err(`no ${MANIFEST} — run \`npx github:nguyennamkkb/agent-work-kit init --<profession>\``);
    return 1;
  }
  ok(`${m.nghe.title} desk · rules ${m.nghe.version} · kit ${m.version} · harness: ${m.harnesses.join(', ') || 'AGENTS.md only'}`);
  const kit = loadKit(m.nghe.name);
  if (m.version !== kitVersion() || m.nghe.version !== kit.nghe.version) warn(`update available (kit ${kitVersion()}, ${m.nghe.name} rules ${kit.nghe.version}) — \`npx github:nguyennamkkb/agent-work-kit update\``);

  let edited = 0;
  for (const [rel, e] of Object.entries(m.files)) {
    const p = path.join(root, rel);
    const cur = readText(p);
    if (cur == null) {
      err(`missing ${rel} — run \`update\``);
      continue;
    }
    if (exists(p + '.kit-new')) warn(`${rel}.kit-new waits to be merged`);
    if (e.kind === 'file' && sha(cur) !== e.hash) edited++;
    if (e.kind === 'block' && !extractBlock(cur)) err(`${rel}: agentkit markers missing`);
    if (e.kind === 'json' && !isPatchApplied(JSON.parse(cur), e.patch)) warn(`${rel}: kit entries removed — run \`update\``);
    if (rel.endsWith('.mjs')) {
      try {
        execFileSync(process.execPath, ['--check', p], { stdio: 'ignore' });
      } catch {
        err(`${rel}: syntax error`);
      }
    }
  }
  edited ? warn(`${edited} kit file(s) edited by hand`) : ok(`${Object.keys(m.files).length} kit files intact`);

  const deskErrors = lintDesk(root);
  deskErrors.length ? deskErrors.forEach((e) => err(`desk: ${e}`)) : ok('desk zones valid');
  const local = parseRules(readText(path.join(root, DESK, ZONES.local))).rules;
  const known = new Set(Object.keys(m.nghe.rules));
  const orphans = local.filter((r) => r.kind !== 'P0' && r.kind !== 'P1' && r.kind !== 'P2' && r.kind !== 'P3' && !known.has(r.id));
  if (orphans.length) warn(`rules.local.md overrides unknown rules: ${orphans.map((r) => r.id).join(', ')}`);
  ok(`rules: ${known.size} ${m.nghe.name} + ${local.length} project`);
  const pending = listReview(root).filter((r) => !r.archived && r.status === 'pending');
  if (pending.length) warn(`${pending.length} item(s) waiting for your decision — \`npx github:nguyennamkkb/agent-work-kit review\``);
  git(root, ['rev-parse', '--is-inside-work-tree']) === 'true' ? ok('git repository') : warn('not a git repository — commits are the desk checkpoints');
  if (m.harnesses.includes('codex')) warn('Codex: project hooks run only after you trust them once with `/hooks` in Codex');
  if (m.harnesses.includes('pi')) warn('Pi: project extensions load only after you trust the project when Pi asks');
  for (const c of kit.checks) which(c.cmd) ? ok(`${c.cmd} found`) : (c.required ? err : warn)(`${c.cmd} not found — ${c.hint}`);

  console.log(errors ? color.red(`\n${errors} error(s), ${warns} warning(s)`) : color.green(`\nHealthy${warns ? ` (${warns} warning(s))` : ''}`));
  return errors ? 1 : 0;
}
