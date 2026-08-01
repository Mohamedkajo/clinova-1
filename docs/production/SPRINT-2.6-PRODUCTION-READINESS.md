# Clinova production candidate runbook

This runbook applies to Sprint 2.6. The worker is an internal local dispatcher: it does not send SMS, WhatsApp, or email through an external provider.

## PostgreSQL setup

Use PostgreSQL 16 or a supported newer release. Create a dedicated database and least-privilege application role, require TLS when the database is remote, and ensure the host clock is synchronized.

Example local development setup:

```sh
docker run --name clinova-postgres \
  -e POSTGRES_USER=clinova \
  -e POSTGRES_PASSWORD=CHANGE_ME \
  -e POSTGRES_DB=clinova \
  -p 127.0.0.1:5432:5432 \
  -d postgres:16-alpine
```

Set these required production variables from a secret manager or protected environment file:

```dotenv
NODE_ENV=production
DATABASE_URL=postgres://clinova:CHANGE_ME@127.0.0.1:5432/clinova
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_CONNECTION_TIMEOUT_MS=10000
SESSION_SECRET=replace-with-at-least-48-random-characters
COOKIE_SECURE=true
HOST=127.0.0.1
PORT=3000
UPLOAD_DIR=./uploads
BACKUP_DIR=./backups
WORKER_POLL_INTERVAL_MS=5000
WORKER_STALE_AFTER_MS=120000
WORKER_RETRY_BASE_MS=5000
```

`DATABASE_SSL=true` is required for remote databases unless the connection is protected by a trusted private transport. Never use `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in production without a documented certificate exception.

## Migration and verification

Before every migration:

1. Stop write traffic or enter a maintenance window.
2. Verify a recent PostgreSQL custom-format backup with `pg_restore --list`.
3. Verify that uploads are backed up with the same retention point.
4. Run the additive schema migration:

```sh
npm run db:migrate
npm run db:verify
npm run db:check
```

PostgreSQL schema changes run in a transaction. A failed migration is rolled back. SQLite creates a consistent `pre-migration-*.sqlite` recovery copy before applying changes. The expected schema version is `2026.08.01.1`.

For a one-time move from the current stable SQLite database to an empty, backed-up PostgreSQL target:

```sh
DATABASE_PATH=./data/clinic.sqlite \
DATABASE_URL=postgres://clinova:CHANGE_ME@127.0.0.1:5432/clinova \
npm run pg:migrate
```

`pg:migrate` replaces application data in the destination transactionally. Do not point it at a populated production database without an approved maintenance window and verified backup.

## Process commands

The web process does not depend on the worker for startup.

```sh
npm run start:web       # web only
npm run start:worker    # worker only
npm run dev:all         # migration + watched web and worker locally
npm run start:production # migration + PM2 web, worker, and backup scheduler
```

Both web and worker handle `SIGTERM` and `SIGINT` gracefully. Production should run exactly one worker instance. Multiple web instances are supported with PostgreSQL.

## Health and readiness

Public, non-sensitive health:

```sh
curl --fail http://127.0.0.1:3000/api/health
```

The response reports database readiness, database engine, whether migrations are current, and only the coarse worker state. Web health remains available when the optional worker has not started.

An authenticated clinic administrator can call `GET /api/operations/readiness`. It includes the current migration version, worker heartbeat state, and that clinic's aggregate queued/processing/failed counts. Reception, therapists, platform owners, other tenants, and unauthenticated callers cannot read it.

## Worker recovery behavior

- Jobs are scoped by `tenant_id` and contain only `{}` as payload.
- A unique tenant/deduplication key prevents duplicate execution within each scheduling window.
- Claims change jobs atomically from `queued` to `processing` with `locked_at` and `locked_by`.
- Stale locks return to the queue after `WORKER_STALE_AFTER_MS`; jobs at their attempt limit become `failed`.
- Retries use bounded exponential backoff and a maximum attempt count.
- Reminder dispatch is local-only and records the existing `sent` state and audit event. No provider credentials or clinical text are read into job payloads or logs.

## Backup and rollback

Install `pg_dump` and `pg_restore` on the deployment host before enabling PostgreSQL backups. Store database dumps and uploads outside the application host and test restoration regularly.

If deployment verification fails:

1. Stop web and worker processes.
2. Preserve logs without copying secrets.
3. For code-only failure, deploy the previous commit and run `npm run db:verify`.
4. For data/schema failure, restore the pre-deploy custom-format dump into a new database, verify it, then switch `DATABASE_URL` atomically.
5. Restore the matching uploads snapshot.
6. Run `npm run db:check`, public health, authenticated readiness, and a read-only clinic smoke test before reopening traffic.

There is no destructive automated down migration. Sprint 2.6 schema changes are additive; recovery uses the verified pre-deploy backup when a database rollback is required.

## Validation commands

```sh
npm run test:sqlite
POSTGRES_TEST_URL=postgres://clinova:CHANGE_ME@127.0.0.1:5432/clinova_test npm run test:postgres
```

`test:postgres` refuses to reset a non-local database or a database whose name does not contain `test`.

## Known limitations

- Dispatch remains local simulation until a provider is approved in a later sprint.
- Worker scheduling uses minute-level deduplication and database polling rather than an external broker.
- PostgreSQL backup utilities remain an operating-system prerequisite.
- Automated rollback is intentionally not provided for database changes; restore into a separate database is the recovery path.
