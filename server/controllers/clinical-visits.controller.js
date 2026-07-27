import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { readJsonBody } from "../shared/http/json-body.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  addClinicalVisit,
  editClinicalVisit,
  finishClinicalVisit,
  getVisitForAppointment,
} from "../services/clinical-visits.service.js";

export async function handleClinicalVisitsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const isAppointmentRead = req.method === "GET"
    && parts[2] === "appointment"
    && /^\d+$/.test(parts[3] || "")
    && !parts[4];
  const isVisitWrite = /^\d+$/.test(parts[2] || "") && !parts[3] && req.method === "PUT";
  const isComplete = /^\d+$/.test(parts[2] || "") && parts[3] === "complete" && !parts[4] && req.method === "POST";
  const isCreate = req.method === "POST" && !parts[2];
  if (!isAppointmentRead && !isVisitWrite && !isComplete && !isCreate) {
    apiNotFound(res);
    return true;
  }

  const permission = await requirePermission(req, isAppointmentRead ? "clinical_visits_read" : "clinical_visits_write");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  let result;
  if (isAppointmentRead) result = await getVisitForAppointment(permission.user, Number(parts[3]));
  else if (isCreate) result = await addClinicalVisit(permission.user, await readJsonBody(req));
  else if (isVisitWrite) result = await editClinicalVisit(permission.user, Number(parts[2]), await readJsonBody(req));
  else result = await finishClinicalVisit(permission.user, Number(parts[2]));
  json(res, result.status, result.body);
  return true;
}
