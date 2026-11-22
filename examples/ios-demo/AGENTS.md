<!-- agentkit:start -->
<!-- Managed by agent-work-kit (`npx github:nguyennamkkb/agent-work-kit update`). Do not edit inside. Project notes go below the end marker; project rules go to .desk/rules.local.md. -->
# Desk — iOS (agent-work-kit)
All work lives on the desk (`.desk/desk.json`): goal, the task in progress, queue, waiting work, memory, lessons, workers. Nothing important lives only in chat.
- Load the **desk** skill (`.agents/skills/desk/SKILL.md`) at the start of every session and follow it: the method + the iOS profession rules.
- Change the desk only with `node .agentkit/desk.mjs <verb>` (`help` lists them); never edit `.desk/desk.json` or `DESK.md` by hand.
- The user never maintains the desk: infer goal, tasks, priorities and what to remember from how they work. Ask only when two readings lead to different work.
- Workers (Orca): read `.agentkit/docs/team.md` first; the first worker of a session needs the user's yes.
- Ask before: deleting files outside the task, `git push`, merges, force operations, deploys, adding/removing dependencies. Changing rules or tooling needs a proposal the user approves.
- Tools without the kit's hooks: run `node .agentkit/desk.mjs status` first, file what the user says with the command, and before ending sort the inbox and set the task done or next.
<!-- agentkit:end -->
