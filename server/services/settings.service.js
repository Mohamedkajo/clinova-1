import {
  auditSettings,
  clinicSettings,
  findTenantDetails,
  findTenantSummary,
  updateClinicSettings,
  updateTenantProfile,
} from "../repositories/settings.repository.js";
import {
  hasReminderSettingChanges,
  syncTenantReminders,
  validateReminderSettings,
} from "./reminders.service.js";

export async function getSettings(user) {
  return { status: 200, body: { settings: await clinicSettings(user.tenantId) } };
}

export async function saveSettings(user, body) {
  const reminderError = validateReminderSettings(body);
  if (reminderError) return { status: 400, body: { error: reminderError } };
  await updateClinicSettings(body, user.tenantId);
  const reminderSettingsChanged = hasReminderSettingChanges(body);
  await auditSettings(user.id, "update", "settings", null, {
    tenantId: user.tenantId,
    reminderSettingsChanged,
  });
  if (reminderSettingsChanged) {
    await syncTenantReminders({ tenantId: user.tenantId, actorUserId: user.id, replace: true });
  }
  return { status: 200, body: { settings: await clinicSettings(user.tenantId) } };
}

export async function getTenant(user) {
  return { status: 200, body: { tenant: await findTenantDetails(user.tenantId) } };
}

export async function saveTenant(user, body) {
  await updateTenantProfile(user.tenantId, body);
  await auditSettings(user.id, "update", "tenants", user.tenantId, { tenantId: user.tenantId });
  return { status: 200, body: { tenant: await findTenantSummary(user.tenantId) } };
}
