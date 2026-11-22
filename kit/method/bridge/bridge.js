// ---- agent-work-kit bridge: run the shared desk hooks (.agentkit/hooks/*.mjs) from an in-process plugin host.
// Node built-ins only. Every call fails open: the host keeps working if a hook is missing or crashes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function akRoot(start) {
  let d = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(d, '.agentkit.json'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function akRun(root, script, payload) {
  const file = root && path.join(root, '.agentkit', 'hooks', script);
  if (!file || !fs.existsSync(file)) return { code: 0, out: '', err: '' };
  try {
    const r = spawnSync(process.env.AGENTKIT_NODE || 'node', [file], {
      input: JSON.stringify({ cwd: root, ...payload }),
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, AGENTKIT_ROOT: root },
    });
    return { code: r.status ?? 0, out: r.stdout ?? '', err: r.stderr ?? '' };
  } catch {
    return { code: 0, out: '', err: '' };
  }
}

function akContext(out) {
  const t = (out ?? '').trim();
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

const akSessionStart = (root, startup, sessionId) => akContext(akRun(root, 'session-start.mjs', { hook_event_name: 'SessionStart', source: startup ? 'startup' : 'resume', ...(sessionId ? { session_id: String(sessionId) } : {}) }).out);
const akCapture = (root, prompt) => (prompt ? akContext(akRun(root, 'capture.mjs', { hook_event_name: 'UserPromptSubmit', prompt }).out) : '');
const isWriteTool = (name, input) => /write|edit|patch|create|replace/i.test(String(name)) || JSON.stringify(input ?? {}).includes('*** Begin Patch');
/** Returns a block reason, or null. */
function akGuard(root, tool, input) {
  if (!isWriteTool(tool, input)) return null;
  const r = akRun(root, 'guard.mjs', { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input });
  return r.code === 2 ? r.err.trim() || 'Blocked by agent-work-kit.' : null;
}
/** Returns desk problems after a write, or null. */
function akAfter(root, tool, input) {
  if (!isWriteTool(tool, input)) return null;
  const r = akRun(root, 'desk-check.mjs', { hook_event_name: 'PostToolUse', tool_name: tool, tool_input: input });
  return r.code === 2 ? r.err.trim() : null;
}
/** Returns a "keep going" reason, or null. */
function akStop(root) {
  const r = akRun(root, 'stop-check.mjs', { hook_event_name: 'Stop', stop_hook_active: false });
  try {
    const j = JSON.parse(r.out);
    return j.decision === 'block' ? j.reason : null;
  } catch {
    return null;
  }
}
