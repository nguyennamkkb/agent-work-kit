#!/usr/bin/env bash
set -uo pipefail
D="${DESK_TEAM_DIR:-$HOME/Documents/dev/desk-team-test}"
ORCA="${ORCA_CLI_COMMAND:-orca}"
case "$D" in *desk-team-test*) ;; *) echo "refusing to clean $D (path must contain desk-team-test)"; exit 1 ;; esac

if [ -d "$D/.git" ]; then
  git -C "$D" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | while IFS= read -r wt; do
    [ "$wt" = "$D" ] && continue
    "$ORCA" terminal close --worktree "path:$wt" --all --json >/dev/null 2>&1 || true
    "$ORCA" worktree rm --worktree "path:$wt" --force --json >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do [ -d "$wt" ] || break; sleep 1; done
    case "$wt" in *plan-*|*desk-team-test*) rm -rf "$wt" ;; esac
    echo "removed worktree $wt"
  done
fi
"$ORCA" terminal close --worktree "path:$D" --all --json >/dev/null 2>&1 || true
rm -rf "$D"
"$ORCA" repo list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{for(const r of (JSON.parse(s).result?.repos||[]))if(r.path===process.argv[1])console.log(r.id)}catch{}})' "$D" | while read -r id; do "$ORCA" repo hide --repo "id:$id" --json >/dev/null 2>&1 && echo "hid Orca project $D"; done
W="${ORCA_WORKSPACES:-$HOME/orca/workspaces}/$(basename "$D")"
[ -d "$W" ] && rmdir "$W" 2>/dev/null && echo "removed empty $W"
echo "clean: $D removed (Orca keeps its Run history; nothing else of the test is left)"
