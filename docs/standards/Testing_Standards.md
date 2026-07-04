# Testing Standards

## Purpose

This document defines validation expectations for Clinova tasks.

## Required Commands

Before proposing production deployment or completing code changes, run:

```bash
npm run init-db
npm run test:api
npm run test:restore
```

For JavaScript files changed in a task, also run:

```bash
node --check <modified-file>
```

For repository hygiene, run:

```bash
git diff --check
git status --short
```

## API Tests

`npm run test:api` is the default API regression suite. It should cover:

- Authentication.
- Authorization.
- Tenant isolation.
- CRUD workflows.
- Validation boundaries.
- Missing-record boundaries.
- Upload and download safety.
- Platform workflows.
- WhatsApp no-real-send paths.
- Monitoring helper and CLI behavior where included.

## Restore Tests

`npm run test:restore` validates disposable restore behavior. It must remain separate from the default API suite because valid restore intentionally restarts a child server process.

## Init DB

`npm run init-db` must initialize the configured database and exit without starting the HTTP server.

## Manual QA Before Production

Manual QA is required before production deployment. At minimum, verify:

- Login by supported roles.
- Platform Owner workflows.
- Clinic Admin workflows.
- Reception workflows.
- Therapist restrictions.
- Appointment creation and validation.
- Client card behavior.
- File and consent workflows.
- Settings save behavior.
- Backup center and health dashboard.

## Regression Expectations

Every bug fix should include a regression test when practical.

Regression tests should cover:

- The original failing scenario.
- A valid success path.
- Permission boundaries.
- Tenant boundaries when IDs are involved.
- Localized frontend behavior when user-facing messages change.

## Test Isolation

- Use isolated SQLite databases for automated tests.
- Use temporary upload and backup directories.
- Do not use production data.
- Do not rely on external network services.
- Do not trigger real WhatsApp sends.

## Manual QA Notes

When manual QA cannot be completed, document why. Common acceptable reasons include:

- Local dev database is intentionally stale.
- A browser automation tool is unavailable.
- The task is documentation-only.

Manual QA limitations must be visible in the final task summary.
