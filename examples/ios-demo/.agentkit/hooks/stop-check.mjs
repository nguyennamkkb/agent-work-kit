#!/usr/bin/env node
// Stop: before the agent ends, the inbox must be empty and now.md must reflect code changes. Reminds once.
// Kit-managed: do not edit.
import fs from 'node:fs';
import path from 'node:path';
import { read, readStdinJson, projectDir, git, findManifest, readState, sessionJournal, DESK, ZONES } from './_lib.mjs';

const input = await readStdinJson();
if (input.stop_hook_active) process.exit(0);
const root = projectDir(input);
const desk = path.join(root, DESK);
if (!fs.existsSync(desk)) process.exit(0);
const problems = [];

const inbox = (read(path.join(desk, ZONES.inbox)) ?? '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'));
if (inbox.length) problems.push(`inbox.md has ${inbox.length} unsorted line(s) — move each into queue, memory or notebook, or drop it`);

// Kit-installed files are not "work"; ignore them (and untracked dirs that only hold them).
const kitFiles = Object.keys(findManifest(root)?.data?.files ?? {}).concat('.agentkit.json');
const isKit = (f) => kitFiles.some((k) => k === f || (f.endsWith('/') && k.startsWith(f)));
const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
if (status) {
  const changed = status
    .split('\n')
    .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
    .filter((f) => f && !f.startsWith(DESK + '/') && !isKit(f));
  const mtime = (f) => {
    try {
      return fs.statSync(path.join(root, f)).mtimeMs;
    } catch {
      return 0;
    }
  };
  const deskTime = Math.max(...['now.md', 'queue.md', 'memory.md', 'notebook.md'].map((f) => mtime(path.join(DESK, f))));
  if (changed.length && Math.max(...changed.map(mtime)) > deskTime)
    problems.push(`${changed.length} file(s) changed but the desk was not updated after them — update now.md (status, next step) and the zones you learned something for`);
}

// Corrections the user made this session must end up as lessons.
const fixes = sessionJournal(root, readState(root).session).filter((e) => e.signals?.includes('correction'));
if (fixes.length) {
  const nb = path.join(desk, ZONES.notebook);
  const last = Date.parse(fixes[fixes.length - 1].t);
  if (!fs.existsSync(nb) || fs.statSync(nb).mtimeMs < last)
    problems.push(`the user corrected you ${fixes.length}× this session (e.g. "${fixes[fixes.length - 1].text.slice(0, 80)}") — record the lesson(s) in notebook.md`);
}

if (!problems.length) process.exit(0);
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `[desk] Before stopping: ${problems.join('; ')}. Then commit if checks pass. If this turn was only a question, just stop.`,
  }) + '\n',
);
