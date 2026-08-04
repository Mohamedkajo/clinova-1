# Clinova 1.8.0-rc.1 controlled production deployment

Production requires Node.js 22+, PostgreSQL 16, `pg_dump`, `pg_restore`, `tar`, PM2, Nginx, and a valid HTTPS certificate. SQLite is not supported by the production runtime.

## Install and configure

```bash
git clone --branch feat/sprint-2.7-release-candidate <approved-repository> /var/www/clinova
cd /var/www/clinova
npm ci --omit=dev
cp .env.production.example .env
chmod 0600 .env
```

Replace every placeholder in `.env`. Keep uploads, backups, and logs in distinct persistent directories outside `client/`. Load the protected environment and validate it without printing secrets:

```bash
set -a
. ./.env
set +a
npm run release:validate
```

Every known demo password must be rotated and no demo tenant may remain. Production runtime startup still refuses to run unless an active Platform Owner exists.

## First production initialization

On a brand-new PostgreSQL installation, inject the ten `INIT_*` values from the inventory in `.env.production.example` for the initialization command only. Do not save them in `.env`, shell history, PM2 configuration, or logs. Run this exact order:

```bash
npm ci
npm run release:validate
npm run db:migrate
npm run production:init
npm run db:verify
npm run start:production
```

`production:init` is a CLI-only, one-time command. It creates the first Platform Owner and provisions the first clinic administrator, subscription, and settings through the application architecture in one PostgreSQL transaction. It refuses an existing Platform Owner, conflicts, or partial state; a second run returns `PRODUCTION_ALREADY_INITIALIZED`. Remove all `INIT_*` values from the process environment immediately after the command. Never run it on an established installation.

## Deploy

```bash
npm run start:production
```

The release gate performs, in order: upload archive and archive verification, PostgreSQL custom-format backup, transactional migration, schema verification, graceful PM2 start/reload, PM2 save, web/database/worker/job/disk readiness verification. A backup or migration failure stops before process reload.

Configure [the supplied Nginx server](deploy/nginx/clinova.conf), replace the domain and certificate paths, run `nginx -t`, then reload Nginx. Configure PM2 startup using the command printed by `npm exec pm2 startup`, followed by `npm exec pm2 save`.

## Backup and restore drill

```bash
npm run backup
npm run backup:uploads
POSTGRES_RESTORE_TEST_URL=postgres://restore_user:password@127.0.0.1:5432/clinova_restore_test npm run backup:verify-restore
```

The restore command refuses the source database, refuses targets whose names do not contain `restore` or `test`, and requires explicit opt-in for remote targets. Restore uploads into an isolated directory with `tar -xzf`, compare the archive listing and application file metadata, and never overwrite the live upload directory during a drill.

Keep 30 daily database/upload recovery points by default, copy them to separate encrypted storage, and perform a restore drill before each release and at least monthly. A rollback restores the verified database dump and matching upload archive into new locations, switches configuration atomically, then repeats the health gate.

## Monitoring

```bash
npm run release:check
npm run monitor:pm2
npm run monitor:backup
npm run monitor:disk
```

Monitor `/api/health` through HTTPS. Detailed readiness remains authenticated and tenant-scoped at `/api/operations/readiness`. Application logs are stored under `LOG_DIR`; never publish PM2 output, readiness details, `.env`, database URLs, or filesystem paths.

See [the complete Sprint 2.7 runbook](docs/production/SPRINT-2.7-RELEASE-CANDIDATE.md) for permissions, startup order, restore verification, rollback, and the release checklist.
