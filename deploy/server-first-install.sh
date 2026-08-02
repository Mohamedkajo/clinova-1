#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:?Set REPO_URL to the approved Clinova repository.}"
APP_DIR="${APP_DIR:-/var/www/clinova}"
APP_USER="${APP_USER:-$USER}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
BRANCH="${BRANCH:-feat/sprint-2.7-release-candidate}"

sudo install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
npm ci --omit=dev

if [ ! -f .env ]; then
  echo "Deployment stopped: create a root-readable .env from .env.production.example and replace every placeholder."
  exit 1
fi
chmod 0600 .env
set -a
. ./.env
set +a

npm run release:validate
sudo install -d -m 0750 -o "$APP_USER" -g "$APP_GROUP" "$UPLOAD_DIR" "$BACKUP_DIR" "$LOG_DIR"
npm run start:production
npm exec pm2 startup
npm exec pm2 save

echo "Install passed. Configure deploy/nginx/clinova.conf, issue the TLS certificate, then verify the public HTTPS URL."
