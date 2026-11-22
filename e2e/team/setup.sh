#!/usr/bin/env bash
# Fresh team-test project: clean everything, copy the fixture, git init, install the kit, configure the team,
# register with Orca. Usage: e2e/team/setup.sh <pi|omp|opencode|claude> [model]
#   KIT=local   install from this checkout instead of GitHub
set -euo pipefail
H="${1:?usage: setup.sh <pi|omp|opencode|claude> [model]}"
MODEL="${2:-opencode-go/deepseek-v4.1-flash}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
D="${DESK_TEAM_DIR:-$HOME/Documents/dev/desk-team-test}"
ORCA="${ORCA_CLI_COMMAND:-orca}"

"$HERE/clean.sh"
mkdir -p "$D"
cp -r "$HERE/fixture/." "$D/"
cd "$D"
git init -q -b main
git add -A
git commit -qm "fixture: Linh Studio landing (brief, build check, tests)"

if [ "${KIT:-github}" = local ]; then node "$REPO/bin/cli.js" init --universal "--$H" -y --dir "$D" | tail -1
else (cd /tmp && npx -y github:nguyennamkkb/agent-work-kit init --universal "--$H" -y --dir "$D" | tail -1); fi

case "$H" in
  pi) CAND="pi:$MODEL@high" ;;
  omp) CAND="omp:$MODEL@high" ;;
  opencode) CAND="opencode:$MODEL" ;;
  claude) CAND="claude" ;;
  *) echo "unknown harness $H"; exit 1 ;;
esac
C="node $D/.agentkit/desk.mjs"
$C team set build "node scripts/check.mjs" >/dev/null
$C team set test.command "node --test" >/dev/null
$C team set test.exclusive "test-runner" >/dev/null
$C team set leadFiles "package.json,tests/page.test.mjs,scripts/check.mjs" >/dev/null
$C team set maxWorkers 2 >/dev/null
# TEAM_DENY: comma-separated model globs routing refuses (default *free*; set TEAM_DENY= to test a free model).
ROUTING="$(node -e 'const [c,d]=process.argv.slice(1);const r={use:[c],fallback:[c]};console.log(JSON.stringify({deny:d?d.split(","):[],roles:{engineer:r,designer:r,tester:r,fixer:r,reviewer:r,writer:r}}))' "$CAND" "${TEAM_DENY-*free*}")"
$C team set routing "$ROUTING" >/dev/null
git add -A
git commit -qm "install agent-work-kit (universal, $H) and team profile"

"$ORCA" repo add --path "$D" --json >/dev/null 2>&1 || true
for _ in $(seq 1 15); do
  "$ORCA" worktree show --worktree "path:$D" --json 2>/dev/null | grep -q '"ok": true' && break
  sleep 1
done

echo "--- ready: $D ($H, $CAND)"
$C team check
git log --oneline
