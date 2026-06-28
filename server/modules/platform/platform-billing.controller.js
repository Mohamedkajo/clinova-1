import { json } from "../../shared/http/json-response.js";
import { requirePlatformOwner } from "../../services/permissions.service.js";
import { runPlatformAutoBilling } from "./platform-billing.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

export async function handlePlatformBillingRoute(req, res, url) {
  if (req.method !== "POST" || url.pathname !== "/api/platform/billing/auto-run") return false;

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  const result = await runPlatformAutoBilling(auth.user, await readJsonBody(req));
  json(res, result.status, result.body);
  return true;
}
