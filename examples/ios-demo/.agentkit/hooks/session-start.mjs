#!/usr/bin/env node
// SessionStart: count the session, sort the desk mechanically, show the surface (or a worker's own task).
// Kit-managed: do not edit.
import { readStdinJson, projectDir, deskRoot, bumpSession, readState, git } from './_lib.mjs';
import { hasDesk, load, mutate, autoSort, compact, surface } from './store.mjs';
import { workerContext } from './team.mjs';

const input = await readStdinJson();
const checkout = projectDir(input);
const droot = deskRoot(checkout);
if (!hasDesk(droot)) process.exit(0);
const worker = workerContext(droot, checkout);
if (worker) {
  process.stdout.write(worker + '\n');
  process.exit(0);
}
const startup = !input.source || input.source === 'startup';
const state = startup ? bumpSession(droot) : readState(droot);
let moves = [];
if (startup)
  mutate(droot, 'auto-sort', (d) => {
    moves = [...autoSort(droot, d, state), ...compact(droot, d, state)];
    return moves.length ? moves : { noop: true };
  });
let out = surface(droot, load(droot), { state, moves });
const log = git(checkout, ['log', '--oneline', '-3']);
if (log) out += '\nRecent commits: ' + log.split('\n').join(' | ');
process.stdout.write(out + '\n');
