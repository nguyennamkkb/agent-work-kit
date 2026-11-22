#!/usr/bin/env node
// After a file write that touched .desk/: lint the whole desk. Catches what could not be checked before the write
// (e.g. edit formats a harness does not expose). Exit 2 + stderr tells the agent what to fix. Kit-managed: do not edit.
import path from 'node:path';
import { readStdinJson, projectDir, normalizeWrites, lintDesk, DESK } from './_lib.mjs';

const input = await readStdinJson();
const root = projectDir(input);
const touched = normalizeWrites(root, input.tool_name, input.tool_input ?? {}, input.cwd).some((w) => {
  const rel = path.relative(root, w.path).split(path.sep).join('/');
  return rel === DESK || rel.startsWith(DESK + '/');
});
if (!touched) process.exit(0);
const errors = lintDesk(root);
if (!errors.length) process.exit(0);
process.stderr.write(`[desk] The desk is now invalid — fix it before continuing:\n- ${errors.slice(0, 8).join('\n- ')}\n`);
process.exit(2);
