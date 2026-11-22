import path from 'node:path';

/** The shared hook scripts every hook-capable harness runs: .agentkit/hooks/*.mjs */
export const HOOK_DIR = '.agentkit/hooks';
export default {
  id: 'hooks',
  outputs: (kit, ctx) => ({
    outputs: kit.hookFiles.map((f) => ({ path: path.join(ctx.root, HOOK_DIR, f.rel), kind: 'file', content: f.content })),
  }),
};

/** Translate the kit's symbolic matcher ("edit") into each harness's tool names. */
export const MATCHERS = {
  claude: { edit: 'Edit|Write|MultiEdit|NotebookEdit' },
  codex: { edit: 'apply_patch|Edit|Write' },
};

/** Hook groups in the Claude Code / Codex settings shape. */
export function hookGroups(kit, harness, command) {
  const hooks = {};
  for (const h of kit.hooks) {
    const matcher = MATCHERS[harness][h.matcher] ?? h.matcher ?? '';
    (hooks[h.event] ??= []).push({
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: command(h.script), ...(h.timeout ? { timeout: h.timeout } : {}) }],
    });
  }
  return hooks;
}
