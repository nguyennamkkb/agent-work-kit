import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { makeCtx, sync, uninstall } from '../src/lib/engine.js';
import { parseApplyPatch, normalizeWrites } from '../kit/method/hooks/_lib.mjs';
import * as Store from '../kit/method/hooks/store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, '__snapshots__');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk-h-'));
const read = (p) => fs.readFileSync(p, 'utf8');
const D = (root, f) => path.join(root, '.desk', f);
const today = new Date().toISOString().slice(0, 10);
const tree = (dir) => execFileSync('find', ['.', '-type', 'f'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean).sort().join('\n') + '\n';

function snapshot(name, value) {
  const p = path.join(SNAP, `${name}.snap`);
  if (!fs.existsSync(p) || process.env.UPDATE_SNAPSHOTS) {
    fs.mkdirSync(SNAP, { recursive: true });
    fs.writeFileSync(p, value);
    return;
  }
  assert.equal(value, read(p), `snapshot ${name} changed — rerun with UPDATE_SNAPSHOTS=1 if intended`);
}
function install(harnesses, { git = false } = {}) {
  const root = tmp();
  if (git) execFileSync('git', ['init', '-q'], { cwd: root });
  sync(makeCtx({ root, harnesses, profession: 'ios' }));
  return root;
}
const guard = (root, tool_name, tool_input) =>
  spawnSync(process.execPath, [path.join(root, '.agentkit/hooks/guard.mjs')], { input: JSON.stringify({ cwd: root, tool_name, tool_input }), encoding: 'utf8' });
const load = async (file) => (await import(pathToFileURL(file).href + `?t=${Math.random()}`)).default;
const patch = (body) => `*** Begin Patch\n${body}\n*** End Patch\n`;

// ------------------------------------------------------------------ write normalization
test('apply_patch parser: add, update, delete, move', () => {
  const ops = parseApplyPatch(patch('*** Add File: a.txt\n+hello\n*** Update File: b.txt\n*** Move to: c.txt\n@@\n-old\n+new\n*** Delete File: d.txt'));
  assert.deepEqual(ops.map((o) => [o.op, o.path, o.moveTo]), [['add', 'a.txt', null], ['update', 'b.txt', 'c.txt'], ['delete', 'd.txt', null]]);
  assert.deepEqual(ops[0].add, ['hello']);
});

test('normalizeWrites understands Claude, Codex, Pi and OpenCode tool shapes', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'f.txt'), 'one two three\n');
  const exp = [{ path: path.join(root, 'f.txt'), next: 'one 2 three\n' }];
  assert.deepEqual(normalizeWrites(root, 'Edit', { file_path: 'f.txt', old_string: 'two', new_string: '2' }), exp);
  assert.deepEqual(normalizeWrites(root, 'edit', { path: 'f.txt', edits: [{ oldText: 'two', newText: '2' }] }), exp, 'Pi');
  assert.deepEqual(normalizeWrites(root, 'edit', { filePath: path.join(root, 'f.txt'), oldString: 'two', newString: '2' }), exp, 'OpenCode');
  assert.deepEqual(normalizeWrites(root, 'apply_patch', { command: patch('*** Update File: f.txt\n@@\n-one two three\n+one 2 three') }), exp, 'Codex');
  assert.deepEqual(normalizeWrites(root, 'write', { path: 'g.txt', content: 'x' }), [{ path: path.join(root, 'g.txt'), next: 'x' }]);
  assert.deepEqual(normalizeWrites(root, 'edit', { path: 'f.txt', anchor: 'L1#ab', text: 'z' }), [{ path: path.join(root, 'f.txt'), next: null }], 'unknown edit format → path-only');
  assert.deepEqual(normalizeWrites(root, 'bash', { command: 'ls' }), []);
});

test('guard blocks Codex apply_patch writes to the desk data and kit files', () => {
  const root = install(['codex']);
  const ap = (body) => guard(root, 'apply_patch', { command: patch(body) });
  const r1 = ap('*** Add File: .desk/todo.md\n+x');
  assert.equal(r1.status, 2);
  assert.match(r1.stderr, /desk command/);
  assert.equal(ap('*** Update File: .desk/desk.json\n@@\n-  "goal": [],\n+  "goal": ["x"],').status, 2, 'desk.json only through the command');
  assert.equal(ap('*** Add File: .desk/plans/20261122-login.md\n+# Plan').status, 0, 'plans are documents');
  assert.equal(ap('*** Update File: .desk/rules.local.md\n@@\n # Project rules\n+### LOCAL-001 · P1\n+Always X.').status, 2, 'new rule needs an approved proposal');
  const r = ap('*** Update File: AGENTS.md\n@@\n-# Desk — iOS (agent-work-kit)\n+# Hacked');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /agentkit block/);
  assert.equal(ap('*** Add File: src/App.swift\n+import SwiftUI').status, 0);
});

// ------------------------------------------------------------------ Codex
test('codex: .codex/hooks.json runs the shared hooks from any subdirectory', () => {
  const root = install(['codex'], { git: true });
  const cfg = JSON.parse(read(path.join(root, '.codex/hooks.json')));
  assert.deepEqual(Object.keys(cfg.hooks).sort(), ['PostToolUse', 'PreToolUse', 'SessionStart', 'Stop', 'UserPromptSubmit']);
  assert.equal(cfg.hooks.PreToolUse[0].matcher, 'apply_patch|Edit|Write');
  const sub = path.join(root, 'Sources/App');
  fs.mkdirSync(sub, { recursive: true });
  const run = (event, input) => spawnSync('sh', ['-c', cfg.hooks[event][0].hooks[0].command], { cwd: sub, input: JSON.stringify(input), encoding: 'utf8' });
  assert.match(run('SessionStart', { source: 'startup', cwd: sub }).stdout, /\[desk\] iOS desk · session 1/);
  assert.equal(run('PreToolUse', { cwd: sub, tool_name: 'apply_patch', tool_input: { command: patch('*** Add File: ../../.desk/x.md\n+x') } }).status, 2);
  assert.match(JSON.parse(run('UserPromptSubmit', { cwd: sub, prompt: 'sai rồi, làm lại' }).stdout).hookSpecificOutput.additionalContext, /Correction → L-1/);
  assert.equal(Store.lessons(Store.load(root)).length, 1, 'the correction became a lesson by itself');
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/desk/SKILL.md')));
});

// ------------------------------------------------------------------ Pi / Oh My Pi
function fakePi({ omp = false } = {}) {
  const handlers = {};
  const sent = [];
  const api = { on: (ev, fn) => ((handlers[ev] ??= []).push(fn)), sendMessage: (m, o) => sent.push([m, o]) };
  if (omp) Object.assign(api, { runtime: {}, extension: {} });
  const emit = async (ev, e, ctx = {}) => {
    let r;
    for (const fn of handlers[ev] ?? []) r = (await fn(e, ctx)) ?? r;
    return r;
  };
  return { api, handlers, sent, emit };
}

for (const host of ['pi', 'omp']) {
  test(`${host}: extension shows the desk, reads prompts, blocks bad writes, reminds before settling`, async () => {
    const root = install([host], { git: true });
    const ext = await load(path.join(root, `.${host}/extensions/agentkit-desk.js`));
    const f = fakePi({ omp: host === 'omp' });
    ext(f.api);
    assert.ok(f.handlers.tool_call && f.handlers.before_agent_start && f.handlers.session_start);
    assert.equal(Boolean(f.handlers.agent_before_settle), host === 'pi');
    assert.equal(Boolean(f.handlers.agent_end), host === 'omp');

    await f.emit('session_start', { reason: 'startup' }, { cwd: path.join(root) });
    const first = await f.emit('before_agent_start', { messageType: 'user', prompt: 'gấp lắm: app crash khi mở' });
    assert.match(first.message.content, /\[desk\] iOS desk · session 1/);
    assert.match(first.message.content, /Urgent/);
    assert.equal(first.message.display, false);
    Store.mutate(root, 'add', (d) => Store.addTask(d, { text: 'Logout button', done: 'tests', now: true }));
    assert.equal(await f.emit('before_agent_start', { messageType: 'user', prompt: 'thêm nút đăng xuất' }), undefined, 'quiet when nothing to say');

    const bad = await f.emit('tool_call', { toolName: 'write', input: { path: '.desk/todo.md', content: 'x' } });
    assert.equal(bad.block, true);
    assert.match(bad.reason, /desk command/);
    assert.equal((await f.emit('tool_call', { toolName: 'edit', input: { path: '.desk/desk.json', edits: [{ oldText: 'Logout', newText: 'Login' }] } })).block, true);
    assert.equal(await f.emit('tool_call', { toolName: 'write', input: { path: '.desk/plans/x.md', content: '# Plan' } }), undefined);
    assert.equal(await f.emit('tool_call', { toolName: 'bash', input: { command: 'ls' } }), undefined);

    fs.writeFileSync(D(root, 'rules.local.md'), '# Project rules\n### bad heading\n'); // e.g. written by a tool the guard could not simulate
    const res = await f.emit('tool_result', { toolName: 'edit', input: { path: '.desk/rules.local.md' }, content: [{ type: 'text', text: 'ok' }] });
    assert.match(res.content.at(-1).text, /Fix before continuing/);
    fs.writeFileSync(D(root, 'rules.local.md'), '# Project rules\n');

    Store.mutate(root, 'inbox', (d) => Store.addInbox(d, 'dark mode later'));
    if (host === 'pi') {
      const s1 = await f.emit('agent_before_settle', { entries: [] });
      assert.equal(s1.continue, true);
      assert.match(s1.entries[0].content, /inbox holds 1/);
      assert.equal(await f.emit('agent_before_settle', { entries: [] }), undefined, 'reminds once per run');
    } else {
      await f.emit('agent_end', {});
      await f.emit('agent_end', {});
      assert.equal(f.sent.length, 1);
      assert.match(f.sent[0][0].content, /inbox holds 1/);
      assert.deepEqual(f.sent[0][1], { deliverAs: 'followUp', triggerTurn: true });
    }
  });
}

// ------------------------------------------------------------------ OpenCode
function fakeOpenCode(root, { putFails = false } = {}) {
  const hooks = { session: {}, tool: {} };
  const calls = { put: [], synthetic: [] };
  const ctx = {
    location: { directory: root },
    session: {
      hook: async (name, fn) => (hooks.session[name] = fn),
      synthetic: async (x) => calls.synthetic.push(x),
      instructions: { entry: { put: async (x) => { if (putFails) throw new Error('unsupported'); calls.put.push(x); } } },
    },
    tool: { hook: async (name, fn) => (hooks.tool[name] = fn) },
  };
  return { ctx, hooks, calls };
}

test('opencode: plugin injects the desk as an instruction entry, blocks bad writes, reminds on idle', async () => {
  const root = install(['opencode'], { git: true });
  const plugin = await load(path.join(root, '.opencode/plugins/agentkit-desk/index.js'));
  assert.equal(plugin.id, 'agentkit-desk');
  const f = fakeOpenCode(root);
  await plugin.setup(f.ctx);
  assert.ok(f.hooks.session.prompt && f.hooks.tool['execute.before'] && f.hooks.tool['execute.after'] && f.hooks.session['experimental.idle']);

  const e = { sessionID: 's1', prompt: { text: 'sai rồi, không phải file đó' } };
  await f.hooks.session.prompt(e);
  assert.equal(f.calls.put[0].key, 'agentkit-desk');
  assert.match(f.calls.put[0].value, /iOS desk · session 1[\s\S]*Correction/);
  assert.equal(e.prompt.text, 'sai rồi, không phải file đó', 'user text untouched');

  assert.throws(() => f.hooks.tool['execute.before']({ tool: 'write', input: { filePath: path.join(root, '.desk/todo.md'), content: 'x' } }), /desk command/);
  assert.equal(f.hooks.tool['execute.before']({ tool: 'edit', input: { filePath: path.join(root, 'App.swift'), oldString: 'a', newString: 'b' } }), undefined);

  Store.mutate(root, 'inbox', (d) => Store.addInbox(d, 'later'));
  await f.hooks.session['experimental.idle']({ sessionID: 's1' });
  await f.hooks.session['experimental.idle']({ sessionID: 's1' });
  assert.equal(f.calls.synthetic.length, 1);
  assert.match(f.calls.synthetic[0].text, /inbox holds 1/);
});

test('opencode: falls back to carrying the desk in the prompt when instruction entries are unavailable', async () => {
  const root = install(['opencode']);
  const plugin = await load(path.join(root, '.opencode/plugins/agentkit-desk/index.js'));
  const f = fakeOpenCode(root, { putFails: true });
  await plugin.setup(f.ctx);
  const e = { sessionID: 's1', prompt: { text: 'hello' } };
  await f.hooks.session.prompt(e);
  assert.match(e.prompt.text, /^hello\n\n<agentkit-desk>\n\[desk\] iOS desk/);
});

// ------------------------------------------------------------------ install / remove all harnesses
test('all harnesses together: shared files written once, everything removed cleanly', () => {
  const root = install(['claude', 'codex', 'opencode', 'pi', 'omp', 'cursor']);
  snapshot('all-files', tree(root));
  snapshot('all-AGENTS.md', read(path.join(root, 'AGENTS.md')));
  for (const h of ['pi', 'omp']) snapshot(`${h}-extension.js`, read(path.join(root, `.${h}/extensions/agentkit-desk.js`)));
  assert.match(read(path.join(root, 'AGENTS.md')), /the kit enforces them on Claude Code, Codex, OpenCode, Pi, Oh My Pi/);
  uninstall(makeCtx({ root }));
  const left = tree(root).split('\n').filter((f) => f && !f.startsWith('./.desk/'));
  assert.deepEqual(left, []);
});

test('generated host files import only node: built-ins', () => {
  const root = install(['pi', 'opencode']);
  for (const f of ['.pi/extensions/agentkit-desk.js', '.opencode/plugins/agentkit-desk/index.js']) {
    const imports = [...read(path.join(root, f)).matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    assert.ok(imports.length && imports.every((i) => i.startsWith('node:')), `${f}: ${imports}`);
  }
});
