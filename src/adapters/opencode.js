import path from 'node:path';
import { exists } from '../lib/util.js';
import { agentsSkill } from './agents-skill.js';

export default {
  id: 'opencode',
  label: 'OpenCode',
  enforcement: 'partial',
  detect: (root) => exists(path.join(root, '.opencode')) || exists(path.join(root, 'opencode.json')) || exists(path.join(root, 'opencode.jsonc')),
  outputs(kit, ctx) {
    const outputs = [agentsSkill(kit, ctx), { path: path.join(ctx.root, '.opencode', 'plugins', 'agentkit-desk', 'index.js'), kind: 'file', content: kit.hosts.opencode }];
    return { outputs };
  },
};
