# ADR-004: Permission-Based Architecture Instead of Role-Only Checks

## Status

Accepted.

## Context

Clinova has several user roles, but role names alone are not enough to safely describe access:

- Platform Owner is not a clinic role.
- Clinic Admin has broad tenant permissions but no platform permissions.
- Reception can perform many operational tasks but should not access admin-only pages.
- Therapist visibility depends on assigned appointments, visible clients, and assigned CRM tasks.

Some checks are also record-specific. For example, a therapist may be allowed to see one appointment but not another. A role-only check cannot express that safely.

## Decision

Clinova uses a permission-based architecture layered on top of roles.

Roles define the default navigation and broad access expectations. Sensitive APIs also enforce:

- Platform owner checks.
- Admin-only checks.
- Tenant isolation.
- Foreign reference validation.
- Record-level visibility.
- Action-specific restrictions.

The frontend may hide unauthorized pages and actions, but the backend remains the source of truth.

## Consequences

### Positive

- Supports safer record-level access.
- Reduces authorization bypass risk.
- Allows future permissions to evolve without renaming roles.
- Keeps platform and clinic permissions separated.
- Makes tests more precise.

### Negative

- Developers must check both role and context.
- Permission behavior needs documentation and regression tests.
- UI visibility and backend authorization must be kept aligned.

## Alternatives

### Role-Only Authorization

Rejected because therapist and platform boundaries require record-aware checks.

### Fully Dynamic Permission Table

Deferred. It may be useful later, but current needs are covered by explicit permission logic and tests.

### UI-Only Restrictions

Rejected. UI hiding improves usability but is not a security boundary.

## References

- Permissions model documentation.
- Therapist authorization hotfix.
- Tenant isolation hotfix.
- Platform owner authorization tests.
- Security negative tests.
- Frontend navigation visibility rules.
