import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { makeCtx, sync } from '../src/lib/engine.js';
import * as S from '../kit/method/hooks/store.mjs';
import { journal, JOURNAL_MAX } from '../kit/method/hooks/_lib.mjs';
import { run } from '../kit/method/hooks/cli.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');
const D = (root, f) => path.join(root, '.desk', f);
function install() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'store-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  sync(makeCtx({ root, harnesses: ['claude'], profession: 'ios' }));
  return root;
}
const desk = (root, ...argv) => {
  const out = [];
  run(argv, { cwd: root, out: (s) => out.push(s) });
  return out.join('\n');
};
const undoCount = (root) => (fs.existsSync(D(root, '.undo')) ? fs.readdirSync(D(root, '.undo')).length : 0);
const ago = (min) => new Date(Date.now() - min * 6e4).toISOString().replace(/\.\d+Z$/, 'Z');

test('nothing changed → nothing written; bookkeeping writes desk.json only (no undo, no re-render)', () => {
  const root = install();
  desk(root, 'add', 'P1', 'Login screen with email field', '--now', '--done', 'tests');
  const json = read(D(root, 'desk.json'));
  const md = fs.statSync(D(root, 'DESK.md')).mtimeMs;
  const undos = undoCount(root);
  S.mutate(root, 'noop', () => 'nothing');
  assert.equal(read(D(root, 'desk.json')), json, 'unchanged desk is not rewritten');
  S.mutate(root, 'count', (d) => void (d.items[0].uses = 9), { bookkeeping: true });
  assert.equal(S.load(root).items[0].uses, 9);
  assert.equal(undoCount(root), undos, 'no undo snapshot for bookkeeping');
  assert.equal(fs.statSync(D(root, 'DESK.md')).mtimeMs, md, 'views not re-rendered for bookkeeping');
  const hook = spawnSync(process.execPath, [path.join(root, '.agentkit/hooks/capture.mjs')], { input: JSON.stringify({ cwd: root, prompt: 'about the login screen email field' }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  assert.equal(hook.status, 0);
  assert.equal(undoCount(root), undos);
});

test('a mention counts at most once a day per item', () => {
  const root = install();
  desk(root, 'add', 'Paywall screen layout');
  S.mutate(root, 'b', (d) => S.bumpMatches(d, { text: 'Q-1' }));
  S.mutate(root, 'b', (d) => S.bumpMatches(d, { text: 'Q-1 again' }));
  assert.equal(S.load(root).items[0].uses, 1, 'already touched today');
});

test('journal keeps words only for signals and stays under its size cap', () => {
  const root = install();
  const f = D(root, '.journal.jsonl');
  const big = 'x'.repeat(2000);
  for (let i = 0; i < 200; i++) journal(root, { s: 1, n: i, text: big });
  assert.ok(fs.statSync(f).size <= JOURNAL_MAX, `journal ${fs.statSync(f).size} bytes`);
  const lines = read(f).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.at(-1).n, 199, 'newest entries kept');
  spawnSync(process.execPath, [path.join(root, '.agentkit/hooks/capture.mjs')], { input: JSON.stringify({ cwd: root, prompt: 'thêm nút đăng xuất' }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  assert.equal(JSON.parse(read(f).trim().split('\n').at(-1)).text, undefined, 'a plain prompt is not stored verbatim');
});

test('archive: monthly compact summaries, deps resolved from the archive, log and restore', () => {
  const root = install();
  desk(root, 'add', 'API contract', '--now');
  desk(root, 'done', '--proof', 'merged');
  for (let i = 0; i < 14; i++) desk(root, 'add', `filler ${i}`, '--now'), desk(root, 'done', '--proof', 'ok');
  assert.ok(!S.load(root).items.some((i) => i.id === 'Q-1'), 'old closed task left the desk');
  const month = new Date().toISOString().slice(0, 7);
  const lines = read(D(root, `archive/${month}.jsonl`)).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].id, 'Q-1');
  assert.equal(lines[0].history, undefined, 'summaries carry no history');
  assert.ok(lines[0].started && lines[0].closed);
  desk(root, 'add', 'Client', '--deps', 'Q-1');
  assert.equal(S.ready(root, S.load(root)).at(0).text, 'Client', 'archived done dep counts as done');
  assert.match(desk(root, 'log', '3'), /filler 13 — ok/);
  desk(root, 'restore', 'Q-1');
  assert.equal(S.find(S.load(root), 'Q-1').status, 'todo');
});

test('compact: folds the legacy archive.jsonl, retires stale memory and one-off lessons; restore brings them back', () => {
  const root = install();
  fs.writeFileSync(D(root, 'archive.jsonl'), JSON.stringify({ id: 'Q-90', status: 'done', at: '2026-10-03T10:00:00Z', item: { id: 'Q-90', kind: 'task', status: 'done', text: 'old one', history: [{ at: '2026-10-01T10:00:00Z', status: 'doing' }] } }) + '\n');
  S.mutate(root, 'seed', (d) => {
    const m = S.remember(d, 'old staging url').item;
    m.last = '2000-01-01';
    const l = S.lesson(d, 'a one-off mistake').item;
    l.last = '2000-01-01';
    S.remember(d, 'pinned build command', { pin: true }).item.last = '2000-01-01';
  });
  const state = { sessions: Array.from({ length: 40 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}`) };
  let moves;
  S.mutate(root, 'compact', (d) => (moves = S.compact(root, d, state)));
  assert.ok(moves.some((m) => /archive.jsonl → monthly files \(1\)/.test(m)));
  assert.ok(moves.some((m) => /retired M-1, L-1/.test(m)), moves.join(' | '));
  assert.ok(!fs.existsSync(D(root, 'archive.jsonl')));
  assert.equal(S.findArchived(root, 'Q-90').started, '2026-10-01T10:00:00Z');
  const d = S.load(root);
  assert.ok(S.find(d, 'M-2').pin, 'pinned memory stays');
  desk(root, 'restore', 'M-1');
  assert.equal(S.find(S.load(root), 'M-1').kind, 'memory');
});

test('metrics: throughput, cycle time, rework, quiet workers and health', () => {
  const root = install();
  S.mutate(root, 'seed', (d) => {
    const mk = (text, status, startMin, endMin, extra = {}) => {
      const t = S.addTask(d, { text }).item;
      Object.assign(t, extra, { status });
      t.history = [{ at: ago(startMin + 10), status: 'todo' }, { at: ago(startMin), status: 'doing' }, ...(extra.failedOnce ? [{ at: ago(startMin - 5), status: 'failed' }, { at: ago(startMin - 6), status: 'doing' }] : []), ...(endMin != null ? [{ at: ago(endMin), status }] : [])];
      delete t.failedOnce;
      return t;
    };
    mk('a', 'done', 120, 60, { executor: 'orca', agent: 'claude', model: 'm1' });
    mk('b', 'done', 300, 60, { executor: 'orca', agent: 'claude', model: 'm1', failedOnce: true });
    mk('c', 'doing', 90, null, { executor: 'orca', agent: 'omp', role: 'tester' });
  });
  const m = S.metrics(root, S.load(root));
  assert.equal(m.done7, 2);
  assert.equal(m.cycleHours, 2.5, 'median of 1 h and 4 h');
  assert.equal(m.rework, 0.5);
  assert.deepEqual(m.quiet.map((q) => q.id), ['Q-3']);
  assert.equal(m.health.level, 'red', 'a worker quiet for 90 min is red');
  assert.equal(m.models.find((x) => x.model === 'claude:m1').done, 2);
  assert.equal(m.perDay.length, 7);
});

test('dashboard: one offline file with team, plans, recent work and metrics embedded', () => {
  const root = install();
  desk(root, 'add', 'P1', 'Paywall', '--now', '--plan', 'paywall');
  desk(root, 'done', '--proof', 'ok');
  desk(root, 'add', 'P1', 'Widgets', '--now');
  const html = read(D(root, 'desk.html'));
  const start = html.indexOf('const D = ') + 'const D = '.length;
  const json = html.slice(start, html.indexOf(';\nconst $ ='));
  const data = JSON.parse(json);
  assert.equal(data.title, 'iOS');
  assert.equal(data.team.maxWorkers, 3);
  assert.equal(data.team.exclusive, 'simulator');
  assert.ok(data.metrics.health && data.metrics.perDay.length === 7);
  assert.equal(data.recent.at(-1).text, 'Paywall');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|https?:\/\/(?!github)/, 'no external resources');
});
