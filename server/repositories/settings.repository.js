import { audit, db } from "../db.js";

export async function clinicSettings(tenantId) {
  const rows = await db.prepare("SELECT key, value FROM clinic_settings WHERE tenant_id = ? ORDER BY key").all(tenantId);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function updateClinicSettings(values, tenantId) {
  const allowed = [
    "clinicName",
    "logoUrl",
    "currency",
    "workStart",
    "workEnd",
    "workDays",
    "whatsappTemplate",
    "whatsappEnabled",
    "whatsappMode",
    "whatsappBusinessPhone",
    "whatsappFeedbackTemplate",
    "whatsappGiftTemplate",
    "appointmentRemindersEnabled",
    "reminderTimingHours",
    "sameDayReminderEnabled",
    "sameDayReminderTime",
    "reminderChannel",
  ];
  const stmt = await db.prepare(`
    INSERT INTO clinic_settings (tenant_id, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) stmt.run(tenantId, key, String(values[key] ?? ""));
  }
}

export async function findTenantDetails(tenantId) {
  return await db.prepare(`
    SELECT t.id, t.name, t.slug, t.status, t.plan, t.billing_email AS billingEmail,
           s.status AS subscriptionStatus, s.provider, s.provider_customer_id AS providerCustomerId,
           s.provider_subscription_id AS providerSubscriptionId, s.current_period_end AS currentPeriodEnd
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    WHERE t.id = ?
    ORDER BY s.id DESC
    LIMIT 1
  `).get(tenantId);
}

export async function updateTenantProfile(tenantId, values) {
  await db.prepare("UPDATE tenants SET name = ?, billing_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(String(values.name || "Clinova Clinic").trim(), String(values.billingEmail || "").trim(), tenantId);
}

export async function findTenantSummary(tenantId) {
  return await db.prepare("SELECT id, name, slug, status, plan, billing_email AS billingEmail FROM tenants WHERE id = ?").get(tenantId);
}

export async function auditSettings(userId, action, entity, entityId, details) {
  await audit(userId, action, entity, entityId, details);
}
