---
name: desk
description: The work method for this project — one desk (.desk/desk.json) holding the goal, the task in progress, the queue, waiting work, memory, lessons and the team's workers, changed only with `node .agentkit/desk.mjs`. Use at the start of every session, whenever work is added, changed, finished, paused or dropped, before handing work to subagents or workers, and before ending.
---
# The desk

You work at one desk, for one profession. Everything you are doing or must remember lives on it. Nothing important lives only in chat.

**The user never maintains the desk.** They just work with you. You infer the goal, the tasks, their priority and what to remember from what they ask, correct, repeat and emphasize. The hooks help: they show the desk at session start, save "remember…" and corrections by themselves, raise what the user calls urgent, and remind you before you stop. Ask only when two readings lead to different work, in one sentence.

**Change the desk only with the command** (`C` = `node .agentkit/desk.mjs`; one line out, never read or edit `.desk/desk.json` or `DESK.md` yourself; `C help` lists everything):

| When | Command |
|---|---|
| user asks for work | `C add P1 "what" --done "<check that proves it>" --now` |
| something for later / noticed on the way | `C add P2 "…"` · raw note: `C inbox "…"` |
| switch task | `C start Q-8 --next "where I stopped"` |
| progress | `C next "the very next step"` |
| blocked on someone/something | `C wait Q-7 --on user\|Q-3\|"API team" [--until 2026-12-01]` → `C resume Q-7` |
| finished | `C done --proof "<the check that passed>"` (prints what is next) |
| no longer wanted | `C drop Q-7 --why "<user's words>"` · mistake: `C undo` |
| too big | `C split Q-7 "part a" "part b"` (in order; the parent closes with them) |
| fix a task | `C edit Q-7 --text/--prio/--done/--files/--deps …` |
| a decision or fact worth keeping | `C remember "…" [--pin]` |
| a lesson (what went wrong, what works) | `C lesson "…"` (same lesson again counts ×2) |
| the goal changed | `C goal "destination" "how we know we arrived"` |

**Priority**, from the user's behavior: P0 blocks the goal or harms now / the user said urgent / raised twice. P1 moves the goal now / asked this session. P2 useful, can wait / "later", your own ideas. P3 nice to have.
**Remember** what the user corrected, repeated, said always/never about, or what cost real time (build commands, paths, decisions). **Don't file** one-off details or what code and git already record.
**Anti-drift:** every task serves the goal. Small off-goal requests: do them, file them P2+. Direction clearly changed: update the goal and say so in one line.

## Session loop
1. Read the surface the hook printed (or `C status`). Goal missing → infer it, `C goal …`, say it in one line. Build/test commands unknown → find them, `C remember` them.
2. Apply approved proposals first. Never act on pending ones.
3. The user's request is the task (`add … --now`; the old one is parked with its next step). Search memory and lessons for what you are about to touch (`C list --all`).
4. Work in small steps, run the checks, commit each green step. New things on the way → `C add P2` or `C inbox`; don't wander off.
5. Before ending: inbox empty (`C file ID task|memory|lesson` or drop), the task `done` or its `next` set, commit code and `.desk/` together.

## Getting help: the cheapest rung that is enough
| Tier | When | How |
|---|---|---|
| T0 yourself | 1–3 files, clear | as above |
| T1 subagent | long reading/surveys, small edits that would bloat your context | your harness's subagent; `C add … --executor subagent`, `C start ID` |
| T2–T4 workers (Orca) | one module with many builds; several modules or parallel plans that need a test gate | read `.agentkit/docs/team.md` first; the first worker of a session needs the user's yes (`C team allow --quote "…"`) |

## Getting better (proposals)
Rearrange the desk freely. Anything that changes **how** work is done — project rules, tooling, structure, dependencies — needs the user's yes:
- A lesson seen ×2 → `C propose "title" --change "exact change" --why "evidence" --from L-3`; prefer a test, lint or script over a rule.
- Ask in one sentence at a natural pause. A yes → `C approve P-001 --quote "<their words>"`, then apply. No or silence → leave it.
- Project rules go to `.desk/rules.local.md` (`### ID · override|off|P0-3`, citing the proposal). They override the profession rules below by ID.

## Safety
Ask before: deleting files outside the task, `git push`, merges, force operations, deploys, adding/removing dependencies, starting workers. Never edit kit files or the agentkit block (the hook blocks it).
