import { audit, db, findLoginUser } from "../db.js";
import { rowToUser } from "../shared/auth/user-mapper.js";

export async function findUserForLogin(identifier, tenant) {
  return await findLoginUser(identifier, tenant);
}

export async function findPlatformOwnerForLogin(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();
  if (!normalized) return null;
  return await db.prepare(`
    SELECT *
    FROM users
    WHERE active = 1
      AND COALESCE(is_platform_owner, 0) = 1
      AND (lower(username) = ? OR lower(email) = ?)
    ORDER BY id
    LIMIT 1
  `).get(normalized, normalized);
}

export async function tenantIdentifierExists(identifier) {
  const normalized = String(identifier || "").trim().toLowerCase();
  if (!normalized) return false;
  const row = await db.prepare(`
    SELECT id
    FROM tenants
    WHERE lower(slug) = ?
    UNION
    SELECT tenant_id AS id
    FROM tenant_domains
    WHERE lower(domain) = ?
    LIMIT 1
  `).get(normalized, normalized);
  return Boolean(row);
}

export async function createSession(id, tenantId, userId, expiresAt) {
  await db.prepare("INSERT INTO sessions (id, tenant_id, user_id, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, tenantId, userId, expiresAt);
}

export async function deleteSession(id) {
  await db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export async function findActiveSession(id, now) {
  return await db.prepare("SELECT tenant_id, user_id FROM sessions WHERE id = ? AND expires_at > ?")
    .get(id, now);
}

export async function findActiveUser(userId, tenantId) {
  return await db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(userId, tenantId);
}

export function toUser(row) {
  return rowToUser(row);
}

export async function auditLogin(userId, tenantId) {
  await audit(userId, "login", "session", null, { tenantId });
}
