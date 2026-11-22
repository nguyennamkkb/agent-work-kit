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
    `# Desk — ${kit.nghe.title} (agent-work-kit)`,
    'Every task, decision and lesson lives in exactly one zone in `.desk/`. Nothing important lives only in chat.',
    `- At the start of every session load the **desk** skill${paths.length ? ` (${paths.map((p) => `\`${p}\``).join(', ')})` : ''} and follow it: the method + the ${kit.nghe.title} profession rules.`,
    '- One task at a time (`.desk/now.md`). Anything new goes to `.desk/inbox.md`; empty it before you end.',
    '- `.desk/rules.local.md` overrides profession rules by ID.',
    '- The user never maintains the desk: infer goal, tasks, priorities and what to remember from how they work with you. Ask only when two readings lead to different work.',
    '- Changing rules, tooling or structure needs a proposal in `.desk/review/`; ask in one sentence, a yes in chat approves.',
    '- Ask before: deleting files outside the task, `git push`, force operations, deploys, adding/removing dependencies.',
  ];
  const soft = kit.hooks.filter((h) => h.soft);
  if (soft.length) {
    lines.push('', enforced.length ? `## Checks (enforced by the kit on ${enforced.join(', ')}; do them yourself elsewhere)` : '## Checks (do these yourself)');
    for (const h of soft) lines.push(`- ${h.soft}`);
  }
  return lines.join('\n');
}

