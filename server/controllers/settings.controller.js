import { json } from "../shared/http/json-response.js";
import { requirePermission, requirePlatformOwner, requireUser } from "../services/permissions.service.js";
import { getSettings, getTenant, saveSettings, saveTenant } from "../services/settings.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleSettingsRoute(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/settings") {
    const auth = await requireUser(req);
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const result = await getSettings(auth.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const auth = await requirePermission(req, "settings_write");
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const result = await saveSettings(auth.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/tenant") {
    const auth = await requireUser(req);
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const result = await getTenant(auth.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/tenant") {
    const auth = await requirePlatformOwner(req);
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const result = await saveTenant(auth.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
