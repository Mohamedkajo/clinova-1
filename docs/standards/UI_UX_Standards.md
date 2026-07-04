# UI and UX Standards

## Purpose

This document defines user-interface and user-experience standards for Clinova.

## Language and Readability

- Hebrew and Arabic text must be readable.
- Avoid mojibake, replacement characters, and broken encoded strings.
- Use clear user-facing language for success and error messages.
- English may be used where supported, but Hebrew and Arabic must remain readable.

## RTL Support

- Clinic UI must support right-to-left layout.
- Forms, tables, modals, and navigation must remain readable in RTL.
- Do not introduce layout changes that break Arabic or Hebrew text.

## Success Messages

- Successful actions should show a clear confirmation when the user needs feedback.
- Settings saves, create/update actions, and operational actions should not fail silently.
- Avoid stale success messages after navigation or failed follow-up actions.

## Error Messages

- Errors must be readable and controlled.
- Do not show raw backend stack traces or internal messages.
- Use localized frontend mapping when backend errors are stable codes.
- Permission, validation, not-found, and operation-failed messages should follow a consistent tone.

## No Silent Button Failures

- Buttons must either perform their action or show a controlled error.
- Disabled buttons should communicate why they are unavailable when practical.
- Failed network or API calls should surface readable feedback.

## Role-Based UI

- Pages and actions should match the user's role.
- Platform Owner pages must not appear to clinic users.
- Admin-only clinic pages must not appear to Reception or Therapist users.
- UI visibility must align with backend authorization but does not replace it.

## Forms

- Required fields should be visible and clear.
- Frontend form behavior should preserve backend validation.
- Do not rely only on frontend validation for security.

## Search

- Search should narrow results as the query becomes more specific.
- Search dropdowns should close on outside click without breaking result selection.
- Search results must be escaped and safe to render.

## Data Rendering

- Render untrusted user data as text by default.
- Avoid unsafe `innerHTML` usage for dynamic values.
- Preserve multilingual names, notes, CRM events, feedback, invoice fields, and consent text.
