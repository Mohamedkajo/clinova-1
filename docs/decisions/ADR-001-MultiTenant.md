# ADR-001: Soft Delete Instead of Hard Delete

## Status

Accepted.

## Context

Clinova stores operational clinic records such as clients, appointments, services, users, files, consents, gifts, feedback, invoices, and audit-related data. Many of these records may be referenced by historical workflows, reports, legal files, appointment history, or audit trails.

Hard deletion can create broken references, remove important operational history, and make support or compliance review harder. It can also produce confusing user experiences when past appointments or signed records refer to entities that no longer exist.

Clinova therefore favors archive, disable, inactive, cancelled, void, or status-based removal patterns where historical meaning matters.

## Decision

Clinova uses soft delete or archive-style behavior instead of hard delete for records that may have operational history or references.

The exact representation depends on the module:

- Appointments may be archived or removed from active views while preserving controlled behavior.
- Services and categories should avoid unsafe deletion when referenced.
- Users may be disabled or protected from unsafe deletion when history or account safety requires it.
- Files and consents use archive/delete flows that preserve tenant and storage safety.
- Billing and platform records use status changes where appropriate.

Hard delete may be acceptable only for records explicitly designed as disposable and where no historical relationship is required.

## Consequences

### Positive

- Preserves operational history.
- Reduces broken references.
- Supports auditability.
- Makes rollback and support analysis safer.
- Prevents destructive mistakes by clinic staff.

### Negative

- Queries must consistently filter archived or inactive records where appropriate.
- UI must explain when a record is archived, disabled, or blocked from deletion.
- Storage and database size may grow over time.
- Retention policy must be documented separately.

## Alternatives

### Hard Delete Everywhere

Rejected because it risks destroying history and breaking references.

### Hard Delete With Cascades

Rejected because cascading deletes can remove related records unexpectedly and make audit trails unreliable.

### Separate Archive Tables

Deferred. Archive tables may be useful later but add complexity and migration work.

### Status-Based Soft Delete

Accepted as the practical current approach where each module can use the status or archive pattern that best matches its workflow.

## References

- Appointment archive/delete behavior.
- Service archive/delete safeguards.
- User disable/delete safeguards.
- File and consent archive/delete behavior.
- Missing-record affected-row regression tests.
- Security hotfixes around tenant isolation and authorization.
