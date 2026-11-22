import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCtx, sync } from '../src/lib/engine.js';
import * as S from '../kit/method/hooks/store.mjs';
import * as T from '../kit/method/hooks/team.mjs';
import { run } from '../kit/method/hooks/cli.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAKE = path.join(HERE, 'fixtures', 'fake-orca.mjs');
const G = ['-c', 'user.email=t@t', '-c', 'user.name=t'];
const sh = (cwd, ...a) => execFileSync('git', [...G, ...a], { cwd, encoding: 'utf8' }).trim();

/** A project with the kit, a fake Orca on hand, routing without catalogs (claude/codex), committed. */
function project() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'team-'));
  const root = path.join(base, 'app');
  fs.mkdirSync(root);
  const orcaDir = path.join(base, 'orca');
  fs.mkdirSync(orcaDir);
  process.env.AGENTKIT_ORCA = FAKE;
  process.env.FAKE_ORCA_DIR = orcaDir;
  process.env.FAKE_ORCA_REPO = root;
  delete process.env.ORCA_TERMINAL_HANDLE;
  sh(root, 'init', '-q', '-b', 'main');
  sync(makeCtx({ root, harnesses: ['claude'], profession: 'ios' }));
  T.setTeam(root, 'routing', JSON.stringify({ deny: ['*free*'], roles: { engineer: { use: ['claude:claude-sonnet-5-5@low'], fallback: ['codex:gpt-5.5@medium'], escalate: ['claude:claude-opus-5-5@high'] }, tester: { use: ['claude:claude-haiku-5-5@low'], fallback: ['codex:gpt-5.5@medium'] }, fixer: { use: ['claude:claude-sonnet-5-5@low'], fallback: ['orchestrator'] } } }));
  T.setTeam(root, 'build', 'make build');
  T.setTeam(root, 'test.command', 'make test');
  fs.writeFileSync(path.join(root, 'App.swift'), 'struct App {}\n');
  sh(root, 'add', '-A');
  sh(root, 'commit', '-q', '-m', 'init');
  const calls = () => fs.readFileSync(path.join(orcaDir, 'calls.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const mail = (msgs) => fs.writeFileSync(path.join(orcaDir, 'mail.json'), JSON.stringify(msgs));
  const workers = (w) => fs.writeFileSync(path.join(orcaDir, 'workers.json'), JSON.stringify(w));
  const desk = (...argv) => {
    const out = [];
    run(argv, { cwd: root, out: (s) => out.push(s) });
    return out.join('\n');
  };
  return { base, root, calls, mail, workers, desk };
}

test('routing: candidates, effort rules per agent, validation, escalation', () => {
  assert.deepEqual(T.parseCandidate('omp:op/deepseek-v4@high'), { agent: 'omp', model: 'op/deepseek-v4', effort: 'high', text: 'omp:op/deepseek-v4@high' });
  assert.deepEqual(T.parseCandidate('claude'), { agent: 'claude', model: null, effort: null, text: 'claude' });
  assert.deepEqual(T.launchArgs(T.parseCandidate('claude:claude-sonnet-5-5@low')), ['--agent', 'claude', '--model', 'claude-sonnet-5-5', '--effort', 'low']);
  assert.deepEqual(T.launchArgs(T.parseCandidate('omp:op/ds@high')), ['--agent', 'omp', '--model', 'op/ds:high'], 'omp: thinking level in the model');
  assert.deepEqual(T.launchArgs(T.parseCandidate('pi:anthropic/claude@medium')), ['--agent', 'pi', '--model', 'anthropic/claude', '--effort', 'medium']);
  assert.deepEqual(T.launchArgs(T.parseCandidate('opencode:openrouter/x')), ['--agent', 'opencode', '--model', 'openrouter/x']);
  const errs = T.routingErrors({ deny: ['*free*'], roles: { a: { use: ['nope:x'], fallback: ['opencode:m@high'] }, b: { use: ['claude@low'], fallback: ['claude:claude-x-free'] }, c: { use: ['orchestrator'] } } });
  for (const re of [/unknown agent nope/, /opencode takes no effort/, /effort needs a model/, /matches deny/, /"orchestrator" only in fallback/, /fallback needs/]) assert.ok(errs.some((e) => re.test(e)), `${re} in ${errs.join(' | ')}`);
  const { root } = project();
  const team = T.loadTeam(root);
  assert.equal(T.route(root, team, 'engineer').cand.text, 'claude:claude-sonnet-5-5@low');
  assert.equal(T.route(root, team, 'engineer', { fails: 2 }).cand.text, 'claude:claude-opus-5-5@high', 'two failed rounds escalate first');
  assert.equal(T.route(root, team, 'engineer', { exclude: ['claude:claude-sonnet-5-5@low'] }).cand.text, 'codex:gpt-5.5@medium');
  assert.equal(T.route(root, team, 'fixer', { exclude: ['claude:claude-sonnet-5-5@low'] }).kind, 'LEAD', 'orchestrator = stop delegating');
  assert.match(T.route(root, team, 'engineer', { level: 'L4' }).detail, /unsliced L4/);
});

test('dispatch: refuses without the user\'s yes, then routes, briefs and records the worker on the desk', () => {
  const { root, desk, calls } = project();
  desk('add', 'P1', 'engineer: API client', '--role', 'engineer', '--files', 'API.swift', '--done', 'build green');
  assert.throws(() => desk('dispatch', 'Q-1'), /ask the user in one sentence/);
  const dry = desk('dispatch', 'Q-1', '--dry-run');
  assert.match(dry, /--agent claude --model claude-sonnet-5-5 --effort low/);
  desk('team', 'allow', '--quote', 'ok, chia cho 2 worker');
  assert.match(desk('dispatch', 'Q-1'), /Q-1 dispatched → claude:claude-sonnet-5-5@low \(dispatch ctx_000000000001/);
  const t = S.find(S.load(root), 'Q-1');
  assert.equal(t.status, 'doing');
  assert.equal(t.executor, 'orca');
  assert.equal(t.terminal, 'term_1');
  assert.equal(t.baseSha.length, 40);
  const sent = fs.readFileSync(path.join(root, t.spec), 'utf8');
  assert.match(sent, /ROLE: engineer for task Q-1[\s\S]*You own only: API.swift[\s\S]*make build[\s\S]*worker Q-1 done --outcome/);
  const start = calls().find((c) => c[1] === 'worker-start');
  assert.ok(start.includes('--spec-file') && start.includes(`path:${root}`));
  // file ownership and the worker ceiling
  desk('add', 'P1', 'engineer: also API', '--role', 'engineer', '--files', 'API.swift');
  assert.throws(() => desk('dispatch', 'Q-2'), /Q-1 \(doing\) also owns API.swift/);
  T.setTeam(root, 'maxWorkers', '1');
  desk('edit', 'Q-2', '--files', 'Other.swift');
  assert.throws(() => desk('dispatch', 'Q-2'), /maxWorkers 1/);
});

test('dispatch retries the next model when a launch fails', () => {
  const { root, desk } = project();
  process.env.FAKE_ORCA_FAIL_MODEL = 'claude-sonnet-5-5';
  try {
    desk('add', 'engineer: x', '--role', 'engineer');
    desk('team', 'allow', '--quote', 'yes');
    const out = desk('dispatch', 'Q-1');
    assert.match(out, /LAUNCH-FAILED\] claude:claude-sonnet-5-5@low[\s\S]*dispatched → codex:gpt-5.5@medium/);
    assert.match(S.find(S.load(root), 'Q-1').history.at(-1).note, /after launch failures/);
  } finally {
    delete process.env.FAKE_ORCA_FAIL_MODEL;
  }
});

test('worker side: done checks the commit and the owned files, then the lead verifies from mail', () => {
  const { root, desk, mail } = project();
  desk('add', 'engineer: API client', '--role', 'engineer', '--files', 'API.swift');
  desk('team', 'allow', '--quote', 'ok');
  desk('dispatch', 'Q-1');
  process.env.ORCA_TERMINAL_HANDLE = 'term_1';
  try {
    assert.throws(() => desk('worker', 'Q-1', 'done', '--outcome', 'succeeded', '--summary', 'x'), /no commit since dispatch/);
    fs.writeFileSync(path.join(root, 'API.swift'), 'struct API {}\n');
    fs.writeFileSync(path.join(root, 'Other.swift'), 'x\n');
    sh(root, 'add', '-A');
    sh(root, 'commit', '-q', '-m', 'api');
    assert.throws(() => desk('worker', 'Q-1', 'done', '--outcome', 'succeeded', '--summary', 'x'), /outside Q-1: Other.swift/);
    sh(root, 'rm', '-q', 'Other.swift');
    sh(root, 'commit', '-q', '-m', 'revert other');
    const head = sh(root, 'rev-parse', 'HEAD');
    assert.match(desk('worker', 'Q-1', 'done', '--outcome', 'succeeded', '--summary', 'API client, build green'), /Q-1 succeeded @ /);
    const t = S.find(S.load(root), 'Q-1');
    assert.equal(t.status, 'review');
    assert.ok(head.startsWith(t.sha) || sh(root, 'rev-parse', 'HEAD~1').startsWith(t.sha));
  } finally {
    delete process.env.ORCA_TERMINAL_HANDLE;
  }
  // a question and an escalation arrive through the lead's mail
  desk('add', 'tester: run unit tests', '--role', 'tester');
  desk('dispatch', 'Q-2');
  mail([
    { id: 'msg_q', type: 'question', subject: 'Q-2 which scheme?', body: 'Lumen or Lumen-Dev?', dispatch_id: 'ctx_000000000002', created_at: '2026-11-22T10:00:00Z' },
    { id: 'msg_s', type: 'status', subject: 'Q-2 started', payload: { dispatchId: 'ctx_000000000002' }, created_at: '2026-11-22T09:59:00Z' },
  ]);
  const m = desk('mail');
  assert.match(m, /question Q-2[\s\S]*→ Q-2: answer with `reply Q-2/);
  assert.equal(S.find(S.load(root), 'Q-2').question.text, 'Lumen or Lumen-Dev?');
  desk('reply', 'Q-2', 'Lumen-Dev');
  assert.equal(S.find(S.load(root), 'Q-2').question, undefined);
  assert.match(desk('mail'), /mail: empty — end your turn/);
  // the lead verifies the reviewed task
  desk('done', 'Q-1', '--proof', 'read the diff; build green');
  assert.equal(S.find(S.load(root), 'Q-1').status, 'done');
});

test('sync moves a worker that finished without reporting; a failed dispatch becomes failed', () => {
  const { root, desk, workers } = project();
  desk('add', 'engineer: a', '--role', 'engineer', '--files', 'a.swift');
  desk('add', 'engineer: b', '--role', 'engineer', '--files', 'b.swift');
  desk('team', 'allow', '--quote', 'ok');
  desk('dispatch', 'Q-1');
  desk('dispatch', 'Q-2');
  workers([{ dispatchId: 'ctx_000000000001', dispatchStatus: 'completed' }, { dispatchId: 'ctx_000000000002', dispatchStatus: 'failed', workerState: 'exited' }]);
  assert.match(desk('sync'), /WOULD\] Q-1 → review[\s\S]*rerun with --apply/);
  desk('sync', '--apply');
  const d = S.load(root);
  assert.equal(S.find(d, 'Q-1').status, 'review');
  assert.equal(S.find(d, 'Q-2').status, 'failed');
});

test('lease: one holder per exclusive resource, released when the task closes', () => {
  const { root, desk } = project();
  desk('add', 'tester: a', '--role', 'tester');
  desk('add', 'tester: b', '--role', 'tester');
  assert.match(desk('lease', 'acquire', '--holder', 'Q-1'), /simulator → Q-1/);
  assert.throws(() => desk('lease', 'acquire', '--holder', 'Q-2'), /held by Q-1/);
  desk('start', 'Q-1');
  assert.match(desk('done', 'Q-1', '--proof', 'green'), /released simulator/);
  assert.match(desk('lease', 'acquire', '--holder', 'Q-2'), /simulator → Q-2/);
});

test('plan worktrees: open, worker surface inside it, park, reopen, gate, close after merge', () => {
  const { root, base, desk } = project();
  assert.throws(() => desk('wt', 'open', 'login'), /no plan file/);
  desk('plan', 'login', '--goal', 'Email login');
  sh(root, 'add', '-A');
  sh(root, 'commit', '-q', '-m', 'plan login');
  assert.match(desk('wt', 'open', 'login'), /opened .*app-plan-login/);
  const wt = path.join(base, 'app-plan-login');
  assert.equal(sh(wt, 'branch', '--show-current'), 'plan/login');
  desk('add', 'engineer: login form', '--plan', 'login', '--role', 'engineer', '--files', 'Login.swift');
  desk('team', 'allow', '--quote', 'ok');
  desk('dispatch', 'Q-1');
  const t = S.find(S.load(root), 'Q-1');
  assert.equal(t.worktree, `path:${wt}`, 'the plan worktree is picked by itself');
  // inside the worktree the hooks and the desk command reach the main desk, and show the worker its task
  const out = [];
  run(['status'], { cwd: wt, out: (s) => out.push(s) });
  assert.match(out.join('\n'), /You are a worker: Q-1/);
  assert.match(desk('wt', 'status'), /\[ACTIVE\] plan\/login/);
  assert.throws(() => desk('wt', 'park', 'login'), /running tasks: Q-1/);
  // the worker commits and reports from its worktree
  fs.writeFileSync(path.join(wt, 'Login.swift'), 'struct Login {}\n');
  sh(wt, 'add', '-A');
  sh(wt, 'commit', '-q', '-m', 'login: form');
  process.env.ORCA_TERMINAL_HANDLE = 'term_1';
  try {
    const o2 = [];
    run(['worker', 'Q-1', 'done', '--outcome', 'succeeded', '--summary', 'form, build green'], { cwd: wt, out: (s) => o2.push(s) });
    assert.match(o2.join('\n'), /succeeded @/);
  } finally {
    delete process.env.ORCA_TERMINAL_HANDLE;
  }
  desk('done', 'Q-1', '--proof', 'diff read');
  assert.match(desk('gate', 'login'), /✗ no green tester report[\s\S]*gate: NOT ready/);
  desk('add', 'tester: login', '--plan', 'login', '--role', 'tester');
  desk('start', 'Q-2');
  desk('done', 'Q-2', '--proof', `unit green @ ${sh(wt, 'rev-parse', '--short', 'HEAD')}`);
  assert.match(desk('gate', 'login'), /gate: mechanical checks pass/);
  assert.match(desk('wt', 'park', 'login'), /parked/);
  assert.ok(!fs.existsSync(wt));
  assert.match(desk('wt', 'status'), /\[PARKED\] plan\/login/);
  assert.match(desk('wt', 'open', 'login'), /reopened/);
  assert.throws(() => desk('wt', 'close', 'login'), /not merged/);
  sh(root, 'merge', '-q', '--no-ff', 'plan/login', '-m', 'merge login');
  desk('wt', 'close', 'login');
  assert.equal(execFileSync('git', ['branch', '--list', 'plan/login'], { cwd: root, encoding: 'utf8' }).trim(), '');
  assert.throws(() => desk('wt', 'drop', 'x'), /--yes/);
});

test('team check and status explain themselves; no Orca → a clear message, solo still works', () => {
  const { root, desk } = project();
  assert.match(desk('team', 'check'), /orca: found[\s\S]*engineer\s+claude:claude-sonnet-5-5@low[\s\S]*routing: valid/);
  process.env.AGENTKIT_ORCA = '/nonexistent/orca';
  try {
    desk('add', 'engineer: x', '--role', 'engineer');
    assert.throws(() => desk('dispatch', 'Q-1'), /not installed/);
    assert.match(desk('team'), /orca not installed/);
    assert.match(desk('add', 'P1', 'solo work', '--now'), /added and started/);
  } finally {
    process.env.AGENTKIT_ORCA = FAKE;
  }
});

test('the npx CLI passes desk verbs and their flags through untouched', () => {
  const { root } = project();
  const cli = (...a) => spawnSync(process.execPath, [path.join(HERE, '../bin/cli.js'), 'desk', ...a, '--dir', root], { encoding: 'utf8' });
  const r = cli('add', 'P0', 'Hotfix', '--now', '--done', 'crash gone');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Q-1 P0 added and started/);
  assert.equal(S.focus(S.load(root)).done, 'crash gone');
});
