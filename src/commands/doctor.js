import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeCtx, loadManifest, kitVersion, MANIFEST } from '../lib/engine.js';
import { loadKit } from '../lib/bundle.js';
import { extractBlock } from '../lib/markers.js';
import { isPatchApplied } from '../lib/jsonmerge.js';
import { readText, exists, sha, which, color } from '../lib/util.js';
import { git, parseRules, listReview, readJson, DESK, LOCAL_RULES } from '../../kit/method/hooks/_lib.mjs';
import * as Store from '../../kit/method/hooks/store.mjs';
import { loadTeam, routingErrors, orcaAvailable } from '../../kit/method/hooks/team.mjs';
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
  ok(`${m.profession.title} desk · rules ${m.profession.version} · kit ${m.version} · harness: ${m.harnesses.join(', ') || 'AGENTS.md only'}`);
  const kit = loadKit(m.profession.name);
  if (m.version !== kitVersion() || m.profession.version !== kit.profession.version) warn(`update available (kit ${kitVersion()}, ${m.profession.name} rules ${kit.profession.version}) — \`npx github:nguyennamkkb/agent-work-kit update\``);

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

  const raw = readJson(path.join(root, DESK, 'desk.json'));
  if (!raw) exists(path.join(root, DESK, 'now.md')) ? warn('desk v1 (markdown zones) — `update` converts it to desk.json') : err('.desk/desk.json missing or not valid JSON — run `update`');
  else {
    const d = Store.load(root);
    const doing = Store.tasks(d, 'doing').filter(Store.isLead);
    const ids = d.items.map((i) => i.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (doing.length > 1) warn(`${doing.length} lead tasks in progress (${doing.map((t) => t.id).join(', ')}); one at a time`);
    if (dup.length) err(`desk: duplicate ids ${[...new Set(dup)].join(', ')}`);
    ok(`desk: ${Store.tasks(d, ...Store.TASK_OPEN).length} open task(s), ${Store.memories(d).length} memory, ${Store.lessons(d).length} lesson(s)`);
  }
  const team = loadTeam(root);
  const rerr = routingErrors(team.routing);
  rerr.length ? rerr.forEach((e) => err(`team.json routing: ${e}`)) : ok(`team: ${orcaAvailable() ? 'Orca found — workers available' : 'Orca not installed — solo + subagents'} · roles ${Object.keys(team.routing.roles).join(', ') || 'none (no agent CLI found)'}`);
  const local = parseRules(readText(path.join(root, DESK, LOCAL_RULES))).rules;
  const known = new Set(Object.keys(m.profession.rules));
  const orphans = local.filter((r) => r.kind !== 'P0' && r.kind !== 'P1' && r.kind !== 'P2' && r.kind !== 'P3' && !known.has(r.id));
  if (orphans.length) warn(`rules.local.md overrides unknown rules: ${orphans.map((r) => r.id).join(', ')}`);
  ok(`rules: ${known.size} ${m.profession.name} + ${local.length} project`);
  const pending = listReview(root).filter((r) => !r.archived && r.status === 'pending');
  if (pending.length) warn(`${pending.length} item(s) waiting for your decision — \`npx github:nguyennamkkb/agent-work-kit review\``);
  git(root, ['rev-parse', '--is-inside-work-tree']) === 'true' ? ok('git repository') : warn('not a git repository — commits are the desk checkpoints');
  if (m.harnesses.includes('codex')) warn('Codex: project hooks run only after you trust them once with `/hooks` in Codex');
  if (m.harnesses.includes('pi')) warn('Pi: project extensions load only after you trust the project when Pi asks');
  for (const c of kit.checks) which(c.cmd) ? ok(`${c.cmd} found`) : (c.required ? err : warn)(`${c.cmd} not found — ${c.hint}`);

  console.log(errors ? color.red(`\n${errors} error(s), ${warns} warning(s)`) : color.green(`\nHealthy${warns ? ` (${warns} warning(s))` : ''}`));
  return errors ? 1 : 0;
}
