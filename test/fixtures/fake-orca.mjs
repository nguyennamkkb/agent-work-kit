#!/usr/bin/env node
// A stand-in for the `orca` CLI in tests. Logs every call; answers like Orca 1.4.268 (JSON {ok,result}).
// State lives in $FAKE_ORCA_DIR: calls.jsonl, mail.json (messages for the next `check`), workers.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = process.env.FAKE_ORCA_DIR;
const args = process.argv.slice(2).filter((a) => a !== '--json' && a !== '--full');
fs.appendFileSync(path.join(dir, 'calls.jsonl'), JSON.stringify(args) + '\n');
const flag = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const ok = (result = {}) => process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
const fail = (code, message) => (process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }) + '\n'), process.exit(1));
const readJ = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch {
    return d;
  }
};
const [a, b] = args;
if (a === 'orchestration' && b === 'worker-start') {
  if (process.env.FAKE_ORCA_FAIL_MODEL && flag('--model') === process.env.FAKE_ORCA_FAIL_MODEL) fail('launch_failed', 'model unavailable');
  const n = readJ('n.json', 0) + 1;
  fs.writeFileSync(path.join(dir, 'n.json'), String(n));
  ok({ dispatchId: `ctx_${String(n).padStart(12, '0')}`, terminal: `term_${n}`, taskId: `task_${String(n).padStart(12, '0')}` });
} else if (a === 'orchestration' && b === 'check') {
  const mail = readJ('mail.json', []);
  fs.writeFileSync(path.join(dir, 'mail.json'), '[]');
  ok({ messages: mail });
} else if (a === 'orchestration' && b === 'worker-list') ok({ workers: readJ('workers.json', []) });
else if (a === 'orchestration' && ['send', 'reply', 'ask'].includes(b)) ok({ messageId: 'msg_1' });
else if (a === 'worktree' && b === 'create') {
  const repo = flag('--repo').replace(/^path:/, '');
  const wt = path.join(path.dirname(repo), path.basename(repo) + '-' + flag('--name'));
  const branch = flag('--branch');
  const base = flag('--base-branch');
  const exists = (() => {
    try {
      execFileSync('git', ['-C', repo, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  })();
  execFileSync('git', ['-C', repo, 'worktree', 'add', ...(exists ? [wt, branch] : ['-b', branch, wt, base])], { stdio: 'ignore' });
  ok({ path: wt });
} else if (a === 'worktree' && b === 'rm') {
  execFileSync('git', ['worktree', 'remove', '--force', flag('--worktree').replace(/^path:/, '')], { cwd: process.env.FAKE_ORCA_REPO, stdio: 'ignore' });
  ok({ status: 'removed' });
} else if (a === 'terminal') ok({ terminals: [] });
else fail('unknown', `fake orca: ${args.join(' ')}`);
