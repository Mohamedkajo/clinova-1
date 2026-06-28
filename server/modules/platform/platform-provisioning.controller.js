import { json } from "../../shared/http/json-response.js";
import { requirePlatformOwner } from "../../services/permissions.service.js";
import { createPlatformTenant } from "./platform-provisioning.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

export async function handlePlatformProvisioningRoute(req, res, url) {
  if (req.method !== "POST" || url.pathname !== "/api/platform/tenants") return false;

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  const result = await createPlatformTenant(auth.user, await readJsonBody(req));
  json(res, result.status, result.body);
  return true;
}
