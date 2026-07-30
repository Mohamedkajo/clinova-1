import { json } from "../shared/http/json-response.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  getReminders,
  prepareReminders,
  simulateReminderDispatch,
} from "../services/reminders.service.js";

export async function handleRemindersRoute(req, res, url) {
  const permission = await requirePermission(req, "reminders_manage");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/reminders") {
    const result = await getReminders(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/reminders/prepare") {
    const result = await prepareReminders(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/reminders/simulate-dispatch") {
    const result = await simulateReminderDispatch(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
