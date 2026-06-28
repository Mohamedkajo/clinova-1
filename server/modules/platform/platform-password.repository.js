import { audit, db } from "../../db.js";
import { platformTenants } from "./platform.repository.js";

export async function findTenantForPasswordReset(tenantId) {
  return db.prepare("SELECT id, name FROM tenants WHERE id = ?").get(tenantId);
}

export async function findTenantAdmin(tenantId) {
  return db.prepare(`
    SELECT id, username, email, name
    FROM users
    WHERE tenant_id = ? AND role = 'admin' AND active = 1 AND COALESCE(is_platform_owner, 0) = 0
    ORDER BY id
    LIMIT 1
  `).get(tenantId);
}

export async function updateTenantAdminPassword(tenantId, userId, passwordHash) {
  await db.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(passwordHash, userId, tenantId);
}

export async function deleteTenantAdminSessions(tenantId, userId) {
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND tenant_id = ?").run(userId, tenantId);
}

export async function auditTenantAdminPasswordReset(user, targetTenantId, targetUserId) {
  await audit(user.id, "platform_reset_tenant_password", "users", targetUserId, {
    tenantId: user.tenantId,
    targetTenantId,
    targetUserId,
  });
}

export { platformTenants };
