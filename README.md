<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="agent-work-kit logo">
</p>

<h1 align="center">agent-work-kit</h1>

<p align="center">
  <strong>Every session starts where the last one stopped.</strong><br>
  A shared desk for coding agents: it remembers the work, splits big jobs across a team, and reports <em>done</em> only with proof.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-1B5244">
  <img alt="Node 18 or later" src="https://img.shields.io/badge/node-%E2%89%A518-1B5244">
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-1B5244">
</p>

<p align="center">
  English · <a href="README.vi.md">Tiếng Việt</a>
</p>

---

## Contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [The dashboard](#the-dashboard)
- [Team mode](#team-mode)
- [Safety](#safety)
- [Supported harnesses](#supported-harnesses)
- [Rules and self-improvement](#rules-and-self-improvement)
- [Command reference](#command-reference)
- [What gets installed](#what-gets-installed)
- [Token cost](#token-cost)
- [Adding a profession](#adding-a-profession)
- [Development](#development)
- [Known limitations](#known-limitations)
- [FAQ](#faq)

## Overview

Coding agents are capable, but they lose the thread: a new session forgets the goal, a side idea derails the current task, and "done" is often reported without evidence. **agent-work-kit** fixes this by giving each project a single working desk, `.desk/`, plus the hooks and skill that make agents use it.

On the desk there is the goal, the task in progress, the queue, what is waiting on someone else, things worth remembering, lessons learned, and what each worker is doing. As a result the agent:

- always knows the goal, the current task and the next one, across sessions and after context compaction;
- stays on track: one task at a time, new ideas go to the queue;
- notices what matters from how you talk to it, with no commands for you to learn;
- splits large jobs across several workers (through [Orca](https://github.com/stablyai/orca)), each in its own git worktree, checked by a tester, merged only once proven;
- improves its own way of working, but every rule change needs your explicit approval.

**You do nothing extra.** Install it, then work with your agent as usual.

| | |
|---|---|
| **Zero dependencies** | Node 18 or later, ESM, built-ins only |
| **Stays in your project** | writes only inside the project directory; `remove` restores every file byte for byte |
| **Harness-neutral** | Claude Code, Codex, OpenCode, Pi, Oh My Pi, Cursor |
| **Cheap** | about 20 tokens per desk update, 0 for an ordinary message |

## Quick start

**1. Install** (Node 18 or later, nothing else to install):

```bash
npx github:nguyennamkkb/agent-work-kit init --universal
```

`--universal` suits any kind of work: research, writing, planning, analysis, learning something new, or code. The agent follows established working methods:

| Method | What the agent does for you |
|---|---|
| Definition of done (SMART) | before starting, states what will exist, for whom, within which limits, and how it will be checked |
| Sourced research | looks up the standard approach in unfamiliar fields; important facts need at least two sources; never invents figures or citations |
| MECE breakdown | splits work into checkable steps; tries the riskiest step first |
| Decision matrix | when a choice is needed, presents 2–3 options with pros, cons and cost, then recommends one and says why |
| Pre-mortem | before anything hard to undo (money, legal, health, sending, deleting), lists what could go wrong, prepares a fallback and asks you first |
| PDCA with proof | checks each step against criteria and reports done only with evidence |
| Professional templates | conclusion first for reports (pyramid principle); milestones, owners and risks for plans; ask, context and next step for emails |
| Teach while working (BLUF) | answers first, then explains; defines new terms and remembers them for you |
| Small first version | shows an outline or draft early so you can steer |
| After-action review | closes each task with one lesson for next time |

<!-- Hidden for now (not fully tested). To restore, add back under the install step:
| `--ios` | iOS developer (SwiftUI, Xcode; done means a green build and tests) | preview |
| `--designer` | product designer (Figma over MCP, library tokens) | preview |
-->

The kit detects which harness your project uses. If it finds none, it installs for Claude Code.

**2. Trust once.** This step belongs to the harness itself, so the kit cannot do it for you:

| Harness | What to do |
|---|---|
| Codex | open Codex in the project, run `/hooks` and trust the agent-work-kit hooks |
| Pi | choose to trust the project when Pi asks the first time |
| Others | nothing |

**3. Work as usual.** Tell the agent what you need. The desk follows along:

| You say | The desk does |
|---|---|
| "build the login screen" | becomes the task in progress, with a done condition the agent infers |
| "urgent", "important" | the task you mention moves to P0 |
| "later", "next week" | queued at low priority, not started now |
| "waiting for Alex to send the API" | the task moves to **waiting**, and returns on its own when unblocked |
| "drop that" | the task is dropped, with your words as the reason; recoverable |
| "remember: always build with scheme Lumen-Dev" | saved to memory immediately; remembered next session |
| "wrong, don't edit that file" | recorded as a lesson; if it recurs, the agent proposes a root-cause fix |
| "ok" (answering a proposal) | proposal approved, with your exact words attached |
| "split this across the team" | the agent asks you one question, then opens workers |

**4. Look at the desk any time:**

- `.desk/desk.html`: the dashboard, opened in a browser, refreshes every 10 seconds ([details](#the-dashboard));
- `.desk/DESK.md`: a quick read, tracked in git;
- `npx github:nguyennamkkb/agent-work-kit desk`: the same view in the terminal.

## How it works

The desk is one data file, `.desk/desk.json`. The agent changes it only through one command, `node .agentkit/desk.mjs <command>`, one line at a time, and never edits the file by hand. This gives three guarantees:

- each operation costs about 20 tokens;
- the data can never become malformed;
- every change has history and can be undone.

### Task lifecycle

```
 inbox ──▶ todo ──▶ doing ──▶ (review) ──▶ done
             ▲  │     │
             │  ▼     ▼
           waiting   dropped (with a reason, undoable) · failed
```

| State | Meaning |
|---|---|
| `inbox` | quick capture, not yet triaged (must be sorted before the session ends) |
| `todo` | queued, ordered P0 to P3, then by how often it was mentioned |
| `doing` | in progress. The lead agent works on **one** task; workers may run in parallel |
| `waiting` | blocked on you, another task, an outside party, or a date; returns to `todo` automatically |
| `review` | a worker reports done; the lead agent is checking |
| `done` | finished, **always with proof** (the check command that ran, a commit sha) |
| `dropped`, `failed` | cancelled or failed, always with a reason |

### What the desk does by itself, at no token cost

- **Session start:** shows a compact desk of about 100 tokens: goal, current task, waiting items, next items, things to remember.
- **Housekeeping:**
  - a task nobody touches for 5 sessions drops one priority level; an old P3 is dropped (recoverable);
  - anything mentioned 3 or more times is pinned to memory;
  - waiting tasks return on their due date.
- **Reading what you say:** saves "remember…" and corrections, raises priority when you say "urgent". Ordinary messages cost 0 tokens.
- **Before the agent stops:** reminds once if the inbox is not empty, if code changed but the desk was not updated, or if a worker report is unchecked.
- **Large tasks:** `split` breaks a task into subtasks that run in order; the parent completes when all children do.

### Priority, inferred from how you work

| | When |
|---|---|
| P0 | blocks the goal or causes harm now; you said urgent or important, or mentioned it twice in a session |
| P1 | moves the goal forward; what you asked for in this session |
| P2 | useful but can wait; "later", the agent's own ideas |
| P3 | nice to have |

## The dashboard

`.desk/desk.html` is a single file: no server, no network, open it straight in a browser. It follows the system light or dark setting, works on a phone, and refreshes every 10 seconds while keeping your filters, tab and scroll position. Open it and three questions are answered at once.

| Section | Tells you |
|---|---|
| **Health light** | green, yellow or red, with the reason (a failed task, a silent worker, a question waiting over 30 minutes…) |
| **Metrics** | doing, queued, waiting, in review, done in 7 days (with a chart), median cycle time, rework rate |
| **Needs you** | worker questions, reports to check, proposals to approve, failed tasks, tasks waiting on you, the inbox. Each item carries its command, one click to copy |
| **Team** | one card per worker: role, agent and model, task, plan, worktree, running time, latest note, files, lease, sha; warns on **silent > 15 minutes** and on open questions; shows which roles are idle |
| **Timeline** | one lane per role, over 24 hours or 7 days: who worked on what, and whether work truly ran in parallel |
| **Plans** | progress by colour (done, in review, doing, waiting) and worktree state |
| **Model performance** | runs, active, done, failed, success rate and cycle time per model, for tuning routing |
| **Board** | kanban filtered by plan, role or agent, with search and a work-in-progress limit |
| **Activity** | the 60 latest events: dispatch, question, reply, done, lease… |
| **Knowledge** | memory, lessons, proposals, leases |

Click any task for full detail: history, route, brief, proof, sha, dependencies and subtasks. Metrics are computed inside the kit (and tested); the page only displays them.

## Team mode

> Requires [Orca](https://github.com/stablyai/orca) and `git`. Without Orca the desk still works fully for a single agent and the harness's own subagents.

The agent picks the **cheapest tier that is enough** and climbs only on evidence (more than about 3 files, more than about 15 tool calls, or a second red build):

| Tier | Who works | Where | Use for |
|---|---|---|---|
| T0 | the main agent | current checkout | 1–3 clear files |
| T1 | harness subagent | current checkout | heavy reading, surveys, read-only review |
| T2 | one Orca worker | current checkout or the plan's worktree | one module, repeated builds, long runs |
| T3 | engineer + tester | the plan's own worktree | several modules, needs a test gate, runs beside another plan |
| T4 | one lead per plan | one worktree per plan | two or more plans at once |

**A fixed workflow:** plan, task, dispatch, verify, close.

1. **Plan.** `desk plan login --goal "…"` creates a plan file: decisions, function signatures, step order, files per step, done criteria.
2. **Task.** Each assignment is a task on the desk that names the files it owns. Two open tasks may not hold the same file.
3. **Dispatch.** `desk dispatch Q-9` picks the agent and model from the routing table, writes the worker brief, opens the worker in the plan's worktree and records everything. The first time in a session, **the agent must ask you**, and the command refuses to run without your answer.
4. **Don't wait.** After dispatching, the agent ends its turn. Orca wakes it when a worker reports; `desk mail` reads the mail and updates the desk.
5. **Verify before done.** Check that the sha exists, read the diff against the plan, then mark `done`.
6. **Merge gate.** `desk gate login` checks that every task is closed, the tester is green on the current HEAD, the branch is rebased on main and the worktree is clean. Merge happens only when you agree.

**One name for a plan, used in four places:** the file `plans/<date>-login.md`, the worktree `plan-login`, the branch `plan/login`, and tasks tagged `--plan login`.

**Guard rails that keep the team on course:**

- **Leases.** An exclusive resource (for example a test device) can be held by one tester at a time.
- **Four-way triage** for every red report: environment (rerun), a bug in the plan (send to a fixer), a design gap (stop and decide), or out of scope (note it).
- **Two fix rounds.** After two failed rounds the agent escalates to a stronger model or does it itself.
- **Disciplined pausing:** `PAUSE`, `RESUME`, `REBASE`, `ABORT`. A worker commits its partial work before stopping.
- **Limits:** at most 3 workers and 3 worktrees (configurable).

**Routing** lives in `.desk/team.json`. Candidates look like `agent[:model][@effort]`, for example `claude:claude-sonnet-5-5@low` or `omp:provider/model@high`. Defaults are generated from the agent CLIs installed on your machine, using each agent's default model. `desk team check --live` validates routing against the real model list.

The full guide for agents is [`kit/method/docs/team.md`](kit/method/docs/team.md), installed as `.agentkit/docs/team.md`.

## Safety

| Concern | How the kit handles it |
|---|---|
| The agent deletes a task by mistake | `drop` requires a reason and is archived; `desk undo` goes back 30 steps |
| The agent takes on big actions unasked | push, merge, force, deploy, adding or removing dependencies and opening the first worker all require asking you. Claude Code is also configured with "ask" permissions for `git push`, `rm -rf`, `git reset --hard` and similar |
| The agent rewrites its own rules | a change to rules, tools or structure needs a proposal with evidence, approved only with your exact words |
| Agents fight over files | each file is owned by one task; lead files (for example `project.pbxproj`) are edited only by the lead agent |
| Unchecked code gets merged | the gate needs a green tester on the exact current HEAD; abandoning a plan prints the sha for recovery |
| Workers run up a bill | at most 3 workers; dispatch stops after 2 failures; models matching a `deny` pattern (default `*free*`) are blocked |
| The kit damages your project | it writes only inside the `agentkit:start/end` region and merges JSON instead of overwriting; `remove` restores every file byte for byte |
| The kit writes elsewhere on your machine | it writes **only inside the project directory** and cleans its own `npx` cache after every run |
| Files grow over time | nothing changes means nothing is written; the journal is capped at 256 KB; the archive is split by month and stores summaries; old memory, lessons and worker briefs are pruned at session start (recoverable with `restore`) |
| A plugin error hangs the harness | every plugin and hook fails open: on error the harness keeps running normally |

## Supported harnesses

Four mechanisms: show the desk at session start, read your messages, block bad writes, remind before stopping. All four share one set of scripts in `.agentkit/hooks/`. Each harness connects through its own native mechanism:

| Harness | Integration | Skill | Desk | Reads messages | Blocks bad writes | Reminds on stop |
|---|---|---|---|---|---|---|
| Claude Code | hooks in `.claude/settings.json` | `.claude/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Codex | hooks in `.codex/hooks.json` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Pi | extension `.pi/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Oh My Pi | extension `.omp/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| OpenCode | plugin `.opencode/plugins/agentkit-desk/` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Cursor | rule `.cursor/rules/agentkit-desk.mdc` | (the rule itself) | checklist | – | – | – |

- Every harness reads `AGENTS.md`; Claude Code reads it through an `@AGENTS.md` line in `CLAUDE.md`.
- Plugins and extensions use only Node built-ins and import nothing from outside, not even the harness's own SDK.
- Orca workers can be any agent Orca supports: claude, codex, omp, pi, opencode, cursor.

## Rules and self-improvement

Rules come in three layers, resolved by ID:

1. **Desk method** (`kit/method/SKILL.md`): the same for every profession.
2. **Profession pack** (`kit/profession/<name>/rules.md`): each rule has an ID, a priority, a reason and a way to check it.

   ```markdown
   ### BE-001 · P0
   Before reporting done, run the project's build + test command and show the summary.
   - Why: "done" without a green build is the most common false report.
   - Check: test output appears in the session before "done".
   ```

3. **Project rules** (`.desk/rules.local.md`): override, switch off, or add (`LOCAL-001 · P2`) by ID. Every rule must cite an approved proposal.

Precedence: project rules, then profession rules, then the desk method.

**Self-improvement loop:**

1. A lesson seen twice or more leads the agent to write a proposal (`desk propose …`) with evidence, the concrete change, a success metric and how to roll it back.
2. The agent asks you one question. Answer "ok" and the proposal is approved.
3. The agent applies it and commits.

**Updating the kit:** run `npx github:nguyennamkkb/agent-work-kit update`.

- The kit diffs each rule by ID: new rules are added, changed rules are applied.
- A rule your project overrides is kept as is. The kit leaves a note, and the agent tells you once.
- A v1 desk (markdown files) is migrated to `desk.json` automatically; the old files are kept in `.desk/archive/v1/`.

## Command reference

**Installer** (`npx github:nguyennamkkb/agent-work-kit <command>`):

| Command | Purpose |
|---|---|
| `init --<profession>` | set up the desk, install profession rules and hooks for your harnesses |
| `switch --<profession>` | change profession, keeping the desk; also adds a harness (`switch --codex`) |
| `update` | update the kit and profession rules (by ID); migrate a v1 desk to v2 |
| `desk <command>` | the desk command (table below), for humans |
| `review` | review and approve proposals in the terminal (optional; normally you answer in chat) |
| `doctor` | check the installation: kit files, desk, team, routing, profession tools |
| `remove` | uninstall the kit and restore your files; keeps `.desk/` unless `--purge-desk` |
| `list` | list professions and harnesses |

**Desk commands** (agents call `node .agentkit/desk.mjs <command>`; you call `npx … desk <command>`):

| Group | Commands |
|---|---|
| View | `status` · `list [--all]` · `show Q-7` · `log` · `compact` |
| Tasks | `add [P0-3] "…" [--done "check"] [--now] [--files a,b] [--deps Q-1] [--plan slug] [--role r]` · `edit Q-7 --prio/--text/--done/--files …` · `start Q-7` · `next "next step"` |
| | `wait Q-7 --on user\|Q-3\|"who" [--until YYYY-MM-DD]` · `resume Q-7` · `done [Q-7] --proof "…"` · `drop Q-7 --why "…"` · `split Q-7 "a" "b"` · `undo` · `restore Q-7` (recover from the archive) |
| Memory and learning | `remember "…" [--pin]` · `forget M-2 --why` · `lesson "…"` · `propose "…" --change … --why …` · `approve P-001 --quote "…"` |
| Direction | `goal "target" "how we know we arrived"` · `inbox "…"` · `file Q-9 task\|memory\|lesson` |
| Team | `team [check\|allow\|set]` · `plan slug` · `route role` · `dispatch Q-9` · `mail` · `reply Q-9 "…"` · `send Q-9 --subject PAUSE` · `sync --apply` · `fleet` · `lease` · `wt status\|open\|park\|close\|drop\|tidy` · `gate slug` |
| Worker | `worker Q-9 status\|ask\|escalate\|inbox\|lease\|done` |

## What gets installed

```
AGENTS.md                         the kit's region (between agentkit:start/end) + your own content below
CLAUDE.md                         @AGENTS.md (when using Claude Code)
.agentkit.json                    manifest: version, profession, rules, a hash per file
.agentkit/desk.mjs                the desk command
.agentkit/hooks/                  shared hooks + desk core (store) + team + dashboard
.agentkit/docs/team.md            team guide (the agent reads it only when using workers)
.claude/skills/desk/SKILL.md      the single skill: method + profession rules
.claude/settings.json             hooks + "ask" permissions, merged, never overwritten
.agents/skills/desk/SKILL.md      the same skill, for Codex, Pi, Oh My Pi, OpenCode
.codex/hooks.json · .pi/extensions/ · .omp/extensions/ · .opencode/plugins/ · .cursor/rules/   (per harness)
.mcp.json                         MCP servers a profession needs (only when its pack declares them)
.desk/
  desk.json      desk data (commit)            DESK.md       readable copy (commit)
  team.json      team profile: build, test, routing (commit)
  plans/         plans and worker briefs        review/       P-* proposals, U-* update notes
  archive/       YYYY-MM.md (readable) + YYYY-MM.jsonl (summaries)   rules.local.md  project rules
  desk.html · .state.json · .journal.jsonl · .undo/   (not committed; already in .desk/.gitignore)
```

**The kit writes only inside the project directory.**

- After every `npx` run, the kit deletes its own copy under `~/.npm/_npx/` and the entries it downloaded from the npm cache. Set `AGENTKIT_KEEP_CACHE=1` to keep them.
- What remains outside the project is not created by the kit: npm's logs, and the trust records kept by Codex and Pi.
- A plan's worktree is created by Orca inside Orca's workspace directory and deleted when the plan closes.

## Token cost

Measured on the demo project, estimating 4 characters per token:

| | Before (v1) | Now |
|---|---|---|
| One desk update | ~300–500 (read, then edit a markdown file) | **~20–25** (one command, one result line) |
| An ordinary message | ~46 | **0** |
| A "remember…" or a correction | the agent writes it (~400) | the hook writes it; the agent receives ~30–50 |
| Desk at session start | ~83 | ~100 (adds waiting items and team status) |
| `AGENTS.md` + skill (fixed per session) | ~2,950 | ~2,170 (method ~1,190 + 7 profession rules ~650 + `AGENTS.md` ~330) |
| Team guide | – | ~2,000, **read only when using workers** |

The fixed part is cached by the harness, so it is much cheaper after the first turn. Most of the old cost came from desk updates, and that part is down by about 95%.

**File I/O over long use:**

- An ordinary message writes at most one small journal line, plus `desk.json` if the message touches an item; each item is counted once per day.
- The dashboard and `DESK.md` are redrawn only when the desk really changes.
- After a year, `.desk/` is around 1–2 MB, rather than tens of MB if it kept growing.

## Adding a profession

Create `kit/profession/<name>/` with two files.

**`profession.json`:**

```json
{
  "name": "backend",
  "title": "Backend",
  "version": "1.0.0",
  "description": "Backend services in Go",
  "checks": [{ "cmd": "go", "required": false, "hint": "install Go" }],
  "team": { "build": "go build ./...", "test": { "command": "go test ./...", "exclusive": "" }, "leadFiles": ["go.mod"] },
  "mcp": {}
}
```

**`rules.md`:** an opening section (Task, Done, priority hints, things worth remembering), then rules as `### BE-001 · P0`, each with a `- Why:` and a `- Check:` line.

The `--backend` flag then exists automatically. Bump `version` every time you edit the rules so `update` diffs correctly. Tests check every pack: no duplicate IDs, every rule has `Why` and `Check`, and the combined skill stays under 220 lines.

## Development

```bash
npm test                       # engine, desk, hooks, team (with a fake Orca), each harness, the CLI
UPDATE_SNAPSHOTS=1 npm test    # when you intentionally change adapter output
node bin/cli.js init --universal -y --dir /tmp/demo
```

```
bin/cli.js            CLI entry point
src/commands/         init, switch, update, desk, review, doctor, remove, list
src/lib/              engine (file writes, manifest, rule diff by ID, v1 migration), markers, JSON merge, cache cleanup
src/adapters/         one adapter per harness
kit/method/           SKILL.md, docs/team.md, desk.mjs, hooks/ (_lib, store, team, cli, 5 hooks, dashboard), bridge/, desk/ (template)
kit/profession/       profession packs
test/                 kit, desk, storage, team, harness; fixtures/fake-orca.mjs
```

The technical specification is [DESK-SPEC.md](DESK-SPEC.md).

## Known limitations

- Detecting corrections, urgency, "later" and approvals relies on keywords (Vietnamese and English), so it can miss or misfire. If it misfires, `undo` or `forget` fixes it.
- Each harness was checked by loading the exact files the kit generates, against API shapes verified on installed versions (Codex 0.171, OpenCode 2.3.2, Pi 1.6.0, omp 18.3.2). End-to-end runs with a real model are not yet complete.
- Team mode is tested with a fake Orca in the test suite, and with read-only commands against real Orca 1.4.268. The workflow (per-plan worktrees, leases, triage, merge gate) is rewritten from orca-orchestrator, which ran for real on Orca 1.4.246. T4 phase A (a lead opening child workers itself) is blocked by Orca by default.
- Cursor has no hooks, so it gets a checklist only.

## FAQ

**Do I have to learn the commands?** No. The agent calls them. The tables are for when you want to look or adjust things yourself.

**What if the agent misunderstands me?** Tell it plainly: "no, that isn't done", "drop the other task". Your correction becomes a lesson. If you slip, `desk undo`.

**What if I don't have Orca?** Everything works with a single agent, plus harness subagents at tier T1. Team commands say clearly that they need Orca and do nothing else.

**Where does my data go?** Only into the project's `.desk/`. The kit sends nothing out, writes nothing to your home directory, and needs no account.

**How do I uninstall?** `npx github:nguyennamkkb/agent-work-kit remove`. Your files return to exactly how they were before install. Add `--purge-desk` to delete the desk too.

## License

MIT, as declared in `package.json`.
