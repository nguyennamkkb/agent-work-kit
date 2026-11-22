#!/usr/bin/env bash
set -uo pipefail
L="${1:-run}"
D="${DESK_TEAM_DIR:-$HOME/Documents/dev/desk-team-test}"
OUTDIR="${DESK_TEAM_RESULTS:-$HOME/Documents/dev/desk-team-results}"
ORCA="${ORCA_CLI_COMMAND:-orca}"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/$(date +%Y%m%d-%H%M)-$L.md"
C="node $D/.agentkit/desk.mjs"
sec() { printf '\n## %s\n\n```\n' "$1" >> "$OUT"; ( cd "$D" && eval "$2" ) >> "$OUT" 2>&1; printf '```\n' >> "$OUT"; }
echo "# Team test — $L — $(date -Iseconds)" > "$OUT"
sec "Desk status" "$C status"
sec "All items" "$C list --all"
sec "Closed (log)" "$C log 50"
sec "Team" "$C team"
sec "Plan worktrees" "$C wt status"
sec "Gate (per plan)" 'for p in $(ls .desk/plans | sed -n "s/^[0-9]*-\(.*\)\.md$/\1/p"); do echo "== $p"; '"$C"' gate "$p"; done'
sec "Git (all branches)" "git log --all --graph --oneline --decorate | head -60"
sec "Worktrees" "git worktree list"
sec "Build and tests on main" "node scripts/check.mjs; node --test 2>&1 | tail -15"
sec "Plans" 'for f in .desk/plans/*.md; do echo "=== $f"; cat "$f"; done'
sec "Worker briefs sent" 'for f in .desk/plans/specs/*.md; do echo "=== $f"; cat "$f"; done'
sec "Journal and state" "cat .desk/.state.json; cat .desk/.journal.jsonl"
sec "Orca workers" "$ORCA orchestration worker-list --full --json 2>/dev/null | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{for(const w of (JSON.parse(s).result?.workers||[]))console.log(w.dispatchId,w.dispatchStatus,w.workerState,w.terminalState,(w.projection?.provider?.id||\"\")+\"/\"+(w.projection?.provider?.model||\"\"))}catch{console.log(s.slice(0,400))}})'"
echo "$OUT"
