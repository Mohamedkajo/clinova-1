# Coding Standards

## Purpose

This document defines the coding standards for Clinova engineering work. These standards are intended to keep changes safe, reviewable, and aligned with the current architecture.

## Minimal Changes

- Keep each change limited to the requested task.
- Avoid broad rewrites unless explicitly approved.
- Preserve existing API response shapes unless the task requires a controlled change.
- Prefer existing project patterns over new abstractions.
- Avoid changing unrelated files.

## No Unrelated Refactors

- Do not combine refactoring with bug fixes.
- Do not rename modules, routes, or database fields as part of unrelated work.
- Do not move files unless the task is specifically about structure.
- If a refactor is necessary, document why and keep it small.

## Permission Checks

- Server-side permission checks are required for protected operations.
- UI visibility is not a security boundary.
- Platform Owner routes must remain separated from clinic routes.
- Tenant-scoped records must be checked against the user's tenant.
- Therapist visibility must be record-aware where applicable.

## Validation

- Validate required fields before writes.
- Validate numeric, date, time, enum, and status inputs.
- Validate foreign references by both ID and tenant.
- Return controlled errors for invalid input.

## Safe Delete and Deactivate Policy

- Prefer archive, disable, inactive, cancelled, void, or status-based behavior when records may have history.
- Do not hard-delete records with audit, legal, appointment, billing, or file history unless explicitly approved.
- Prevent unsafe deletion of current users, last critical admins, or referenced records where applicable.
- Show clear user-facing messages when deletion is blocked.

## File Handling

- Do not trust client-provided MIME type alone.
- Validate extension, MIME type, file size, and magic bytes where applicable.
- Never allow arbitrary file paths from user input.
- Do not expose absolute server paths in user-facing responses unless explicitly intended for local operator tooling.

## OS and Environment Safety

- Avoid hardcoded OS-specific paths.
- Use configured paths for database, uploads, backups, and runtime files.
- Production and local development must remain isolated.
- Do not modify production configuration from application code.

## Error Handling

- Use controlled errors for expected failures.
- Do not expose stack traces or internal filesystem paths in production responses.
- Keep frontend messages localized and readable.
- Avoid silent failures.

## Documentation

- Update relevant documentation when behavior, permissions, workflows, or operational expectations change.
- Use English for official documentation.
