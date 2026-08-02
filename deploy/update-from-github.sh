#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/clinova}"
BRANCH="${BRANCH:-feat/sprint-2.7-release-candidate}"
LOCK_DIR="${LOCK_DIR:-/tmp/clinova-deploy.lock}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another deployment is already running."
  exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

cd "$APP_DIR"
test -f .env || { echo "Deployment stopped: .env is missing."; exit 1; }
chmod 0600 .env
set -a
. ./.env
set +a

echo "==> Validating current production configuration"
npm run release:validate
echo "==> Creating pre-fetch database and upload backups"
npm run backup
npm run backup:uploads

echo "==> Fetching approved branch"
git fetch origin "$BRANCH" --tags
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
npm ci --omit=dev

echo "==> Deploying release through the migration and health gate"
npm run start:production
echo "==> Deployed version $(node -p "require('./package.json').version") at commit $(git rev-parse --short HEAD)"
