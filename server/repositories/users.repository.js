import { audit, db } from "../db.js";
import { rowToUser } from "../shared/auth/user-mapper.js";

export async function listUsers(tenantId) {
  const rows = await db.prepare("SELECT * FROM users WHERE tenant_id = ? AND COALESCE(is_platform_owner, 0) = 0 ORDER BY id")
    .all(tenantId);
  return rows.map(rowToUser);
}

export async function createUser(tenantId, values) {
  const result = await db.prepare("INSERT INTO users (tenant_id, username, email, password_hash, name, title, role, workdays, service_ids, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(tenantId, values.username, values.email, values.passwordHash, values.name, values.title, values.role, values.workdays, values.serviceIds, values.active);
  return result.lastInsertRowid;
}

export async function findManagedUser(id, tenantId) {
  return await db.prepare("SELECT email, is_platform_owner AS isPlatformOwner FROM users WHERE id = ? AND tenant_id = ?")
    .get(id, tenantId);
}

export async function updateUser(id, tenantId, values) {
  const passwordPart = values.passwordHash ? ", password_hash = ?" : "";
  const params = values.passwordHash
    ? [values.username, values.email, values.name, values.title, values.role, values.workdays, values.serviceIds, values.active, values.passwordHash, id, tenantId]
    : [values.username, values.email, values.name, values.title, values.role, values.workdays, values.serviceIds, values.active, id, tenantId];
  await db.prepare(`UPDATE users SET username = ?, email = ?, name = ?, title = ?, role = ?, workdays = ?, service_ids = ?, active = ?, updated_at = CURRENT_TIMESTAMP${passwordPart} WHERE id = ? AND tenant_id = ?`)
    .run(...params);
}

export async function deleteUserSessions(id, tenantId) {
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(id, tenantId);
}

export async function deactivateUser(id, tenantId) {
  await db.prepare("UPDATE users SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(id, tenantId);
}

export async function tenantBillingSnapshot(tenantId) {
  const tenant = await db.prepare("SELECT id, status, plan FROM tenants WHERE id = ?").get(tenantId);
  const subscription = await db.prepare(`
    SELECT status, plan
    FROM subscriptions
    WHERE tenant_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(tenantId);
  const userUsage = await db.prepare("SELECT COUNT(*) AS count FROM users WHERE tenant_id = ? AND active = 1 AND COALESCE(is_platform_owner, 0) = 0")
    .get(tenantId);
  return {
    plan: subscription?.plan || tenant?.plan || "starter",
    status: subscription?.status || tenant?.status || "trial",
    usage: { users: Number(userUsage?.count || 0) },
  };
}

export async function auditUser(userId, action, entityId, tenantId) {
  await audit(userId, action, "users", entityId, { tenantId });
}
