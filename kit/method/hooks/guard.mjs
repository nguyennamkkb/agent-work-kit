#!/usr/bin/env node
// Before a file write (any harness):
//  1. kit-managed files and the agentkit block stay untouched;
//  2. writes inside .desk/ go only to zones and must leave the desk valid (format, capacity, approved local rules).
// Exit 2 + stderr = blocked (Claude Code, Codex; the Pi/omp/OpenCode bridges translate it). Kit-managed: do not edit.
import path from 'node:path';
import { read, readStdinJson, projectDir, findManifest, DESK, KIT_STATE, ZONES, allowedDeskPath, lintFile, normalizeWrites, bumpMatches } from './_lib.mjs';

const START = '<!-- agentkit:start -->';
const END = '<!-- agentkit:end -->';
const input = await readStdinJson();
const root = projectDir(input);
const writes = normalizeWrites(root, input.tool_name, input.tool_input ?? {}, input.cwd);
if (!writes.length) process.exit(0);

const KIT_HINT =
  'Kit files change only via `npx agent-work-kit update`. To change how work is done, draft a proposal in .desk/review/ and ask the user in one sentence; approved project rules go to .desk/rules.local.md.';
const problems = [];
const m = findManifest(root);

for (const w of writes) {
  const rel = path.relative(root, w.path).split(path.sep).join('/');
  if (rel.startsWith('..')) continue;

  if (rel === DESK || rel.startsWith(DESK + '/')) {
    const inner = rel.slice(DESK.length + 1);
    if (KIT_STATE.includes(inner)) problems.push(`.desk/${inner} is maintained by the kit hooks.`);
    else if (!allowedDeskPath(inner))
      problems.push(`.desk/${inner} is not a desk zone. Zones: goal.md now.md queue.md inbox.md memory.md notebook.md rules.local.md review/P-*.md archive/*.md.`);
    else if (w.deleted && Object.values(ZONES).includes(inner)) problems.push(`.desk/${inner} is a zone; empty it instead of deleting it.`);
    else if (w.next != null) problems.push(...lintFile(root, inner, w.next, read(w.path) ?? ''));
    continue;
  }
  if (!m) continue;
  if (w.path === m.path) {
    problems.push('.agentkit.json is the kit manifest.');
    continue;
  }
  const entry = m.data.files?.[rel];
  if (!entry) {
    bumpMatches(root, { file: rel }); // editing a file makes desk items that reference it more important
    continue;
  }
  if (entry.kind === 'file') problems.push(`${rel} is installed by agent-work-kit.`);
  else if (entry.kind === 'json') problems.push(`${rel} holds kit hooks/permissions; explain the change you need to the user instead.`);
  else if (entry.kind === 'block') {
    const cur = read(w.path) ?? '';
    const s = cur.indexOf(START);
    const e = cur.indexOf(END);
    if (s >= 0 && e >= 0 && w.next != null && !w.next.includes(cur.slice(s, e + END.length)))
      problems.push(`the agentkit block in ${rel} must stay unchanged; edit below the end marker instead.`);
    if (w.deleted) problems.push(`${rel} holds the agentkit block; do not delete it.`);
  }
}

if (problems.length) {
  const kit = problems.some((p) => /kit|agentkit|manifest/.test(p));
  process.stderr.write(
    `[desk] Blocked:\n- ${problems.join('\n- ')}\n${kit ? KIT_HINT : 'Fix the content and retry. When moving items between zones, remove from the source zone first.'}\n`,
  );
  process.exit(2);
}
process.exit(0);
