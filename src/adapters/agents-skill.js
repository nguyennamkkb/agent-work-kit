import path from 'node:path';

export const agentsSkill = (kit, ctx) => ({ path: path.join(ctx.root, '.agents', 'skills', 'desk', 'SKILL.md'), kind: 'file', content: kit.skill.raw });
