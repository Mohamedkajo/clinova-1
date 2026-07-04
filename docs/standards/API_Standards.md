# API Standards

## Purpose

This document defines API behavior standards for Clinova backend routes and services.

## Controlled Errors

- Return controlled JSON errors for expected failures.
- Prefer stable error messages and optional stable error codes when frontend localization is needed.
- Do not leak internal implementation details.
- Keep response shapes stable unless a task explicitly approves a change.

## No Raw Stack Traces

- Production responses must not include stack traces.
- Production responses must not expose SQL errors, filesystem paths, secrets, or internal exception messages.
- Development and test environments may keep enough detail for debugging when appropriate.

## Status Code Conventions

## 401 Unauthorized

Use when the request is unauthenticated or the session is invalid.

## 403 Forbidden

Use when the user is authenticated but does not have permission for the action.

## 404 Not Found

Use when a record does not exist, is outside the user's tenant boundary, or is not visible to the current user where not-found behavior is the safer boundary.

## 400 Bad Request

Use for validation errors, malformed input, missing required fields, invalid IDs, invalid enum values, and invalid date/time values.

## 409 Conflict

Use for business-rule conflicts such as appointment conflicts or required consent blockers.

## 413 Payload Too Large

Use when request body size exceeds the configured limit.

## Tenant Isolation

- Every tenant-scoped read or write must enforce tenant boundaries.
- Foreign references must be validated by both ID and tenant.
- Cross-tenant IDs must not be accepted even when numerically valid.
- Platform routes must not accidentally expose clinic tenant data beyond their intended platform scope.

## Platform Owner Separation

- Platform Owner routes must be explicitly protected.
- Clinic Admin is not equivalent to Platform Owner.
- Platform Owner should not use ordinary clinic APIs unless explicitly designed.
- Clinic users must not access platform health, platform backups, platform tenants, or platform billing.

## Input Validation

- Validate required fields before repository writes.
- Validate numeric values, dates, times, enum/status values, and malformed IDs.
- Validate JSON body size and JSON syntax centrally where possible.
- Validate upload metadata and file signatures.

## Response Stability

- Successful response shapes should remain stable.
- Error response changes must be intentional and documented.
- Avoid adding sensitive metadata to responses.

## Testing Expectations

- Add regression tests for new API behavior.
- Include positive, negative, permission, tenant, and missing-record cases when relevant.
- Use isolated SQLite test environments.
