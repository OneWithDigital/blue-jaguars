#!/usr/bin/env bash
# Update the running VPS app to the latest code on main.
# Run as root from the app directory:  bash scripts/deploy.sh
# First-time install is scripts/vps-app.sh; this is for every update after.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Local edits found. Saving them to a stash so the pull is clean:"
  git status --short --untracked-files=no
  git stash push -m "deploy $(date +%Y%m%d-%H%M%S)"
fi

git fetch origin main
git checkout main
git reset --hard origin/main
echo "Deploying $(git log -1 --format='%h %s')"

# Build with the same settings the service runs with (DATABASE_URL, Google keys, preset).
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env"
set +a
export NITRO_PRESET=node

npm ci --no-audit --no-fund
npm run build
test -f "$APP_DIR/.output/server/index.mjs"

systemctl restart blue-jaguars
sleep 3
if curl -sf --max-time 8 -o /dev/null http://127.0.0.1:3000/; then
  echo "Live: $(git log -1 --format='%h %s')"
else
  echo "The app did not answer. Last log:" >&2
  journalctl -u blue-jaguars -n 40 --no-pager >&2 || true
  exit 1
fi
