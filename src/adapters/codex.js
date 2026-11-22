import path from 'node:path';
import { exists } from '../lib/util.js';
import { hookGroups, HOOK_DIR } from './hooks.js';
import { agentsSkill } from './agents-skill.js';

const cmd = (script) =>
  `d="$PWD"; while [ "$d" != / ] && [ ! -f "$d/.agentkit.json" ]; do d=$(dirname "$d"); done; node "$d/${HOOK_DIR}/${script}"`;

export default {
  id: 'codex',
  label: 'Codex',
  enforcement: 'full',
  detect: (root) => exists(path.join(root, '.codex')),
  outputs(kit, ctx) {
    const notes = ['Codex: run `/hooks` once in this project and trust the agent-work-kit hooks (Codex requires it for project hooks).'];
    if (Object.keys(kit.mcp).length)
      notes.push('Codex reads MCP servers from ~/.codex/config.toml. Add:\n' + Object.entries(kit.mcp).map(([k, v]) => `[mcp_servers.${k}]\nurl = "${v.url}"`).join('\n'));
    return {
      outputs: [agentsSkill(kit, ctx), { path: path.join(ctx.root, '.codex', 'hooks.json'), kind: 'json', patch: { hooks: hookGroups(kit, 'codex', cmd) } }],
      notes,
    };
  },
};
