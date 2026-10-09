#!/usr/bin/env bash
# Start the app on port 3000 behind the VPS's existing Nginx Proxy Manager.
# Do not install a second nginx. Run as root from the app directory:
#   bash scripts/vps-app.sh
set -euo pipefail

DOMAIN="${1:-www.bluejaguarskarate.com}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"

export DEBIAN_FRONTEND=noninteractive
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(openssl rand -hex 16)"
  AUTH_SECRET="$(openssl rand -hex 32)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jaguars') THEN
    CREATE ROLE jaguars LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'jaguars'" | grep -q 1 \
    || sudo -u postgres createdb -O jaguars jaguars
  cat >"$ENV_FILE" <<EOF
DATABASE_URL=postgres://jaguars:${DB_PASS}@127.0.0.1:5432/jaguars
BETTER_AUTH_SECRET=${AUTH_SECRET}
BETTER_AUTH_URL=https://${DOMAIN}
VITE_AUTH_ENABLED=true
PORT=3000
HOST=0.0.0.0
NITRO_PRESET=node
EOF
  chmod 600 "$ENV_FILE"
fi

cd "$APP_DIR"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
npm ci
npm run build

cat >/etc/systemd/system/blue-jaguars.service <<EOF
[Unit]
Description=Blue Jaguars
After=network.target postgresql.service

[Service]
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=$(command -v node) .output/server/index.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now blue-jaguars
systemctl restart blue-jaguars
systemctl disable --now nginx >/dev/null 2>&1 || true

echo "App is on port 3000. In Nginx Proxy Manager, proxy ${DOMAIN} to 172.17.0.1 port 3000."
curl -sI --max-time 5 http://127.0.0.1:3000 | head -5 || true
