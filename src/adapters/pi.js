import path from 'node:path';
import { exists } from '../lib/util.js';
import { agentsSkill } from './agents-skill.js';

const make = (id, label, dir, note) => ({
  id,
  label,
  enforcement: 'full',
  detect: (root) => exists(path.join(root, dir)),
  outputs: (kit, ctx) => ({
    outputs: [agentsSkill(kit, ctx), { path: path.join(ctx.root, dir, 'extensions', 'agentkit-desk.js'), kind: 'file', content: kit.hosts.pi }],
    notes: note ? [note] : [],
  }),
});

export const pi = make('pi', 'Pi', '.pi', 'Pi: trust this project when Pi asks (project extensions load only after trust).');
export const omp = make('omp', 'Oh My Pi', '.omp', null);
