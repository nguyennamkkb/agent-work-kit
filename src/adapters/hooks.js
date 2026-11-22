import path from 'node:path';

export const HOOK_DIR = '.agentkit/hooks';
export default {
  id: 'hooks',
  outputs: (kit, ctx) => ({
    outputs: [
      ...kit.hookFiles.map((f) => ({ path: path.join(ctx.root, HOOK_DIR, f.rel), kind: 'file', content: f.content })),
      { path: path.join(ctx.root, '.agentkit', 'desk.mjs'), kind: 'file', content: kit.cli },
      ...kit.docs.map((f) => ({ path: path.join(ctx.root, '.agentkit', 'docs', f.rel), kind: 'file', content: f.content })),
    ],
  }),
};

export const MATCHERS = {
  claude: { edit: 'Edit|Write|MultiEdit|NotebookEdit' },
  codex: { edit: 'apply_patch|Edit|Write' },
};

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
