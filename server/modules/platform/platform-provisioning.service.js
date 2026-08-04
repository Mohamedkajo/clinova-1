import { planCatalog } from "./platform.repository.js";
import {
  auditPlatformTenantCreate,
  platformTenants,
  provisionPlatformTenant,
  updateProvisionedSubscription,
  updateProvisionedTenant,
} from "./platform-provisioning.repository.js";

const tenantStatuses = ["trial", "active", "past_due", "suspended", "cancelled"];

function hasExplicitValue(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined && body[field] !== null && body[field] !== "";
}

export async function createPlatformTenant(user, body) {
  if ((hasExplicitValue(body, "plan") && !planCatalog[body.plan])
      || (hasExplicitValue(body, "status") && !tenantStatuses.includes(body.status))) {
    return { status: 400, body: { error: "Valid plan and status are required." } };
  }
  const result = await provisionPlatformTenant({
    clinicName: body.clinicName,
    slug: body.slug,
    ownerName: body.ownerName,
    email: body.email,
    password: body.password,
  });
  const plan = planCatalog[body.plan] ? body.plan : "starter";
  const status = tenantStatuses.includes(body.status) ? body.status : "trial";
  await updateProvisionedSubscription(result.tenant.id, plan, status);
  await updateProvisionedTenant(result.tenant.id, plan, status);
  await auditPlatformTenantCreate(user, result.tenant.id, plan, status);
  return { status: 201, body: { tenants: await platformTenants(), tenant: result.tenant } };
}

export async function provisionInitialPlatformTenant(values, connection) {
  return provisionPlatformTenant(values, connection);
}
