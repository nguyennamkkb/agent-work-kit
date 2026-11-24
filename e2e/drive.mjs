#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const [scnName, H, MODEL, ...rest] = process.argv.slice(2);
if (!scnName || !H || !MODEL) {
  console.error('usage: drive.mjs <scenario> <pi|omp|opencode> <model> [--keep]');
  process.exit(1);
}
const KEEP = rest.includes('--keep');
const ORCA = process.env.ORCA_CLI_COMMAND || 'orca';
const scn = (await import(path.join(HERE, 'scenarios', scnName, 'scenario.mjs'))).default;
const S = await import(path.join(REPO, 'kit/method/hooks/store.mjs'));
const L = await import(path.join(REPO, 'kit/method/hooks/_lib.mjs'));
const short = MODEL.split('/').pop().replace(/[^\w.-]/g, '');
const D = path.join(os.homedir(), 'Documents/dev', `desk-team-test-${scnName}-${H}-${short}`);
const OUT = path.join(os.homedir(), 'Documents/dev/desk-team-results/scenarios');
const STAMP = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'));
const sleep = (ms) => spawnSync('sleep', [String(ms / 1000)]);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), `[${scnName}/${H}/${short}]`, ...a);

function orca(args) {
  const r = spawnSync(ORCA, [...args, '--json'], { encoding: 'utf8', timeout: 700000 });
  try {
    return JSON.parse((r.stdout || '').split('\n').filter((l) => !l.startsWith('{"_keepalive"')).join('\n'));
  } catch {
    return { ok: false, raw: (r.stdout || '') + (r.stderr || '') };
  }
}
const terminals = () => orca(['terminal', 'list', '--worktree', `path:${D}`]).result?.terminals ?? [];
const screen = (h) => (orca(['terminal', 'read', '--terminal', h, '--screen']).result?.terminal?.tail ?? []).join('\n');
const ASK = /╭─ Ask|enter submit|enter confirm|↑↓ select/;
const TRUST = /Trust project folder\?|Hooks need review|t trust all/;
let trusts = 0;

let asked = 0;
function trustOnce(h) {
  trusts++;
  const scr = screen(h);
  if (/t trust all/.test(scr)) {
    log('codex shows its hooks review page; trusting all and closing it');
    for (const k of ['t', '\x1b']) spawnSync(ORCA, ['terminal', 'send', '--terminal', h, '--text', k, '--json']), sleep(1000);
    sleep(3000);
    return;
  }
  if (/Hooks need review/.test(scr)) {
    log('codex asks to review the project hooks; choosing "Trust all and continue"');
    for (const k of ['\x1b[B', '\r']) spawnSync(ORCA, ['terminal', 'send', '--terminal', h, '--text', k, '--json']), sleep(500);
    sleep(5000);
    return;
  }
  log('harness asks to trust the project folder; choosing "this session only"');
  for (const k of ['\x1b[B', '\x1b[B', '\r']) spawnSync(ORCA, ['terminal', 'send', '--terminal', h, '--text', k, '--json']), sleep(500);
  sleep(15000);
}
const asks = [];
function settle(h, firstWaitMs = 20000) {
  sleep(firstWaitMs);
  for (let i = 0; i < 8; i++) {
    // A trust dialog never reads as idle: wait in short steps and look at the screen between them.
    for (let k = 0; k < 40; k++) {
      const cur = screen(h);
      if (TRUST.test(cur) || ASK.test(cur)) break;
      const w = orca(['terminal', 'wait', '--terminal', h, '--for', 'tui-idle', '--timeout-ms', '15000']);
      if (w.ok || w.error?.code === 'terminal_exited') break;
    }
    const scr = screen(h);
    if (TRUST.test(scr)) {
      trustOnce(h);
      continue;
    }
    if (!ASK.test(scr)) return scr;
    asked++;
    asks.push(scr.split('\n').slice(-25).join('\n'));
    log(`agent opened a question dialog (#${asked}); accepting its default to go on`);
    spawnSync(ORCA, ['terminal', 'send', '--terminal', h, '--text', '\r', '--json']);
    sleep(15000);
  }
  return screen(h);
}
function launch(prompt) {
  const before = new Set(terminals().map((t) => t.handle));
  const args = ['agent', 'launch', '--agent', H, '--model', MODEL, '--worktree', `path:${D}`, '--surface', 'terminal', '--prompt', prompt];
  if (H !== 'opencode') args.push('--effort', process.env.EFFORT || 'high');
  const r = orca(args);
  if (!r.ok) throw new Error(`launch failed: ${JSON.stringify(r.error ?? r.raw).slice(0, 300)}`);
  for (let i = 0; i < 20; i++) {
    const t = terminals().find((x) => !before.has(x.handle));
    if (t) return t.handle;
    sleep(2000);
  }
  throw new Error('no terminal for the launched agent');
}
function mail(h, text) {
  const f = path.join(tmp, `m${Date.now()}.txt`);
  fs.writeFileSync(f, text + '\n');
  const r = orca(['orchestration', 'send', '--to', h, '--type', 'dispatch', '--subject', text.slice(0, 60), '--body-file', f]);
  if (!r.ok) log('mail failed', JSON.stringify(r.error ?? r.raw).slice(0, 200));
}
const loadDesk = () => ({ ...S.load(D), archived: S.archived(D, 400) });
const snaps = {};
const snap = (id) => {
  snaps[id] = { at: new Date().toISOString(), desk: loadDesk() };
  log(`after ${id}:`, snaps[id].desk.items.filter((i) => i.kind === 'task').map((t) => `${t.id}:${t.status}${t.prio ? '/' + t.prio : ''}`).join(' '));
};
const sh = (cmd) => spawnSync('bash', ['-lc', cmd], { cwd: D, encoding: 'utf8' });

const t0 = Date.now();
log('setup', D);
const env = { ...process.env, DESK_TEAM_DIR: D, ...(/free/.test(MODEL) ? { TEAM_DENY: '' } : {}) };
const ov = path.join(HERE, 'scenarios', scnName, 'overlay');
if (fs.existsSync(ov)) env.FIXTURE_OVERLAY = ov;
const st = spawnSync('bash', [path.join(HERE, 'team', 'setup.sh'), H, MODEL], { env, encoding: 'utf8' });
if (st.status) throw new Error('setup failed: ' + st.stdout + st.stderr);
const fixtureTests = Object.fromEntries(fs.readdirSync(path.join(D, 'tests')).map((f) => [f, fs.readFileSync(path.join(D, 'tests', f), 'utf8')]));

let lead = launch(scn.launch);
log('lead', lead);
settle(lead, 30000);
let redelivered = 0;
if (!fs.existsSync(path.join(D, '.desk/.journal.jsonl'))) {
  redelivered++;
  log('launch prompt was lost (agent used no tokens); re-delivering it by mail');
  mail(lead, scn.launch);
  settle(lead);
}
snap('launch');
if (scn.mode === 'solo') {
  for (const s of scn.steps ?? []) {
    mail(lead, s.send);
    settle(lead);
    snap(s.id);
  }
} else {
  const until = t0 + (scn.timeoutMin ?? 45) * 60e3;
  for (;;) {
    const merged = sh('git log --merges --oneline -1').stdout.trim();
    const wts = sh('git worktree list').stdout.trim().split('\n').length;
    if (merged && wts === 1) break;
    if (Date.now() > until) {
      log('timeout');
      break;
    }
    // Workers start in their own worktree, where the harness asks to trust the hooks again.
    for (const t of orca(['terminal', 'list']).result?.terminals ?? []) if (t.handle !== lead && (t.worktreePath ?? '').includes(path.basename(D)) && TRUST.test(screen(t.handle))) trustOnce(t.handle);
    const scr = screen(lead);
    if (TRUST.test(scr)) trustOnce(lead);
    else if (ASK.test(scr)) {
      asked++;
      asks.push(scr.split('\n').slice(-25).join('\n'));
      log(`lead opened a question dialog (#${asked}); accepting its default`);
      spawnSync(ORCA, ['terminal', 'send', '--terminal', lead, '--text', '\r', '--json']);
    }
    sleep(30000);
  }
  settle(lead, 5000);
  snap('end');
}
const sessions = L.readState(D).session;
let freshAnswer = '';
if (scn.fresh) {
  const f = launch(scn.fresh);
  freshAnswer = settle(f, 30000);
  snap('fresh');
}

const build = sh('node scripts/check.mjs');
const tests = sh('node --test 2>&1');
const num = (k) => Number(new RegExp(`ℹ ${k} (\\d+)`).exec(tests.stdout)?.[1] ?? NaN);
const now = fs.readdirSync(path.join(D, 'tests'));
const ctx = {
  desk: loadDesk(),
  snaps,
  asked,
  sessions,
  freshAnswer,
  rules: L.read(path.join(D, '.desk/rules.local.md')) ?? '',
  review: L.listReview(D),
  fixtureTests: now.length === Object.keys(fixtureTests).length && now.every((f) => fixtureTests[f] === fs.readFileSync(path.join(D, 'tests', f), 'utf8')),
  sh: { buildOk: build.status === 0, testsPass: num('pass'), testsFail: num('fail') },
  git: { lastMerge: sh('git log --merges --oneline -1').stdout.trim(), merged: !!sh('git log --merges --oneline -1').stdout.trim(), worktrees: sh('git worktree list').stdout.trim().split('\n').length },
};
const checks = scn.verify(ctx).map(([name, ok, detail]) => ({ name, ok: !!ok, detail: String(detail ?? '') }));
const minutes = Math.round((Date.now() - t0) / 60e3);
fs.mkdirSync(OUT, { recursive: true });
const base = path.join(OUT, `${STAMP}-${scnName}-${H}-${short}`);
fs.writeFileSync(base + '.json', JSON.stringify({ scenario: scnName, harness: H, model: MODEL, minutes, asked, trusts, redelivered, sessions, checks, asks, freshAnswer, snaps, ctx: { ...ctx, snaps: undefined, review: ctx.review.map(({ id, kind, status, title }) => ({ id, kind, status, title })) } }, null, 1));
fs.writeFileSync(
  base + '.md',
  `# ${scnName} · ${H} · ${MODEL}\n\n${checks.filter((c) => c.ok).length}/${checks.length} checks · ${minutes} min · ask dialogs ${asked} · trust prompts ${trusts} · prompt re-delivered ${redelivered}\n\n| | Check | Detail |\n|---|---|---|\n${checks.map((c) => `| ${c.ok ? '✅' : '❌'} | ${c.name} | ${c.detail.replace(/\|/g, '/').replace(/\n/g, ' ')} |`).join('\n')}\n\n## Fresh session answer\n\n\`\`\`\n${freshAnswer.slice(-3000)}\n\`\`\`\n`,
);
spawnSync('bash', [path.join(HERE, 'team', 'collect.sh'), `${scnName}-${H}-${short}`], { env, encoding: 'utf8' });
log(`score ${checks.filter((c) => c.ok).length}/${checks.length} in ${minutes} min → ${base}.md`);
if (!KEEP) spawnSync('bash', [path.join(HERE, 'team', 'clean.sh')], { env, stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
