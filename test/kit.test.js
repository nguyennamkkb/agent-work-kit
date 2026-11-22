import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeCtx, sync, uninstall, loadManifest } from '../src/lib/engine.js';
import { availableProfessions, loadKit } from '../src/lib/bundle.js';
import { applyPatch, revertPatch } from '../src/lib/jsonmerge.js';
import { upsertBlock, removeBlock, extractBlock } from '../src/lib/markers.js';
import { parseArgs, pickFlags } from '../src/cli.js';
import { parseRules, listReview } from '../kit/method/hooks/_lib.mjs';
import * as Store from '../kit/method/hooks/store.mjs';
import { selfClean, cleanCacache } from '../src/lib/selfclean.js';
const listReviewPending = (root) => listReview(root).filter((r) => !r.archived && r.status === 'pending').length;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAP = path.join(HERE, '__snapshots__');
const CLI = path.join(HERE, '../bin/cli.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'desk-'));
const read = (p) => fs.readFileSync(p, 'utf8');
const D = (root, f) => path.join(root, '.desk', f);
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

function install(profession = 'ios', harnesses = ['claude'], { git = false } = {}) {
  const root = tmp();
  if (git) execFileSync('git', ['init', '-q'], { cwd: root });
  const ctx = makeCtx({ root, harnesses, profession });
  sync(ctx);
  return { root, ctx };
}

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
  assert.deepEqual(pickFlags(o), { profession: 'ios', harnesses: ['claude', 'cursor'] });
  assert.throws(() => pickFlags(parseArgs(['init', '--ios', '--designer'], ['ios', 'designer'])), /one profession/);
});

// ------------------------------------------------------------------ profession packs
for (const n of availableProfessions()) {
  test(`pack ${n.name}: every rule has an ID, priority, Why and Check; skill within budget`, () => {
    const kit = loadKit(n.name);
    const { rules, bad, preamble } = parseRules(read(path.join(HERE, '../kit/profession', n.name, 'rules.md')));
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
  const ctx = makeCtx({ root, harnesses: ['claude'], profession: 'designer' });
  sync(ctx);
  assert.match(read(path.join(root, 'CLAUDE.md')), /@AGENTS\.md[\s\S]*Use pnpm/);
  assert.ok(fs.existsSync(path.join(root, '.mcp.json')), 'designer adds Figma MCP');
  assert.deepEqual(sync(ctx).report.filter((r) => r.action !== 'ok'), [], 'second sync is a no-op');
  uninstall(ctx);
  assert.equal(read(path.join(root, 'CLAUDE.md')), claudeMd);
  assert.equal(read(path.join(root, '.claude/settings.json')), settings);
  assert.ok(!fs.existsSync(path.join(root, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(root, '.mcp.json')));
  assert.ok(fs.existsSync(D(root, 'desk.json')), 'the desk is user data and stays');
});

test('update compares rules by ID; overridden rules are kept automatically and noted', () => {
  const { root, ctx } = install('ios', ['claude'], { git: true });
  fs.writeFileSync(D(root, 'rules.local.md'), '# Project rules\n\n### IOS-001 · override\nUse `make test`.\n- Why: P-001\n\n### IOS-099 · off\n- Why: P-002\n\n### LOCAL-001 · P2\nSnapshots in Tests/Snap.\n- Why: P-003\n');
  const m = loadManifest(ctx);
  m.profession.version = '0.9.0';
  m.profession.rules['IOS-001'] = { ...m.profession.rules['IOS-001'], hash: 'old', body: 'old text' };
  m.profession.rules['IOS-002'] = { ...m.profession.rules['IOS-002'], hash: 'old' };
  m.profession.rules['IOS-099'] = { hash: 'x', kind: 'P2', body: 'Use CocoaPods.' };
  delete m.profession.rules['IOS-007'];
  fs.writeFileSync(path.join(root, '.agentkit.json'), JSON.stringify(m));

  const res = sync(ctx);
  const by = Object.fromEntries(res.rules.map((r) => [r.id, r]));
  assert.equal(by['IOS-007'].change, 'added');
  assert.equal(by['IOS-002'].action, 'applied');
  assert.match(by['IOS-001'].action, /project rule override kept/);
  assert.equal(by['IOS-099'].change, 'removed');
  assert.deepEqual(res.orphans, ['IOS-099']);
  const ver = loadKit('ios').profession.version;
  const note = read(D(root, `archive/U-IOS-001-v${ver}.md`));
  assert.match(note, /- Status: applied[\s\S]*old text[\s\S]*Use `make test`/);
  assert.ok(Store.tasks(Store.load(root), 'inbox').some((t) => /IOS-001; project rule kept/.test(t.text)), 'agent mentions it once');
  assert.equal(listReviewPending(root), 0, 'nothing waits on the user');
  assert.equal(sync(ctx).rules.length, 0, 'second update: no changes, no duplicate notes');

  // the user can still prefer the kit rule
  assert.equal(cli(root, 'review', '--drop', `U-IOS-001-v${ver}`).status, 0);
  assert.doesNotMatch(read(D(root, 'rules.local.md')), /IOS-001/);
  assert.match(read(D(root, 'rules.local.md')), /LOCAL-001/);
});

test('switch changes the profession and keeps the desk', () => {
  const { root } = install('ios');
  Store.mutate(root, 'goal', (d) => Store.setGoal(d, ['Redesign onboarding.']));
  const r = cli(root, 'switch', '--designer');
  assert.equal(r.status, 0, r.stderr);
  assert.match(read(path.join(root, '.claude/skills/desk/SKILL.md')), /DES-001/);
  assert.doesNotMatch(read(path.join(root, '.claude/skills/desk/SKILL.md')), /IOS-001/);
  assert.deepEqual(Store.load(root).goal, ['Redesign onboarding.']);
  assert.equal(JSON.parse(read(path.join(root, '.agentkit.json'))).profession.name, 'designer');
});

test('CLI end to end: init --ios, desk, doctor, review, remove', () => {
  const root = tmp();
  execFileSync('git', ['init', '-q'], { cwd: root });
  assert.match(cli(root, 'init', '-y').stderr, /Choose a profession/);
  assert.equal(cli(root, 'init', '--ios', '-y').status, 0);
  assert.equal(cli(root, 'desk').status, 0);
  const doc = cli(root, 'doctor');
  assert.equal(doc.status, 0, doc.stdout);
  const p = cli(root, 'desk', 'propose', 'Run lint before commit', '--change', 'add make lint to the done check', '--why', 'lint failed twice');
  assert.equal(p.status, 0, p.stderr);
  const file = fs.readdirSync(D(root, 'review')).find((f) => f.startsWith('P-001'));
  assert.equal(cli(root, 'review', '--approve', 'P-001').status, 0);
  assert.match(read(D(root, `review/${file}`)), /- Status: approved/);
  assert.equal(cli(root, 'remove', '-y').status, 0);
  assert.ok(!fs.existsSync(path.join(root, '.agentkit.json')));
  assert.ok(!fs.existsSync(path.join(root, '.claude')), 'nothing of the kit left in .claude/');
  assert.ok(!fs.existsSync(path.join(root, '.agentkit')), 'shared hooks removed');
  assert.ok(fs.existsSync(D(root, 'desk.json')));
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
  const env = {};
  assert.deepEqual(selfClean({ root: path.join(tmp, 'clone'), env }), []); // a git clone is never touched
  assert.deepEqual(selfClean({ root: pkg, env: { ...env, AGENTKIT_KEEP_CACHE: '1' } }), []);
  assert.ok(fs.existsSync(pkg));
  selfClean({ root: pkg, env });
  assert.ok(!fs.existsSync(path.join(tmp, '.npm', '_npx', 'abc123')));
  assert.ok(fs.existsSync(other), 'other npx entries stay');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('self-clean: drops only cacache buckets and blobs that belong to the kit', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ak-cacache-'));
  const c = path.join(tmp, '_cacache');
  const blob = (b) => { const hex = Buffer.from(b, 'base64').toString('hex'); const p = path.join(c, 'content-v2', 'sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'x'); return p; };
  const bucket = (name, entries) => { const p = path.join(c, 'index-v5', 'aa', 'bb', name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, entries.map((e) => '\nhash\t' + JSON.stringify(e)).join('')); return p; };
  const oursBlob = blob('b3Vycw==');
  const otherBlob = blob('b3RoZXI=');
  const ours = bucket('k1', [{ key: 'pacote:tarball:github:me/agent-work-kit#abc', integrity: 'sha512-b3Vycw==' }, { key: 'pacote:tarball:github:me/agent-work-kit#abc', integrity: null }]);
  const other = bucket('k2', [{ key: 'pacote:tarball:left-pad', integrity: 'sha512-b3RoZXI=' }]);
  assert.deepEqual(cleanCacache(tmp), ['pacote:tarball:github:me/agent-work-kit#abc']);
  assert.ok(!fs.existsSync(ours) && !fs.existsSync(oursBlob));
  assert.ok(fs.existsSync(other) && fs.existsSync(otherBlob));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('remove never deletes the project directory or its parents, even when only kit files were in it', () => {
  const parent = tmp();
  const root = path.join(parent, 'project');
  fs.mkdirSync(root);
  const ctx = makeCtx({ root, harnesses: ['pi', 'claude'], profession: 'universal' });
  sync(ctx);
  fs.rmSync(path.join(root, '.desk'), { recursive: true, force: true }); // only kit files left
  uninstall(ctx);
  assert.ok(fs.existsSync(root), 'the project directory stays');
  assert.ok(fs.existsSync(parent), 'its parent stays');
  assert.deepEqual(fs.readdirSync(root), [], 'kit files and their empty folders are gone');
});

test('skill frontmatter is valid YAML for strict parsers: the description is a quoted scalar', () => {
  for (const n of availableProfessions()) {
    const raw = loadKit(n.name).skill.raw;
    const line = raw.split('\n').find((l) => l.startsWith('description: '));
    const value = line.slice('description: '.length);
    assert.ok(value.startsWith('"') && value.endsWith('"'), `${n.name}: description is quoted`);
    assert.match(JSON.parse(value), /Profession: /, 'JSON string quoting is valid YAML and round-trips');
  }
});
