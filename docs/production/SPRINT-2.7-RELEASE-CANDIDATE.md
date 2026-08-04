# Clinova 1.8.0-rc.1 release candidate runbook

## Architecture and persistent state

Nginx terminates HTTPS and proxies only to the loopback-bound web process. PM2 manages `clinova`, `clinova-worker`, and `clinova-backup`. PostgreSQL is the only production database. Uploads, backup archives, and logs use separate persistent paths with application-user read/write access and no public web mapping.

Required startup order:

1. Verify PostgreSQL and protected `.env` availability.
2. Validate configuration with `npm run release:validate`.
3. Create and verify the upload archive and PostgreSQL custom-format backup when upgrading.
4. Run transactional migration.
5. On a brand-new installation only, run `npm run production:init` with ephemeral `INIT_*` values.
6. Verify the schema, gracefully start/reload PM2 processes, and save the process list.
7. Pass public health plus internal database, worker, queue, failed-job, and disk checks.
8. Validate HTTPS and the end-to-end role workflows before opening traffic.

`npm run start:production` performs steps 2–6 and stops before reload if backup or migration fails. The web process, worker, and backup scheduler independently validate production configuration and refuse SQLite, insecure cookies, HTTP application URLs, weak secrets, missing proxy configuration, or unsafe storage paths.

## Environment and secrets

Use `.env.production.example` as the variable inventory. Store `.env` as mode `0600`, owned by the service account, or inject variables from an approved secret manager. Never place credentials in Git, PM2 configuration, shell history, monitoring output, or application logs. Use TLS certificate verification for remote PostgreSQL.

The `INIT_*` inventory is for the one-time CLI bootstrap only. Inject those values directly for `npm run production:init` and remove them immediately afterward; do not persist them in `.env`. Initialization uses the current password policy and refuses demo/default credentials, duplicate Platform Owners, conflicting identities, and partial clinic state.

`APP_URL` and allowed CORS origins must be HTTPS. `TRUSTED_PROXY_IPS` must contain only the reverse-proxy addresses. Set `HOST=127.0.0.1`; do not expose Node directly. The application trusts forwarded client addresses only from configured proxy IPs and builds external links from `APP_URL`.

## Persistent directories and permissions

Recommended paths:

```text
/var/lib/clinova/uploads   application uploads, mode 0750
/var/backups/clinova      database and upload archives, mode 0750
/var/log/clinova          PM2 output/error logs, mode 0750
/var/www/clinova/.env     secrets, mode 0600
```

Backups must also be replicated to encrypted storage outside the application host. Default retention is 30 recovery points; keep daily backups for 30 days and a monthly verified copy according to clinic policy.

## Database deployment and restore

For the first installation, use this exact order:

```bash
npm ci
npm run release:validate
npm run db:migrate
npm run production:init
npm run db:verify
npm run start:production
```

The migration CLI may prepare an empty PostgreSQL schema before the first owner exists. The web server and worker retain the active Platform Owner startup gate. `production:init` is not an upgrade or repair command and exposes no HTTP endpoint.

```bash
npm run backup
npm run backup:uploads
npm run db:migrate
npm run db:verify
npm run db:check
```

PostgreSQL migrations run transactionally. A migration failure leaves the current PM2 processes untouched and stops deployment. There is no destructive automatic down migration.

For a real isolated restore drill, create a separate empty database and restricted role, then run:

```bash
POSTGRES_RESTORE_TEST_URL=postgres://restore_user:password@127.0.0.1:5432/clinova_restore_test \
  npm run backup:verify-restore
```

The verifier resets only the explicitly named restore/test target, restores the new custom-format dump, and compares tenant/user/patient/appointment/ledger counts, migration version, constraints, and indexes. Drop the isolated target after recording the result. Verify the upload archive with `tar -tzf`; restore it to a temporary path and compare it with file metadata before any real recovery.

Rollback uses a new PostgreSQL database restored from the pre-deployment dump and a new upload directory restored from the matching archive. Point the protected environment at those verified locations, deploy the previous commit, then run the complete readiness gate before switching traffic.

## Process recovery and graceful restart

```bash
npm run start:production
npm exec pm2 reload ecosystem.config.cjs --update-env
npm exec pm2 save
npm exec pm2 startup
```

PM2 waits for explicit readiness from web, worker, and backup processes and uses bounded restart backoff. Web and worker handle `SIGTERM`/`SIGINT`; one worker instance prevents competing schedulers while atomic database claims still protect jobs after restart.

## HTTPS and reverse proxy

Copy `deploy/nginx/clinova.conf`, replace the domain and certificate paths, obtain/renew certificates with Certbot or the approved platform, run `nginx -t`, then reload Nginx. Redirect HTTP to HTTPS. Keep the application on loopback, set the proxy IP allowlist, align `client_max_body_size` with `UPLOAD_MAX_MB`, and never publish `.env`, uploads, backups, logs, PostgreSQL, or authenticated readiness.

## Monitoring and release gate

Monitor:

- PM2 process presence, uptime, memory, and restart count.
- `GET /api/health` for web, PostgreSQL, schema version, and coarse worker state.
- Admin-only `/api/operations/readiness` for the clinic queue.
- `npm run release:check` locally for failed jobs and aggregate queue/disk readiness.
- backup age and upload/backup/log filesystem capacity.
- protected PM2 logs with rotation and host-level alert delivery.

Before promotion, verify login/logout, role restrictions, patient and appointment lifecycle, calendar/queue, clinical visit, consents, protected files, notifications/reminders, billing/ledger, reports/CSV, audit, backup/restore, tenant isolation, clean browser console, mobile 390px, and RTL/LTR. Restart web and worker and repeat health/readiness. Any critical/high security finding, demo tenant/password, failed test, stale worker, migration mismatch, restore mismatch, or failed job is a `NO-GO`.

## Known limitations

- Reminder delivery remains simulated; no external provider is enabled.
- Jobs use PostgreSQL polling rather than an external queue broker.
- `pg_dump`, `pg_restore`, and `tar` are host prerequisites.
- Certificate issuance, off-host backup storage, log rotation, alert transport, and DNS remain operator-managed.
