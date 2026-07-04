# Git Standards

## Purpose

This document defines Git standards for Clinova development.

## One Commit Equals One Task

- Each commit should represent one coherent task.
- Do not mix unrelated fixes, features, docs, refactors, and formatting changes.
- Keep commits small enough to review safely.

## No Mixed Commits

Avoid combining:

- Code changes with documentation-only tasks.
- Backend changes with unrelated frontend changes.
- Feature work with security fixes.
- Test rewrites with unrelated implementation work.
- Release artifacts with source code.

## Commit Message Examples

Use concise, conventional messages:

- `fix: reject past appointment times with localized errors`
- `docs: initialize project documentation structure`
- `docs: populate product vision architecture and ADRs`
- `chore: fix test workflow runner temp scope`
- `test: add missing-record regression coverage`
- `security: harden tenant reference validation`

## Staging Review

Before committing:

- Run `git status --short`.
- Run `git diff --cached --name-only`.
- Confirm only intended files are staged.
- Confirm no release artifacts, zip files, demo folders, or generated bundles are staged.

## No Push Without Approval

- Do not push without explicit approval.
- Do not push to production, origin, or external remotes unless the task explicitly says to do so.
- When a push target is provided, verify the remote and branch before pushing.

## No Deploy Without Approval

- Do not deploy without explicit approval.
- Do not change PM2, Nginx, SSL, production database, or production environment files during local development tasks.

## Release Artifacts

Release artifacts must not be committed unless explicitly reviewed and approved.

Examples to keep out of normal commits:

- `release/`
- Zip bundles.
- Demo export folders.
- Temporary unzip verification folders.
- Generated local test artifacts.

## Local Commits

Local commits are allowed only when requested or when the task explicitly says to create a local commit after validation passes.

## Dirty Worktree

When the working tree contains unrelated changes:

- Do not overwrite them.
- Do not delete untracked files automatically.
- Stage only reviewed files.
- Report suspicious files before including them.
