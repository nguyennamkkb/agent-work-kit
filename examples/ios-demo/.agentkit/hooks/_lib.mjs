// agent-work-kit desk library — shared by hooks and CLI. Zero dependencies. Kit-managed: do not edit.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------- basics
export const read = (p) => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
};

export async function readStdinJson() {
  if (process.stdin.isTTY) return {};
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try {
    return JSON.parse(data || '{}');
  } catch {
    return {};
  }
}

/** Project root: the nearest directory (walking up) that holds .agentkit.json or .desk/. */
export function findRoot(start) {
  let d = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(d, '.agentkit.json')) || fs.existsSync(path.join(d, '.desk', 'now.md'))) return d;
    const up = path.dirname(d);
    if (up === d) return path.resolve(start || process.cwd());
    d = up;
  }
}
export const projectDir = (input = {}) => findRoot(process.env.AGENTKIT_ROOT || process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());

/** Hook output that both Claude Code and Codex inject as context. */
export function emitContext(event, text) {
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }) + '\n');
}
/** Read context back from a hook's stdout (JSON form or plain text). */
export function contextOf(stdout) {
  const t = (stdout ?? '').trim();
  if (!t) return '';
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t);
      return j.hookSpecificOutput?.additionalContext ?? j.reason ?? '';
    } catch {
      /* plain text */
    }
  }
  return t;
}
export const today = () => new Date().toISOString().slice(0, 10);

export function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function findManifest(root) {
  const p = path.join(root, '.agentkit.json');
  const t = read(p);
  if (!t) return null;
  try {
    return { path: p, base: root, data: JSON.parse(t) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- desk layout
export const DESK = '.desk';
export const KIT_STATE = ['.state.json', '.journal.jsonl']; // written by hooks only
export const ZONES = {
  goal: 'goal.md',
  now: 'now.md',
  queue: 'queue.md',
  inbox: 'inbox.md',
  memory: 'memory.md',
  notebook: 'notebook.md',
  local: 'rules.local.md',
};
export const CAPS = { goalLines: 5, now: 1, queue: 7, memoryTop: 10 };
export const PROMOTE_USES = 3; // used ≥3× → move up one level
export const STALE_SESSIONS = 5; // untouched for 5 sessions → move down one level
export const PROPOSE_SEEN = 2; // lesson seen ≥2× → draft a proposal
const PREFIX = { now: 'Q', queue: 'Q', memory: 'M', notebook: 'L' };

/** Is `rel` (relative to .desk/) a file the desk allows? */
export function allowedDeskPath(rel) {
  rel = rel.split(path.sep).join('/');
  if (Object.values(ZONES).includes(rel) || rel === 'README.md' || rel === '.gitignore') return true;
  if (/^review\/(README|_TEMPLATE)\.md$/.test(rel)) return true;
  if (/^review\/[PU]-[A-Z0-9-]*\d[\w.-]*\.md$/.test(rel)) return true;
  if (/^archive\/[\w.-]+\.md$/.test(rel)) return true;
  return false;
}

const stripNoise = (text) =>
  (text ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^```[\s\S]*?^```/gm, '');

// ---------------------------------------------------------------- items
// - P1 Q-007 Login screen · +2026-11-20 · ×3 · @2026-11-22
//   - done: <check>
const SEP = '\\s*[·|]\\s*';
const ITEM_RE = new RegExp(`^- (P[0-3]) ([A-Z]+-\\d+) (.+?)${SEP}\\+(\\d{4}-\\d\\d-\\d\\d)${SEP}[×x](\\d+)${SEP}@(\\d{4}-\\d\\d-\\d\\d)\\s*$`);

export function parseItems(text) {
  const items = [];
  const bad = [];
  let divider = -1; // index in items where the `---` line sits (memory)
  let cur = null;
  for (const line of stripNoise(text).split('\n')) {
    if (/^---\s*$/.test(line)) {
      if (divider < 0) divider = items.length;
      cur = null;
      continue;
    }
    if (line.startsWith('- ')) {
      const m = ITEM_RE.exec(line);
      if (!m) {
        bad.push(line);
        cur = null;
        continue;
      }
      cur = { prio: m[1], id: m[2], text: m[3].trim(), added: m[4], uses: Number(m[5]), last: m[6], sub: [] };
      items.push(cur);
    } else if (cur && /^\s+- /.test(line)) {
      cur.sub.push(line.trim().slice(2));
    }
  }
  return { items, bad, divider };
}

export const subField = (item, key) => item.sub.find((s) => s.toLowerCase().startsWith(key + ':'))?.slice(key.length + 1).trim() ?? null;

const contentLines = (text) =>
  stripNoise(text)
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'));

// ---------------------------------------------------------------- rules (pack + local)
// ### IOS-012 · P1        (pack rule or new local rule)
// ### IOS-012 · override  (local: replace kit rule)
// ### IOS-020 · off       (local: disable kit rule)
const RULE_HEAD = /^### ([A-Z]+-\d+)\s*[·|-]\s*(P[0-3]|override|off)\s*$/;

export function parseRules(text) {
  const lines = (text ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const rules = [];
  const bad = [];
  let preamble = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      const m = RULE_HEAD.exec(line.trim());
      if (!m) {
        bad.push(line);
        cur = null;
        continue;
      }
      cur = { id: m[1], kind: m[2], lines: [] };
      rules.push(cur);
    } else if (cur && line.startsWith('## ')) {
      cur = null;
      preamble.push(line);
    } else if (cur) cur.lines.push(line);
    else preamble.push(line);
  }
  for (const r of rules) {
    r.body = r.lines.join('\n').trim();
    r.why = /^- Why:\s*(.+)$/m.exec(r.body)?.[1]?.trim() ?? null;
    r.check = /^- Check:\s*(.+)$/m.exec(r.body)?.[1]?.trim() ?? null;
    r.summary = r.body.split('\n').find((l) => l.trim() && !l.startsWith('- ')) ?? r.why ?? '';
    delete r.lines;
  }
  return { preamble: preamble.join('\n').trim(), rules, bad };
}

/** Remove `### ID · …` section from rules text (used when the user drops an override). */
export function removeRuleSection(text, id) {
  const lines = (text ?? '').split('\n');
  const out = [];
  let skip = false;
  for (const line of lines) {
    if (line.startsWith('### ')) skip = new RegExp(`^### ${id}\\s*[·|-]`).test(line);
    else if (line.startsWith('## ') || line.startsWith('# ')) skip = false;
    if (!skip) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------- review/ (proposals P-*, kit updates U-*)
export function listReview(root) {
  const out = [];
  for (const sub of ['review', 'archive']) {
    const dir = path.join(root, DESK, sub);
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => /^[PU]-.*\.md$/.test(f));
    } catch {
      continue;
    }
    for (const f of files.sort()) {
      const text = read(path.join(dir, f)) ?? '';
      const id = f.startsWith('P-') ? /^P-\d+/.exec(f)?.[0] ?? f.replace(/\.md$/, '') : f.replace(/\.md$/, '');
      out.push({
        id,
        kind: id[0],
        file: path.join(dir, f),
        archived: sub === 'archive',
        title: /^# [^:]+:\s*(.*)$/m.exec(text)?.[1]?.trim() ?? f,
        status: (/^- Status:\s*(\w+)/im.exec(text)?.[1] ?? 'pending').toLowerCase(),
        text,
      });
    }
  }
  return out;
}

export function setStatus(file, status, note = '') {
  let text = read(file) ?? '';
  if (/^- Status:.*$/im.test(text)) text = text.replace(/^- Status:.*$/im, `- Status: ${status}`);
  else text = text.replace(/^(# .*\n)/, `$1- Status: ${status}\n`);
  text = text.replace(/^(- Status:.*\n)/im, `$1- Reviewed: ${today()}${note ? ` — ${note}` : ''}\n`);
  fs.writeFileSync(file, text);
}

// ---------------------------------------------------------------- session state
const statePath = (root) => path.join(root, DESK, '.state.json');
export function readState(root) {
  try {
    return JSON.parse(read(statePath(root)) ?? '');
  } catch {
    return { session: 0, sessions: [] };
  }
}
export function bumpSession(root) {
  const s = readState(root);
  s.session = (s.session ?? 0) + 1;
  s.sessions = [...(s.sessions ?? []), today()].slice(-50);
  try {
    fs.writeFileSync(statePath(root), JSON.stringify(s, null, 2) + '\n');
  } catch {
    /* desk missing */
  }
  return s;
}
/** Date of the session STALE_SESSIONS sessions ago; items last used before it are stale. */
function staleBefore(state) {
  const s = state.sessions ?? [];
  return s.length > STALE_SESSIONS ? s[s.length - 1 - STALE_SESSIONS] : null;
}

// ---------------------------------------------------------------- lint
/**
 * Lint one desk file. `rel` is relative to .desk/. `prev` (optional) is the content before an edit,
 * used to only demand proposal citations for local rules that are new or changed.
 */
export function lintFile(root, rel, text, prev = null) {
  const errors = [];
  const zone = Object.entries(ZONES).find(([, f]) => f === rel)?.[0];
  if (!zone) return errors;
  if (zone === 'goal') {
    const n = contentLines(text).length;
    if (n > CAPS.goalLines) errors.push(`goal.md has ${n} lines; max ${CAPS.goalLines}. Keep only the destination and success criteria.`);
    return errors;
  }
  if (zone === 'inbox') return errors;
  if (zone === 'local') {
    const { rules, bad } = parseRules(text);
    for (const b of bad) errors.push(`rules.local.md: bad heading "${b.trim()}". Use "### ID · P0-P3|override|off".`);
    const seen = new Set();
    for (const r of rules) {
      if (seen.has(r.id)) errors.push(`rules.local.md: ${r.id} appears twice.`);
      seen.add(r.id);
    }
    if (prev != null) {
      const before = new Map(parseRules(prev).rules.map((r) => [r.id, r.kind + '\n' + r.body]));
      const approved = new Set(listReview(root).filter((p) => p.kind === 'P' && ['approved', 'applied'].includes(p.status)).map((p) => p.id));
      for (const r of rules) {
        if (before.get(r.id) === r.kind + '\n' + r.body) continue;
        const cited = [...r.body.matchAll(/P-\d+/g)].map((m) => m[0]);
        if (!cited.some((id) => approved.has(id)))
          errors.push(`rules.local.md: ${r.id} is new or changed but cites no approved proposal. Write a proposal in .desk/review/ and wait for the user to approve it; then add "- Why: P-00N ..." to the rule.`);
      }
    }
    return errors;
  }

  const { items, bad, divider } = parseItems(text);
  for (const b of bad.slice(0, 3))
    errors.push(`${rel}: "${b.slice(0, 80)}" is not a desk item. Format: "- P1 ${PREFIX[zone]}-001 text · +YYYY-MM-DD · ×1 · @YYYY-MM-DD".`);
  for (const it of items) {
    if (PREFIX[zone] && !it.id.startsWith(PREFIX[zone] + '-')) errors.push(`${rel}: ${it.id} must use the ${PREFIX[zone]}- prefix in this zone.`);
  }
  if (zone === 'now') {
    if (items.length > CAPS.now) errors.push(`now.md holds ${items.length} tasks; exactly one task may be in progress. Move the others back to queue.md.`);
    for (const it of items) if (!subField(it, 'done')) errors.push(`now.md: ${it.id} needs a "  - done: <check>" line.`);
  }
  if (zone === 'queue') {
    if (items.length > CAPS.queue) errors.push(`queue.md holds ${items.length} tasks; max ${CAPS.queue}. Move the lowest-priority ones to archive/ (or drop them).`);
    for (let i = 1; i < items.length; i++)
      if (items[i].prio < items[i - 1].prio) {
        errors.push(`queue.md must be sorted P0→P3; ${items[i].id} (${items[i].prio}) is below ${items[i - 1].id} (${items[i - 1].prio}).`);
        break;
      }
  }
  if (zone === 'memory') {
    const top = divider < 0 ? items.length : divider;
    if (top > CAPS.memoryTop) errors.push(`memory.md has ${top} items above the "---" line; max ${CAPS.memoryTop}. Move the least-used below the line.`);
  }
  return errors;
}

/** Lint the whole desk. `overrides` maps rel → simulated content. */
export function lintDesk(root, overrides = {}) {
  const errors = [];
  const ids = new Map();
  for (const rel of Object.values(ZONES)) {
    const text = rel in overrides ? overrides[rel] : read(path.join(root, DESK, rel));
    if (text == null) {
      errors.push(`.desk/${rel} is missing.`);
      continue;
    }
    errors.push(...lintFile(root, rel, text));
    if (['now.md', 'queue.md', 'memory.md', 'notebook.md'].includes(rel))
      for (const it of parseItems(text).items) {
        if (ids.has(it.id) && ids.get(it.id) !== rel) errors.push(`${it.id} is in both ${ids.get(it.id)} and ${rel}; an item lives in exactly one zone.`);
        else if (ids.has(it.id)) errors.push(`${it.id} appears twice in ${rel}.`);
        ids.set(it.id, rel);
      }
  }
  const walk = (dir, base = '') => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), rel);
      else if (!KIT_STATE.includes(rel) && !allowedDeskPath(rel)) errors.push(`.desk/${rel} is not a desk zone. Move its content into a zone and delete it.`);
    }
  };
  walk(path.join(root, DESK));
  return errors;
}

/** Apply an Edit/MultiEdit/Write tool call to current content (for pre-write validation). */
export function simulateEdit(cur, toolName, ti) {
  if (toolName === 'Write') return ti.content ?? '';
  const edits = toolName === 'MultiEdit' ? ti.edits ?? [] : [ti];
  let text = cur ?? '';
  for (const e of edits) {
    if (e.old_string == null) return null;
    if (e.old_string === '' && !text) text = e.new_string ?? '';
    else text = e.replace_all ? text.split(e.old_string).join(e.new_string ?? '') : text.replace(e.old_string, () => e.new_string ?? '');
  }
  return text;
}

// ---------------------------------------------------------------- file writes, across harnesses
/** Find a Codex-style patch ("*** Begin Patch") anywhere in a tool input. */
function findPatch(v) {
  if (typeof v === 'string') return v.includes('*** Begin Patch') ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = findPatch(x);
      if (r) return r;
    }
  } else if (v && typeof v === 'object') for (const x of Object.values(v)) {
    const r = findPatch(x);
    if (r) return r;
  }
  return null;
}

/** Parse the apply_patch envelope into per-file operations. */
export function parseApplyPatch(text) {
  const ops = [];
  let cur = null;
  let hunk = null;
  for (const line of text.split('\n')) {
    let m;
    if ((m = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line))) {
      cur = { op: m[1].toLowerCase(), path: m[2].trim(), moveTo: null, add: [], hunks: [] };
      ops.push(cur);
      hunk = null;
    } else if (!cur || /^\*\*\* (Begin|End) Patch/.test(line) || line === '*** End of File') continue;
    else if ((m = /^\*\*\* Move to: (.+)$/.exec(line))) cur.moveTo = m[1].trim();
    else if (cur.op === 'add') {
      if (line.startsWith('+')) cur.add.push(line.slice(1));
    } else if (cur.op === 'update') {
      if (line.startsWith('@@')) cur.hunks.push((hunk = []));
      else if (/^[ +-]/.test(line) || line === '') {
        if (!hunk) cur.hunks.push((hunk = []));
        hunk.push({ t: line[0] ?? ' ', s: line.slice(1) });
      }
    }
  }
  return ops;
}

function applyHunks(content, hunks) {
  let text = content ?? '';
  for (const h of hunks) {
    const oldS = h.filter((l) => l.t !== '+').map((l) => l.s).join('\n');
    const newS = h.filter((l) => l.t !== '-').map((l) => l.s).join('\n');
    if (!oldS) return null;
    const i = text.indexOf(oldS);
    if (i < 0) return null;
    text = text.slice(0, i) + newS + text.slice(i + oldS.length);
  }
  return text;
}

const pick = (o, ...keys) => keys.map((k) => o?.[k]).find((v) => v != null);

/**
 * Normalize any harness's file-writing tool call into [{ path, next, deleted? }].
 * `next` is the resulting content, or null when it cannot be predicted (path-only check).
 * Understands Claude (Edit/Write/MultiEdit), Codex apply_patch, Pi (edit {path, edits[oldText,newText]}),
 * OpenCode (edit {filePath, oldString, newString, replaceAll}), and generic {path|file_path|filePath}.
 */
export function normalizeWrites(root, toolName, ti = {}, base = root) {
  const abs = (p) => path.resolve(base || root, p); // relative paths are relative to the session cwd
  const patch = findPatch(ti);
  if (patch) {
    return parseApplyPatch(patch).flatMap((op) => {
      if (op.op === 'add') return [{ path: abs(op.path), next: op.add.join('\n') + '\n' }];
      if (op.op === 'delete') return [{ path: abs(op.path), next: null, deleted: true }];
      const next = applyHunks(read(abs(op.path)), op.hunks);
      return op.moveTo ? [{ path: abs(op.path), next: null, deleted: true }, { path: abs(op.moveTo), next }] : [{ path: abs(op.path), next }];
    });
  }
  const file = pick(ti, 'file_path', 'filePath', 'path', 'notebook_path');
  if (!file || typeof file !== 'string') return [];
  const p = abs(file);
  const name = String(toolName ?? '').toLowerCase();
  const content = pick(ti, 'content');
  if (typeof content === 'string' && /write|create/.test(name)) return [{ path: p, next: content }];
  const list = Array.isArray(ti.edits)
    ? ti.edits.map((e) => ({ o: pick(e, 'old_string', 'oldString', 'oldText'), n: pick(e, 'new_string', 'newString', 'newText'), all: pick(e, 'replace_all', 'replaceAll') }))
    : [{ o: pick(ti, 'old_string', 'oldString', 'oldText'), n: pick(ti, 'new_string', 'newString', 'newText'), all: pick(ti, 'replace_all', 'replaceAll') }];
  if (list.every((e) => typeof e.o === 'string')) {
    let text = read(p) ?? '';
    for (const e of list) {
      if (e.o === '' && !text) text = e.n ?? '';
      else if (!text.includes(e.o)) return [{ path: p, next: null }];
      else text = e.all ? text.split(e.o).join(e.n ?? '') : text.replace(e.o, () => e.n ?? '');
    }
    return [{ path: p, next: text }];
  }
  return [{ path: p, next: null }];
}

// ---------------------------------------------------------------- surface (what the agent sees first)
const short = (s, n = 110) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmt = (it) => `${it.prio} ${it.id} ${short(it.text)}`;

export function renderSurface(root, { session = null, moves = [] } = {}) {
  const d = (f) => read(path.join(root, DESK, f));
  const m = findManifest(root)?.data;
  if (d(ZONES.now) == null) return '[desk] This project has no .desk/ (agent-work-kit not installed here).';
  const state = session ?? readState(root);
  const out = [];
  out.push(`[desk] ${m?.nghe?.title ?? 'Work'} desk · session ${state.session ?? '?'} — follow the desk skill. Everything goes into a zone.`);

  const goal = contentLines(d(ZONES.goal));
  out.push(goal.length ? `Goal: ${goal.map((l) => l.replace(/^[-*]\s*/, '')).join(' / ')}` : 'Goal: not set → infer it from the user\'s requests, README and git log; write goal.md yourself and mention it in one line. Ask only if two readings lead to different work.');

  const now = parseItems(d(ZONES.now)).items[0];
  const queue = parseItems(d(ZONES.queue)).items;
  if (now) out.push(`Now: ${fmt(now)}\n  done: ${subField(now, 'done') ?? '(missing)'}${subField(now, 'next') ? `\n  next: ${subField(now, 'next')}` : ''}`);
  else out.push(queue.length ? `Now: empty → move the top of queue.md (${queue[0].id}) into now.md and set its done-check.` : 'Now: empty → the user\'s next request becomes the task: write it to now.md with a done-check you infer.');
  if (queue.length) out.push(`Queue (${queue.length}/${CAPS.queue}): ${queue.slice(0, 3).map(fmt).join(' | ')}${queue.length > 3 ? ' | …' : ''}`);

  const mem = parseItems(d(ZONES.memory));
  const top = mem.items.slice(0, mem.divider < 0 ? mem.items.length : mem.divider);
  if (top.length) out.push('Memory (always on):\n' + top.map((it) => `  - ${fmt(it)}`).join('\n'));

  const inbox = contentLines(d(ZONES.inbox));
  if (inbox.length) out.push(`Inbox: ${inbox.length} unsorted → sort into zones before ending the session.`);

  const review = listReview(root).filter((r) => !r.archived);
  const approved = review.filter((r) => r.kind === 'P' && r.status === 'approved');
  const waiting = review.filter((r) => r.status === 'pending');
  if (approved.length) out.push(`Approved proposals — apply first: ${approved.map((r) => `${r.id} ${r.title}`).join('; ')}`);
  if (waiting.length) out.push(`Waiting for the user's decision (do not apply): ${waiting.map((r) => r.id).join(', ')}`);

  const local = parseRules(d(ZONES.local)).rules;
  if (local.length) out.push('Project rules (override profession rules by ID):\n' + local.map((r) => `  - ${r.id} ${r.kind}${r.kind === 'off' ? '' : `: ${short(r.summary, 90)}`}`).join('\n'));

  // housekeeping candidates
  const cut = staleBefore(state);
  const stale = cut ? [...queue, ...top].filter((it) => it.last < cut).map((it) => it.id) : [];
  const below = mem.divider < 0 ? [] : mem.items.slice(mem.divider);
  const promote = below.filter((it) => it.uses >= PROMOTE_USES).map((it) => it.id);
  const ripe = parseItems(d(ZONES.notebook)).items.filter((it) => it.uses >= PROPOSE_SEEN && !subField(it, 'proposal')).map((it) => it.id);
  const hk = [];
  if (stale.length) hk.push(`still stale after auto-sort: ${stale.join(', ')}`);
  if (promote.length) hk.push(`used ≥${PROMOTE_USES}× but memory top is full: ${promote.join(', ')} — merge or retire a top item`);
  if (ripe.length) hk.push(`draft proposals (lesson seen ≥${PROPOSE_SEEN}×): ${ripe.join(', ')}`);
  if (hk.length) out.push('To do this session: ' + hk.join('; '));

  if (moves.length) out.push('Auto-sorted: ' + moves.join('; '));
  const errs = lintDesk(root);
  if (errs.length) out.push('Desk problems — fix first:\n' + errs.slice(0, 6).map((e) => `  - ${e}`).join('\n'));
  return out.join('\n');
}

// ---------------------------------------------------------------- automatic importance
const serialize = (it) => [`- ${it.prio} ${it.id} ${it.text} · +${it.added} · ×${it.uses} · @${it.last}`, ...it.sub.map((x) => `  - ${x}`)].join('\n');

/** Everything before the first real item (or the memory divider), comments included. */
function headerOf(text) {
  const lines = (text ?? '').split('\n');
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inComment && (ITEM_RE.test(l) || /^---\s*$/.test(l))) return lines.slice(0, i).join('\n').replace(/\n+$/, '');
    if (l.includes('<!--')) inComment = true;
    if (l.includes('-->')) inComment = false;
  }
  return (text ?? '').replace(/\n+$/, '');
}

function writeZone(root, file, items, below = null) {
  const p = path.join(root, DESK, file);
  const head = headerOf(read(p));
  let body = items.map(serialize).join('\n');
  if (below) body = `${body}${body ? '\n' : ''}---${below.length ? '\n' + below.map(serialize).join('\n') : ''}`;
  fs.writeFileSync(p, `${head}\n${body ? body + '\n' : ''}`);
}

function archiveItems(root, items, from) {
  if (!items.length) return;
  const p = path.join(root, DESK, 'archive', `${today().slice(0, 7)}.md`);
  const head = fs.existsSync(p) ? '' : `# Archive ${today().slice(0, 7)}\n`;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, head + items.map((it) => `- [${today()} from ${from}] ${serialize(it).replace(/^- /, '')}`).join('\n') + '\n');
}

const DOWN = { P0: 'P1', P1: 'P2', P2: 'P3', P3: null };
const score = (it) => it.uses * 2 + (it.last >= today() ? 1 : 0);

/**
 * Mechanical sorting, done by the kit so neither the user nor the agent has to:
 * queue sorted by priority then use; stale tasks drop a level, P3 stale → archive; overflow → archive;
 * memory: stale top → below the line, used ≥PROMOTE_USES below → top (if room), top overflow → below.
 * `@` means "last touched"; a demotion resets it so an item drops one level per STALE_SESSIONS sessions.
 */
export function autoSort(root, state = readState(root)) {
  const moves = [];
  const cut = staleBefore(state);
  const qPath = path.join(root, DESK, ZONES.queue);
  const mPath = path.join(root, DESK, ZONES.memory);

  if (fs.existsSync(qPath)) {
    const { items, bad } = parseItems(read(qPath));
    if (!bad.length) {
      let q = [...items];
      const gone = [];
      for (const it of q) {
        if (!cut || it.last >= cut) continue;
        const to = DOWN[it.prio];
        if (to) moves.push(`${it.id} ${it.prio}→${to} (untouched ${STALE_SESSIONS} sessions)`), (it.prio = to), (it.last = today());
        else gone.push(it);
      }
      q = q.filter((it) => !gone.includes(it));
      q.sort((a, b) => a.prio.localeCompare(b.prio) || b.uses - a.uses);
      while (q.length > CAPS.queue) gone.push(q.pop());
      for (const it of gone) moves.push(`${it.id} → archive`);
      archiveItems(root, gone, 'queue');
      if (JSON.stringify(q) !== JSON.stringify(items)) writeZone(root, ZONES.queue, q);
    }
  }

  if (fs.existsSync(mPath)) {
    const { items, bad, divider } = parseItems(read(mPath));
    if (!bad.length) {
      const split = divider < 0 ? items.length : divider;
      let top = items.slice(0, split);
      let below = items.slice(split);
      const before = JSON.stringify([top, below]);
      for (const it of [...top]) if (cut && it.last < cut) (top = top.filter((x) => x !== it)), below.unshift({ ...it, last: today() }), moves.push(`${it.id} ↓ memory (untouched)`);
      for (const it of [...below])
        if (it.uses >= PROMOTE_USES && top.length < CAPS.memoryTop) (below = below.filter((x) => x !== it)), top.push(it), moves.push(`${it.id} ↑ memory (used ${it.uses}×)`);
      top.sort((a, b) => a.prio.localeCompare(b.prio) || score(b) - score(a));
      while (top.length > CAPS.memoryTop) {
        const it = top.pop();
        below.unshift(it);
        moves.push(`${it.id} ↓ memory (top full)`);
      }
      if (JSON.stringify([top, below]) !== before) writeZone(root, ZONES.memory, top, below);
    }
  }
  return moves;
}

// ---------------------------------------------------------------- reading the user
const words = (s) => (s.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}_]{3,}/gu) ?? []);
const STOP = new Set('the and for with this that from have not are you your but was what when then them they into about there please also just like need make sure them cho của các những được trong với này một là có không và thì để khi đã sẽ đang lại nữa thôi rồi bạn mình tôi làm'.split(' '));
const has = (re, s) => re.test(s);
const W = (list) => new RegExp(`(?<![\\p{L}])(?:${list})(?![\\p{L}])`, 'iu');
export const SIGNALS = {
  correction: W("không phải|sai rồi|sai|nhầm|đừng|không được|làm lại|chưa đúng|vẫn lỗi|vẫn chưa|wrong|incorrect|don't|do not|stop|revert|undo|that's not|not what i|again|still broken|still failing"),
  urgent: W('gấp|khẩn|ngay bây giờ|ngay lập tức|quan trọng|ưu tiên|trước tiên|urgent|asap|important|priority|critical|blocker|blocking'),
  remember: W('nhớ|ghi nhớ|luôn luôn|luôn|không bao giờ|từ giờ|từ nay|remember|always|never|from now on|going forward'),
  approve: /^\s*(ok|oke|okay|yes|yep|ừ|ừm|uh|đồng ý|duyệt|được|được rồi|chốt|làm đi|go ahead|approve[d]?|lgtm|sounds good)\b/iu,
};

export function detectSignals(prompt) {
  return Object.entries(SIGNALS)
    .filter(([, re]) => has(re, prompt ?? ''))
    .map(([k]) => k);
}

/** Bump × and @ on items the user (or an edit) refers to: by id, by ≥2 shared words, or by a `ref:` path. */
export function bumpMatches(root, { text = '', file = null } = {}) {
  const tokens = new Set(words(text).filter((w) => !STOP.has(w)));
  const bumped = [];
  for (const zone of ['now.md', 'queue.md', 'memory.md', 'notebook.md']) {
    const p = path.join(root, DESK, zone);
    const raw = read(p);
    if (raw == null) continue;
    const { items } = parseItems(raw);
    const hit = items.filter((it) => {
      if (text && new RegExp(`(?<![\\w-])${it.id}(?![\\w-])`).test(text)) return true;
      if (file && it.sub.some((x) => /^ref:/i.test(x) && x.includes(file))) return true;
      if (!text) return false;
      const own = new Set(words(it.text).filter((w) => !STOP.has(w)));
      let n = 0;
      for (const w of own) if (tokens.has(w)) n++;
      return n >= 2 && n >= Math.min(own.size, 3) * 0.6;
    });
    if (!hit.length) continue;
    let out = raw;
    for (const it of hit) {
      if (it.last === today() && file) continue; // one bump per day for edit-based touches
      out = out.replace(new RegExp(`^(- P[0-3] ${it.id} .*?[·|]\\s*[×x])(\\d+)(\\s*[·|]\\s*@)\\d{4}-\\d\\d-\\d\\d`, 'm'), (_, a, n, b) => `${a}${Number(n) + 1}${b}${today()}`);
      bumped.push(it.id);
    }
    if (out !== raw) fs.writeFileSync(p, out);
  }
  return bumped;
}

export function journal(root, entry) {
  try {
    fs.appendFileSync(path.join(root, DESK, '.journal.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    /* no desk */
  }
}

export function sessionJournal(root, session) {
  return (read(path.join(root, DESK, '.journal.jsonl')) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.s === session);
}
