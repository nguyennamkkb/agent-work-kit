import path from 'node:path';
import { exists } from '../lib/util.js';
import { hookGroups, HOOK_DIR } from './hooks.js';

export default {
  id: 'claude',
  label: 'Claude Code',
  enforcement: 'full',
  detect: (root) => exists(path.join(root, '.claude')) || exists(path.join(root, 'CLAUDE.md')),
  outputs(kit, ctx) {
    const dir = path.join(ctx.root, '.claude');
    const outputs = [
      {
        path: path.join(ctx.root, 'CLAUDE.md'),
        kind: 'block',
        content:
          '@AGENTS.md\n\nClaude Code: the desk skill is `.claude/skills/desk/SKILL.md`. Hooks show and sort the desk at session start, read each user message for corrections/urgency/approvals, validate every write to `.desk/`, and check the inbox before you stop. When a hook blocks you, fix what it says; never work around it.',
      },
      { path: path.join(dir, 'skills', 'desk', 'SKILL.md'), kind: 'file', content: kit.skill.raw },
    ];
    const hooks = hookGroups(kit, 'claude', (s) => `node "$CLAUDE_PROJECT_DIR/${HOOK_DIR}/${s}"`);
    outputs.push({ path: path.join(dir, 'settings.json'), kind: 'json', patch: { hooks, ...(Object.keys(kit.permissions).length ? { permissions: kit.permissions } : {}) } });
    if (Object.keys(kit.mcp).length) outputs.push({ path: path.join(ctx.root, '.mcp.json'), kind: 'json', patch: { mcpServers: kit.mcp } });
    return { outputs };
  },
};
