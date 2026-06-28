import { json } from "../../shared/http/json-response.js";
import { requirePlatformOwner } from "../../services/permissions.service.js";
import { resetTenantAdminPassword } from "./platform-password.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

export async function handlePlatformPasswordRoute(req, res, url) {
  const match = req.method === "POST" ? url.pathname.match(/^\/api\/platform\/tenants\/(\d+)\/reset-password$/) : null;
  if (!match) return false;

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  const result = await resetTenantAdminPassword(auth.user, Number(match[1]), await readJsonBody(req));
  json(res, result.status, result.body);
  return true;
}
