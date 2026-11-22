import path from 'node:path';
import { sha, readText, writeText, readJson, exists, removeFile, toPosix, PKG_ROOT } from './util.js';
import { extractBlock, upsertBlock, removeBlock } from './markers.js';
import { applyPatch, revertPatch } from './jsonmerge.js';
import { loadKit } from './bundle.js';
import { collectOutputs } from '../adapters/index.js';
import { parseRules, DESK, LOCAL_RULES } from '../../kit/method/hooks/_lib.mjs';
import * as Store from '../../kit/method/hooks/store.mjs';

export const MANIFEST = '.agentkit.json';
export const kitVersion = () => readJson(path.join(PKG_ROOT, 'package.json')).version;

export function makeCtx({ root = process.cwd(), harnesses = [], profession = null } = {}) {
  root = path.resolve(root);
  return { root, harnesses, profession };
}
export const manifestPath = (ctx) => path.join(ctx.root, MANIFEST);
export function loadManifest(ctx) {
  const m = readJson(manifestPath(ctx));
  if (m && m.nghe && !m.profession) {
    m.profession = m.nghe;
    delete m.nghe;
  }
  return m;
}
const rel = (ctx, p) => toPosix(path.relative(ctx.root, p));

export function diffRules(prev = {}, rules) {
  const next = Object.fromEntries(rules.map((r) => [r.id, { hash: sha(r.kind + '\n' + r.body), kind: r.kind, body: r.body }]));
  const added = Object.keys(next).filter((id) => !prev[id]);
  const changed = Object.keys(next).filter((id) => prev[id] && prev[id].hash !== next[id].hash);
  const removed = Object.keys(prev).filter((id) => !next[id]);
  return { next, added, changed, removed };
}

function writeUpdateItem(ctx, { id, change, prev, next, local, from, to, dryRun }) {
  const base = `U-${id}-v${to}`;
  const p = path.join(ctx.root, DESK, 'archive', base + '.md');
  if (exists(p) || exists(path.join(ctx.root, DESK, 'review', base + '.md'))) return null;
  const text = `# ${base}: kit ${change} ${id}, which this project ${local.kind === 'off' ? 'turns off' : 'overrides'}
- Status: applied
- Decided: kept the project rule automatically (${new Date().toISOString().slice(0, 10)})
- Kit: ${from} → ${to}

## Kit's ${change === 'removed' ? 'removed' : 'new'} version
${change === 'removed' ? '(rule no longer exists in the profession pack)' : `### ${id} · ${next.kind}\n${next.body}`}

## Previous kit version
${prev ? `### ${id} · ${prev.kind}\n${prev.body}` : '(unknown)'}

## Your project rule (.desk/rules.local.md)
### ${id} · ${local.kind}
${local.body}

## If the kit version is better
Tell the agent "use the kit rule for ${id}" (it removes the project rule), or run \`npx github:nguyennamkkb/agent-work-kit review --drop ${base}\`.
`;
  if (!dryRun) {
    writeText(p, text);
    if (Store.hasDesk(ctx.root)) Store.mutate(ctx.root, 'kit-update', (d) => Store.addInbox(d, `kit ${to} ${change} ${id}; project rule kept (archive/${base}.md) — tell the user once, in one line`));
  }
  return base + '.md';
}

export function sync(ctx, { force = false, dryRun = false } = {}) {
  const prev = loadManifest(ctx) ?? { files: {} };
  const kit = loadKit(ctx.profession);
  const { outputs, notes } = collectOutputs(kit, ctx);
  const files = {};
  const report = [];
  const log = (action, p, extra = '') => report.push({ action, path: p, extra });
  const write = (p, c) => !dryRun && writeText(p, c);

  for (const out of outputs) {
    const r = rel(ctx, out.path);
    const before = prev.files[r];
    const cur = readText(out.path);
    if (out.kind === 'file') {
      if (cur == null) {
        write(out.path, out.content);
        log('create', r);
      } else if (cur === out.content) log('ok', r);
      else if (force || (before && sha(cur) === before.hash)) {
        write(out.path, out.content);
        log('update', r);
      } else {
        write(out.path + '.kit-new', out.content);
        log('conflict', r, `edited by hand; kept, new version in ${r}.kit-new`);
      }
      files[r] = { kind: 'file', hash: sha(out.content) };
    } else if (out.kind === 'block') {
      const h = sha(out.content.trim());
      const blk = extractBlock(cur);
      const keep = before?.stub ? { stub: before.stub } : {};
      if (!blk) {
        write(out.path, upsertBlock(cur, out.content));
        log(cur == null ? 'create' : 'insert-block', r);
        files[r] = { kind: 'block', hash: h };
      } else if (blk.inner.trim() === out.content.trim()) {
        const fresh = upsertBlock(cur, out.content);
        if (fresh !== cur) write(out.path, fresh);
        log(fresh !== cur ? 'update' : 'ok', r);
        files[r] = { kind: 'block', hash: h, ...keep };
      } else if (force || (before && sha(blk.inner.trim()) === before.hash)) {
        write(out.path, upsertBlock(cur, out.content));
        log('update', r);
        files[r] = { kind: 'block', hash: h, ...keep };
      } else {
        log('conflict', r, 'kit block edited by hand; left unchanged (use --force)');
        files[r] = before ?? { kind: 'block', hash: sha(blk.inner.trim()) };
      }
    } else if (out.kind === 'json') {
      let obj = cur == null ? {} : JSON.parse(cur);
      if (before?.patch) obj = revertPatch(obj, before.patch);
      obj = applyPatch(obj, out.patch);
      const text = JSON.stringify(obj, null, 2) + '\n';
      if (text !== cur) {
        write(out.path, text);
        log(cur == null ? 'create' : 'merge', r);
      } else log('ok', r);
      const original = before ? before.original : cur;
      files[r] = { kind: 'json', patch: out.patch, ...(original != null ? { original } : {}) };
    }
  }

  const v1 = exists(path.join(ctx.root, DESK, 'now.md')) && !exists(path.join(ctx.root, DESK, 'desk.json'));
  if (v1 && !dryRun) {
    Store.migrateV1(ctx.root);
    log('migrate', `${DESK}/`, 'desk v1 → v2 (desk.json); old zone files kept in .desk/archive/v1/');
  }
  for (const t of kit.templates) {
    const p = path.join(ctx.root, DESK, t.rel);
    if (!exists(p)) {
      write(p, t.content);
      log('seed', rel(ctx, p));
    } else if (t.rel === '.gitignore') {
      const cur = readText(p);
      const missing = t.content.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !cur.split('\n').includes(l));
      if (missing.length) {
        write(p, cur.replace(/\n*$/, '\n') + missing.join('\n') + '\n');
        log('update', rel(ctx, p), `ignore ${missing.join(' ')}`);
      }
    }
  }

  for (const [r, entry] of Object.entries(prev.files)) {
    if (files[r]) continue;
    const res = removeEntry(ctx, r, entry, { force, dryRun });
    log(res.removed ? 'remove' : 'keep', r, res.reason ?? '');
  }

  const sameProfession = prev.profession?.name === kit.profession.name;
  const d = diffRules(sameProfession ? prev.profession.rules : {}, kit.rules);
  const local = new Map(parseRules(readText(path.join(ctx.root, DESK, LOCAL_RULES))).rules.map((r) => [r.id, r]));
  const rules = [];
  if (sameProfession) {
    for (const id of d.added) rules.push({ id, change: 'added', action: 'applied' });
    for (const [list, change] of [
      [d.changed, 'changed'],
      [d.removed, 'removed'],
    ])
      for (const id of list) {
        const lr = local.get(id);
        if (lr && (lr.kind === 'override' || lr.kind === 'off')) {
          const item = writeUpdateItem(ctx, { id, change, prev: prev.profession.rules[id], next: d.next[id], local: lr, from: prev.profession.version, to: kit.profession.version, dryRun });
          rules.push({ id, change, action: item ? `project rule ${lr.kind} kept → .desk/archive/${item}` : 'project rule kept (noted before)' });
        } else rules.push({ id, change, action: change === 'removed' ? 'removed' : 'applied' });
      }
  }
  const orphans = [...local.values()].filter((r) => (r.kind === 'override' || r.kind === 'off') && !d.next[r.id]).map((r) => r.id);

  const manifest = {
    kit: 'agent-work-kit',
    version: kitVersion(),
    profession: { name: kit.profession.name, title: kit.profession.title, version: kit.profession.version, rules: d.next },
    harnesses: ctx.harnesses,
    installedAt: prev.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files,
  };
  if (!dryRun) {
    writeText(manifestPath(ctx), JSON.stringify(manifest, null, 2) + '\n');
    if (!exists(path.join(ctx.root, DESK, 'DESK.md'))) Store.save(ctx.root, Store.load(ctx.root));
  }
  return { report, notes, manifest, rules, from: sameProfession ? prev.profession.version : null, orphans, kit };
}

export function removeEntry(ctx, r, entry, { force = false, dryRun = false } = {}) {
  const p = path.join(ctx.root, r);
  if (!dryRun && exists(p + '.kit-new')) removeFile(p + '.kit-new', ctx.root);
  const cur = readText(p);
  if (cur == null) return { removed: true };
  if (entry.kind === 'file') {
    if (!force && sha(cur) !== entry.hash) return { removed: false, reason: 'edited by hand; kept' };
    if (!dryRun) removeFile(p, ctx.root);
    return { removed: true };
  }
  if (entry.kind === 'block') {
    if (!extractBlock(cur)) return { removed: true };
    const rest = removeBlock(cur);
    const untouched = !rest.trim() || (entry.stub && sha(rest.trim()) === entry.stub);
    if (!dryRun) untouched ? removeFile(p, ctx.root) : writeText(p, rest);
    return { removed: true };
  }
  if (entry.kind === 'json') {
    const obj = revertPatch(JSON.parse(cur), entry.patch);
    let text = JSON.stringify(obj, null, 2) + '\n';
    if (entry.original != null) {
      try {
        if (JSON.stringify(JSON.parse(entry.original)) === JSON.stringify(obj)) text = entry.original;
      } catch {
      }
    }
    if (!dryRun) Object.keys(obj).length ? writeText(p, text) : removeFile(p, ctx.root);
    return { removed: true };
  }
  return { removed: false, reason: 'unknown entry' };
}

export function uninstall(ctx, { force = false, dryRun = false } = {}) {
  const m = loadManifest(ctx);
  if (!m) throw new Error(`No ${MANIFEST} in ${ctx.root}. Nothing to remove.`);
  const report = [];
  for (const [r, entry] of Object.entries(m.files)) {
    const res = removeEntry(ctx, r, entry, { force, dryRun });
    report.push({ action: res.removed ? 'remove' : 'keep', path: r, extra: res.reason ?? '' });
  }
  if (!dryRun) removeFile(manifestPath(ctx), ctx.root);
  return { report };
}
