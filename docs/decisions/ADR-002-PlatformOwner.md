# ADR-002: Platform Owner Separation

## Status

Accepted.

## Context

Clinova is a multi-tenant clinic SaaS product. The platform operator needs capabilities that ordinary clinic administrators must not have:

- Tenant creation and deactivation.
- Tenant plan and status management.
- Platform-level billing.
- Platform health checks.
- Platform backup center access.
- Tenant owner password reset.

Clinic Admin users manage a single clinic tenant. Mixing Platform Owner and Clinic Admin concepts would increase the risk of cross-tenant data exposure and accidental platform-wide actions by clinic staff.

## Decision

Platform Owner is completely separated from Clinic Admin.

Platform Owner is a system-level identity with platform-scoped pages and APIs. Clinic Admin is a tenant-scoped clinic role. A Platform Owner should not automatically gain access to ordinary clinic workflows unless a specific platform operation is intentionally designed.

## Consequences

### Positive

- Clear separation between SaaS operations and clinic operations.
- Lower risk of cross-tenant data exposure.
- Easier authorization testing.
- Safer platform dashboards and backup controls.
- Cleaner UI navigation for each user type.

### Negative

- Some operational workflows may require explicit platform tools instead of reusing clinic pages.
- Developers must maintain separate mental models for platform routes and clinic routes.
- Documentation and tests must clearly distinguish platform owner permissions from clinic admin permissions.

## Alternatives

### Treat Platform Owner as Super Admin

Rejected. A super admin model would make it easier to accidentally expose or mutate clinic tenant data outside intended workflows.

### Use Clinic Admin With Extra Flag

Rejected as the primary model. A flag may exist internally, but behavior must remain conceptually and operationally separate.

### Separate Platform Application

Deferred. A separate application may be useful later, but the current implementation supports platform owner pages within the same frontend while keeping route permissions separate.

## References

- Platform owner health dashboard.
- Platform backup center.
- Platform tenant management routes.
- Platform billing routes.
- Role separation tests.
- Production bootstrap rule requiring an active platform owner.
