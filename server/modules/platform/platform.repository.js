import { audit, db } from "../../db.js";

export const planCatalog = {
  starter: { name: "Starter", monthlyPrice: 49, maxUsers: 5, maxClients: 200, whatsapp: false, billing: false },
  growth: { name: "Growth", monthlyPrice: 99, maxUsers: 10, maxClients: 2000, whatsapp: true, billing: false },
  scale: { name: "Scale", monthlyPrice: 199, maxUsers: null, maxClients: null, whatsapp: true, billing: true },
};

export async function tenantDomains(tenantId) {
  return db.prepare(`
    SELECT id, domain, status, is_primary AS isPrimary, verified_at AS verifiedAt, created_at AS createdAt, updated_at AS updatedAt
    FROM tenant_domains
    WHERE tenant_id = ?
    ORDER BY is_primary DESC, id DESC
  `).all(tenantId);
}

export async function platformTenants() {
  const tenants = await db.prepare(`
    SELECT t.id, t.name, t.slug, t.status, t.plan, t.billing_email AS billingEmail, t.trial_ends_at AS trialEndsAt,
           t.created_at AS createdAt, t.updated_at AS updatedAt,
           COALESCE(s.status, t.status) AS subscriptionStatus, COALESCE(s.plan, t.plan) AS subscriptionPlan,
           s.current_period_end AS currentPeriodEnd, COALESCE(s.billing_day, 1) AS billingDay,
           COALESCE(s.auto_billing_enabled, 0) AS autoBillingEnabled
    FROM tenants t
    LEFT JOIN subscriptions s ON s.id = (
      SELECT id FROM subscriptions WHERE tenant_id = t.id ORDER BY id DESC LIMIT 1
    )
    ORDER BY t.id DESC
  `).all();

  return Promise.all(tenants.map(async (tenant) => {
    const invoiceRows = await db.prepare(`
      SELECT id, number, status, currency, amount, period_start AS periodStart, period_end AS periodEnd,
             due_at AS dueAt, paid_at AS paidAt, notes, billing_cycle AS billingCycle, created_at AS createdAt, updated_at AS updatedAt
      FROM billing_invoices
      WHERE tenant_id = ?
      ORDER BY id DESC
      LIMIT 50
    `).all(tenant.id);
    return {
      ...tenant,
      users: Number((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND active = 1 AND COALESCE(is_platform_owner, 0) = 0").get(tenant.id)).count || 0),
      clients: Number((await db.prepare("SELECT COUNT(*) AS count FROM clients WHERE tenant_id = ? AND active = 1").get(tenant.id)).count || 0),
      invoices: Number((await db.prepare("SELECT COUNT(*) AS count FROM billing_invoices WHERE tenant_id = ?").get(tenant.id)).count || 0),
      openBalance: Number((await db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM billing_invoices WHERE tenant_id = ? AND status IN ('draft', 'open', 'uncollectible')").get(tenant.id)).total || 0),
      paidRevenue: Number((await db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM billing_invoices WHERE tenant_id = ? AND status = 'paid'").get(tenant.id)).total || 0),
      recentInvoices: invoiceRows,
      domains: await tenantDomains(tenant.id),
    };
  }));
}

export async function findTenant(tenantId) {
  return db.prepare("SELECT id, status, plan FROM tenants WHERE id = ?").get(tenantId);
}

export async function latestSubscription(tenantId) {
  return db.prepare("SELECT id FROM subscriptions WHERE tenant_id = ? ORDER BY id DESC LIMIT 1").get(tenantId);
}

export async function updateSubscription(subscriptionId, tenantId, { plan, status, billingDay, autoBillingEnabled }) {
  await db.prepare("UPDATE subscriptions SET plan = ?, status = ?, billing_day = ?, auto_billing_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(plan, status, billingDay, autoBillingEnabled ? 1 : 0, subscriptionId, tenantId);
}

export async function createSubscription(tenantId, { plan, status, billingDay, autoBillingEnabled }) {
  await db.prepare("INSERT INTO subscriptions (tenant_id, provider, status, plan, billing_day, auto_billing_enabled) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tenantId, "manual", status, plan, billingDay, autoBillingEnabled ? 1 : 0);
}

export async function updateTenantPlanStatus(tenantId, plan, status) {
  await db.prepare("UPDATE tenants SET plan = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(plan, status, tenantId);
}

export async function auditPlatformTenantUpdate(user, tenantId, plan, status) {
  await audit(user.id, "platform_update_tenant", "tenants", tenantId, { tenantId: user.tenantId, targetTenantId: tenantId, plan, status });
}

export async function deactivateTenant(tenantId) {
  await db.prepare("UPDATE tenants SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(tenantId);
  await db.prepare(`
    UPDATE subscriptions
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ?
  `).run(tenantId);
}

export async function auditPlatformTenantDeactivate(user, tenantId) {
  await audit(user.id, "platform_deactivate_tenant", "tenants", tenantId, {
    tenantId: user.tenantId,
    targetTenantId: tenantId,
  });
}
