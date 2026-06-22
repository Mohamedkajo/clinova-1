import { json } from "../../shared/http/json-response.js";
import { requirePlatformOwner } from "../../services/permissions.service.js";
import { createPlatformBackup, listPlatformBackups } from "./platform-backups.service.js";
import { getPlatformHealth, getPlatformTenants, updatePlatformTenant } from "./platform.service.js";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

export async function handlePlatformRoute(req, res, url) {
  const isHealthRead = req.method === "GET" && url.pathname === "/api/platform/health";
  const isBackupRead = req.method === "GET" && url.pathname === "/api/platform/backups";
  const isBackupCreate = req.method === "POST" && url.pathname === "/api/platform/backups";
  const isTenantRead = req.method === "GET" && url.pathname === "/api/platform/tenants";
  const updateMatch = req.method === "PUT" ? url.pathname.match(/^\/api\/platform\/tenants\/(\d+)$/) : null;
  if (!isHealthRead && !isBackupRead && !isBackupCreate && !isTenantRead && !updateMatch) return false;

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  const result = isHealthRead
    ? await getPlatformHealth()
    : isBackupRead
      ? { status: 200, body: listPlatformBackups() }
      : isBackupCreate
        ? await createPlatformBackup(auth.user)
    : isTenantRead
      ? await getPlatformTenants()
      : await updatePlatformTenant(auth.user, Number(updateMatch[1]), await readBody(req));
  json(res, result.status, result.body);
  return true;
}
