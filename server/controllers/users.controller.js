import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePermission } from "../services/permissions.service.js";
import { addUser, editUser, getUsers, removeUser } from "../services/users.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleUsersRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;
  const permission = await requirePermission(req, "users");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET" && !id) {
    const result = await getUsers(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && !id) {
    const result = await addUser(permission.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && id) {
    const result = await editUser(permission.user, id, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "DELETE" && id) {
    const result = await removeUser(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
