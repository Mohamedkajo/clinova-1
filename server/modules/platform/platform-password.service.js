import { hashPassword } from "../../security.js";
import {
  auditTenantAdminPasswordReset,
  deleteTenantAdminSessions,
  findTenantAdmin,
  findTenantForPasswordReset,
  platformTenants,
  updateTenantAdminPassword,
} from "./platform-password.repository.js";

export async function resetTenantAdminPassword(user, tenantId, body) {
  const newPassword = String(body.password || "").trim();
  if (newPassword.length < 8) return { status: 400, body: { error: "Password must be at least 8 characters." } };

  const tenant = await findTenantForPasswordReset(tenantId);
  if (!tenant) return { status: 404, body: { error: "Tenant not found" } };

  const owner = await findTenantAdmin(tenantId);
  if (!owner) return { status: 404, body: { error: "No active clinic admin was found for this clinic." } };

  await updateTenantAdminPassword(tenantId, owner.id, hashPassword(newPassword));
  await deleteTenantAdminSessions(tenantId, owner.id);
  await auditTenantAdminPasswordReset(user, tenantId, owner.id);
  return {
    status: 200,
    body: {
      tenants: await platformTenants(),
      owner: { id: owner.id, username: owner.username, email: owner.email, name: owner.name },
      tenant: { id: tenant.id, name: tenant.name },
    },
  };
}
