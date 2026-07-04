# Features

## Overview

This document describes the current Clinova production modules. It reflects implemented modules only and should be updated when new features are shipped.

## Authentication and Sessions

### Purpose

Authenticate clinic users and platform owners while keeping clinic access tenant-aware.

### Main Capabilities

- Login with username, password, and clinic identifier for clinic users.
- Platform owner login without clinic identifier.
- Logout and current-user lookup.
- Session revocation after password reset or password change.

### Current Status

Implemented and covered by automated API tests.

### Main Permissions

- Public login endpoint.
- Authenticated access required for protected APIs.
- Platform owner access is separated from clinic access.

### Planned Evolution

- Additional production session hardening may be documented for deployment-specific environments.

## Platform Tenant Management

### Purpose

Allow the platform owner to manage clinics as SaaS tenants.

### Main Capabilities

- List platform tenants.
- Create tenants.
- Update tenant status, plan, and related metadata.
- Deactivate tenants.
- Reset tenant owner passwords.
- Manage tenant domains.

### Current Status

Implemented for platform owner users.

### Main Permissions

- Platform Owner only.
- Clinic Admin, Reception, Therapist, and unauthenticated users are denied.

### Planned Evolution

- More complete onboarding workflows and safer operational dashboards.

## Platform Billing

### Purpose

Support platform-level invoice and subscription workflows.

### Main Capabilities

- View platform billing data.
- Create invoices for tenants.
- Update invoice status.
- Run controlled auto-billing flows.
- Print platform invoice views.

### Current Status

Implemented with platform owner authorization.

### Main Permissions

- Platform Owner only.

### Planned Evolution

- Future external payment integration may be considered separately.

## Platform Health Dashboard

### Purpose

Expose safe operational status to the platform owner.

### Main Capabilities

- App and version status.
- Environment and Node runtime visibility.
- Database connectivity status.
- Upload and backup directory status.
- Server time, uptime, and memory usage.

### Current Status

Implemented and visible only to platform owner users.

### Main Permissions

- Platform Owner only.

### Planned Evolution

- May later include protected operational status panels for monitoring outputs.

## Platform Backup Center

### Purpose

Give platform owners safe backup visibility and manual backup creation.

### Main Capabilities

- List recent backups.
- Show backup count and latest backup metadata.
- Create manual SQLite backup using configured backup directory.
- Avoid exposing unsafe absolute paths.

### Current Status

Implemented for SQLite deployments.

### Main Permissions

- Platform Owner only.

### Planned Evolution

- PostgreSQL backup support, if production moves to PostgreSQL, should be designed separately.

## Dashboard

### Purpose

Give clinic managers a high-level view of clinic activity.

### Main Capabilities

- Clinic summary cards.
- Today's appointments.
- Recent appointments.
- Revenue and activity summaries where available.

### Current Status

Implemented for clinic admin role.

### Main Permissions

- Clinic Admin.
- Not shown to Reception or Therapist.

### Planned Evolution

- More refined analytics and role-specific summaries.

## Calendar and Appointments

### Purpose

Manage clinic scheduling and appointment lifecycle.

### Main Capabilities

- Calendar views.
- Appointment creation and update.
- Appointment archive/delete behavior.
- Status and payment status tracking.
- Work-hours validation.
- Past-date and past-time validation.
- Conflict checks.
- Consent signing entry points from appointment flow.

### Current Status

Implemented and covered by validation and negative tests.

### Main Permissions

- Clinic Admin and Reception can manage scheduling.
- Therapist access is restricted to assigned appointment visibility and allowed actions.
- Platform Owner does not use clinic appointment workflows.

### Planned Evolution

- More advanced calendar UX and scheduling intelligence.

## Clients

### Purpose

Maintain tenant-scoped client records.

### Main Capabilities

- Create, update, view, and archive clients.
- Client profile card.
- Client files.
- CRM history.
- Client status handling.
- Therapist assignment where permitted.

### Current Status

Implemented with tenant isolation and validation.

### Main Permissions

- Clinic Admin and Reception can manage clients.
- Therapist access is restricted according to visibility rules and permissions.

### Planned Evolution

- Stronger client timeline and segmentation tools.

## CRM

### Purpose

Track follow-up tasks, notes, and client events.

### Main Capabilities

- CRM tasks.
- CRM events.
- Add notes through client workflows.
- Mark tasks complete.
- Recent CRM event display in client card.

### Current Status

Implemented with therapist visibility protections.

### Main Permissions

- Clinic Admin and Reception have broad clinic CRM access.
- Therapist access is restricted to visible clients or assigned tasks.

### Planned Evolution

- More structured automation and follow-up pipelines.

## Catalog: Categories and Services

### Purpose

Manage clinic services and service categories.

### Main Capabilities

- Create and update categories.
- Create and update services.
- Archive/delete supported records.
- Service duration and pricing.
- Active/inactive service handling.

### Current Status

Implemented with validation and missing-record protections.

### Main Permissions

- Clinic Admin has catalog management access.
- Reception and Therapist have restricted access.

### Planned Evolution

- Better service packaging and pricing management.

## Users and Invitations

### Purpose

Manage clinic staff and invite new users.

### Main Capabilities

- Create and update users.
- Disable or remove users according to safety rules.
- Staff invitation creation.
- Invitation preview and acceptance.
- Password reset/change workflows.

### Current Status

Implemented with session revocation and authorization tests.

### Main Permissions

- Clinic Admin manages clinic users.
- Platform Owner manages tenant owners through platform workflows.
- Reception and Therapist cannot manage users.

### Planned Evolution

- Stronger invitation token storage and expiry hardening may be considered.

## Files

### Purpose

Store and retrieve client-related files.

### Main Capabilities

- Upload client files.
- List files.
- Download files.
- Archive files.
- Extension, MIME, size, and magic-byte validation.

### Current Status

Implemented with upload safety checks and tenant access controls.

### Main Permissions

- Clinic roles according to file workflow permissions.
- Tenant isolation enforced.

### Planned Evolution

- More granular file categories and retention controls.

## Consents and Legal Forms

### Purpose

Manage legal consent templates and signed consent documents.

### Main Capabilities

- Upload consent templates.
- Associate templates with categories.
- Download consent templates.
- Sign valid consent documents.
- Generate signed PDF client files.
- Prevent signing when no valid document exists.

### Current Status

Implemented with validation, font fallback, and signed-file safeguards.

### Main Permissions

- Clinic Admin and Reception can manage consent workflows.
- Therapist access is restricted.

### Planned Evolution

- More template lifecycle controls and richer signing audit views.

## Feedback

### Purpose

Collect and display client feedback after appointments.

### Main Capabilities

- Create feedback request links.
- Public feedback submission.
- View submitted feedback results.
- WhatsApp fallback message support for feedback links.

### Current Status

Implemented and covered by public endpoint safety checks.

### Main Permissions

- Clinic users with feedback access can manage feedback requests and view results.
- Public feedback endpoint is limited to tokenized submission.

### Planned Evolution

- More analytics and structured feedback reports.

## Gifts

### Purpose

Manage gift cards and related communication.

### Main Capabilities

- Create and update gift cards.
- Track gift status.
- Send WhatsApp gift messages through safe provider/fallback paths.

### Current Status

Implemented with tenant isolation and WhatsApp safety tests.

### Main Permissions

- Clinic Admin and Reception can use gift workflows.
- Therapist access follows current clinic role restrictions.

### Planned Evolution

- More complete redemption and payment integration.

## WhatsApp Messaging

### Purpose

Support clinic communication through fallback, dry-run, and provider paths.

### Main Capabilities

- Appointment reminder send flow.
- Gift send flow.
- Message logs.
- Provider dry-run tests.
- Missing config and provider failure handling.

### Current Status

Implemented with no-real-send automated regression coverage.

### Main Permissions

- Clinic roles with relevant workflow access can trigger supported sends.
- Message logs are protected.

### Planned Evolution

- Real provider integration must be enabled only with production credentials and operational checks.

## Reports

### Purpose

Provide clinic-level operational reporting.

### Main Capabilities

- Appointment reports.
- Revenue summaries.
- Therapist summaries.
- Conflict views.
- CSV export with multilingual encoding support.

### Current Status

Implemented for clinic admin.

### Main Permissions

- Clinic Admin only.

### Planned Evolution

- More report filters, exports, and dashboards.

## Audit Logs

### Purpose

Provide traceability for sensitive operations.

### Main Capabilities

- View audit records.
- Track relevant create, update, archive, and operational actions.

### Current Status

Implemented for admin-level visibility.

### Main Permissions

- Clinic Admin.
- Platform-specific visibility remains separated.

### Planned Evolution

- More structured operational audit views.

## Settings and Tenant Domains

### Purpose

Manage clinic configuration and tenant-level domain settings.

### Main Capabilities

- Clinic settings.
- Work hours.
- Branding fields where supported.
- Tenant metadata.
- Tenant domain create/update/delete.

### Current Status

Implemented with validation and tenant isolation.

### Main Permissions

- Clinic Admin manages clinic settings.
- Tenant domain management is protected.

### Planned Evolution

- More deployment-aware domain verification workflows.

## Search

### Purpose

Help users quickly locate clients, appointments, and services.

### Main Capabilities

- Global quick search.
- Client, appointment, and service result groups.
- More precise narrowing as query length increases.
- Outside-click close behavior.

### Current Status

Implemented in the frontend and backed by protected search APIs.

### Main Permissions

- Search results are limited by authenticated user's tenant and visibility.

### Planned Evolution

- Better ranking, filters, and keyboard navigation.

## Monitoring Helpers and CLIs

### Purpose

Provide local operational checks without exposing public endpoints.

### Main Capabilities

- Backup freshness monitor.
- Restore pending marker monitor.
- PM2 status monitor.
- Disk usage monitor.
- Log-only alert payload modes for supported monitors.

### Current Status

Implemented as local helpers and CLI commands.

### Main Permissions

- Local operator access only.
- No public route exposure.

### Planned Evolution

- Optional alert delivery and systemd/cron deployment may be added later.
