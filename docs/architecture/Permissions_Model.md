# Permissions Model

## Overview

Clinova uses a permission-aware architecture layered on top of user roles. Roles provide the default UI and API boundaries, while sensitive operations also enforce route-level authorization, tenant isolation, and record visibility checks.

The main roles are:

- Platform Owner
- Clinic Admin
- Reception
- Therapist

Platform Owner is not a clinic role. It is a system-level operator role separated from clinic tenant workflows.

## Role Summary

| Role | Scope | Primary Responsibility |
| --- | --- | --- |
| Platform Owner | Platform-wide | Manage tenants, billing, platform health, and platform backups. |
| Clinic Admin | Single clinic tenant | Manage clinic operations, staff, reports, settings, catalog, and audit views. |
| Reception | Single clinic tenant | Operate daily front-desk workflows such as calendar, clients, CRM, consents, feedback, and gifts. |
| Therapist | Single clinic tenant with restricted visibility | Work with assigned appointments, visible clients, CRM items, consents, and settings as allowed. |

## Permission Matrix

| Area | Platform Owner | Clinic Admin | Reception | Therapist |
| --- | --- | --- | --- | --- |
| Platform tenants | Full access | No access | No access | No access |
| Platform billing | Full access | No access | No access | No access |
| Platform reports | Full access | No access | No access | No access |
| Platform health | Full access | No access | No access | No access |
| Platform backup center | Full access | No access | No access | No access |
| Clinic dashboard | No clinic dashboard access | Access | No access | No access |
| Calendar | No clinic workflow access | Access | Access | Access within visibility rules |
| Appointments | No clinic workflow access | Full clinic access | Operational access | Restricted to assigned/visible appointments |
| Clients | No clinic workflow access | Full clinic access | Operational access | Restricted visibility and actions |
| CRM | No clinic workflow access | Full clinic access | Operational access | Restricted to visible clients or assigned tasks |
| Categories | No clinic workflow access | Manage | Restricted or no management access | Restricted or no management access |
| Services | No clinic workflow access | Manage | Restricted or no management access | Restricted or no management access |
| Users | No clinic user management except platform tenant owner flows | Manage clinic staff | No access | No access |
| Invitations | Platform tenant owner flows only | Create and manage clinic staff invitations | No access | No access |
| Reports | No clinic reports access | Access | No access | No access |
| Audit logs | No clinic audit access by default | Access | No access | No access |
| Settings | No clinic settings access | Manage clinic settings | Visible according to current UI permissions | Visible according to current UI permissions |
| Files | No clinic file workflow access | Access according to clinic workflow | Access according to clinic workflow | Restricted access |
| Consents | No clinic consent workflow access | Manage and sign according to workflow | Manage and sign according to workflow | Restricted access |
| Feedback | No clinic feedback workflow access | Access | Access | Restricted or no access based on current visibility |
| Gifts | No clinic gift workflow access | Access | Access | Restricted or no access based on current visibility |
| WhatsApp actions | No clinic send workflow access | Access through clinic workflows | Access through clinic workflows where visible | Restricted |

## Platform Owner

Platform Owner can:

- List, create, update, and deactivate tenants.
- Reset tenant owner passwords.
- Manage platform invoices and tenant billing workflows.
- View platform reports.
- Access platform health information.
- List and create platform backups.

Platform Owner cannot:

- Act as a clinic user inside ordinary clinic pages.
- Use tenant-scoped clinic endpoints such as clients, appointments, reports, and clinic audit logs unless explicitly implemented as a platform operation.

## Clinic Admin

Clinic Admin can:

- Use the clinic dashboard.
- Manage clients, appointments, CRM, catalog, users, invitations, reports, audit logs, settings, files, consents, feedback, gifts, and WhatsApp workflows.
- Perform admin-level clinic operations inside the tenant boundary.

Clinic Admin cannot:

- Access platform tenant management.
- Access platform billing.
- Access platform health or backup center.
- Access another tenant's data.

## Reception

Reception can:

- Use day-to-day clinic workflows for calendar, appointments, clients, CRM, consents, feedback, gifts, and settings where available.
- Support front-desk operations without platform or admin-only management access.

Reception cannot:

- Access platform routes.
- Access clinic dashboard if it is restricted to manager/admin roles.
- Access reports and audit logs.
- Manage users or staff invitations.
- Delete or manage protected catalog records unless explicitly allowed.

## Therapist

Therapist can:

- View assigned or visible appointments.
- Work with visible client context.
- Use restricted CRM and consent workflows according to visibility rules.
- Access settings pages where the current UI permits.

Therapist cannot:

- Update appointments assigned to another therapist.
- Update unrelated CRM tasks.
- See unrelated CRM events in bootstrap data.
- Access platform routes.
- Access admin-only dashboard, reports, audit logs, users, or protected catalog management.

## Permission Boundaries

The permission model uses multiple boundaries:

- Authentication: protected APIs require an active session.
- Tenant isolation: tenant-scoped records must match the user's tenant.
- Role checks: platform and admin routes enforce role or platform-owner checks.
- Record visibility: therapist workflows check assigned appointments, visible clients, or assigned CRM tasks.
- UI visibility: navigation hides pages not intended for the current role.

## Route-Level Authorization

API authorization is enforced on the server. UI visibility is not considered sufficient security.

Expected route behavior:

- Unauthenticated users receive the existing unauthorized behavior.
- Authenticated users without permission receive 403 where applicable.
- Missing or invisible tenant records return controlled not-found responses where appropriate.

## UI Visibility Rules

The frontend navigation currently separates:

- Platform owner pages: platform clinics, platform billing, platform reports, platform health.
- Clinic admin pages: dashboard, calendar, appointments, clients, CRM, WhatsApp, consents, feedback, gifts, categories, services, users, reports, audit, settings.
- Reception pages: calendar, appointments, clients, CRM, consents, feedback, gifts, settings.
- Therapist pages: calendar, appointments, clients, CRM, consents, settings.

UI visibility must remain aligned with server authorization, but server authorization is the source of truth.

## Test Coverage

Automated tests cover:

- Platform owner and clinic role separation.
- Platform health and backup center authorization.
- Tenant isolation for foreign references.
- Therapist appointment and CRM restrictions.
- Unauthorized access to protected routes.
- Missing-record boundaries.
- Session revocation after password reset.

Permission documentation must be updated when tests or route permissions change.
