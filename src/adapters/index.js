import agentsMd from './agents-md.js';
import hooks from './hooks.js';
import claude from './claude.js';
import cursor from './cursor.js';
import codex from './codex.js';
import { pi, omp } from './pi.js';
import opencode from './opencode.js';

export const HARNESSES = { claude, codex, opencode, pi, omp, cursor };

export const detectHarnesses = (root) =>
  Object.values(HARNESSES)
    .filter((a) => a.detect(root))
    .map((a) => a.id);

export function collectOutputs(kit, ctx) {
  const byPath = new Map();
  const notes = [];
  for (const a of [agentsMd, hooks, ...ctx.harnesses.map((h) => HARNESSES[h]).filter(Boolean)]) {
    const r = a.outputs(kit, ctx);
    for (const o of r.outputs) byPath.set(o.path, o); // shared files (e.g. .agents/skills) are written once
    notes.push(...(r.notes ?? []));
  }
  return { outputs: [...byPath.values()], notes };
}
