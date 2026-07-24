import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePermission } from "../services/permissions.service.js";
import { addClient, addClientNote, editClient, getClientHistory, getClients, getPatientWorkspace, removeClient } from "../services/clients.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleClientsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.method === "GET" && parts[2] === "workspace" && !parts[3]) {
    const permission = await requirePermission(req, "clients_read");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = await getPatientWorkspace(permission.user, Object.fromEntries(url.searchParams.entries()));
    json(res, result.status, result.body);
    return true;
  }
  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;

  if (id && parts[3] && !["history", "notes"].includes(parts[3])) {
    apiNotFound(res);
    return true;
  }

  const permissionKey = req.method === "POST" && id && parts[3] === "notes"
    ? "clients_clinical_write"
    : req.method === "GET" && parts[3] !== "notes"
      ? "clients_read"
      : "clients_write";
  const permission = await requirePermission(req, permissionKey);
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET" && id && parts[3] === "history") {
    const result = await getClientHistory(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && id && parts[3] === "notes") {
    const result = await addClientNote(permission.user, id, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && !id) {
    const result = await getClients(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && !id) {
    const result = await addClient(permission.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && id) {
    const result = await editClient(permission.user, id, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "DELETE" && id) {
    const result = await removeClient(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
