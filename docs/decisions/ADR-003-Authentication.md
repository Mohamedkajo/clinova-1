# ADR-003: Tenant-Aware Authentication Using Clinic Identifier

## Status

Accepted.

## Context

Clinova supports multiple clinic tenants. Clinic users may have usernames that are meaningful only inside a specific clinic. Authentication therefore needs a tenant selector so a clinic user can be resolved within the correct tenant boundary.

The login UI includes:

- Username.
- Password.
- Clinic identifier.

Platform Owner login remains possible without a clinic identifier because platform owner identity is not scoped to a clinic tenant in the same way.

## Decision

Clinova uses tenant-aware authentication with a clinic identifier for clinic users.

Clinic users authenticate with username, password, and clinic identifier. The backend resolves the tenant before authenticating the user. Platform owner authentication remains separated and does not require a clinic identifier.

## Consequences

### Positive

- Avoids username collisions across tenants.
- Makes tenant selection explicit.
- Supports separate clinic deployment and SaaS product positioning.
- Reinforces tenant isolation from the start of the session.

### Negative

- Login UX includes one additional field for clinic users.
- Local development seed data must include a usable clinic identifier.
- Error handling must avoid leaking whether a tenant or username exists.

## Alternatives

### Global Unique Usernames

Rejected because it creates unnecessary constraints across tenants and is less natural for clinic staff.

### Email-Only Login

Deferred. Email login may be considered later, but current clinic workflows use usernames.

### Domain-Based Tenant Resolution Only

Deferred. Domain-based routing is useful for production tenant domains, but clinic identifier remains a reliable explicit login mechanism.

### Platform Owner Uses Clinic Identifier

Rejected. Platform Owner is not a clinic-scoped role and must remain separated.

## References

- Login form with clinic identifier.
- Tenant-aware authentication tests.
- Development seed for platform owner and clinic admin.
- Platform owner separation decision.
- Session and password reset tests.
