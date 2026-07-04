# Engineering Workflow

## Purpose

This document defines the official engineering workflow for Clinova tasks.

## Workflow Stages

## Decision

Clarify the task type, scope, risk, and boundaries before implementation.

Confirm:

- What is allowed.
- What is forbidden.
- Which files or modules are in scope.
- Whether the task is code, test, documentation, deployment, or report-only.

## Documentation First

For architectural, product, deployment, security, or workflow changes, update or create documentation before implementation when practical.

Documentation-first work is required for:

- Architecture decisions.
- Deployment plans.
- Security boundary changes.
- Production rollout procedures.
- Operational monitoring plans.

## Implementation

Implement the smallest safe change that satisfies the task.

Rules:

- Preserve existing behavior outside the scope.
- Reuse project patterns.
- Avoid unrelated refactors.
- Keep permission and tenant boundaries intact.
- Do not modify production configuration during local development.

## Testing

Run the required automated tests for the task.

Typical validation:

```bash
npm run init-db
npm run test:api
npm run test:restore
```

Also run `node --check` on modified JavaScript files and `git diff --check`.

## Manual QA

Perform manual QA for user-facing workflows when possible.

Manual QA should verify:

- The original issue is fixed.
- Valid workflows still work.
- Unauthorized roles cannot access restricted pages or actions.
- User-facing messages are readable.

## Final Documentation

Update documentation after implementation if behavior changed.

Documentation should reflect:

- New behavior.
- Permission changes.
- Operational changes.
- Known limitations.
- Remaining risks.

## Git

Create one local commit per task after validation passes.

Before committing:

- Review `git status --short`.
- Review staged files.
- Exclude release artifacts and unrelated files.
- Use the agreed commit message when provided.

## Release

Release work requires explicit approval.

Do not:

- Push without approval.
- Deploy without approval.
- Modify production PM2, Nginx, SSL, database, or environment files without explicit deployment instructions.

## Task Types

## BUG

A defect fix that restores expected behavior. Must include regression coverage when practical.

## POLISH

A small improvement to readability, consistency, copy, layout, or interaction quality without changing core business behavior.

## UX

A user experience improvement that changes how users interact with the product. Requires manual QA when possible.

## FEATURE

A new capability or workflow. Requires documentation, tests, permissions review, and QA.

## SECURITY

A task that fixes or audits security boundaries. Must be narrow, testable, and documented. Avoid unrelated changes.

## PERFORMANCE

A change intended to improve speed, memory, scaling, or payload size. Must include before/after reasoning or measurement where practical.

## DOCS

Documentation-only work. Must not change source code, package files, deployment files, or runtime behavior.

## REFACTOR

Internal structure change without intended behavior change. Must be isolated from feature or bug work unless explicitly approved.
