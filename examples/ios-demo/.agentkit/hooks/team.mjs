import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { read, readJson, writeAtomic, git, today, nowIso, DESK, mainRoot, readState, writeState } from './_lib.mjs';
import { mutate, load, find, tasks, log, depsOpen, releaseLeases, isLead, TASK_OPEN, TASK_CLOSED, fmt, ready } from './store.mjs';

export const TEAM_DEFAULTS = {
  mainBranch: '',
  build: '',
  test: { command: '', exclusive: '', scope: '' },
  leadFiles: [],
  maxWorkers: 3,
  maxPlanWorktrees: 3,
  plansDir: '.desk/plans',
  notes: [],
  routing: { deny: [], roles: {} },
};
export const ROLES = ['engineer', 'designer', 'tester', 'fixer', 'writer', 'reviewer', 'researcher', 'scout', 'lead'];
const teamPath = (droot) => path.join(droot, DESK, 'team.json');

export function loadTeam(droot) {
  const raw = readJson(teamPath(droot), {}) ?? {};
  const out = JSON.parse(JSON.stringify(TEAM_DEFAULTS));
  for (const [k, v] of Object.entries(raw)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && !Array.isArray(out[k]) ? { ...out[k], ...v } : v;
  if (!out.mainBranch) out.mainBranch = detectMain(droot);
  out.routing = mergeRouting(out.routing);
  return out;
}
// Saved roles win; every other role gets the default. A default candidate takes the effort a saved role
// already gives the same agent:model, so the merged routing never breaks "one model keeps one effort".
export function mergeRouting(routing, defs = defaultRoles()) {
  const saved = routing.roles ?? {};
  const effortOf = new Map();
  for (const r of Object.values(saved))
    for (const raw of [...(r.use ?? []), ...(r.fallback ?? []), ...(r.escalate ?? [])]) {
      const c = parseCandidate(raw);
      if (c.model) effortOf.set(`${c.agent}:${c.model}`, c.effort);
    }
  const fit = (raw) => {
    const c = parseCandidate(raw);
    const k = `${c.agent}:${c.model}`;
    return c.model && effortOf.has(k) && effortOf.get(k) !== c.effort ? candText(c.agent, c.model, effortOf.get(k)) : raw;
  };
  const roles = { ...saved };
  const defaults = [];
  for (const [name, r] of Object.entries(defs)) {
    if (name in saved) continue;
    defaults.push(name);
    roles[name] = { ...r, use: r.use.map(fit), fallback: [...new Set(r.fallback.map(fit))] };
  }
  const { generated, ...rest } = routing;
  return { ...rest, roles, defaults };
}
const candText = (agent, model, effort) => `${agent}${model ? `:${model}` : ''}${effort ? `@${effort}` : ''}`;
export function setTeam(droot, key, value) {
  const raw = readJson(teamPath(droot), {}) ?? {};
  const parts = key.split('.');
  let o = raw;
  for (const p of parts.slice(0, -1)) o = o[p] = o[p] && typeof o[p] === 'object' ? o[p] : {};
  let v = value;
  if (/^\d+$/.test(v)) v = Number(v);
  else if (/^[[{]/.test(String(v).trim())) v = JSON.parse(v);
  else if (key === 'leadFiles' || key === 'routing.deny') v = String(v).split(',').map((x) => x.trim()).filter(Boolean);
  o[parts.at(-1)] = v;
  writeAtomic(teamPath(droot), JSON.stringify(raw, null, 2) + '\n');
  return v;
}
function detectMain(root) {
  const head = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.split('/').slice(1).join('/');
  for (const b of ['main', 'master']) if (git(root, ['rev-parse', '--verify', '--quiet', b]) != null) return b;
  return git(root, ['branch', '--show-current']) || 'main';
}

const which = (cmd) => {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']) if (fs.existsSync(path.join(dir, cmd + ext))) return true;
  }
  return false;
};
export const orcaAvailable = () => (process.env.AGENTKIT_ORCA && path.isAbsolute(process.env.AGENTKIT_ORCA) ? fs.existsSync(process.env.AGENTKIT_ORCA) : which(process.env.AGENTKIT_ORCA || 'orca'));

export function runJson(cmd, args, { cwd } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 180000, shell: process.platform === 'win32' });
  const body = (r.stdout ?? '')
    .split('\n')
    .filter((l) => !l.startsWith('{"_keepalive"'))
    .join('\n')
    .trim();
  try {
    const j = JSON.parse(body);
    return { code: r.status ?? 0, res: j, data: j.result ?? j };
  } catch {
    return { code: r.status ?? 1, res: { ok: false, error: { message: ((r.stdout ?? '') + (r.stderr ?? '') || String(r.error ?? 'no output')).trim().slice(-600) } }, data: {} };
  }
}
const ORCA = () => process.env.AGENTKIT_ORCA || 'orca';
export function orca(args, opts) {
  const out = runJson(ORCA(), [...args, '--json'], opts);
  out.ok = !out.code && out.res.ok !== false;
  out.err = out.ok ? null : `${out.res.error?.code ?? ''} ${out.res.error?.message ?? JSON.stringify(out.res).slice(0, 300)}`.trim();
  return out;
}

export const AGENTS = {
  claude: { effort: 'flag', catalog: null, newChild: true },
  codex: { effort: 'flag', catalog: null, newChild: true },
  cursor: { effort: 'flag', catalog: null, newChild: true },
  antigravity: { effort: 'flag', catalog: null, newChild: true },
  grok: { effort: 'flag', catalog: null, newChild: true },
  muse: { effort: 'flag', catalog: null, newChild: true },
  pi: { effort: 'flag', catalog: ['pi', ['--list-models']], newChild: true, providers: true },
  omp: { effort: 'suffix', catalog: ['omp', ['models', '--json']], newChild: true, providers: true },
  opencode: { effort: 'hash', catalog: ['opencode', ['models']], newChild: false, providers: true },
  opencode2: { effort: null, catalog: null, newChild: false },
  zcode: { effort: null, catalog: null, newChild: true },
};
const CLAUDE_EFFORTS = ['low', 'medium', 'high'];
const PI_EFFORTS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
const OPENCODE_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
// Claude models the default routing uses; each keeps one effort so roles never conflict.
export const CLAUDE_DEFAULTS = { opus: 'claude:claude-opus-5-5@high', sonnet: 'claude:claude-sonnet-5-5@medium', haiku: 'claude:claude-haiku-5-5@low' };
const LEAD = 'orchestrator';

export function parseCandidate(c) {
  if (c === LEAD) return { lead: true, text: c };
  if (typeof c !== 'string' || !/^[a-z0-9]+/.test(c)) return { bad: `${JSON.stringify(c)} is not agent[:model][@effort]`, text: String(c) };
  const at = c.lastIndexOf('@');
  const head = at > 0 && !c.slice(at).includes('/') ? c.slice(0, at) : c;
  const effort = head === c ? null : c.slice(at + 1);
  const i = head.indexOf(':');
  return { agent: i < 0 ? head : head.slice(0, i), model: i < 0 ? null : head.slice(i + 1), effort, text: c };
}

// Default routing (from the author's tuned .desk/team.json). Candidates whose agent is not installed are dropped;
// a default candidate missing from the agent's model list is skipped at route time, never an error.
const DS_OMP = 'omp:op-go/deepseek-v4.1-flash@high';
const DS_OPENCODE = 'opencode:opencode-go/deepseek-v4.1-flash@high';
const HY4_FREE = 'opencode:opencode-go/hy4-flash-free@high';
export const DEFAULT_ROUTES = (({ opus, sonnet, haiku }) => ({
  engineer: [sonnet, DS_OMP, DS_OPENCODE, opus],
  designer: [opus, sonnet, 'omp'],
  fixer: [sonnet, opus, 'omp'],
  tester: [HY4_FREE, haiku, sonnet, 'omp'],
  writer: [DS_OPENCODE, haiku, sonnet, 'omp'],
  reviewer: [opus, sonnet, 'omp'],
  scout: [HY4_FREE, haiku, sonnet, 'omp'],
  researcher: { runs: 'subagent', chain: [haiku, sonnet] },
}))(CLAUDE_DEFAULTS);
export function defaultRoles(available = ['claude', 'omp', 'pi', 'opencode', 'codex'].filter(which)) {
  if (!available.length) return {};
  if (!available.includes('claude')) {
    const [a, b = a] = available;
    const r = (use, fallback = [b]) => ({ use, fallback });
    return { engineer: r([a]), designer: r([a]), fixer: r([a]), tester: r([a]), writer: r([a]), reviewer: r([a]), scout: r([a]), researcher: { runs: 'subagent', use: [a], fallback: [a] } };
  }
  const out = {};
  for (const [role, spec] of Object.entries(DEFAULT_ROUTES)) {
    const chain = (Array.isArray(spec) ? spec : spec.chain).filter((t) => available.includes(parseCandidate(t).agent));
    const [use, ...fallback] = chain;
    out[role] = { ...(spec.runs ? { runs: spec.runs } : {}), use: [use], fallback: fallback.length ? fallback : [CLAUDE_DEFAULTS.sonnet === use ? CLAUDE_DEFAULTS.opus : CLAUDE_DEFAULTS.sonnet] };
  }
  return out;
}
// Only roles the project saved are validated strictly; defaults adapt to the machine.
export const savedRouting = (routing) => ({ ...routing, roles: Object.fromEntries(Object.entries(routing.roles ?? {}).filter(([n]) => !(routing.defaults ?? []).includes(n))) });

const cachePath = (droot) => path.join(droot, DESK, '.routing-cache.json');
export function catalogs(droot, { refresh = false, agents = Object.keys(AGENTS) } = {}) {
  const cache = readJson(cachePath(droot), {}) ?? {};
  const out = {};
  let changed = false;
  for (const name of agents) {
    const cat = AGENTS[name]?.catalog;
    if (!cat) continue;
    const hit = cache[name];
    if (hit && !refresh && Date.now() - hit.at < 6 * 3600e3) {
      out[name] = hit;
      continue;
    }
    if (!which(cat[0])) {
      out[name] = { at: Date.now(), models: null, error: `${cat[0]} not installed` };
      continue;
    }
    const r = spawnSync(cat[0], cat[1], { encoding: 'utf8', timeout: 60000, input: '' });
    const parsed = r.status ? { models: null, error: `${cat.flat().join(' ')}: exit ${r.status}` } : parseCatalog(name, r.stdout ?? '');
    out[name] = cache[name] = { at: Date.now(), ...parsed };
    changed = true;
  }
  if (changed)
    try {
      writeAtomic(cachePath(droot), JSON.stringify(cache) + '\n');
    } catch {
    }
  return out;
}

// One agent's model list → { models: { "provider/id": [efforts] }, error }.
export function parseCatalog(name, stdout) {
  const text = stdout.replace(/\x1b\[[0-9;]*m/g, '');
  if (name === 'omp') {
    try {
      return { models: Object.fromEntries((JSON.parse(text).models ?? []).map((m) => [`${m.provider}/${m.id}`, m.thinking ?? []])), error: null };
    } catch {
      return { models: null, error: 'omp models: not JSON' };
    }
  }
  if (name === 'pi') {
    if (/No models available/i.test(text)) return { models: null, error: 'pi: no provider logged in (pi /login)' };
    const rows = text.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 5 && p[0] !== 'provider' && /^[\w.-]+$/.test(p[0]));
    return { models: Object.fromEntries(rows.map((p) => [`${p[0]}/${p[1]}`, p[4] === 'yes' ? PI_EFFORTS : []])), error: null };
  }
  return { models: Object.fromEntries(text.split('\n').map((l) => l.trim()).filter((l) => l.includes('/') && !l.includes(' ')).map((l) => [l, []])), error: null };
}

const glob = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
export function routingErrors(routing, cats = {}, verified = verifiedOf(routing)) {
  const errs = [];
  const deny = (routing.deny ?? []).map(glob);
  const effortOf = new Map();
  for (const [name, r] of Object.entries(routing.roles ?? {})) {
    const where = `role ${name}`;
    if (r.runs && !['lead', 'subagent'].includes(r.runs)) errs.push(`${where}: runs must be lead or subagent`);
    for (const key of ['use', 'fallback']) if (!r[key]?.length) errs.push(`${where}: ${key} needs at least one candidate`);
    for (const key of ['use', 'fallback', 'escalate'])
      for (const raw of r[key] ?? []) {
        const c = parseCandidate(raw);
        const at = `${where}.${key} "${c.text}"`;
        if (c.bad) {
          errs.push(`${at}: ${c.bad}`);
          continue;
        }
        if (c.lead) {
          if (key === 'use') errs.push(`${at}: "orchestrator" only in fallback or escalate`);
          continue;
        }
        const rule = AGENTS[c.agent];
        if (!rule) {
          errs.push(`${at}: unknown agent ${c.agent} (one of ${Object.keys(AGENTS).join(', ')})`);
          continue;
        }
        if (c.model && deny.some((re) => re.test(c.model))) errs.push(`${at}: model matches deny ${JSON.stringify(routing.deny)}`);
        const k = `${c.agent}:${c.model ?? ''}`;
        if (effortOf.has(k) && effortOf.get(k) !== c.effort) errs.push(`${at}: ${k} already used ${effortOf.get(k) ? `with @${effortOf.get(k)}` : 'without an effort'}; one model keeps one effort`);
        effortOf.set(k, c.effort);
        if (c.effort && !c.model && rule.effort) errs.push(`${at}: an effort needs a model (Orca: --effort requires --model)`);
        if (c.effort && !rule.effort) errs.push(`${at}: ${c.agent} takes no effort`);
        if (c.agent === 'claude' && c.effort && !CLAUDE_EFFORTS.includes(c.effort)) errs.push(`${at}: claude effort is one of ${CLAUDE_EFFORTS.join('/')}`);
        if (c.agent === 'pi' && c.effort && !PI_EFFORTS.includes(c.effort)) errs.push(`${at}: pi effort is one of ${PI_EFFORTS.join('/')}`);
        if (c.agent === 'opencode' && c.effort && !OPENCODE_EFFORTS.includes(c.effort)) errs.push(`${at}: opencode variant is one of ${OPENCODE_EFFORTS.join('/')}`);
        const cat = cats[c.agent];
        if (c.model && cat?.models && !verified.has(c.text)) {
          if (!(c.model in cat.models)) errs.push(`${at}: ${c.model} is not in ${c.agent}'s model list`);
          else if (c.effort && rule.effort === 'suffix' && !cat.models[c.model].includes(c.effort)) errs.push(`${at}: ${c.model} takes thinking levels ${JSON.stringify(cat.models[c.model])}`);
          else if (c.effort && c.agent === 'pi' && !cat.models[c.model].length) errs.push(`${at}: ${c.model} has no thinking levels`);
        }
      }
  }
  return errs;
}

export function route(droot, team, role, { fails = 0, prefer = null, exclude = [], terminal = null, worktree = 'current', level = null } = {}) {
  const routing = team.routing ?? {};
  const r = routing.roles?.[role];
  if (!r) return { kind: 'ERROR', detail: `no routing for role ${role} (roles: ${Object.keys(routing.roles ?? {}).join(', ') || 'none — no agent CLI found; install one or set routing in .desk/team.json'})` };
  if (r.runs === 'lead') return { kind: 'ERROR', detail: `${role} runs as the lead session; it is never dispatched` };
  if (level === 'L4') return { kind: 'ERROR', l4: true, detail: 'unsliced L4 work: write the plan, split it (`split`), then dispatch the slices as L3 tasks' };
  const strict = savedRouting(routing);
  const isDefault = (routing.defaults ?? []).includes(role);
  const cats = catalogs(droot, { agents: modelAgents([...Object.values(strict.roles), r].flatMap((x) => [...(x.use ?? []), ...(x.fallback ?? []), ...(x.escalate ?? [])])) });
  const errs = routingErrors(strict, cats);
  const pings = pingCache(droot);
  if (errs.length) return { kind: 'ERROR', detail: `routing in .desk/team.json is invalid: ${errs.join('; ')}` };
  let chain = [...(r.use ?? []), ...(r.fallback ?? [])];
  if (fails >= 2) chain = [...(r.escalate ?? []), ...chain];
  if (prefer) chain = [prefer, ...chain];
  const skipped = [];
  for (const text of [...new Set(chain)]) {
    const c = parseCandidate(text);
    if (c.lead) return { kind: 'LEAD', cand: c, skipped, detail: 'stop delegating: read the failure and the diff yourself, or ask the user' };
    if (exclude.includes(c.text) || (c.model && exclude.includes(c.model))) {
      skipped.push(`${c.text}: launch failed earlier`);
      continue;
    }
    const cat = cats[c.agent];
    const verified = verifiedOf(routing).has(c.text) || pings[c.text]?.ok;
    if (c.model && cat && cat.models == null && cat.error && !verified) {
      skipped.push(`${c.text}: ${cat.error}`);
      continue;
    }
    if (isDefault && c.model && cat?.models && !(c.model in cat.models) && !verified) {
      skipped.push(`${c.text}: not in ${c.agent}'s model list (default routing)`);
      continue;
    }
    if (pings[c.text] && !pings[c.text].ok) {
      skipped.push(`${c.text}: ping failed — ${pings[c.text].err}`);
      continue;
    }
    if (r.runs === 'subagent') return { kind: 'SUBAGENT', cand: c, skipped, escalated: fails >= 2 };
    if (terminal) return { kind: 'REUSE', cand: c, skipped, args: ['--terminal', terminal], warning: 'a reused terminal keeps its model' };
    if (worktree === 'new-child' && !AGENTS[c.agent].newChild) {
      skipped.push(`${c.text}: ${c.agent} selects a model only in an existing worktree`);
      continue;
    }
    return { kind: 'WORKER', cand: c, skipped, args: launchArgs(c), escalated: fails >= 2 };
  }
  return { kind: 'ERROR', detail: `no usable candidate for ${role}: ${skipped.join('; ')}`, skipped };
}
export function launchArgs(c) {
  const rule = AGENTS[c.agent]?.effort;
  const out = ['--agent', c.agent];
  if (c.model) out.push('--model', c.effort && rule === 'suffix' ? `${c.model}:${c.effort}` : c.effort && rule === 'hash' ? `${c.model}#${c.effort}` : c.model);
  if (c.model && c.effort && rule === 'flag') out.push('--effort', c.effort);
  return out;
}

const modelAgents = (list) => [...new Set(list.map(parseCandidate).filter((c) => c.model).map((c) => c.agent))];
const verifiedOf = (routing) => new Set(Object.values(routing.roles ?? {}).flatMap((r) => r.learned?.verified ?? []));

// ---- ping-pong: prove a candidate answers before routing keeps it ----
const PING_TTL = 7 * 24 * 3600e3;
const PING_PROMPT = 'Reply with exactly: PONG';
const pingCache = (droot) => {
  const pings = (readJson(cachePath(droot), {}) ?? {}).pings ?? {};
  return Object.fromEntries(Object.entries(pings).filter(([, p]) => Date.now() - p.at < PING_TTL));
};
export function pingCommand(c) {
  const m = c.model;
  const e = c.effort;
  const P = PING_PROMPT;
  if (c.agent === 'claude') return ['claude', ['-p', ...(m ? ['--model', m] : []), ...(e ? ['--effort', e] : []), P]];
  if (c.agent === 'omp') return ['omp', ['-p', ...(m ? ['--model', e ? `${m}:${e}` : m] : []), '--max-cost', '0.05', P]];
  if (c.agent === 'pi') return ['pi', ['-p', ...(m ? ['--model', m] : []), ...(e ? ['--thinking', e] : []), P]];
  if (c.agent === 'opencode') return ['opencode', ['run', '--archived', ...(m ? ['--model', e ? `${m}#${e}` : m] : []), P]];
  if (c.agent === 'codex') return ['codex', ['exec', ...(m ? ['-m', m] : []), ...(e ? ['-c', `model_reasoning_effort=${e}`] : []), P]];
  return null;
}
// A candidate needs a ping when the model list cannot vouch for it: no list (claude, codex), not in the list,
// a list that failed, or an effort the list cannot check (opencode variants, pi thinking).
export function needsPing(c, cats = {}) {
  if (c.lead || c.bad || !c.model) return false;
  const models = cats[c.agent]?.models;
  if (!models || !(c.model in models)) return true;
  return !!c.effort && (c.agent === 'opencode' || c.agent === 'pi');
}
export function pingCandidate(droot, text, { reping = false } = {}) {
  const c = parseCandidate(text);
  const cached = pingCache(droot)[c.text];
  if (cached && !reping) return { ...cached, cached: true };
  const cmd = pingCommand(c);
  let res;
  if (!cmd) res = { ok: false, err: `no ping command for ${c.agent}` };
  else {
    const fake = process.env.AGENTKIT_PING;
    const [bin, args] = fake ? [fake, [cmd[0], ...cmd[1]]] : cmd;
    if (!fake && !which(bin)) res = { ok: false, err: `${bin} not installed` };
    else {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'agentkit-ping-'));
      const r = spawnSync(bin, args, { cwd, encoding: 'utf8', timeout: 120000, input: '', shell: process.platform === 'win32' });
      fs.rmSync(cwd, { recursive: true, force: true });
      const outText = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
      const lines = outText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (r.error?.code === 'ETIMEDOUT') res = { ok: false, err: 'no answer in 120s' };
      else if (!r.status && /\bPONG\b/.test(r.stdout ?? '')) res = { ok: true, err: null };
      else res = { ok: false, err: (outText.match(/"message":"([^"]+)"/)?.[1] ?? lines.find((l) => /error|unavailable|not found|invalid|unknown|denied|no route|not supported/i.test(l)) ?? lines.at(-1) ?? `exit ${r.status}`).slice(0, 300) };
    }
  }
  const cache = readJson(cachePath(droot), {}) ?? {};
  cache.pings = { ...(cache.pings ?? {}), [c.text]: { ...res, at: Date.now() } };
  try {
    writeAtomic(cachePath(droot), JSON.stringify(cache) + '\n');
  } catch {
  }
  return res;
}

// ---- learning: what the user names for a role is saved to .desk/team.json ----
const keyOf = (t) => {
  const c = parseCandidate(t);
  return c.model ? `${c.agent}:${c.model}` : t;
};
function providerError(text, cats) {
  const c = parseCandidate(text);
  if (c.bad) return c.bad;
  if (c.lead || !c.model || !AGENTS[c.agent]?.providers) return null;
  const models = Object.keys(cats[c.agent]?.models ?? {});
  const id = c.model.includes('/') ? c.model.slice(c.model.indexOf('/') + 1) : c.model;
  const like = models.filter((m) => m.slice(m.indexOf('/') + 1) === id);
  if (!c.model.includes('/')) return `${c.agent} needs provider/model${like.length ? ` — did you mean ${like.map((m) => candText(c.agent, m, c.effort)).join(' or ')}?` : ''}`;
  if (models.length && !models.includes(c.model) && like.length) return `${c.model} is not in ${c.agent}'s list — did you mean ${like.map((m) => candText(c.agent, m, c.effort)).join(' or ')}?`;
  return null;
}
// use/fallback/escalate: arrays the user named (any may be omitted). Returns { saved, role, entry, notes, errors }.
export function learnRoute(droot, role, { use, fallback, escalate, from = 'user', reping = false, onPing = () => {} } = {}) {
  if (!ROLES.includes(role) || role === 'lead') throw new Error(`role must be one of ${ROLES.filter((r) => r !== 'lead').join(', ')}`);
  if (!use?.length && !fallback?.length && !escalate?.length) throw new Error('name at least one of --use, --fallback, --escalate');
  const team = loadTeam(droot);
  const isDefault = team.routing.defaults.includes(role);
  const cur = team.routing.roles[role] ?? { use: [], fallback: [] };
  if (use?.length && !fallback && !escalate && !isDefault && cur.use?.[0] === use[0] && cur.use.length === use.length) return { saved: false, unchanged: true, role, notes: [], errors: [] };
  const { learned: _l, ...next } = cur;
  if (use?.length) {
    const keys = new Set(use.map(keyOf));
    next.use = use;
    if (!fallback) next.fallback = [...new Set([...(cur.use ?? []), ...(cur.fallback ?? [])])].filter((t) => !keys.has(keyOf(t)));
  }
  if (fallback) next.fallback = fallback;
  if (escalate) next.escalate = escalate;
  if (!next.fallback?.length) {
    const keys = new Set(next.use.map(keyOf));
    const d = defaultRoles()[role] ?? {};
    next.fallback = [...new Set([...(d.use ?? []), ...(d.fallback ?? [])])].filter((t) => !keys.has(keyOf(t)));
  }
  const named = [...new Set([...(use ?? []), ...(fallback ?? []), ...(escalate ?? [])])];
  const cats = catalogs(droot, { agents: modelAgents([...named, ...next.use, ...next.fallback, ...(next.escalate ?? [])]) });
  const errors = named.map((t) => [t, providerError(t, cats)]).filter(([, e]) => e).map(([t, e]) => `"${t}": ${e}`);
  if (errors.length) return { saved: false, role, notes: [], errors };
  const notes = [];
  const verified = new Set((cur.learned?.verified ?? []).filter((t) => [...next.use, ...next.fallback, ...(next.escalate ?? [])].includes(t)));
  for (const t of named) {
    const c = parseCandidate(t);
    if (!needsPing(c, cats) || verified.has(t)) continue;
    onPing(t);
    const p = pingCandidate(droot, t, { reping });
    if (!p.ok) errors.push(`"${t}": ping failed — ${p.err}`);
    else {
      verified.add(t);
      notes.push(`${t}: ping ok${p.cached ? ' (cached)' : ''}`);
    }
  }
  if (errors.length) return { saved: false, role, notes, errors };
  const raw = readJson(teamPath(droot), {}) ?? {};
  const savedRoles = { ...(raw.routing?.roles ?? {}) };
  // The user's latest word wins: a saved role using the same agent:model with another effort follows it.
  const want = new Map(named.map(parseCandidate).filter((c) => c.model).map((c) => [`${c.agent}:${c.model}`, c.text]));
  for (const [name, r] of Object.entries(savedRoles)) {
    if (name === role) continue;
    let moved = false;
    const fix = (list) => list && [...new Set(list.map((t) => {
      const w = want.get(keyOf(t));
      if (!w || w === t) return t;
      moved = true;
      return w;
    }))];
    const nr = { ...r, use: fix(r.use), fallback: fix(r.fallback), ...(r.escalate ? { escalate: fix(r.escalate) } : {}) };
    if (moved) {
      savedRoles[name] = nr;
      notes.push(`${name} now uses the same effort: ${[...nr.use, ...nr.fallback].filter((t) => [...want.values()].includes(t)).join(', ')}`);
    }
  }
  const entry = { ...next, learned: { at: nowIso(), from, ...(verified.size ? { verified: [...verified] } : {}) } };
  savedRoles[role] = entry;
  const merged = mergeRouting({ ...TEAM_DEFAULTS.routing, ...(raw.routing ?? {}), roles: savedRoles });
  const errs = routingErrors(savedRouting(merged), cats);
  if (errs.length) return { saved: false, role, notes, errors: errs };
  raw.routing = { ...(raw.routing ?? {}), roles: savedRoles };
  delete raw.routing.generated;
  writeAtomic(teamPath(droot), JSON.stringify(raw, null, 2) + '\n');
  return { saved: true, role, entry, notes, errors: [] };
}

export const plansDir = (droot, team) => path.join(droot, team.plansDir ?? '.desk/plans');
export function planFile(droot, team, slug) {
  if (!slug) return null;
  const d = plansDir(droot, team);
  let files = [];
  try {
    files = fs.readdirSync(d).filter((f) => f.endsWith('.md') && (f === `${slug}.md` || f.endsWith(`-${slug}.md`)));
  } catch {
    return null;
  }
  return files.length ? path.join(d, files.sort().at(-1)) : null;
}
export function newPlan(droot, team, slug, { goal = '', files = '' } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('plan slug: lowercase letters, digits and dashes (e.g. login-screen)');
  const existing = planFile(droot, team, slug);
  if (existing) return { file: existing, created: false };
  const file = path.join(plansDir(droot, team), `${today().replace(/-/g, '')}-${slug}.md`);
  writeAtomic(
    file,
    `# Plan: ${slug}\n\n- Status: planned\n- Branch: plan/${slug} · worktree plan-${slug}\n\n## Goal\n${goal || '<what is true when this plan is done>'}\n\n## Decisions\n- <decision — why>\n\n## Signatures\n<types, functions, endpoints other lanes rely on; fixed once work starts>\n\n## Order\n- [ ] 1. <step> — files: ${files || '<owned files>'}\n\n## Constraints\n- <rules from the profession pack / project that matter here>\n\n## Done criteria\n- <build green> · <tests that must pass> · <what the user sees>\n`,
  );
  return { file, created: true };
}

function worktreeList(root) {
  const out = [];
  let cur = null;
  for (const l of (git(root, ['worktree', 'list', '--porcelain']) ?? '').split('\n')) {
    if (l.startsWith('worktree ')) out.push((cur = { path: l.slice(9) }));
    else if (cur && l.startsWith('branch ')) cur.branch = l.slice(7).replace('refs/heads/', '');
  }
  return out;
}
export const planWorktrees = (root) => Object.fromEntries(worktreeList(root).filter((w) => w.branch?.startsWith('plan/')).map((w) => [w.branch.slice(5), w.path]));
const planBranches = (root) => (git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/plan/']) ?? '').split('\n').filter(Boolean).map((b) => b.slice(5));
const merged = (root, slug, main) => git(root, ['merge-base', '--is-ancestor', `plan/${slug}`, main]) != null;

export function planState(droot, team, slug, desk, wts = planWorktrees(mainRoot(droot))) {
  const root = mainRoot(droot);
  const ts = tasks(desk).filter((t) => t.plan === slug);
  const open = ts.filter((t) => TASK_OPEN.includes(t.status));
  const running = ts.filter((t) => t.status === 'doing' && !isLead(t));
  const [behind = '?', ahead = '?'] = (git(root, ['rev-list', '--left-right', '--count', `${team.mainBranch}...plan/${slug}`]) ?? '').split(/\s+/);
  const p = wts[slug];
  const base = { slug, path: p ?? null, ahead, behind, tasks: ts.length, open: open.length };
  if (!p) {
    if (merged(root, slug, team.mainBranch)) return { ...base, state: 'MERGED', todo: 'tidy deletes the branch' };
    return { ...base, state: 'PARKED', todo: open.length ? `wt open ${slug} before dispatching ${open.map((t) => t.id).join(', ')}` : 'all tasks closed — merge gate, or wt drop --yes' };
  }
  if (running.length) return { ...base, state: 'ACTIVE', todo: `${running.length} worker(s) running — wait for their reports (end your turn)` };
  if (open.length) return { ...base, state: 'WAITING', todo: 'open: ' + open.map((t) => `${t.id} ${t.status}`).join(', ') };
  const dirty = (git(p, ['status', '--porcelain']) ?? '').split('\n').filter(Boolean).length;
  if (dirty) return { ...base, state: 'DIRTY', todo: `${dirty} uncommitted file(s), no open task — inspect, commit or drop` };
  if (ahead === '0') return { ...base, state: 'EMPTY', todo: 'nothing to merge — tidy closes it' };
  return { ...base, state: 'READY', todo: `gate ${slug}; merge only if the user agreed, then wt close ${slug} (or park)` };
}

export function wtStatus(droot, team) {
  const root = mainRoot(droot);
  const desk = load(droot);
  const wts = planWorktrees(root);
  return [...new Set([...Object.keys(wts), ...planBranches(root)])].sort().map((s) => planState(droot, team, s, desk, wts));
}

function closeTerminals(wtPath) {
  orca(['terminal', 'close', '--worktree', `path:${wtPath}`, '--all']);
}
function removeWorktree(root, wtPath) {
  closeTerminals(wtPath);
  const r = orca(['worktree', 'rm', '--worktree', `path:${wtPath}`, '--force']);
  if (!r.ok) git(root, ['worktree', 'remove', '--force', wtPath]);
  for (let i = 0; i < 60 && fs.existsSync(wtPath); i++) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']);
  if (fs.existsSync(wtPath)) throw new Error(`${wtPath} is still being deleted; rerun later`);
  git(root, ['worktree', 'prune']);
}
function guardPlan(droot, slug, wtPath, { dirtyOk = false } = {}) {
  const running = tasks(load(droot)).filter((t) => t.plan === slug && t.status === 'doing' && !isLead(t));
  if (running.length) throw new Error(`plan ${slug} has running tasks: ${running.map((t) => t.id).join(', ')} — wait for their reports`);
  if (wtPath && !dirtyOk && git(wtPath, ['status', '--porcelain'])) throw new Error(`uncommitted changes in ${wtPath}; commit them, or drop the plan`);
}

export function wtOpen(droot, team, slug, { base = null } = {}) {
  const root = mainRoot(droot);
  const wts = planWorktrees(root);
  if (wts[slug]) return { path: wts[slug], existed: true };
  if (Object.keys(wts).length >= Number(team.maxPlanWorktrees)) throw new Error(`${Object.keys(wts).length} plan worktrees open (max ${team.maxPlanWorktrees}); park or close one first (wt status)`);
  if (!planFile(droot, team, slug)) throw new Error(`no plan file for ${slug}; write it first (\`plan ${slug} --goal "…"\`) and commit it`);
  const branch = `plan/${slug}`;
  const reopen = git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) != null;
  const from = reopen ? branch : base || team.mainBranch;
  const want = git(root, ['rev-parse', from]);
  if (!want) throw new Error(`unknown base ${from}`);
  const r = orca(['worktree', 'create', '--name', `plan-${slug}`, '--branch', branch, '--base-branch', from, '--repo', `path:${root}`, '--setup', 'skip']);
  if (!r.ok) throw new Error(`orca worktree create: ${r.err}`);
  const p = planWorktrees(root)[slug];
  if (!p) throw new Error(`Orca created no worktree on ${branch}; check \`orca worktree list\``);
  closeTerminals(p);
  const head = git(p, ['rev-parse', 'HEAD']);
  if (head !== want) throw new Error(`${p} is at ${head?.slice(0, 9)}, expected ${from} @ ${want.slice(0, 9)}`);
  return { path: p, reopened: reopen, head };
}
export function wtPark(droot, slug) {
  const root = mainRoot(droot);
  const p = planWorktrees(root)[slug];
  if (!p) throw new Error(`no worktree on plan/${slug}`);
  guardPlan(droot, slug, p);
  const sha = git(root, ['rev-parse', `plan/${slug}`]);
  removeWorktree(root, p);
  if (git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/plan/${slug}`]) == null) git(root, ['branch', `plan/${slug}`, sha]);
  return { sha };
}
export function wtClose(droot, team, slug) {
  const root = mainRoot(droot);
  if (!merged(root, slug, team.mainBranch)) throw new Error(`plan/${slug} is not merged into ${team.mainBranch}; merge it, park it, or drop it --yes`);
  const p = planWorktrees(root)[slug];
  if (p) guardPlan(droot, slug, p), removeWorktree(root, p);
  git(root, ['branch', '-D', `plan/${slug}`]);
  return {};
}
export function wtDrop(droot, slug, { yes } = {}) {
  if (!yes) throw new Error(`drop discards plan/${slug}'s unmerged work; pass --yes only after the user agreed`);
  const root = mainRoot(droot);
  const p = planWorktrees(root)[slug];
  guardPlan(droot, slug, p, { dirtyOk: true });
  const sha = git(root, ['rev-parse', `plan/${slug}`]);
  if (p) removeWorktree(root, p);
  git(root, ['branch', '-D', `plan/${slug}`]);
  return { sha };
}
export function wtTidy(droot, team, { dryRun = false } = {}) {
  const root = mainRoot(droot);
  const acts = [];
  for (const s of wtStatus(droot, team)) {
    if (s.state === 'EMPTY') {
      acts.push(`plan/${s.slug}: empty → remove worktree and branch`);
      if (!dryRun) removeWorktree(root, s.path), git(root, ['branch', '-D', `plan/${s.slug}`]);
    } else if (s.state === 'MERGED') {
      acts.push(`plan/${s.slug}: merged → delete branch`);
      if (!dryRun) git(root, ['branch', '-D', `plan/${s.slug}`]);
    }
  }
  return acts;
}

export function gate(droot, team, slug) {
  const root = mainRoot(droot);
  const desk = load(droot);
  const checks = [];
  const add = (ok, text) => checks.push({ ok, text });
  const ts = tasks(desk).filter((t) => t.plan === slug);
  const open = ts.filter((t) => !TASK_CLOSED.includes(t.status));
  add(ts.length > 0 && !open.length, open.length ? `open tasks: ${open.map((t) => `${t.id} ${t.status}`).join(', ')}` : `all ${ts.length} task(s) of the plan are closed`);
  const head = git(root, ['rev-parse', `plan/${slug}`]);
  if (!head && ts.length && !open.length && !ts.some((t) => t.status === 'failed'))
    return { checks: [...checks, { ok: true, text: `plan/${slug} is already merged and closed (branch removed)` }], pass: true, manual: [] };
  add(!!head, head ? `branch plan/${slug} @ ${head.slice(0, 9)}` : `no branch plan/${slug}`);
  const headTime = Number(git(root, ['log', '-1', '--format=%ct', `plan/${slug}`]) ?? 0) * 1000;
  const testers = ts.filter((t) => t.role === 'tester' && t.status === 'done');
  const tested = testers.find((t) => (t.sha && head?.startsWith(t.sha)) || (t.proof ?? '').includes(head?.slice(0, 7) ?? '#') || Date.parse(t.history?.at(-1)?.at ?? 0) >= headTime);
  add(!!tested || !team.test.command, tested ? `tester ${tested.id} green on the current HEAD` : team.test.command ? 'no green tester report on the current HEAD — dispatch a tester' : 'no test command in team.json (gate skipped)');
  const contains = head && git(root, ['merge-base', '--is-ancestor', team.mainBranch, `plan/${slug}`]) != null;
  const aheadFiles = head && !contains ? (git(root, ['log', `plan/${slug}..${team.mainBranch}`, '--name-only', '--format=']) ?? '').split('\n').filter(Boolean) : [];
  const deskOnly = !contains && aheadFiles.length > 0 && aheadFiles.every((f) => f.startsWith(DESK + '/'));
  add(contains || deskOnly, contains ? `plan/${slug} contains ${team.mainBranch} (rebased)` : deskOnly ? `${team.mainBranch} is ahead only by desk bookkeeping (.desk/) — no rebase or retest needed` : `plan/${slug} is behind ${team.mainBranch} by code changes — rebase, then retest`);
  const wt = planWorktrees(root)[slug];
  add(!wt || !git(wt, ['status', '--porcelain']), wt ? 'worktree clean' : 'no worktree (parked)');
  const failed = ts.filter((t) => t.status === 'failed');
  add(!failed.length, failed.length ? `failed tasks: ${failed.map((t) => t.id).join(', ')} (cancel with a note or fix)` : 'no failed task');
  return { checks, pass: checks.every((c) => c.ok), manual: [`read \`git diff ${team.mainBranch}...plan/${slug}\` against the plan; record every deviation`, 'merge only when the user asked for merges (git merge --no-ff plan/' + slug + ')', 'after merging: wt close ' + slug] };
}

export function conflicts(desk, team, t) {
  const out = [];
  const mine = new Set(t.files ?? []);
  for (const x of tasks(desk, 'todo', 'doing', 'review', 'waiting')) {
    if (x.id === t.id) continue;
    if (x.status === 'todo' && ((x.deps ?? []).includes(t.id) || (t.deps ?? []).includes(x.id))) continue;
    const shared = (x.files ?? []).filter((f) => mine.has(f));
    if (shared.length) out.push(`${x.id} (${x.status}) also owns ${shared.join(', ')}`);
  }
  if (t.role !== 'lead') for (const f of mine) if ((team.leadFiles ?? []).some((s) => f.endsWith(s))) out.push(`${f} is lead-owned (team.json leadFiles)`);
  return out;
}

const ROLE_BRIEF = {
  engineer: 'You code and build; you never run the test command (the tester owns testing). Implement exactly what the task and plan say; Signatures and Decisions are fixed — if one is wrong, ask instead of changing it.',
  designer: 'You build UI and layout, build, and commit. Same limits as an engineer.',
  tester: 'You only run tests and report; never edit, commit or fix anything, never reset the test environment. Stop at the first rung with a real failure. Report per failing test: id, first failure with file:line, rerun command, class guess 1–4 (environment / local defect / design gap / not this plan). Finish with `done --no-commit`, succeeded only if every rung is green; include the sha you tested.',
  fixer: 'One failure to fix, nothing else: reproduce it with a test where the logic allows, fix the cause inside your files, build, commit "<plan>: fix <test id>". You do not run the test command. A fix that needs a signature, behaviour or copy change is the lead\'s decision: ask.',
  writer: 'Apply the decided documentation or string changes, nothing else. Keep keys, order, format and format specifiers exactly. Never edit code.',
  reviewer: 'Read-only review of the diff against the plan and the project rules. Report findings as file:line, rule, what is wrong, evidence. No edits; finish with `done --no-commit`.',
  researcher: 'Read and survey; report findings with file:line evidence. No edits; finish with `done --no-commit`.',
  scout: 'Scout ahead of the plan: map the files, entry points, commands and risks the task will touch, read excerpts not whole trees, and report a short map with file:line evidence plus open questions. No edits; finish with `done --no-commit`.',
  lead: 'You lead this plan: split it into sub-tasks (title | role | level | owned files | deps) and propose them with one `ask`; review your peers\' commits; triage test failures; finish with `done` carrying "merge-ready <HEAD sha>". Never dispatch, merge, push or edit lead-owned files yourself.',
};
export function specFor(droot, team, t, wt) {
  const plan = planFile(droot, team, t.plan);
  const L = [
    `ROLE: ${t.role ?? 'engineer'} for task ${t.id}${t.plan ? ` of plan ${t.plan}` : ''}.`,
    `Task: ${t.text}`,
    t.done ? `Done when: ${t.done}` : null,
    plan ? `Plan: ${path.relative(mainRoot(droot), plan)} (read it first; follow its Constraints).` : null,
    t.files?.length ? `You own only: ${t.files.join(', ')}. Do not edit other files.` : null,
    `Work only in this worktree: ${wt}. Never cd into the main checkout or another worktree.`,
    team.build ? `Build with: ${team.build} (from the worktree root). Build after each step and fix errors before the next.` : null,
    (team.leadFiles ?? []).length ? `Never edit lead-owned files (${team.leadFiles.join(', ')}); if one needs a change, ask.` : null,
    ROLE_BRIEF[t.role ?? 'engineer'] ?? ROLE_BRIEF.engineer,
    !['tester', 'reviewer', 'researcher', 'scout'].includes(t.role ?? 'engineer') ? 'Commit when the build is green: "<plan or task>: <what>". Do not push.' : null,
    team.test.exclusive && t.role === 'tester' ? `Exclusive resource ${team.test.exclusive}: before the first test run, \`lease acquire --holder ${t.id}\` (commands below); refused → ask the lead. Release it right before done.` : null,
    t.role === 'tester' && team.test.command ? `Test with: ${team.test.command}` : null,
    'Before each new file and after every build, run the `inbox` command below. On PAUSE: commit "wip: …", `ask "Paused at <step>"`, end your turn. RESUME → continue; REBASE <ref> then RESUME → rebase, build, continue; ABORT → `done --outcome failed`.',
  ];
  return L.filter(Boolean).join('\n');
}
function footer(droot, t) {
  const w = `node "${path.join(mainRoot(droot), '.agentkit', 'desk.mjs')}" worker ${t.id}`;
  return `\n\nREPORT — only with these commands, from your worktree; never call \`orca orchestration\`, never wait or poll:\n  ${w} status "<one line>"      (at start and milestones)\n  ${w} ask "<question>"         then END YOUR TURN; Orca wakes you with the answer\n  ${w} escalate "<why blocked>"\n  ${w} inbox                     (read PAUSE / RESUME / REBASE / ABORT)\n  ${w} lease acquire|release     (tester, exclusive resource)\n  ${w} done --outcome succeeded|failed --summary "<what, sha, files, build/test status line>" [--no-commit]\n  done is final and checks that you committed only your files since dispatch.\n`;
}

export function allowTeam(droot, quote) {
  if (!quote) throw new Error('team allow needs --quote "<the user\'s words agreeing to start workers>"');
  const s = readState(droot);
  s.teamAllowed = { at: nowIso(), quote: String(quote).slice(0, 300), session: s.session };
  writeState(droot, s);
  return s.teamAllowed;
}

export function dispatch(droot, id, o = {}) {
  const team = loadTeam(droot);
  const root = mainRoot(droot);
  if (!orcaAvailable()) throw new Error('the `orca` CLI is not installed; workers need Orca (https://github.com/stablyai/orca). Work solo or with subagents instead.');
  const state = readState(droot);
  if (!state.teamAllowed && !o.dryRun) throw new Error('first worker of this session: ask the user in one sentence (what, how many workers, why), then `team allow --quote "<their yes>"`');
  let desk = load(droot);
  const t = find(desk, id, 'task');
  if (!['todo', 'waiting', 'inbox'].includes(t.status)) throw new Error(`${t.id} is ${t.status}; dispatch needs todo (resume it for a retry)`);
  const role = o.role || t.role || 'engineer';
  if (!ROLES.includes(role)) throw new Error(`role must be one of ${ROLES.join(', ')}`);
  if (t.plan && !planFile(droot, team, t.plan)) throw new Error(`plan ${t.plan} has no file in ${team.plansDir}/ (\`plan ${t.plan} --goal …\`)`);
  const open = depsOpen(droot, desk, t);
  const issues = conflicts(desk, team, { ...t, role });
  if ((open.length || issues.length) && !o.force) throw new Error([open.length && `deps not done: ${open.join(', ')}`, ...issues].filter(Boolean).join('; ') + ' (--force to dispatch anyway)');
  const busy = tasks(desk, 'doing').filter((x) => x.executor === 'orca');
  if (busy.length >= Number(team.maxWorkers) && !o.terminal && !o.force) throw new Error(`${busy.length} workers running (maxWorkers ${team.maxWorkers}); reuse one with --terminal or wait for a report`);
  let worktree = o.worktree;
  if (!worktree) {
    const wt = t.plan && planWorktrees(root)[t.plan];
    if (wt) worktree = `path:${wt}`;
    else if (t.plan && git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/plan/${t.plan}`]) != null) throw new Error(`plan ${t.plan} is parked: \`wt open ${t.plan}\` first`);
    else worktree = `path:${root}`;
  }
  const wtDir = worktree.startsWith('path:') ? worktree.slice(5) : root;
  if (!fs.existsSync(wtDir)) throw new Error(`worktree ${wtDir} does not exist (wt status)`);
  const base = git(wtDir, ['rev-parse', 'HEAD']);
  if (!base) throw new Error(`cannot read HEAD of ${wtDir} (is it a git checkout with a commit?)`);
  const specDir = path.join(plansDir(droot, team), 'specs');
  const spec = o.spec ? path.resolve(o.spec) : path.join(specDir, `${t.id}.md`);
  if (!fs.existsSync(spec)) writeAtomic(spec, specFor(droot, team, { ...t, role }, wtDir) + '\n');
  const sent = spec.replace(/\.md$/, '') + '.sent.md';
  writeAtomic(sent, (read(spec) ?? '').trimEnd() + footer(droot, t));
  const excluded = [];
  const out = { steps: [] };
  let picked = null;
  let res = null;
  let prefer = o.prefer || null;
  if (prefer && !o.dryRun && !o.terminal) {
    const pc = parseCandidate(prefer);
    if (needsPing(pc, catalogs(droot, { agents: modelAgents([prefer]) })) && !verifiedOf(team.routing).has(prefer)) {
      const p = pingCandidate(droot, prefer);
      if (!p.ok) {
        out.steps.push(`[SKIP] ${prefer}: ping failed — ${p.err}`);
        prefer = null;
      } else out.steps.push(`[PING] ${prefer}: ok${p.cached ? ' (cached)' : ''}`);
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = route(droot, team, role, { fails: Number(o.fails ?? 0), prefer, exclude: excluded, terminal: o.terminal, worktree, level: t.level });
    out.steps.push(...r.skipped?.map((s) => `[SKIP] ${s}`) ?? []);
    if (!['WORKER', 'REUSE'].includes(r.kind)) throw new Error(`route ${role} → ${r.kind}: ${r.detail ?? ''}${r.kind === 'SUBAGENT' ? ' — run it with your harness subagent, then `start ' + t.id + '`' : ''}`);
    const args = ['orchestration', 'worker-start', ...r.args, '--worktree', worktree, '--task-title', `${t.id} ${t.text}`.slice(0, 120), '--spec-file', sent, ...(o.keepOpen ? ['--keep-open'] : []), ...(o.run ? ['--run', o.run] : [])];
    out.command = `${ORCA()} ${args.join(' ')}`;
    if (o.dryRun) return { ...out, dryRun: true, route: r.cand.text, sent };
    res = orca(args);
    if (res.ok) {
      picked = r;
      break;
    }
    out.steps.push(`[LAUNCH-FAILED] ${r.cand.text}: ${res.err}`);
    if (/selector_not_found/.test(res.err) || o.terminal) break;
    excluded.push(r.cand.text);
  }
  if (!picked) throw new Error(`worker-start failed; ${t.id} left ${t.status}. ${out.steps.join(' ')}`);
  const w = res.data;
  mutate(droot, 'dispatch', (d) => {
    const x = find(d, t.id);
    Object.assign(x, { executor: 'orca', role, dispatch: w.dispatchId, terminal: w.terminal ?? w.terminalHandle, orcaTask: w.taskId, agent: picked.cand.agent, model: picked.cand.model ?? undefined, route: `${role}:${picked.cand.text}`, spec: path.relative(root, sent), worktree, baseSha: base, run: o.run ?? w.runId });
    for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k];
    delete x.question;
    log(x, 'doing', `dispatched ${w.dispatchId ?? ''} via ${picked.cand.text}${o.fails ? ` (fails=${o.fails})` : ''}${excluded.length ? ` after launch failures: ${excluded.join(', ')}` : ''}`);
  });
  if (prefer && picked.cand.text === prefer && !o.terminal) {
    try {
      const l = learnRoute(droot, role, { use: [prefer], from: 'dispatch' });
      if (l.saved) out.steps.push(`[desk] routing ${role} ← ${prefer} (saved to .desk/team.json)`);
      else if (l.errors.length) out.steps.push(`[desk] routing ${role}: ${prefer} not saved — ${l.errors.join('; ')}`);
    } catch (e) {
      out.steps.push(`[desk] routing ${role}: ${prefer} not saved — ${e.message}`);
    }
  }
  return { ...out, route: picked.cand.text, dispatch: w.dispatchId, terminal: w.terminal ?? w.terminalHandle, sent };
}

const payloadOf = (m) => {
  const p = m.payload ?? {};
  if (typeof p !== 'string') return p;
  try {
    return JSON.parse(p);
  } catch {
    return {};
  }
};

export function mail(droot, { runs = [] } = {}) {
  const desk = load(droot);
  const list = runs.length ? runs : [...new Set(tasks(desk).filter((t) => t.run && TASK_OPEN.includes(t.status)).map((t) => t.run))];
  const msgs = [];
  for (const run of list.length ? list : [null]) {
    const r = orca(['orchestration', 'check', '--full', ...(run ? ['--run', run] : [])]);
    if (!r.ok) throw new Error(`orca check ${run ?? '(bound Run)'}: ${r.err}`);
    msgs.push(...(r.data.messages ?? []));
  }
  const lines = [];
  const next = [];
  if (!msgs.length) return { lines: ['mail: empty — end your turn; Orca wakes you when a worker reports'], next };
  mutate(droot, 'mail', (d) => {
    const all = tasks(d);
    for (const m of msgs.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))) {
      const p = payloadOf(m);
      const text = `${m.subject ?? ''} ${m.body ?? ''}`;
      const t =
        all.find((x) => x.dispatch && x.dispatch === (p.dispatchId ?? m.dispatch_id)) ??
        all.find((x) => x.orcaTask && x.orcaTask === (p.taskId ?? m.task_id)) ??
        all.find((x) => x.dispatch && text.includes(x.dispatch)) ??
        all.find((x) => new RegExp(`(^|\\W)${x.id}(\\W|$)`).test(m.subject ?? '') && x.executor === 'orca') ??
        all.find((x) => x.terminal && x.terminal === (m.from_handle ?? m.from));
      const kind = m.type;
      lines.push(`${kind} ${t?.id ?? '?'}: ${m.subject ?? ''}${m.body ? ` — ${String(m.body).trim().slice(0, 300)}` : ''}`);
      if (!t) {
        next.push(`unmatched ${kind} ${m.id}: orca orchestration inbox --limit 20 --full`);
        continue;
      }
      if (kind === 'worker_done') {
        const ok = (p.outcome ?? m.outcome) === 'succeeded';
        const sha = p.sha ?? /@ ([0-9a-f]{7,40})/.exec(m.subject ?? '')?.[1] ?? /\b([0-9a-f]{40})\b/.exec(m.body ?? '')?.[1];
        if (sha) t.sha = sha.slice(0, 12);
        if (t.status === 'doing') log(t, ok ? 'review' : 'failed', `worker_done ${ok ? 'succeeded' : 'failed'}: ${m.subject ?? ''}`);
        else log(t, null, `worker_done: ${m.subject ?? ''}`);
        if (!ok) t.why = String(m.body ?? m.subject ?? 'worker reported failure').slice(0, 300);
        next.push(ok ? `${t.id}: verify ${t.sha ?? 'the result'} (git -C <worktree> log -1; diff vs plan), then \`done ${t.id} --sha … --proof "…"\`` : `${t.id}: failed — triage (docs/team.md): resume + dispatch a fixer, or --fails 2`);
      } else if (kind === 'question') {
        t.question = { id: m.id, text: String(m.body || m.subject).slice(0, 500), at: m.created_at };
        log(t, null, `QUESTION: ${t.question.text.slice(0, 200)}`);
        next.push(`${t.id}: answer with \`reply ${t.id} "…"\``);
      } else if (kind === 'escalation') {
        if (['doing', 'review'].includes(t.status)) (t.on = 'lead'), log(t, 'waiting', `ESCALATION: ${m.subject ?? ''} — ${String(m.body ?? '').slice(0, 200)}`);
        next.push(`${t.id}: escalated — act, then \`reply\` or \`send ${t.id} --subject RESUME\``);
      } else log(t, null, `${kind}: ${m.subject ?? ''}`.slice(0, 300));
    }
  });
  return { lines, next };
}

export function reply(droot, id, body) {
  const t = find(load(droot), id, 'task');
  if (!t.question) throw new Error(`${t.id} has no open question (send ${t.id} --subject … --body … to message it)`);
  const r = orca(['orchestration', 'reply', '--id', t.question.id, '--body', body]);
  if (!r.ok) throw new Error(`reply failed: ${r.err}`);
  mutate(droot, 'reply', (d) => {
    const x = find(d, id);
    delete x.question;
    if (x.status === 'waiting' && x.on === 'lead') delete x.on, log(x, 'doing', `answered: ${body.slice(0, 200)}`);
    else log(x, null, `answered: ${body.slice(0, 200)}`);
  });
  return t.id;
}
export function send(droot, id, subject, body) {
  const t = find(load(droot), id, 'task');
  if (!t.dispatch) throw new Error(`${t.id} has no dispatch`);
  const r = orca(['orchestration', 'send', '--to', `dispatch:${t.dispatch}`, '--subject', subject, '--body', body]);
  if (!r.ok) throw new Error(`send failed: ${r.err}`);
  mutate(droot, 'send', (d) => {
    const x = find(d, id);
    if (x.status === 'waiting' && /^RESUME|^REBASE/i.test(subject)) delete x.on, log(x, 'doing', `sent ${subject}`);
    else log(x, null, `sent ${subject}: ${body.slice(0, 160)}`);
  });
  return t.dispatch;
}

const SETTLED_OK = ['completed', 'succeeded'];
const SETTLED_BAD = ['failed', 'cancelled', 'canceled', 'abandoned', 'stopped'];
export function sync(droot, { apply = false } = {}) {
  const desk = load(droot);
  const mine = tasks(desk, 'doing', 'review').filter((t) => t.executor === 'orca' && t.dispatch);
  const runs = [...new Set(mine.map((t) => t.run).filter(Boolean))];
  const workers = {};
  for (const run of runs.length ? runs : [null]) {
    const r = orca(['orchestration', 'worker-list', '--full', ...(run ? ['--run', run] : [])]);
    if (!r.ok) throw new Error(`worker-list: ${r.err}`);
    for (const w of r.data.workers ?? []) workers[w.dispatchId] = w;
  }
  const changes = [];
  const lines = [];
  for (const t of mine) {
    const w = workers[t.dispatch];
    if (!w) {
      lines.push(`[MISS] ${t.id} dispatch ${t.dispatch} not in worker-list`);
      continue;
    }
    if (SETTLED_OK.includes(w.dispatchStatus) && t.status === 'doing') changes.push([t.id, 'review', `orca dispatch ${w.dispatchStatus}; verify before done`]);
    else if (SETTLED_BAD.includes(w.dispatchStatus)) changes.push([t.id, 'failed', `orca dispatch ${w.dispatchStatus} (${w.workerState ?? ''})`]);
    else lines.push(`[OK] ${t.id} ${t.status} ↔ ${w.dispatchStatus}/${w.terminalState ?? ''}`);
  }
  for (const [id, to, note] of changes) lines.push(`[${apply ? 'MOVE' : 'WOULD'}] ${id} → ${to}: ${note}`);
  if (apply && changes.length)
    mutate(droot, 'sync', (d) => {
      for (const [id, to, note] of changes) {
        const x = find(d, id);
        if (to === 'failed') x.why = note;
        log(x, to, note);
      }
    });
  return { lines, changes };
}

export function fleet(droot) {
  const desk = load(droot);
  const runs = [...new Set(tasks(desk).filter((t) => t.run && TASK_OPEN.includes(t.status)).map((t) => t.run))];
  const rows = [];
  for (const run of runs.length ? runs : [null]) {
    const r = orca(['orchestration', 'worker-list', '--full', ...(run ? ['--run', run] : [])]);
    if (!r.ok) return { error: r.err, rows };
    for (const w of r.data.workers ?? []) {
      const t = tasks(desk).find((x) => x.dispatch === w.dispatchId);
      const settled = [...SETTLED_OK, ...SETTLED_BAD].includes(w.dispatchStatus);
      rows.push({ task: t?.id ?? '-', dispatch: w.dispatchId, status: w.dispatchStatus, terminal: w.agentTerminalHandle, terminalState: w.terminalState, settled, hint: settled && w.terminalState === 'active' ? `reuse: dispatch <ID> --terminal ${w.agentTerminalHandle}, or orca orchestration worker-release --dispatch ${w.dispatchId}` : '' });
    }
  }
  return { rows };
}

export function lease(droot, action, { resource, holder, ttlMin = 90, force = false } = {}) {
  const team = loadTeam(droot);
  const name = resource || team.test.exclusive || 'test';
  if (action === 'show') return Object.entries(load(droot).leases ?? {}).map(([k, l]) => `${k} held by ${l.holder} until ${l.expires}${l.expires < nowIso() ? ' (expired)' : ''}`);
  if (!holder) throw new Error(`lease ${action} needs --holder <task id>`);
  return mutate(droot, `lease-${action}`, (d) => {
    const h = find(d, holder, 'task');
    const cur = d.leases[name];
    if (action === 'acquire') {
      if (cur && cur.holder !== h.id && cur.expires >= nowIso() && !force) throw new Error(`${name} held by ${cur.holder} until ${cur.expires}; wait, or release it if that task settled`);
      d.leases[name] = { holder: h.id, at: nowIso(), expires: new Date(Date.now() + ttlMin * 60e3).toISOString().replace(/\.\d+Z$/, 'Z') };
      log(h, null, `lease ${name} acquired`);
      return [`${name} → ${h.id} until ${d.leases[name].expires}${cur && cur.holder !== h.id ? ` (took over expired lease of ${cur.holder})` : ''}`];
    }
    if (!cur) throw new Error(`${name} is not leased`);
    if (cur.holder !== h.id && !force) throw new Error(`${name} is held by ${cur.holder}, not ${h.id}`);
    delete d.leases[name];
    log(h, null, `lease ${name} released`);
    return [`${name} released by ${h.id}`];
  });
}

function workerTask(droot, id) {
  const t = find(load(droot), id, 'task');
  if (t.executor !== 'orca' || !t.dispatch) throw new Error(`${t.id} is not a dispatched worker task`);
  return t;
}
const ids = (t) => {
  const from = process.env.ORCA_TERMINAL_HANDLE || t.terminal;
  if (!from) throw new Error('no terminal handle (ORCA_TERMINAL_HANDLE unset and none on the task)');
  return ['--from', from, '--dispatch-id', t.dispatch, ...(t.orcaTask ? ['--task-id', t.orcaTask] : [])];
};
const note = (droot, id, text) => mutate(droot, 'worker-note', (d) => log(find(d, id), null, text));

export function worker(droot, id, verb, o = {}) {
  const t = workerTask(droot, id);
  const cwd = o.cwd ?? process.cwd();
  if (verb === 'status') {
    const r = orca(['orchestration', 'send', ...ids(t), '--type', 'status', '--subject', `${t.id} ${String(o.text).slice(0, 80)}`, '--body', o.text]);
    if (!r.ok) throw new Error(r.err);
    note(droot, t.id, `status: ${o.text}`);
    return [`status sent for ${t.id}`];
  }
  if (verb === 'ask') {
    const r = orca(['orchestration', 'ask', '--from', ids(t)[1], '--question', `[${t.id}] ${o.text}`]);
    if (!r.ok) throw new Error(r.err);
    note(droot, t.id, `asked: ${o.text}`);
    return [`asked. END YOUR TURN now; Orca wakes you with the answer. Then: worker ${t.id} inbox`];
  }
  if (verb === 'escalate') {
    const r = orca(['orchestration', 'send', ...ids(t), '--type', 'escalation', '--subject', `${t.id} Blocked: ${String(o.text).slice(0, 70)}`, '--body', o.body ?? o.text]);
    if (!r.ok) throw new Error(r.err);
    note(droot, t.id, `escalated: ${o.text}`);
    return ['escalated: end your turn; the lead answers by mail'];
  }
  if (verb === 'inbox') {
    const r = orca(['orchestration', 'check', '--full']);
    if (!r.ok) throw new Error(r.err);
    const msgs = r.data.messages ?? [];
    const out = msgs.map((m) => {
      const s = String(m.subject ?? '').toUpperCase();
      const todo = s.startsWith('PAUSE') ? ` → commit "wip: …", then worker ${t.id} ask "Paused at <step>" and end your turn` : s.startsWith('REBASE') ? ' → git rebase <ref>, build, continue' : s.startsWith('ABORT') ? ` → worker ${t.id} done --outcome failed --summary "aborted: …"` : '';
      return `${m.type} from ${m.from_handle ?? m.from ?? '?'}: ${m.subject ?? ''}${m.body ? ` — ${m.body}` : ''}${todo}`;
    });
    if (msgs.length) note(droot, t.id, 'inbox: ' + msgs.map((m) => `${m.type} ${m.subject}`).join('; ').slice(0, 300));
    return out.length ? out : ['inbox: empty'];
  }
  if (verb === 'lease') return lease(droot, o.action ?? 'acquire', { holder: t.id, ttlMin: o.ttlMin });
  if (verb === 'done') {
    if (t.status !== 'doing') throw new Error(`${t.id} is ${t.status}; done is sent once, while the task runs`);
    if (!['succeeded', 'failed'].includes(o.outcome)) throw new Error('done --outcome succeeded|failed --summary "…"');
    if (!o.summary) throw new Error('done needs --summary "<what you did, sha, files, build/test status line>"');
    let sha = null;
    let files = [];
    if (o.outcome === 'succeeded' && !o.noCommit) {
      const head = git(cwd, ['rev-parse', 'HEAD']);
      if (!head) throw new Error('not in a git checkout');
      if (t.baseSha && head === t.baseSha) throw new Error(`no commit since dispatch (HEAD is still ${t.baseSha.slice(0, 9)}); commit your files first`);
      const owned = new Set(t.files ?? []);
      const range = t.baseSha ? [t.baseSha, head] : [`${head}~1`, head];
      const changed = (git(cwd, ['diff', '--name-only', ...range]) ?? '').split('\n').filter((f) => f && !f.startsWith(DESK + '/'));
      const touched = new Set(changed);
      const outside = new Set(owned.size ? changed.filter((f) => !owned.has(f)) : []);
      const last = !owned.size || changed.some((f) => owned.has(f)) ? head : null;
      if (!last) throw new Error(`no commit touching your files since dispatch (HEAD ${head.slice(0, 9)})`);
      if (outside.size && !o.force) throw new Error(`commit touches files outside ${t.id}: ${[...outside].join(', ')} (revert them, or ask the lead)`);
      const dirty = (git(cwd, ['status', '--porcelain']) ?? '').split('\n').filter(Boolean).map((l) => l.slice(3)).filter((f) => owned.has(f));
      if (dirty.length && !o.force) throw new Error(`uncommitted changes in your files: ${dirty.join(', ')}; commit them first`);
      sha = last;
      files = [...touched].sort();
    }
    const r = orca(['orchestration', 'send', ...ids(t), '--type', 'worker_done', '--subject', `${t.id} ${o.outcome}${sha ? ` @ ${sha}` : ''}`, '--body', o.summary, '--outcome', o.outcome, '--files-modified', files.join(',') || 'none']);
    if (!r.ok) throw new Error(r.err);
    mutate(droot, 'worker-done', (d) => {
      const x = find(d, t.id);
      if (o.outcome === 'succeeded') {
        if (sha) x.sha = sha.slice(0, 12);
        x.proof = String(o.summary).slice(0, 500);
        x.actualFiles = files.length;
        log(x, 'review', `worker_done succeeded${sha ? ` @ ${sha.slice(0, 9)}` : ''}`);
      } else {
        x.why = String(o.summary).slice(0, 300);
        log(x, 'failed', `worker_done failed: ${String(o.summary).slice(0, 200)}`);
        releaseLeases(d, x.id);
      }
    });
    return [`${t.id} ${o.outcome}${sha ? ` @ ${sha.slice(0, 9)}, ${files.length} file(s)` : ''} — end your turn`];
  }
  throw new Error('worker ID status|ask|escalate|inbox|lease|done');
}

export const isWorkerEnv = (droot, checkout) => path.resolve(checkout) !== path.resolve(droot) || /^structworker_/.test(process.env.ORCA_TERMINAL_HANDLE ?? '');

export function workerContext(droot, checkout) {
  const desk = load(droot);
  const handle = process.env.ORCA_TERMINAL_HANDLE;
  const mine = tasks(desk, 'doing').filter((t) => t.executor === 'orca' && ((handle && t.terminal === handle) || (t.worktree && path.resolve(t.worktree.replace(/^path:/, '')) === path.resolve(checkout) && path.resolve(checkout) !== path.resolve(droot))));
  if (!mine.length)
    return isWorkerEnv(droot, checkout)
      ? `[desk] You are a worker in ${path.resolve(checkout) !== path.resolve(droot) ? 'a plan worktree' : 'an Orca worker terminal'}; the desk belongs to the lead. Follow your brief and report only with its REPORT commands (worker <task id> …).`
      : null;
  const t = mine.length === 1 ? mine[0] : mine.find((x) => x.terminal === handle) ?? mine[0];
  return `[desk] You are a worker: ${fmt(t)} (${t.role ?? 'engineer'}${t.plan ? `, plan ${t.plan}` : ''}). Your brief: ${t.spec ?? '(see the task)'} — follow it and report only with its REPORT commands (worker ${t.id} …). The lead's desk is not yours to change.`;
}

export function teamSummary(droot) {
  const team = loadTeam(droot);
  const desk = load(droot);
  const state = readState(droot);
  const running = tasks(desk, 'doing').filter((t) => t.executor === 'orca');
  return {
    orca: orcaAvailable(),
    allowed: !!state.teamAllowed,
    team,
    running,
    review: tasks(desk, 'review'),
    questions: tasks(desk, ...TASK_OPEN).filter((t) => t.question),
    ready: ready(droot, desk).filter((t) => t.executor === 'orca' || t.role),
    leases: desk.leases,
  };
}
