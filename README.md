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

## Why

Agents lose the thread. A new session forgets the goal, a side idea derails the current task, and "done" is reported without evidence.

agent-work-kit puts one working desk, `.desk/`, in your project and wires your agent to it. The agent:

- **remembers**: goal, current task, queue, lessons, across sessions and context resets;
- **stays focused**: one task at a time, new ideas go to the queue;
- **proves it**: a task is done only with evidence, such as a passing check or a commit sha;
- **works as a team**: big jobs are split across parallel workers through [Orca](https://github.com/stablyai/orca), each in its own git worktree.

You learn no commands. Install it, then talk to your agent as usual.

## Install

```bash
npx github:nguyennamkkb/agent-work-kit init --universal
```

Needs Node 18 or later. No other dependencies. The kit detects your harness and installs for it, or for Claude Code if it finds none.

One extra step for two harnesses, because trust is the harness's own security check:

- **Codex:** run `/hooks` in the project and trust the hooks.
- **Pi:** trust the project when asked.

## See it work

You talk normally. Hooks read each message and keep the desk up to date:

```text
You   build the profile screen
Desk  Q-7 Profile screen → doing

You   urgent, the expired-token bug matters more
Desk  Q-4 Fix token bug → P0

You   oh, the button color change can wait
Desk  Q-12 Change button color → queue (P2)

You   waiting for Sam to send the API, then continue
Desk  Q-6 → waiting, resumes when it is unblocked

You   remember: always build with scheme X
Desk  M-2 → memory, kept for every future session

You   wrong, don't edit that file
Desk  L-3 → lesson. Seen twice, it becomes a proposal and waits for your OK

You   tidy up the label on the button
Desk  (nothing recorded, 0 tokens)
```

Every new session opens with the desk, about 100 tokens, so the agent never asks "where were we?":

```text
desk status
Goal       Ship the checkout flow
Doing      [P0] Q-4 Fix expired-token bug
           next: write the refresh test
Waiting    Q-6 waiting on Sam for the API, until Dec 1
Next       [P1] Q-7 Profile screen
Remember   Always build with scheme X
Just done  Q-3 Login button
```

## A task's life

```
 inbox ──▶ todo ──▶ doing ──▶ (review) ──▶ done  ← needs proof
             ▲  │     │
             │  ▼     ▼
           waiting   dropped (reason, recoverable) · failed
```

- **One task at a time** for the lead agent. New work queues up.
- **No proof, no done.** `done Q-4` is refused. `done Q-4 --proof "tests: 42 passed"` is accepted.
- **Every detour has a reason.** Dropped and failed tasks both record why, and `desk undo` goes back.

The desk also tidies itself, at no token cost: stale tasks lose priority, anything mentioned three times is pinned to memory, and waiting tasks return on their due date.

## Dashboard

Open `.desk/desk.html` in a browser. One file, no server, refreshes every 10 seconds.

| Section | Shows |
|---|---|
| Health light | green, yellow or red, with the reason |
| Needs you | questions, reports to check, proposals awaiting approval, each with a command to copy |
| Team | who does what and for how long; warns when a worker is silent |
| Models | success rate and cycle time per model |
| Board | kanban with filters and search |

Prefer text? `.desk/DESK.md` is the same desk as a quick read, and `npx github:nguyennamkkb/agent-work-kit desk` prints it in the terminal.

## Team mode

For big jobs the agent picks the cheapest tier that is enough, and climbs only with evidence (more than about 3 files, 15 tool calls, or a second red build):

| Tier | Who works | Use for |
|---|---|---|
| T0 | the main agent | 1 to 3 files |
| T1 | harness subagent | reading, surveys |
| T2 | one Orca worker | one module, long runs |
| T3 | engineer + tester, own worktree | several modules, needs a test gate |
| T4 | one lead per plan | two or more plans at once |

The flow is fixed: **plan → task → dispatch → verify → close.**

1. `desk plan` writes the decisions, step order and done criteria.
2. Each assignment is a task that names the files it owns; two open tasks never share a file.
3. `desk dispatch` picks the model, writes the brief and opens the worker. The first worker of a session is opened only after the agent asks you.
4. The agent reads the worker's report, checks the commit and the diff against the plan, then closes the task.
5. `desk gate` lets a plan merge only when every task is closed, the tester is green on the current HEAD, and the branch is rebased. You approve the merge.

Needs [Orca](https://github.com/stablyai/orca) and `git`. Without Orca, everything still works for a single agent.

## Works with

Claude Code, Codex, OpenCode, Pi, Oh My Pi and Cursor. All share one desk. Cursor gets a rule and checklist only, because it has no hooks.

## Safe by design

- **Asks first** before push, merge, deploy, adding dependencies, or opening a worker.
- **Undo** any desk change (`desk undo`); dropped tasks are recoverable.
- **Rules change only with your approval**, quoted in your own words.
- **Stays in your project.** Nothing is sent out, no account needed, and `remove` restores every file byte for byte.

## Commands

`npx github:nguyennamkkb/agent-work-kit <command>`

| Command | Purpose |
|---|---|
| `init --universal` | set up the desk and hooks |
| `update` | update the kit and rules, keeping your overrides |
| `doctor` | check the installation |
| `desk` | show the desk |
| `remove` | uninstall (add `--purge-desk` to delete the desk too) |

## Learn more

- [`DESK-SPEC.md`](DESK-SPEC.md): the technical specification.
- [`kit/method/docs/team.md`](kit/method/docs/team.md): the full team-mode guide.

## Known limits

Detecting urgency, corrections and approvals relies on keywords, so it can miss or misfire; `desk undo` fixes it. Each harness is verified against the files the kit generates, not yet end to end with a real model.

## License

[MIT](LICENSE)
