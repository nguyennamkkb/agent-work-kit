import path from 'node:path';
import { renderAlwaysOn } from './shared.js';

/** AGENTS.md — shared, always-loaded entry point (read by Codex, Cursor, and Claude via @AGENTS.md). */
export default {
  id: 'agents-md',
  outputs: (kit, ctx) => ({
    outputs: [{ path: path.join(ctx.root, 'AGENTS.md'), kind: 'block', content: renderAlwaysOn(kit, ctx.harnesses) }],
  }),
};
