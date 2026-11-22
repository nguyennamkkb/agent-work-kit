import { HARNESSES } from './index.js';

const AGENTS_SKILL = '.agents/skills/desk/SKILL.md';
export const SKILL_PATHS = {
  claude: '.claude/skills/desk/SKILL.md',
  cursor: '.cursor/rules/agentkit-desk.mdc',
  codex: AGENTS_SKILL,
  pi: AGENTS_SKILL,
  omp: AGENTS_SKILL,
  opencode: AGENTS_SKILL,
};

/** Always-loaded instructions (AGENTS.md block). Short on purpose: the method lives in the desk skill. */
export function renderAlwaysOn(kit, harnesses) {
  const paths = [...new Set(harnesses.map((h) => SKILL_PATHS[h]).filter(Boolean))];
  const enforced = harnesses.filter((h) => HARNESSES[h]?.enforcement !== 'none').map((h) => HARNESSES[h].label);
  const lines = [
    `# Desk — ${kit.profession.title} (agent-work-kit)`,
    'All work lives on the desk (`.desk/desk.json`): goal, the task in progress, queue, waiting work, memory, lessons, workers. Nothing important lives only in chat.',
    `- Load the **desk** skill${paths.length ? ` (${paths.map((p) => `\`${p}\``).join(', ')})` : ''} at the start of every session and follow it: the method + the ${kit.profession.title} profession rules.`,
    '- Change the desk only with `node .agentkit/desk.mjs <verb>` (`help` lists them); never edit `.desk/desk.json` or `DESK.md` by hand.',
    '- The user never maintains the desk: infer goal, tasks, priorities and what to remember from how they work. Ask only when two readings lead to different work.',
    '- Workers (Orca): read `.agentkit/docs/team.md` first; the first worker of a session needs the user\'s yes.',
    '- Ask before: deleting files outside the task, `git push`, merges, force operations, deploys, adding/removing dependencies. Changing rules or tooling needs a proposal the user approves.',
  ];
  const soft = kit.hooks.filter((h) => h.soft);
  const unenforced = harnesses.filter((h) => HARNESSES[h]?.enforcement === 'none');
  if (soft.length && (unenforced.length || !enforced.length)) {
    lines.push('', enforced.length ? `## Checks (the kit enforces them on ${enforced.join(', ')}; do them yourself elsewhere)` : '## Checks (do these yourself)');
    for (const h of soft) lines.push(`- ${h.soft}`);
  } else if (soft.length) lines.push(`- Tools without the kit's hooks: run \`node .agentkit/desk.mjs status\` first, file what the user says with the command, and before ending sort the inbox and set the task done or next.`);
  return lines.join('\n');
}

