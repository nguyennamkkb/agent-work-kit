import path from 'node:path';

/** .agents/skills/desk/SKILL.md — read by Codex, Pi, Oh My Pi and OpenCode. */
export const agentsSkill = (kit, ctx) => ({ path: path.join(ctx.root, '.agents', 'skills', 'desk', 'SKILL.md'), kind: 'file', content: kit.skill.raw });
