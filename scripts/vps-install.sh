#!/usr/bin/env bash
# First-time install on an Ubuntu Hostinger VPS. Run as root:
#   bash scripts/vps-install.sh www.bluejaguarskarate.com
set -euo pipefail

DOMAIN="${1:-www.bluejaguarskarate.com}"
APEX="${DOMAIN#www.}"

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(openssl rand -hex 16)"
  AUTH_SECRET="$(openssl rand -hex 32)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y nginx postgresql certbot python3-certbot-nginx ca-certificates curl
  if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22)'; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
  fi
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
HOST=127.0.0.1
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
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now blue-jaguars
systemctl restart blue-jaguars

cat >/etc/nginx/sites-available/blue-jaguars <<EOF
server {
  listen 80;
  server_name ${APEX};
  return 301 https://${DOMAIN}\$request_uri;
}
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
ln -sfn /etc/nginx/sites-available/blue-jaguars /etc/nginx/sites-enabled/blue-jaguars
nginx -t
systemctl reload nginx

if [[ ! -d /etc/letsencrypt/live/${DOMAIN} ]]; then
  certbot --nginx -d "$DOMAIN" -d "$APEX" --non-interactive --agree-tos -m "erikedgington@gmail.com" --redirect || true
fi

echo "Blue Jaguars is running at https://${DOMAIN}"
