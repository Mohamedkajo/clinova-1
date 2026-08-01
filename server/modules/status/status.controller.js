import { json } from "../../shared/http/json-response.js";
import { requirePermission } from "../../services/permissions.service.js";
import { health, readiness, version } from "./status.service.js";

function send(res, result) {
  json(res, result.status, result.body);
  return true;
}

export async function handleStatusRoute(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, await health());
  }
  if (req.method === "GET" && url.pathname === "/api/version") {
    return send(res, await version());
  }
  if (req.method === "GET" && url.pathname === "/api/operations/readiness") {
    const permission = await requirePermission(req, "operations_readiness");
    if (!permission.ok) return send(res, permission);
    return send(res, await readiness(permission.user));
  }
  return false;
}
