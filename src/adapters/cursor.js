import path from 'node:path';
import { exists } from '../lib/util.js';

/** Cursor reads AGENTS.md natively; the desk skill becomes an agent-requested rule. */
export default {
  id: 'cursor',
  label: 'Cursor',
  enforcement: 'none',
  detect: (root) => exists(path.join(root, '.cursor')) || exists(path.join(root, '.cursorrules')),
  outputs(kit, ctx) {
    const dir = path.join(ctx.root, '.cursor');
    const outputs = [
      {
        path: path.join(dir, 'rules', 'agentkit-desk.mdc'),
        kind: 'file',
        content: `---\ndescription: ${kit.skill.description}\nglobs:\nalwaysApply: false\n---\n${kit.skill.body}`,
      },
    ];
    if (Object.keys(kit.mcp).length) {
      const mcpServers = Object.fromEntries(Object.entries(kit.mcp).map(([k, v]) => [k, v.url ? { url: v.url } : v]));
      outputs.push({ path: path.join(dir, 'mcp.json'), kind: 'json', patch: { mcpServers } });
    }
    return { outputs };
  },
};
