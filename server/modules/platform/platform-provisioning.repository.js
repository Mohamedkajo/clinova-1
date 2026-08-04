import { audit, db, defaultClinicSettingKeys, provisionTenant } from "../../db.js";
import { hashPassword } from "../../security.js";
import { platformTenants } from "./platform.repository.js";

export async function provisionPlatformTenant(values, connection = db) {
  return provisionTenant(values, connection);
}

export async function updateProvisionedSubscription(tenantId, plan, status, connection = db) {
  await connection.prepare("UPDATE subscriptions SET plan = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?")
    .run(plan, status, tenantId);
}

export async function updateProvisionedTenant(tenantId, plan, status, connection = db) {
  await connection.prepare("UPDATE tenants SET plan = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(plan, status, tenantId);
}

export async function auditPlatformTenantCreate(user, tenantId, plan, status, connection = db) {
  await audit(user.id, "platform_create_tenant", "tenants", tenantId, {
    tenantId: user.tenantId,
    targetTenantId: tenantId,
    plan,
    status,
  }, connection);
}

export async function lockProductionInitialization(connection) {
  await connection.prepare("SELECT pg_advisory_xact_lock(?) AS locked").get(18072701);
}

export async function currentMigrationExists(connection, version) {
  return Boolean(await connection.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version));
}

export async function productionInitializationState(connection, { usernames, emails, slug }) {
  const ownerCounts = await connection.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(is_platform_owner, 0) = 1) AS owners,
      COUNT(*) FILTER (WHERE COALESCE(is_platform_owner, 0) = 1 AND active = 1) AS active_owners,
      COUNT(*) AS users
    FROM users
  `).get();
  const tenants = await connection.prepare(`
    SELECT id, name, slug, status, plan, billing_email AS billingEmail
    FROM tenants
    ORDER BY id
  `).all();
  const usernameConflict = await connection.prepare(`
    SELECT id FROM users
    WHERE lower(username) IN (?, ?)
    LIMIT 1
  `).get(usernames[0], usernames[1]);
  const emailConflict = await connection.prepare(`
    SELECT id FROM users
    WHERE lower(email) IN (?, ?)
    LIMIT 1
  `).get(emails[0], emails[1]);
  const slugConflict = await connection.prepare("SELECT id FROM tenants WHERE lower(slug) = ? LIMIT 1").get(slug);

  let bootstrapTenantId = null;
  if (tenants.length === 1 && Number(ownerCounts.users || 0) === 0) {
    const tenant = tenants[0];
    const knownPlaceholder = Number(tenant.id) === 1
      && ["demo", "primary"].includes(String(tenant.slug || "").toLowerCase())
      && ["clinova demo clinic", "clinova clinic"].includes(String(tenant.name || "").toLowerCase())
      && ["trial", "active"].includes(String(tenant.status || "").toLowerCase())
      && String(tenant.plan || "").toLowerCase() === "starter"
      && !String(tenant.billingEmail || "").trim();

    if (knownPlaceholder) {
      const tenantTables = await connection.prepare(`
        SELECT table_name AS tableName
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'
        ORDER BY table_name
      `).all();
      let containsClinicData = false;
      for (const row of tenantTables) {
        const tableName = String(row.tableName || "");
        if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) throw new Error("Unsafe tenant table metadata.");
        if (tableName === "clinic_settings") continue;
        const count = await connection.prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE tenant_id = ?`).get(tenant.id);
        if (Number(count?.count || 0) > 0) {
          containsClinicData = true;
          break;
        }
      }
      const settingRows = await connection.prepare("SELECT key FROM clinic_settings WHERE tenant_id = ?").all(tenant.id);
      const allowedSettings = new Set(defaultClinicSettingKeys);
      const containsCustomSettings = settingRows.some((row) => !allowedSettings.has(String(row.key || "")));
      if (!containsClinicData && !containsCustomSettings) bootstrapTenantId = Number(tenant.id);
    }
  }

  return {
    activeOwners: Number(ownerCounts.active_owners || 0),
    owners: Number(ownerCounts.owners || 0),
    users: Number(ownerCounts.users || 0),
    tenants: tenants.length,
    usernameConflict: Boolean(usernameConflict),
    emailConflict: Boolean(emailConflict),
    slugConflict: Boolean(slugConflict),
    bootstrapTenantId,
  };
}

export async function removeProductionBootstrapTenant(connection, tenantId) {
  await connection.prepare("DELETE FROM clinic_settings WHERE tenant_id = ?").run(tenantId);
  await connection.prepare("DELETE FROM tenants WHERE id = ?").run(tenantId);
}

export async function createInitialPlatformOwner(connection, tenantId, values) {
  const result = await connection.prepare(`
    INSERT INTO users (
      tenant_id, username, email, password_hash, name, title, role,
      workdays, service_ids, is_platform_owner, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    values.username,
    values.email,
    hashPassword(values.password),
    values.name,
    "Platform owner",
    "admin",
    "[]",
    "[]",
    1,
    1,
  );
  return Number(result.lastInsertRowid);
}

export async function auditProductionInitialization(connection, ownerId, tenantId) {
  await audit(ownerId, "production_initialize", "tenants", tenantId, {
    tenantId,
    targetTenantId: tenantId,
    status: "completed",
  }, connection);
}

export { platformTenants };
