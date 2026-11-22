#!/usr/bin/env node
// Stop: before the agent ends its turn, the desk must reflect the work. Reminds once per distinct problem.
// A worker is reminded to report; the lead to sort the inbox, update its task, verify reports and answer questions.
// Kit-managed: do not edit.
import fs from 'node:fs';
import path from 'node:path';
import { readStdinJson, projectDir, deskRoot, git, findManifest, readState, writeState, DESK } from './_lib.mjs';
import { hasDesk, load, tasks, focus, paths, TASK_OPEN } from './store.mjs';
import { workerContext } from './team.mjs';

const input = await readStdinJson();
if (input.stop_hook_active) process.exit(0);
const checkout = projectDir(input);
const droot = deskRoot(checkout);
if (!hasDesk(droot)) process.exit(0);
const C = 'node .agentkit/desk.mjs';
const desk = load(droot);
const problems = [];

const w = workerContext(droot, checkout);
if (w) {
  const id = /You are a worker: (Q-\d+)/.exec(w)?.[1];
  problems.push(`you are worker ${id}: report before stopping — \`worker ${id} done --outcome … --summary "…"\` when finished, or \`ask\`/\`escalate\` if you are waiting (then end your turn)`);
} else {
  const inbox = tasks(desk, 'inbox');
  if (inbox.length) problems.push(`the inbox holds ${inbox.length} item(s) (${inbox.map((t) => t.id).join(', ')}) — \`${C} file ID task|memory|lesson\` or \`drop ID --why\``);
  const kitFiles = Object.keys(findManifest(checkout)?.data?.files ?? {}).concat('.agentkit.json');
  const status = git(checkout, ['status', '--porcelain', '--untracked-files=all']);
  if (status) {
    const changed = status
      .split('\n')
      .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
      .filter((f) => f && !f.startsWith(DESK + '/') && !kitFiles.includes(f));
    const mtime = (f) => {
      try {
        return fs.statSync(f).mtimeMs;
      } catch {
        return 0;
      }
    };
    if (changed.length && Math.max(...changed.map((f) => mtime(path.join(checkout, f)))) > mtime(paths(droot).json)) {
      const cur = focus(desk);
      problems.push(cur ? `${changed.length} file(s) changed after the desk — \`${C} done ${cur.id} --proof "…"\` if its check passes, else \`${C} next "…"\`` : `${changed.length} file(s) changed but no task is in progress — record the work: \`${C} add P1 "…" --done "…" --now\`, then done/next`);
    }
  }
  const review = tasks(desk, 'review');
  if (review.length) problems.push(`worker report(s) to verify: ${review.map((t) => t.id).join(', ')} (git log -1 in its worktree, diff vs plan, then \`${C} done ID --sha … --proof …\`)`);
  const asks = tasks(desk, ...TASK_OPEN).filter((t) => t.question);
  if (asks.length) problems.push(`worker question(s) waiting: ${asks.map((t) => t.id).join(', ')} — \`${C} reply ID "…"\``);
}
if (!problems.length) process.exit(0);
const state = readState(droot);
const key = problems.join('|').replace(/\d+ file\(s\)/g, 'N files');
state.reminded ??= {};
if (state.reminded.stop === key) process.exit(0);
state.reminded.stop = key;
writeState(droot, state);
process.stdout.write(JSON.stringify({ decision: 'block', reason: `[desk] Before stopping: ${problems.join('; ')}. If this turn was only a question, just stop.` }) + '\n');
