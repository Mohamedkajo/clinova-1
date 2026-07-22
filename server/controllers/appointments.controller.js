import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  addAppointment,
  editAppointment,
  getAppointment,
  getAppointmentQueue,
  getAppointments,
  removeAppointment,
} from "../services/appointments.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleAppointmentsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.method === "GET" && parts[2] === "queue" && !parts[3]) {
    const permission = await requirePermission(req, "appointments_read");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = await getAppointmentQueue(permission.user, url.searchParams.get("date") || "");
    json(res, result.status, result.body);
    return true;
  }
  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;

  if (id && parts[3]) {
    apiNotFound(res);
    return true;
  }

  const key = req.method === "DELETE" ? "appointments_delete" : req.method === "GET" ? "appointments_read" : "appointments_write";
  const permission = await requirePermission(req, key);
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET" && !id) {
    const result = await getAppointments(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && id) {
    const result = await getAppointment(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && !id) {
    const result = await addAppointment(permission.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "PUT" && id) {
    const result = await editAppointment(permission.user, id, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "DELETE" && id) {
    const result = await removeAppointment(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
