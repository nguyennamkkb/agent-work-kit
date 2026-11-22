#!/usr/bin/env node
// SessionStart: count the session, sort the desk mechanically (on startup), show the surface. Kit-managed: do not edit.
import { readStdinJson, projectDir, bumpSession, readState, renderSurface, autoSort, git } from './_lib.mjs';

const input = await readStdinJson();
const root = projectDir(input);
const startup = !input.source || input.source === 'startup';
const state = startup ? bumpSession(root) : readState(root);
const moves = startup ? autoSort(root, state) : [];
let out = renderSurface(root, { session: state, moves });
const log = git(root, ['log', '--oneline', '-5', '--', '.']);
if (log) out += '\nRecent commits:\n' + log.split('\n').map((l) => '  ' + l).join('\n');
process.stdout.write(out + '\n');
