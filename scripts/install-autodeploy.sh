#!/usr/bin/env bash
# One-time setup: turn on automatic deploys after a merge to main.
# Run as root:  bash /var/www/blue-jaguars/scripts/install-autodeploy.sh
# Turn it off:  systemctl disable --now blue-jaguars-autodeploy.timer
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$APP_DIR" != "/var/www/blue-jaguars" ]]; then
  echo "The service files expect the app at /var/www/blue-jaguars (found $APP_DIR)." >&2
  exit 1
fi

install -m 0644 "$APP_DIR/scripts/systemd/blue-jaguars-autodeploy.service" /etc/systemd/system/
install -m 0644 "$APP_DIR/scripts/systemd/blue-jaguars-autodeploy.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now blue-jaguars-autodeploy.timer

echo "Automatic deploys are on. The server checks GitHub every 2 minutes."
systemctl list-timers blue-jaguars-autodeploy.timer --no-pager
echo
echo "Watch a deploy:   journalctl -u blue-jaguars-autodeploy -f"
echo "Recent history:   journalctl -u blue-jaguars-autodeploy -n 100 --no-pager"
