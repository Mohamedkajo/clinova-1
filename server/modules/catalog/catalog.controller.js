import { json } from "../../shared/http/json-response.js";
import { apiNotFound } from "../../shared/http/api-not-found.js";
import { requirePermission } from "../../services/permissions.service.js";
import {
  addCategory,
  addService,
  editCategory,
  editService,
  getCategories,
  getServices,
  removeCategory,
  removeService,
} from "./catalog.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

function catalogParts(url) {
  return url.pathname.split("/").filter(Boolean);
}

async function send(res, result) {
  json(res, result.status, result.body);
  return true;
}

export async function handleCatalogRoute(req, res, url) {
  const parts = catalogParts(url);
  const resource = parts[1];
  if ((resource === "categories" || resource === "services") && parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;

  if ((resource === "categories" || resource === "services") && parts.length > 3) {
    apiNotFound(res);
    return true;
  }

  if (resource === "categories") {
    const auth = await requirePermission(req, "categories");
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const { user } = auth;
    if (req.method === "GET") return send(res, await getCategories(user));
    const body = await readJsonBody(req);
    if (req.method === "POST") return send(res, await addCategory(user, body));
    if (req.method === "PUT" && id) return send(res, await editCategory(user, id, body));
    if (req.method === "DELETE" && id) return send(res, await removeCategory(user, id));
  }

  if (resource === "services") {
    const auth = await requirePermission(req, "services");
    if (!auth.ok) {
      json(res, auth.status, auth.body);
      return true;
    }
    const { user } = auth;
    if (req.method === "GET") return send(res, await getServices(user));
    const body = await readJsonBody(req);
    if (req.method === "POST") return send(res, await addService(user, body));
    if (req.method === "PUT" && id) return send(res, await editService(user, id, body));
    if (req.method === "DELETE" && id) return send(res, await removeService(user, id));
  }

  return false;
}
