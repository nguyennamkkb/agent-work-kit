import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeCtx, sync } from '../src/lib/engine.js';
import * as S from '../kit/method/hooks/store.mjs';
import { run } from '../kit/method/hooks/cli.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk2-'));
const read = (p) => fs.readFileSync(p, 'utf8');
const D = (root, f) => path.join(root, '.desk', f);
function install({ git = true } = {}) {
  const root = tmp();
  if (git) {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
  }
  sync(makeCtx({ root, harnesses: ['claude'], profession: 'ios' }));
  return root;
}
const desk = (root, ...argv) => {
  const out = [];
  run(argv, { cwd: root, out: (s) => out.push(s) });
  return out.join('\n');
};
const hook = (root, script, input = {}) =>
  spawnSync(process.execPath, [path.join(root, '.agentkit/hooks', script)], { input: JSON.stringify({ cwd: root, ...input }), env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' });
const ctxOf = (r) => (r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '');

test('fresh install: desk.json, DESK.md, team.json with the profession defaults, git-ignored state', () => {
  const root = install();
  assert.deepEqual(S.load(root).items, []);
  assert.match(read(D(root, 'DESK.md')), /# Desk — iOS/);
  assert.equal(JSON.parse(read(D(root, 'team.json'))).test.exclusive, 'simulator');
  for (const f of ['.state.json', '.journal.jsonl', '.undo/', 'desk.html']) assert.match(read(D(root, '.gitignore')), new RegExp(f.replace('.', '\\.')));
  assert.ok(fs.existsSync(path.join(root, '.agentkit/desk.mjs')) && fs.existsSync(path.join(root, '.agentkit/docs/team.md')));
});

test('task lifecycle: add, start (parks the current one), wait, resume, done with proof, next up', () => {
  const root = install();
  assert.match(desk(root, 'add', 'P1', 'Login screen', '--done', 'tests pass', '--now'), /Q-1 P1 added and started/);
  assert.match(desk(root, 'add', 'P2', 'Dark mode'), /Q-2 P2 added/);
  assert.match(desk(root, 'add', 'P0', 'Crash on launch', '--now', '--next', 'form half done'), /Q-1 back to queue/);
  let d = S.load(root);
  assert.equal(S.focus(d).id, 'Q-3');
  assert.equal(S.find(d, 'Q-1').next, 'form half done', 'the parked task keeps where it stopped');
  assert.throws(() => desk(root, 'done'), /needs proof/);
  assert.match(desk(root, 'done', '--proof', 'launch ok'), /Q-3 done · next up: Q-1/);
  assert.match(desk(root, 'wait', 'Q-2', '--on', 'user'), /waiting on user/);
  assert.equal(S.find(S.load(root), 'Q-2').status, 'waiting');
  desk(root, 'resume', 'Q-2');
  assert.equal(S.find(S.load(root), 'Q-2').status, 'todo');
  desk(root, 'edit', 'Q-2', '--prio', 'P0', '--text', 'Dark mode (all screens)');
  d = S.load(root);
  assert.equal(S.ready(root, d)[0].id, 'Q-2', 'P0 first');
  assert.match(read(D(root, `archive/${new Date().toISOString().slice(0, 7)}.md`)), /Q-3 P0 Crash on launch — launch ok/);
});

test('waiting on a task or a date wakes up by itself', () => {
  const root = install();
  desk(root, 'add', 'API contract');
  desk(root, 'add', 'Client', '--now');
  desk(root, 'wait', 'Q-2', '--on', 'Q-1');
  desk(root, 'add', 'Renew cert');
  desk(root, 'wait', 'Q-3', '--until', '2000-01-01');
  desk(root, 'start', 'Q-1');
  const out = desk(root, 'done', '--proof', 'contract merged');
  assert.match(out, /woke Q-2 \(Q-1 done\), Q-3 \(until 2000-01-01 reached\)/);
  const d = S.load(root);
  assert.equal(S.find(d, 'Q-2').status, 'todo');
  assert.equal(S.find(d, 'Q-3').status, 'todo');
});

test('drop needs a reason and undo brings it back; split closes the parent with its children', () => {
  const root = install();
  desk(root, 'add', 'Onboarding');
  assert.throws(() => desk(root, 'drop', 'Q-1'), /--why/);
  desk(root, 'drop', 'Q-1', '--why', 'user: not this release');
  assert.equal(S.find(S.load(root), 'Q-1').status, 'dropped');
  assert.match(desk(root, 'undo'), /undid drop/);
  assert.equal(S.find(S.load(root), 'Q-1').status, 'todo');
  assert.match(desk(root, 'split', 'Q-1', 'screens', 'copy'), /Q-1 → Q-2, Q-3/);
  let d = S.load(root);
  assert.deepEqual(S.find(d, 'Q-3').deps, ['Q-2']);
  assert.ok(!S.ready(root, d).some((t) => t.id === 'Q-1'), 'a parent with open children is not "next"');
  desk(root, 'start', 'Q-2');
  desk(root, 'done', '--proof', 'ok');
  desk(root, 'start', 'Q-3');
  assert.match(desk(root, 'done', '--proof', 'ok'), /also done: Q-1/);
});

test('memory and lessons merge duplicates; a lesson seen twice asks for a proposal; approve needs the user\'s words', () => {
  const root = install();
  desk(root, 'remember', 'Build with the Lumen scheme', '--pin');
  assert.match(desk(root, 'remember', 'build with lumen scheme always'), /already known/);
  desk(root, 'lesson', 'force unwrap crashed the login view');
  assert.match(desk(root, 'lesson', 'force unwrap crashed login view again'), /seen ×2 → propose/);
  desk(root, 'propose', 'Lint force unwraps', '--change', 'enable swiftlint force_unwrapping', '--why', 'L-1 twice', '--from', 'L-1');
  assert.equal(S.find(S.load(root), 'L-1').proposal, 'P-001');
  assert.throws(() => desk(root, 'approve', 'P-001'), /--quote/);
  desk(root, 'approve', 'P-001', '--quote', 'ok làm đi');
  const file = fs.readdirSync(D(root, 'review')).find((f) => f.startsWith('P-001'));
  assert.match(read(D(root, `review/${file}`)), /Status: approved[\s\S]*ok làm đi/);
  assert.throws(() => desk(root, 'goal', 'a', 'b', 'c', 'd', 'e', 'f'), /at most 5/);
  desk(root, 'goal', 'Ship login v1', 'App Store build passes review');
  assert.match(S.surface(root, S.load(root)), /Goal: Ship login v1 \/ App Store build/);
});

test('auto-sort: stale todos drop a level, stale P3 is dropped, memory used often gets pinned', () => {
  const root = install();
  S.mutate(root, 'seed', (d) => {
    S.addTask(d, { text: 'old idea', prio: 'P3' });
    S.addTask(d, { text: 'old task', prio: 'P1' });
    for (const t of d.items) t.last = '2000-01-01';
    const m = S.remember(d, 'simulator udid is in team notes').item;
    m.uses = 4;
  });
  const state = { sessions: Array.from({ length: 7 }, (_, i) => `2026-0${i + 1}-01`) };
  let moves;
  S.mutate(root, 'sort', (d) => (moves = S.autoSort(root, d, state)));
  assert.ok(moves.includes('Q-2 P1→P2'));
  assert.ok(moves.includes('Q-1 dropped (stale)'));
  assert.ok(moves.some((m) => /M-1 pinned/.test(m)));
});

test('inbox: capture raw notes, file them as task, memory or lesson', () => {
  const root = install();
  desk(root, 'inbox', 'maybe cache images');
  desk(root, 'inbox', 'API base url is staging.example.com');
  desk(root, 'file', 'Q-1', 'task', 'P2');
  desk(root, 'file', 'Q-2', 'memory');
  const d = S.load(root);
  assert.equal(S.find(d, 'Q-1').status, 'todo');
  assert.equal(S.memories(d)[0].text, 'API base url is staging.example.com');
  assert.equal(S.tasks(d, 'inbox').length, 0);
});

test('v1 desk (markdown zones) converts to desk.json on update; old files are kept', () => {
  const root = tmp();
  fs.mkdirSync(D(root, 'archive'), { recursive: true });
  const it = (p, id, t, sub = []) => [`- ${p} ${id} ${t} · +2026-11-01 · ×2 · @2026-11-20`, ...sub.map((x) => `  - ${x}`)].join('\n');
  fs.writeFileSync(D(root, 'goal.md'), '# Goal\nShip v1\n');
  fs.writeFileSync(D(root, 'now.md'), `# Now\n${it('P1', 'Q-4', 'Login', ['done: tests', 'next: API'])}\n`);
  fs.writeFileSync(D(root, 'queue.md'), `# Queue\n${it('P2', 'Q-5', 'Dark mode')}\n`);
  fs.writeFileSync(D(root, 'inbox.md'), '# Inbox\n- check crash log\n');
  fs.writeFileSync(D(root, 'memory.md'), `# Memory\n${it('P1', 'M-1', 'Use Lumen scheme')}\n---\n${it('P3', 'M-2', 'old fact')}\n`);
  fs.writeFileSync(D(root, 'notebook.md'), `# Notebook\n${it('P2', 'L-1', 'run lint first')}\n`);
  fs.writeFileSync(D(root, 'rules.local.md'), '# Project rules\n');
  const res = sync(makeCtx({ root, harnesses: ['claude'], profession: 'ios' }));
  assert.ok(res.report.some((r) => r.action === 'migrate'));
  const d = S.load(root);
  assert.deepEqual(d.goal, ['Ship v1']);
  assert.equal(S.focus(d).id, 'Q-4');
  assert.equal(S.focus(d).next, 'API');
  assert.equal(S.find(d, 'M-1').pin, true);
  assert.ok(!S.find(d, 'M-2').pin);
  assert.equal(S.find(d, 'L-1').seen, 2);
  assert.equal(S.tasks(d, 'inbox')[0].text, 'check crash log');
  assert.equal(d.seq.Q, 6, 'new ids continue after the old ones');
  assert.ok(fs.existsSync(D(root, 'archive/v1/now.md')) && !fs.existsSync(D(root, 'now.md')));
});

test('capture: remember and corrections are filed by the hook; urgent lifts the mentioned task; normal prompts cost nothing', () => {
  const root = install();
  hook(root, 'session-start.mjs', { source: 'startup' });
  desk(root, 'add', 'P2', 'Fix login crash on iPad', '--now', '--done', 'no crash');
  assert.equal(hook(root, 'capture.mjs', { prompt: 'thêm nút đăng xuất ở settings' }).stdout, '', 'nothing to say → no tokens');
  const r1 = ctxOf(hook(root, 'capture.mjs', { prompt: 'nhớ: luôn build bằng scheme Lumen-Dev' }));
  assert.match(r1, /Saved the user's words as M-1/);
  const r2 = ctxOf(hook(root, 'capture.mjs', { prompt: 'sai rồi, đừng dùng force unwrap' }));
  assert.match(r2, /Correction → L-1/);
  const r3 = ctxOf(hook(root, 'capture.mjs', { prompt: 'login crash iPad gấp lắm' }));
  assert.match(r3, /Q-1 raised to P0/);
  const d = S.load(root);
  assert.equal(S.find(d, 'Q-1').prio, 'P0');
  assert.equal(S.memories(d)[0].auto, true);
  assert.equal(S.lessons(d).length, 1);
  assert.ok(read(D(root, '.journal.jsonl')).includes('force unwrap'));
});

test('session-start: counts sessions, shows a short surface; a worker sees only its own task', () => {
  const root = install();
  desk(root, 'add', 'P1', 'Login screen', '--now', '--done', 'tests');
  const out = hook(root, 'session-start.mjs', { source: 'startup' }).stdout;
  assert.match(out, /iOS desk · session 1/);
  assert.match(out, /Now: Q-1 P1 Login screen · done: tests/);
  const surfacePart = out.split('<desk-skill')[0];
  assert.ok(surfacePart.length < 900, `surface stays short (${surfacePart.length} chars)`);
  assert.match(out, /<desk-skill source="\.claude\/skills\/desk\/SKILL\.md">[\s\S]*# The desk[\s\S]*### IOS-001 · P0[\s\S]*<\/desk-skill>/, 'the skill is handed over at a new session (models may not load it themselves)');
  assert.doesNotMatch(hook(root, 'session-start.mjs', { source: 'resume' }).stdout, /<desk-skill/, 'not repeated on resume');
  S.mutate(root, 'w', (d) => {
    const t = S.addTask(d, { text: 'engineer: API client', role: 'engineer' }).item;
    Object.assign(t, { status: 'doing', executor: 'orca', terminal: 'term_W', dispatch: 'ctx_1', spec: '.desk/plans/specs/Q-2.sent.md' });
  });
  const w = spawnSync(process.execPath, [path.join(root, '.agentkit/hooks/session-start.mjs')], { input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: root, ORCA_TERMINAL_HANDLE: 'term_W' }, encoding: 'utf8' }).stdout;
  assert.match(w, /You are a worker: Q-2/);
  assert.doesNotMatch(w, /Login screen/);
});

test('guard: the desk data changes only through the command; plans, proposals, team.json and rules stay writable', () => {
  const root = install();
  const g = (file, content) => hook(root, 'guard.mjs', { tool_name: 'Write', tool_input: { file_path: path.join(root, file), content } });
  assert.equal(g('.desk/desk.json', '{}').status, 2);
  assert.match(g('.desk/DESK.md', 'x').stderr, /desk command/);
  assert.equal(g('.desk/archive/2026-11.md', 'x').status, 2);
  assert.equal(g('.desk/plans/20261122-login.md', '# Plan').status, 0);
  assert.equal(g('.desk/team.json', '{"build":"make"}').status, 0);
  assert.equal(g('.desk/team.json', '{oops').status, 2);
  assert.equal(g('.desk/rules.local.md', '# Project rules\n\n### LOCAL-001 · P1\nAlways X.\n').status, 2, 'needs an approved proposal');
  assert.equal(g('.agentkit/hooks/guard.mjs', '').status, 2);
  assert.equal(g('Sources/App.swift', 'import SwiftUI').status, 0);
});

test('stop-check: inbox, unrecorded code changes, reports to verify — each reminded once', () => {
  const root = install();
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'kit'], { cwd: root });
  const stop = () => hook(root, 'stop-check.mjs', {});
  assert.equal(stop().stdout, '', 'clean desk: nothing to say');
  desk(root, 'inbox', 'idea');
  const r = JSON.parse(stop().stdout);
  assert.equal(r.decision, 'block');
  assert.match(r.reason, /inbox holds 1/);
  assert.equal(stop().stdout, '', 'the same reminder only once');
  desk(root, 'file', 'Q-1', 'task');
  const later = Date.now() / 1000 + 5;
  fs.writeFileSync(path.join(root, 'App.swift'), 'x');
  fs.utimesSync(path.join(root, 'App.swift'), later, later);
  assert.match(JSON.parse(stop().stdout).reason, /changed but no task is in progress/);
});

test('DESK.md and desk.html are regenerated on every change', () => {
  const root = install();
  desk(root, 'add', 'P1', 'Paywall', '--now', '--done', 'purchase works in sandbox');
  desk(root, 'add', 'P2', 'Widgets');
  desk(root, 'wait', 'Q-2', '--on', 'design team');
  const md = read(D(root, 'DESK.md'));
  assert.match(md, /## Now[\s\S]*Q-1[\s\S]*done: purchase works/);
  assert.match(md, /## Waiting[\s\S]*\*\*Q-2\*\* P2 Widgets — on design team/);
  const html = read(D(root, 'desk.html'));
  assert.ok(html.includes('"Paywall"') && !html.includes('/*DESK*/'));
});

test('smoke: prompts from a real session — no false mentions, drop is recognized, resumed session ids count once', async () => {
  const root = install();
  const { detectSignals } = await import('../kit/method/hooks/_lib.mjs');
  S.mutate(root, 'seed', (d) => {
    S.lesson(d, "Kế hoạch theo thời hạn (học, tập, dự án) phải chốt mốc thật trước khi chia tuần: JLPT chỉ thi tháng 7 và 12, nên '3 tháng nữa thi' lệch lịch");
    S.remember(d, 'Tài liệu tiếng Nhật của mình: KHÔNG viết romaji — thuật ngữ Nhật viết bằng kana', { pin: true });
    S.addTask(d, { text: 'Tìm bộ đề thi thử N5: đề mẫu chính thức' });
  });
  const probe = (text) => S.bumpMatches(JSON.parse(JSON.stringify(S.load(root))), { text }).map((i) => i.id);
  assert.deepEqual(probe('nhớ: mình chỉ học được buổi tối sau 21h, cuối tuần học được 2 tiếng'), []);
  assert.deepEqual(probe('Nên dùng Anki hay app Duolingo để học từ vựng?'), []);
  assert.deepEqual(probe('để sau: tìm một bộ đề thi thử N5. Còn việc chọn giáo trình thì chờ mình hỏi giáo viên đã.'), ['Q-1']);
  assert.ok(detectSignals('thôi bỏ việc tìm đề thi thử đi, mình có rồi').includes('drop'));
  const start = (sid) => hook(root, 'session-start.mjs', { source: 'startup', session_id: sid });
  start('ses_A');
  start('ses_A');
  assert.equal(JSON.parse(read(D(root, '.state.json'))).session, 1, 'the same session id resumed is not a new session');
  start('ses_B');
  assert.equal(JSON.parse(read(D(root, '.state.json'))).session, 2);
  assert.match(S.surface(root, { ...S.load(root), goal: [] }), /take it from what the user asks for/);
});

test('stop-check notices changed files without git (projects outside coding often have none)', () => {
  const root = install({ git: false });
  desk(root, 'add', 'P1', 'Landing page', '--now', '--done', 'renders');
  desk(root, 'done', '--proof', 'opened in the browser');
  assert.equal(S.find(S.load(root), 'Q-1').next, undefined, 'a closed task keeps no next step');
  const stop = () => hook(root, 'stop-check.mjs', {});
  assert.equal(stop().stdout, '', 'nothing changed yet');
  const later = Date.now() / 1000 + 5;
  fs.writeFileSync(path.join(root, 'styles.css'), 'body{}');
  fs.utimesSync(path.join(root, 'styles.css'), later, later);
  assert.match(JSON.parse(stop().stdout).reason, /1 file\(s\) changed but no task is in progress/);
});
