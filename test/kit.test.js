import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCtx, sync, uninstall, loadManifest } from '../src/lib/engine.js';
import { availableNghe, loadKit } from '../src/lib/bundle.js';
import { applyPatch, revertPatch } from '../src/lib/jsonmerge.js';
import { upsertBlock, removeBlock, extractBlock } from '../src/lib/markers.js';
import { parseArgs, pickFlags } from '../src/cli.js';
import { lintDesk, lintFile, parseItems, parseRules, listReview } from '../kit/method/hooks/_lib.mjs';
import { selfClean } from '../src/lib/selfclean.js';
const listReviewPending = (root) => listReview(root).filter((r) => !r.archived && r.status === 'pending').length;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, '__snapshots__');
const CLI = path.join(HERE, '../bin/cli.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk-'));
const read = (p) => fs.readFileSync(p, 'utf8');
const D = (root, f) => path.join(root, '.desk', f);
const item = (prio, id, text, { uses = 1, last = '2026-11-22', sub = [] } = {}) =>
  [`- ${prio} ${id} ${text} · +2026-11-01 · ×${uses} · @${last}`, ...sub.map((s) => `  - ${s}`)].join('\n');
const tree = (dir) =>
  execFileSync('find', ['.', '-type', 'f', '-not', '-path', './.git/*'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean).sort().join('\n') + '\n';

function snapshot(name, value) {
  const p = path.join(SNAP, `${name}.snap`);
  if (!fs.existsSync(p) || process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(SNAP, { recursive: true });
    fs.writeFileSync(p, value);
    return;
  }
  assert.equal(value, read(p), `snapshot ${name} changed — rerun with UPDATE_SNAPSHOTS=1 if intended`);
}

function install(nghe = 'ios', harnesses = ['claude'], { git = false } = {}) {
  const root = tmp();
  if (git) execFileSync('git', ['init', '-q'], { cwd: root });
  const ctx = makeCtx({ root, harnesses, nghe });
  sync(ctx);
  return { root, ctx };
}

const hook = (root, script, input) =>
  spawnSync(process.execPath, [path.join(root, '.agentkit/hooks', script)], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
const cli = (root, ...args) => spawnSync(process.execPath, [CLI, ...args, '--dir', root], { encoding: 'utf8', env: { ...process.env, CI: '1' } });

// ------------------------------------------------------------------ basics
test('markers keep user text around the kit block', () => {
  const user = '# Mine\nkeep me\n';
  const b = upsertBlock(upsertBlock(user, 'v1'), 'v2');
  assert.equal(extractBlock(b).inner, 'v2');
  assert.equal(removeBlock(b), user);
});

test('json patch apply/revert round-trips', () => {
  const orig = { permissions: { allow: ['x'] }, hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'mine' }] }] } };
  const patch = { hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'kit' }] }] }, permissions: { ask: ['a'] }, mcpServers: { f: { url: 'u' } } };
  const merged = applyPatch(orig, patch);
  assert.deepEqual(applyPatch(merged, patch), merged);
  assert.deepEqual(revertPatch(merged, patch), orig);
});

test('short flags: --ios / --designer / --claude; one profession per desk', () => {
  const o = parseArgs(['init', '--ios', '--cursor', '--claude'], ['ios', 'designer', 'claude', 'cursor', 'codex']);
  assert.deepEqual(pickFlags(o), { nghe: 'ios', harnesses: ['claude', 'cursor'] });
  assert.throws(() => pickFlags(parseArgs(['init', '--ios', '--designer'], ['ios', 'designer'])), /one profession/);
});

// ------------------------------------------------------------------ profession packs
for (const n of availableNghe()) {
  test(`pack ${n.name}: every rule has an ID, priority, Why and Check; skill within budget`, () => {
    const kit = loadKit(n.name);
    const { rules, bad, preamble } = parseRules(read(path.join(HERE, '../kit/nghe', n.name, 'rules.md')));
    assert.deepEqual(bad, []);
    assert.ok(preamble.includes('**Done**'), 'preamble defines Done');
    assert.ok(rules.length >= 3);
    const prefix = rules[0].id.split('-')[0];
    assert.equal(new Set(rules.map((r) => r.id)).size, rules.length, 'unique ids');
    for (const r of rules) {
      assert.match(r.kind, /^P[0-3]$/, r.id);
      assert.ok(r.id.startsWith(prefix + '-'), `${r.id} uses prefix ${prefix}`);
      assert.ok(r.why, `${r.id} has Why`);
      assert.ok(r.check, `${r.id} has Check`);
    }
    assert.ok(kit.skill.raw.split('\n').length < 220, 'desk skill stays under 220 lines');
  });
}

for (const h of ['claude', 'cursor', 'codex']) {
  test(`snapshot: ${h} output for --ios`, () => {
    const { root } = install('ios', [h]);
    snapshot(`${h}-files`, tree(root));
    snapshot(`${h}-AGENTS.md`, read(path.join(root, 'AGENTS.md')));
    if (h === 'claude') {
      snapshot('claude-CLAUDE.md', read(path.join(root, 'CLAUDE.md')));
      snapshot('claude-settings.json', read(path.join(root, '.claude/settings.json')));
    }
  });
}

// ------------------------------------------------------------------ install / remove
test('install keeps existing CLAUDE.md and settings; remove restores them exactly', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.claude'));
  const claudeMd = '# Project\nUse pnpm.\n';
  const settings = '{"permissions":{"allow":["Bash(pnpm test)"]}}'; // compact on purpose: must come back byte-for-byte
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), claudeMd);
  fs.writeFileSync(path.join(root, '.claude/settings.json'), settings);
  const ctx = makeCtx({ root, harnesses: ['claude'], nghe: 'designer' });
  sync(ctx);
  assert.match(read(path.join(root, 'CLAUDE.md')), /@AGENTS\.md[\s\S]*Use pnpm/);
  assert.ok(fs.existsSync(path.join(root, '.mcp.json')), 'designer adds Figma MCP');
  assert.deepEqual(sync(ctx).report.filter((r) => r.action !== 'ok'), [], 'second sync is a no-op');
  uninstall(ctx);
  assert.equal(read(path.join(root, 'CLAUDE.md')), claudeMd);
  assert.equal(read(path.join(root, '.claude/settings.json')), settings);
  assert.ok(!fs.existsSync(path.join(root, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(root, '.mcp.json')));
  assert.ok(fs.existsSync(D(root, 'now.md')), 'the desk is user data and stays');
});

// ------------------------------------------------------------------ desk lint
test('desk lint: fresh desk is valid', () => {
  const { root } = install();
  assert.deepEqual(lintDesk(root), []);
});

test('desk lint: format, capacity, order, uniqueness, unknown files', () => {
  const { root } = install();
  const L = (f, t) => lintFile(root, f, t);
  assert.deepEqual(L('now.md', `# Now\n${item('P1', 'Q-1', 'Login', { sub: ['done: tests pass'] })}\n`), []);
  assert.match(L('now.md', `${item('P1', 'Q-1', 'a', { sub: ['done: x'] })}\n${item('P1', 'Q-2', 'b', { sub: ['done: y'] })}`)[0], /exactly one/);
  assert.match(L('now.md', item('P1', 'Q-1', 'a'))[0], /done:/);
  assert.match(L('queue.md', [1, 2, 3, 4, 5, 6, 7, 8].map((i) => item('P2', `Q-${i}`, 't')).join('\n'))[0], /max 7/);
  assert.match(L('queue.md', `${item('P2', 'Q-1', 'a')}\n${item('P0', 'Q-2', 'b')}`)[0], /sorted P0→P3/);
  assert.match(L('queue.md', '- fix the login bug')[0], /not a desk item/);
  assert.match(L('queue.md', item('P1', 'M-1', 'x'))[0], /Q- prefix/);
  assert.match(L('memory.md', Array.from({ length: 11 }, (_, i) => item('P1', `M-${i}`, 'm')).join('\n') + '\n---\n')[0], /above the "---"/);
  assert.deepEqual(L('memory.md', Array.from({ length: 11 }, (_, i) => item('P1', `M-${i}`, 'm')).join('\n').replace(/(\n[^\n]*){1}$/, '\n---$&')), []);
  assert.match(L('goal.md', '# Goal\n1\n2\n3\n4\n5\n6\n')[0], /max 5/);
  fs.writeFileSync(D(root, 'queue.md'), item('P1', 'Q-1', 'a'));
  fs.writeFileSync(D(root, 'now.md'), item('P1', 'Q-1', 'a', { sub: ['done: x'] }));
  fs.writeFileSync(D(root, 'notes.txt'), 'stray');
  const errs = lintDesk(root);
  assert.ok(errs.some((e) => /Q-1 is in both/.test(e)));
  assert.ok(errs.some((e) => /notes\.txt is not a desk zone/.test(e)));
});

// ------------------------------------------------------------------ hooks
test('guard: only valid writes to desk zones; kit files and block are protected', () => {
  const { root } = install();
  const w = (file_path, content) => hook(root, 'guard.mjs', { tool_name: 'Write', tool_input: { file_path, content } });
  const e = (file_path, old_string, new_string) => hook(root, 'guard.mjs', { tool_name: 'Edit', tool_input: { file_path, old_string, new_string } });

  assert.equal(w('.desk/now.md', `# Now\n${item('P1', 'Q-1', 'Login', { sub: ['done: tests'] })}\n`).status, 0);
  const two = w('.desk/now.md', `${item('P1', 'Q-1', 'a', { sub: ['done: x'] })}\n${item('P1', 'Q-2', 'b', { sub: ['done: y'] })}`);
  assert.equal(two.status, 2);
  assert.match(two.stderr, /exactly one task/);
  assert.equal(w('.desk/todo.md', 'x').status, 2, 'no files outside zones');
  assert.equal(w('.desk/.state.json', '{}').status, 2);
  assert.equal(w('.desk/review/P-001-lint.md', '# P-001: x\n- Status: pending\n').status, 0);
  assert.equal(w('.desk/archive/2026-11.md', 'anything').status, 0);

  assert.equal(w('.claude/skills/desk/SKILL.md', 'x').status, 2);
  assert.equal(e('AGENTS.md', '# Desk', '# Hacked').status, 2);
  assert.equal(e('AGENTS.md', '- Build: `TODO`', '- Build: `make`').status, 0);
  assert.equal(e('.claude/settings.json', '{', '{ ').status, 2);
  assert.equal(e('src/App.swift', 'a', 'b').status, 0);
});

test('guard: project rules need an approved proposal', () => {
  const { root } = install();
  const local = D(root, 'rules.local.md');
  const add = (rule) => hook(root, 'guard.mjs', { tool_name: 'Write', tool_input: { file_path: local, content: read(local) + '\n' + rule } });
  const rule = '### IOS-001 · override\nUse `make test`.\n- Why: P-001\n';
  const r = add(rule);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cites no approved proposal/);
  fs.writeFileSync(D(root, 'review/P-001-make.md'), '# P-001: use make\n- Status: pending\n');
  assert.equal(add(rule).status, 2, 'pending is not enough');
  fs.writeFileSync(D(root, 'review/P-001-make.md'), '# P-001: use make\n- Status: approved\n');
  assert.equal(add(rule).status, 0);
});

test('session-start: counts sessions, auto-sorts the desk and shows the surface', () => {
  const { root } = install();
  fs.writeFileSync(D(root, 'goal.md'), '# Goal\nShip v1 of the habit tracker to TestFlight.\n');
  fs.writeFileSync(D(root, 'now.md'), item('P1', 'Q-3', 'Login screen', { sub: ['done: tests pass', 'next: wire API'] }));
  // out of order + one stale P2 + one stale P3
  fs.writeFileSync(D(root, 'queue.md'), ['# Queue', item('P2', 'Q-5', 'Old idea', { last: '2026-01-01' }), item('P0', 'Q-4', 'Fix crash'), item('P3', 'Q-6', 'Ancient', { last: '2026-01-01' })].join('\n'));
  fs.writeFileSync(D(root, 'memory.md'), `# Memory\n${item('P1', 'M-1', 'Scheme App, iPhone 16')}\n${item('P2', 'M-9', 'Old fact', { last: '2026-01-01' })}\n---\n${item('P2', 'M-2', 'Uses SwiftData', { uses: 4 })}\n`);
  fs.writeFileSync(D(root, 'notebook.md'), item('P2', 'L-1', 'Pass -destination', { uses: 2 }));
  fs.writeFileSync(D(root, 'review/P-002-x.md'), '# P-002: Add lint\n- Status: approved\n');
  fs.writeFileSync(D(root, '.state.json'), JSON.stringify({ session: 6, sessions: ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'] }));
  const out = hook(root, 'session-start.mjs', { source: 'startup' }).stdout;
  assert.match(out, /session 7/);
  assert.match(out, /Goal: Ship v1/);
  assert.match(out, /Now: P1 Q-3 Login screen\n {2}done: tests pass\n {2}next: wire API/);
  assert.match(out, /Auto-sorted: .*Q-5 P2→P3.*Q-6 → archive.*M-9 ↓ memory.*M-2 ↑ memory/);
  const q = parseItems(read(D(root, 'queue.md'))).items;
  assert.deepEqual(q.map((i) => `${i.prio} ${i.id}`), ['P0 Q-4', 'P3 Q-5']);
  assert.match(read(D(root, 'queue.md')), /^# Queue/, 'header kept');
  assert.match(read(D(root, `archive/${new Date().toISOString().slice(0, 7)}.md`)), /from queue\] P3 Q-6 Ancient/);
  const mem = parseItems(read(D(root, 'memory.md')));
  assert.deepEqual(mem.items.slice(0, mem.divider).map((i) => i.id), ['M-1', 'M-2']);
  assert.match(out, /Approved proposals — apply first: P-002/);
  assert.match(out, /draft proposals.*L-1/);
  assert.deepEqual(lintDesk(root), []);
  assert.match(hook(root, 'session-start.mjs', { source: 'compact' }).stdout, /session 7/, 'compact does not count');
});

test('session-start on an empty desk tells the agent to infer, not to ask', () => {
  const { root } = install();
  const out = hook(root, 'session-start.mjs', { source: 'startup' }).stdout;
  assert.match(out, /Goal: not set → infer it/);
  assert.match(out, /user's next request becomes the task/);
  assert.doesNotMatch(out, /with the user/);
});

test('capture: reads the user message, bumps what it mentions, journals it, hints where to file', () => {
  const { root } = install();
  fs.writeFileSync(D(root, 'now.md'), item('P1', 'Q-3', 'Login screen validation', { sub: ['done: tests pass'] }));
  fs.writeFileSync(D(root, 'memory.md'), `# Memory\n${item('P1', 'M-1', 'Build scheme HabitApp on iPhone 16 simulator', { last: '2026-11-01' })}\n---\n`);
  const today = new Date().toISOString().slice(0, 10);

  let out = hook(root, 'capture.mjs', { prompt: 'Sai rồi, đừng dùng simulator iPhone 15, scheme HabitApp phải chạy iPhone 16' }).stdout;
  assert.match(out, /correction/);
  assert.match(out, /Related desk items: M-1/);
  const m1 = parseItems(read(D(root, 'memory.md'))).items[0];
  assert.equal(m1.uses, 2);
  assert.equal(m1.last, today);

  out = hook(root, 'capture.mjs', { prompt: 'Cái này gấp lắm, crash khi mở app' }).stdout;
  assert.match(out, /Urgent\. If this is not Q-3, put it at the top of queue\.md/);
  out = hook(root, 'capture.mjs', { prompt: 'From now on always run swiftformat before commit' }).stdout;
  assert.match(out, /memory\.md|proposal/);
  fs.writeFileSync(D(root, 'review/P-001-fmt.md'), '# P-001: swiftformat rule\n- Status: pending\n');
  assert.match(hook(root, 'capture.mjs', { prompt: 'ok làm đi' }).stdout, /If this approves P-001/);
  assert.equal(hook(root, 'capture.mjs', { prompt: 'thêm nút đăng xuất vào màn hình settings' }).stdout, '', 'plain request: silent');
  assert.equal(hook(root, 'capture.mjs', { prompt: '/clear' }).stdout, '');

  const lines = read(D(root, '.journal.jsonl')).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 5);
  assert.deepEqual(lines[0].signals, ['correction']);
  assert.match(read(D(root, '.gitignore')), /\.journal\.jsonl/);
});

test('editing a file bumps desk items that reference it', () => {
  const { root } = install();
  fs.writeFileSync(D(root, 'memory.md'), `# Memory\n${item('P1', 'M-1', 'Auth lives in one service', { last: '2026-11-01', sub: ['ref: Sources/Auth/AuthService.swift'] })}\n---\n`);
  assert.equal(hook(root, 'guard.mjs', { tool_name: 'Edit', tool_input: { file_path: 'Sources/Auth/AuthService.swift', old_string: 'a', new_string: 'b' } }).status, 0);
  assert.equal(parseItems(read(D(root, 'memory.md'))).items[0].uses, 2);
});

test('stop-check: inbox must be empty; desk must follow code changes', () => {
  const { root } = install('ios', ['claude'], { git: true });
  assert.equal(hook(root, 'stop-check.mjs', {}).stdout, '');
  fs.appendFileSync(D(root, 'inbox.md'), 'dark mode?\n');
  assert.match(JSON.parse(hook(root, 'stop-check.mjs', {}).stdout).reason, /inbox\.md has 1/);
  assert.equal(hook(root, 'stop-check.mjs', { stop_hook_active: true }).stdout, '', 'reminds only once');
  fs.writeFileSync(D(root, 'inbox.md'), '# Inbox\n');
  const old = new Date(Date.now() - 60_000);
  for (const f of ['now.md', 'queue.md', 'memory.md', 'notebook.md']) fs.utimesSync(D(root, f), old, old);
  fs.writeFileSync(path.join(root, 'App.swift'), 'x');
  assert.match(JSON.parse(hook(root, 'stop-check.mjs', {}).stdout).reason, /desk was not updated/);
  fs.appendFileSync(D(root, 'now.md'), '\n');
  assert.equal(hook(root, 'stop-check.mjs', {}).stdout, '');
  hook(root, 'capture.mjs', { prompt: 'sai rồi, không phải file đó' });
  fs.utimesSync(D(root, 'notebook.md'), old, old);
  assert.match(JSON.parse(hook(root, 'stop-check.mjs', {}).stdout).reason, /corrected you 1×/);
  fs.appendFileSync(D(root, 'notebook.md'), '\n');
  assert.equal(hook(root, 'stop-check.mjs', {}).stdout, '');
});

// ------------------------------------------------------------------ rule-by-rule update
test('update compares rules by ID; overridden rules are kept automatically and noted', () => {
  const { root, ctx } = install('ios', ['claude'], { git: true });
  fs.writeFileSync(D(root, 'rules.local.md'), '# Project rules\n\n### IOS-001 · override\nUse `make test`.\n- Why: P-001\n\n### IOS-099 · off\n- Why: P-002\n\n### LOCAL-001 · P2\nSnapshots in Tests/Snap.\n- Why: P-003\n');
  const m = loadManifest(ctx);
  m.nghe.version = '0.9.0';
  m.nghe.rules['IOS-001'] = { ...m.nghe.rules['IOS-001'], hash: 'old', body: 'old text' };
  m.nghe.rules['IOS-002'] = { ...m.nghe.rules['IOS-002'], hash: 'old' };
  m.nghe.rules['IOS-099'] = { hash: 'x', kind: 'P2', body: 'Use CocoaPods.' };
  delete m.nghe.rules['IOS-007'];
  fs.writeFileSync(path.join(root, '.agentkit.json'), JSON.stringify(m));

  const res = sync(ctx);
  const by = Object.fromEntries(res.rules.map((r) => [r.id, r]));
  assert.equal(by['IOS-007'].change, 'added');
  assert.equal(by['IOS-002'].action, 'applied');
  assert.match(by['IOS-001'].action, /project rule override kept/);
  assert.equal(by['IOS-099'].change, 'removed');
  assert.deepEqual(res.orphans, ['IOS-099']);
  const note = read(D(root, 'archive/U-IOS-001-v1.0.0.md'));
  assert.match(note, /- Status: applied[\s\S]*old text[\s\S]*Use `make test`/);
  assert.match(read(D(root, 'inbox.md')), /IOS-001; project rule kept/, 'agent mentions it once');
  assert.equal(listReviewPending(root), 0, 'nothing waits on the user');
  assert.equal(sync(ctx).rules.length, 0, 'second update: no changes, no duplicate notes');

  // the user can still prefer the kit rule
  assert.equal(cli(root, 'review', '--drop', 'U-IOS-001-v1.0.0').status, 0);
  assert.doesNotMatch(read(D(root, 'rules.local.md')), /IOS-001/);
  assert.match(read(D(root, 'rules.local.md')), /LOCAL-001/);
});

test('switch changes the profession and keeps the desk', () => {
  const { root } = install('ios');
  fs.writeFileSync(D(root, 'goal.md'), '# Goal\nRedesign onboarding.\n');
  const r = cli(root, 'switch', '--designer');
  assert.equal(r.status, 0, r.stderr);
  assert.match(read(path.join(root, '.claude/skills/desk/SKILL.md')), /DES-001/);
  assert.doesNotMatch(read(path.join(root, '.claude/skills/desk/SKILL.md')), /IOS-001/);
  assert.match(read(D(root, 'goal.md')), /Redesign onboarding/);
  assert.equal(JSON.parse(read(path.join(root, '.agentkit.json'))).nghe.name, 'designer');
});

test('CLI end to end: init --ios, desk, doctor, review, remove', () => {
  const root = tmp();
  execFileSync('git', ['init', '-q'], { cwd: root });
  assert.match(cli(root, 'init', '-y').stderr, /Choose a profession/);
  assert.equal(cli(root, 'init', '--ios', '-y').status, 0);
  assert.equal(cli(root, 'desk').status, 0);
  const doc = cli(root, 'doctor');
  assert.equal(doc.status, 0, doc.stdout);
  fs.copyFileSync(D(root, 'review/_TEMPLATE.md'), D(root, 'review/P-001-a.md'));
  assert.equal(cli(root, 'review', '--approve', 'P-001').status, 0);
  assert.match(read(D(root, 'review/P-001-a.md')), /- Status: approved/);
  assert.equal(cli(root, 'remove', '-y').status, 0);
  assert.ok(!fs.existsSync(path.join(root, '.agentkit.json')));
  assert.ok(!fs.existsSync(path.join(root, '.claude')), 'nothing of the kit left in .claude/');
  assert.ok(!fs.existsSync(path.join(root, '.agentkit')), 'shared hooks removed');
  assert.ok(fs.existsSync(D(root, 'goal.md')));
});

test('item parser reads sub-fields', () => {
  const { items } = parseItems(item('P1', 'Q-1', 'Login', { sub: ['done: tests pass', 'next: API'] }));
  assert.equal(items[0].uses, 1);
  assert.deepEqual(items[0].sub, ['done: tests pass', 'next: API']);
});

test('npm package ships every file the kit needs (npm silently drops some, e.g. .gitignore)', () => {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: path.join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const packed = new Set(JSON.parse(out)[0].files.map((f) => f.path));
  const need = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', 'kit', 'src', 'bin'], { cwd: path.join(HERE, '..'), encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const missing = need.filter((f) => !packed.has(f));
  assert.deepEqual(missing, []);
  assert.ok(packed.has('kit/method/desk/gitignore'));
});

test('self-clean: removes only its own npx folder, and only when run from the npx cache', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ak-clean-'));
  const pkg = path.join(tmp, '.npm', '_npx', 'abc123', 'node_modules', 'agent-work-kit');
  const other = path.join(tmp, '.npm', '_npx', 'other99');
  fs.mkdirSync(pkg, { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  const env = { PATH: '' }; // no npm on PATH: the cache-key step is skipped, the folder step still runs
  assert.deepEqual(selfClean({ root: path.join(tmp, 'clone'), env }), []); // a git clone is never touched
  assert.deepEqual(selfClean({ root: pkg, env: { ...env, AGENTKIT_KEEP_CACHE: '1' } }), []);
  assert.ok(fs.existsSync(pkg));
  selfClean({ root: pkg, env });
  assert.ok(!fs.existsSync(path.join(tmp, '.npm', '_npx', 'abc123')));
  assert.ok(fs.existsSync(other), 'other npx entries stay');
  fs.rmSync(tmp, { recursive: true, force: true });
});
