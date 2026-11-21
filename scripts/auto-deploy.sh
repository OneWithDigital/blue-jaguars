#!/usr/bin/env bash
# Deploy automatically when main changes on GitHub.
# Run by the blue-jaguars-autodeploy.timer every 2 minutes (see
# scripts/install-autodeploy.sh). Safe to run by hand: bash scripts/auto-deploy.sh
#
# - Does nothing when the server already runs the latest commit on main.
# - Never runs two deploys at once.
# - If a commit fails to deploy, it is not retried every 2 minutes; the next
#   new commit on main is tried. Run scripts/deploy.sh by hand to retry.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="/var/lib/blue-jaguars"
FAILED_FILE="$STATE_DIR/last-failed-commit"
LOCK_FILE="/run/blue-jaguars-deploy.lock"
mkdir -p "$STATE_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "A deploy is already running. Skipping this check."
  exit 0
fi

cd "$APP_DIR"

remote="$(git ls-remote origin refs/heads/main | cut -f1)"
if [[ -z "$remote" ]]; then
  echo "Could not reach GitHub. Will try again next check." >&2
  exit 0
fi

local_head="$(git rev-parse HEAD)"
if [[ "$remote" == "$local_head" ]]; then
  exit 0
fi

if [[ -f "$FAILED_FILE" && "$(cat "$FAILED_FILE")" == "$remote" ]]; then
  echo "Commit ${remote:0:7} failed to deploy before. Waiting for a newer commit (or run scripts/deploy.sh by hand)."
  exit 0
fi

echo "New commit on main: ${remote:0:7} (server has ${local_head:0:7}). Deploying."
if bash "$APP_DIR/scripts/deploy.sh"; then
  rm -f "$FAILED_FILE"
  echo "Auto-deploy finished: $(git log -1 --format='%h %s')"
else
  echo "$remote" > "$FAILED_FILE"
  echo "Auto-deploy of ${remote:0:7} FAILED. See: journalctl -u blue-jaguars-autodeploy -n 200" >&2
  exit 1
fi
