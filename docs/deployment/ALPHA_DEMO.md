# Clinova Alpha 0.1 demo

This procedure runs Clinova against an explicit, local-only SQLite database under `.demo/`. It never seeds the normal development or production database.

## Requirements

- Node.js 22.5 or newer
- `npm install`
- PowerShell, Bash, or another shell that can set environment variables
- No `DATABASE_URL` in the demo command environment

## Seed and start

PowerShell:

```powershell
$env:DEMO_PASSWORD = "ClinovaAlphaDemo!"
$env:DEMO_SESSION_SECRET = "replace-with-a-local-secret-at-least-24-characters"
npm run demo:seed
npm run demo:start
```

Bash:

```bash
DEMO_PASSWORD='ClinovaAlphaDemo!' npm run demo:seed
DEMO_SESSION_SECRET='replace-with-a-local-secret-at-least-24-characters' npm run demo:start
```

Open `http://127.0.0.1:4300`. The clinic identifier is `demo`.

`DEMO_PASSWORD` is required and must contain at least 12 characters. The value is hashed before storage and is never printed. `DEMO_SESSION_SECRET` is required only when starting the demo and must contain at least 24 characters.

## Demo accounts

All accounts use the value supplied through `DEMO_PASSWORD`.

| Role | Username |
| --- | --- |
| Platform Owner | `owner` |
| Clinic Administrator | `admin` |
| Reception | `reception` |
| Therapist | `sara` |

The documented local walkthrough password is `ClinovaAlphaDemo!`. Change it when the demo environment is shared beyond one workstation.

## Reset

Stop the demo server, then run:

```powershell
$env:DEMO_PASSWORD = "ClinovaAlphaDemo!"
npm run demo:reset
```

Reset removes only `.demo/clinova-alpha.sqlite` and its SQLite sidecar files, recreates the schema, and restores the fictional Alpha dataset. `demo:seed` is also repeatable and replaces data only inside that isolated database.

## Safety boundaries

- Demo commands refuse `NODE_ENV=production`.
- Demo commands refuse a configured `DATABASE_URL`.
- Demo paths outside the repository's `.demo/` directory are rejected.
- Backups and WhatsApp sending are disabled in demo mode.
- Patient names, addresses, phone numbers, and emails are fictional. Emails use the reserved `example.test` domain and phones use the reserved North American 555-0100 example range.
- No password is committed in application source or emitted in logs.

## Normal startup and database setup

The normal application does not create demo data automatically.

```powershell
npm install
npm run init-db
npm start
```

At minimum, configure `SESSION_SECRET` with a strong secret. Configure `DATABASE_PATH` for SQLite or `DATABASE_URL` for PostgreSQL. Production also requires an active Platform Owner and should set `COOKIE_SECURE=true` behind HTTPS. See `.env.example` and the existing deployment documentation for backup, upload, proxy, and WhatsApp settings.
