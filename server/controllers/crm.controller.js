import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePermission } from "../services/permissions.service.js";
import { addCrmTask, editCrmTask, getCrm, getCrmTasks } from "../services/crm.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleCrmRoute(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/crm") {
    const permission = await requirePermission(req, "crm");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = await getCrm(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[1] !== "crm-tasks") return false;
  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;
  if (parts.length > 3) {
    apiNotFound(res);
    return true;
  }

  const permission = await requirePermission(req, req.method === "GET" ? "crm" : "crm_write");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET") {
    const result = await getCrmTasks(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && !id) {
    const result = await addCrmTask(permission.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && id) {
    const result = await editCrmTask(permission.user, id, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
