---
name: desk
description: The work method for this project — a desk with fixed zones (.desk/) that holds the goal, the one task in progress, the prioritized queue, memory, lessons and proposals, plus the profession rules. Use at the start of every session, before picking or switching tasks, whenever something new comes up, and before ending.
---
# The desk

You work at one desk, for one profession. Everything you are doing or must remember lives in exactly one **zone** in `.desk/`. Nothing lives in chat only and nothing lives "somewhere else". If it has no zone, it goes to the inbox.

**The user never maintains the desk.** They just work with you. You infer the goal, the tasks, their priority and what is worth remembering from what they ask, correct, repeat and emphasize. The kit helps: hooks read each user message, bump the importance of items it mentions, sort the zones, and tell you when something must be filed. Ask a question only when two readings would lead to different work, and then in one sentence.

## Zones
| File | Zone | Holds | Capacity |
|---|---|---|---|
| `goal.md` | Goal | Destination + success criteria, inferred by you | ≤ 5 lines |
| `now.md` | Now | The single task in progress, with `done:` and `next:` | exactly 1 |
| `queue.md` | Queue | Next tasks, sorted P0 → P3 | ≤ 7 |
| `inbox.md` | Inbox | New, unsorted things | empty at session end |
| `memory.md` | Memory | Project decisions & facts; above `---` is always read | ≤ 10 above the line |
| `notebook.md` | Notebook | Lessons, `×` = times hit | ×2 → proposal |
| `review/` | Review | Proposals `P-*`, kit update notes `U-*` | approved by a one-line yes |
| `archive/` | Archive | Done tasks, retired items, decided reviews | never auto-loaded |
| `rules.local.md` | Project rules | Overrides/extensions of profession rules, by ID | approved only |

The kit hook rejects writes that leave a zone malformed or over capacity. Read its message and fix the content.

## Item format
```
- P1 Q-007 Login screen with email + password · +2026-11-20 · ×3 · @2026-11-22
  - done: `xcodebuild test` passes and the screen shows on the simulator
```
`P0–P3` priority · id (`Q-` task, `M-` memory, `L-` lesson) · text · `+` created · `×` uses · `@` last touched.
The hooks bump `×`/`@` when the user mentions an item or you edit a file in its `ref:`. Bump it yourself when you rely on an item the hooks could not see.
Ids are never reused. Sub-bullets (`  - key: value`) hold detail: `done`, `next`, `ref`, `example`, `rule`, `proposal`.

**Priority** — infer it from the user's behavior, not from asking:
- P0: blocks the goal or causes harm now; the user said urgent/important, or raised it twice in one session.
- P1: moves the goal forward directly; what the user asked for in this session.
- P2: useful, can wait; side remarks ("later", "sometime"), your own ideas.
- P3: nice to have; mentioned once, long ago.
**What to remember:** what the user corrected, repeated, said "always/never/remember" about, or what cost real time to find out (build commands, paths, decisions).
**What to forget:** one-off details, things the code or git already records, raw output. Don't file those.
**Anti-drift:** every task must serve `goal.md`. If one doesn't, still do small requests, but file them P2+ and keep the goal; if the user's direction has clearly changed, update `goal.md` and say so in one line.

## Session loop
**Start**
1. Read the surface the hook printed (or read goal, now, the top of the queue, memory above the line, rules.local.md, `git log --oneline -5`).
2. Goal not set → infer it (user's first request, README, git log), write `goal.md`, mention it in one line. Build/test commands unknown → find them yourself and store them as memory items.
3. Apply approved proposals first. Never act on proposals still pending.
4. The user's request is the task. If `now.md` holds something else, park it in the queue with a `next:` note. Write the task with a `done:` check you infer.
5. Grep `memory.md` and `notebook.md` for what you are about to touch.

**During**
- Work on the task in `now.md`. Things you notice on the way (bug, idea, follow-up) are one line in `inbox.md`; don't wander off.
- The user is in charge of what happens now: a new request replaces the current task (park the old one with `next:`).
- Small steps, run the checks, commit each green step with a message that says why.
- A decision was made → a memory item right away (`- P1 M-012 Use zod for validation — smaller than joi · …`).

**End** (also when the conversation is about to be compacted)
1. Empty the inbox: each line becomes a queue task, a memory item, a lesson, or is dropped.
2. Update `now.md`: done → move the task to `archive/YYYY-MM.md` and pull the next one from the queue; not done → update `next:`.
3. Retro: user corrections (the journal in `.desk/.journal.jsonl` lists this session's messages), failed checks, slow or repeated steps → lessons. Same lesson again → bump `×` (don't duplicate).
4. Commit the code and `.desk/` together.

## Sorting: keep the important things in front
The kit sorts mechanically at every session start (the surface shows "Auto-sorted: …"):
- queue ordered P0 → P3, then by `×`; a task untouched for 5 sessions drops one level; P3 untouched → archive; overflow → archive.
- memory: used ≥3× below the line → above (if room); untouched 5 sessions above → below; top over 10 → least used goes below.
You handle what needs judgment: merging duplicates, rewriting vague items, raising a priority when the user's behavior shows it matters.

## Self-improvement (proposals)
You may freely rearrange items inside the zones. Anything that changes **how** work is done needs a proposal that the user approves: project rules, the goal, zone conventions, tooling (scripts, tests, lint, hooks), structure, dependencies.
- Lesson with `×` ≥ 2 → draft `review/P-00N-slug.md` from `review/_TEMPLATE.md`, then add `- proposal: P-00N` to the lesson.
- Prefer the cheapest durable fix: a test, lint rule or script > a project rule. Rules cost context every session.
- Every proposal states: evidence (dates, errors, user quotes), the exact change, impact, success metric, rollback.
- Ask in one sentence at a natural pause (end of a task), e.g. "Lesson L-004 keeps coming up — add rule LOCAL-002 'run make lint before commit'? (P-003)". A yes in chat approves: set `- Status: approved` and quote the user's words under it. Silence or no → leave it pending, don't ask again for that proposal until new evidence. (`npx agent-work-kit review` also works.)
- Applying: write the rule to `rules.local.md` citing the proposal (`- Why: P-00N …`), set `- Status: applied`, move the proposal to `archive/`, add a memory item, commit `apply P-00N: <title>`.
- `U-*` notes: a kit update changed a rule this project overrides. The project rule was kept automatically; mention it to the user once.

## Rules: three layers
1. **This method**: the desk itself. Kit-owned.
2. **Profession rules** below: `### ID · priority`. Kit-owned, updated with `npx agent-work-kit update`.
3. **Project rules** in `.desk/rules.local.md`: `### ID · override` replaces a profession rule, `### ID · off` disables it, a new ID (`LOCAL-001`) adds one.

Precedence: project rule > profession rule > this method's defaults. Never edit layers 1 and 2. The kit hook blocks it.
