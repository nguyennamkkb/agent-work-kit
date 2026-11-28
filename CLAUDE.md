<!-- agentkit:start -->
<!-- Managed by agent-work-kit (`npx github:nguyennamkkb/agent-work-kit update`). Do not edit inside. Project notes go below the end marker; project rules go to .desk/rules.local.md. -->
@AGENTS.md

Claude Code: the desk skill is `.claude/skills/desk/SKILL.md`. Hooks show the desk at session start, file what the user says (remember → memory, corrections → lessons, urgent → P0), keep `.desk/` writable only through `node .agentkit/desk.mjs`, and check the desk before you stop. Subagents are tier T1 (`add … --executor subagent`). When a hook blocks you, do what it says; never work around it.
<!-- agentkit:end -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`agent-work-kit`: a zero-dependency Node ≥ 18 ESM CLI, installed with `npx github:nguyennamkkb/agent-work-kit init --<profession>`. It writes a "desk" (`.desk/`) plus hooks, a skill and harness wiring into a target project, so coding agents (Claude Code, Codex, OpenCode, Pi, Oh My Pi, Cursor) keep a task board, memory and lessons, and can lead a team of Orca workers. User-facing docs (`README.md`, `DESK-SPEC.md`) are in Vietnamese. Code, comments and the agent-facing kit text are in English.

## Commands

```bash
npm test                                              # all tests (node:test), ~70 tests
node --test test/desk.test.js                         # one file
node --test --test-name-pattern="worker side" test/team.test.js   # one test
UPDATE_SNAPSHOTS=1 npm test                           # accept intended adapter output changes (test/__snapshots__/)
node bin/cli.js init --ios -y --dir /tmp/demo         # try an install locally
node /tmp/demo/.agentkit/desk.mjs help                # the desk command as installed
cd examples/ios-demo && node ../../bin/cli.js update  # refresh the committed demo after changing kit output
```

There is no build or lint step. Never add npm dependencies. Everything under `kit/` is copied into user projects and may import only `node:` built-ins; `test/harness.test.js` enforces this for the generated host files.

## Architecture

There are two halves. A **CLI** (`bin/`, `src/`) installs and updates files. The **kit runtime** (`kit/method/`) is copied into each project as `.agentkit/` and runs there.

**Installer pipeline** (`src/`):
1. `lib/bundle.js` `loadKit(profession)` builds one neutral description from `kit/method/` and one `kit/profession/<name>/` pack: the skill text, rules parsed by ID, hook scripts, CLI, docs, desk templates and a `team.json` seed.
2. `adapters/index.js` `collectOutputs` asks each adapter (AGENTS.md block, shared hooks, then one adapter per harness) for its outputs and dedupes them by path.
3. `lib/engine.js` `sync` writes the outputs. There are four write kinds:
   - `file`: hash recorded in `.agentkit.json`; a hand-edited file gets a `.kit-new` sibling instead of being overwritten.
   - `block`: content between `<!-- agentkit:start/end -->` in AGENTS.md/CLAUDE.md.
   - `json`: patch/revert merge; the original text is stored so `remove` restores it byte for byte.
   - `seed`: the desk; created once, never overwritten.

   `sync` also diffs profession rules by ID across versions (a rule the project overrides is kept, with a `U-*` note), migrates v1 desks, and merges missing lines into `.desk/.gitignore`.

**Kit runtime** (`kit/method/hooks/`, installed as `.agentkit/hooks/`):
- `_lib.mjs`: basics. Root discovery (`projectDir`; `deskRoot` resolves a git worktree to the main checkout so the whole team shares one desk), lock and atomic write, rules parsing and lint, user-prompt signal regexes, and `normalizeWrites`, which turns every harness's file-write tool shape (Claude Edit/Write, Codex `apply_patch`, Pi `edits[]`, OpenCode `filePath/oldString`) into `{path, next}`.
- `store.mjs`: the board, `.desk/desk.json` (v2). Item model, task lifecycle (`inbox → todo → doing → review → done`, plus `waiting`, `dropped`, `failed`), and the invariants: one lead `doing` task, `done` needs proof, `drop` needs a reason. Also `mutate()`, which locks, snapshots for undo and re-renders `DESK.md`/`desk.html`; auto-sort; archive; and the v1 → v2 migration.
- `team.mjs`: orca-orchestrator ported to Node. Team profile `.desk/team.json`, routing (`agent[:model][@effort]`, with per-agent effort rules from Orca 1.4.268; Claude-model defaults merged per role; `route learn` / `dispatch --prefer` save what the user names after a PONG ping when the model list cannot vouch for it), `dispatch` (refuses until `team allow --quote` in the current session), mail/reply/send/sync/fleet, plan worktrees, leases, worker-side `done` scope checks, merge `gate`.
- `cli.mjs`: the `desk` command (`.agentkit/desk.mjs` → `main`). `src/cli.js` passes `desk …` argv through untouched.
- Hooks: `session-start`, `capture`, `guard` (exit 2 + stderr blocks a write), `desk-check`, `stop-check` (`{"decision":"block"}`, reminds once per problem set). Agents must change `.desk/desk.json` only through the command; `guard` lets them write `plans/`, `review/`, `team.json` and `rules.local.md` directly.
- `kit/method/bridge/` (`bridge.js` + `pi-host.js`/`opencode-host.js`) is concatenated into the Pi/omp extension and the OpenCode V2 plugin. Those hosts spawn the same hook scripts and fail open.

**Content**: `kit/method/SKILL.md` (method) and `docs/team.md` (team guide, read on demand). Each profession pack is `kit/profession/<name>/profession.json` + `rules.md`:
- the preamble must contain `**Done**`;
- each rule is `### PREFIX-NNN · P0-3` with `- Why:` and `- Check:`;
- the combined skill must stay under 220 lines (all checked by tests);
- bump the pack `version` whenever you edit its rules, so `update` reports per-rule changes.

## Gotchas

- npm drops `.gitignore` from packages, so the desk template ships as `kit/method/desk/gitignore` and is renamed on seed. A test compares `npm pack` contents with `git ls-files`, so new kit files must be tracked.
- Manifests written before 0.2 store the profession under `nghe`; `loadManifest`/`findManifest` map it to `profession`. Keep that compatibility.
- Team tests use `test/fixtures/fake-orca.mjs` through the `AGENTKIT_ORCA`, `FAKE_ORCA_DIR` and `FAKE_ORCA_REPO` env vars; it creates real git worktrees. Routing pings go through `test/fixtures/fake-ping.mjs` via `AGENTKIT_PING`. Do not launch real Orca workers without the user's explicit yes.
- `bin/cli.js` calls `selfClean()` after every command: when run from the npx cache it deletes its own `_npx` folder and cacache entries (`AGENTKIT_KEEP_CACHE=1` disables this).
- `examples/ios-demo/` is generated kit output, committed as a sample. Its `.desk/` is real usage data.
