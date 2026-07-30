import { json } from "../shared/http/json-response.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "../services/notifications.service.js";

export async function handleNotificationsRoute(req, res, url) {
  const permission = await requirePermission(req, "notifications");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/notifications") {
    const result = await getNotifications(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/notifications/read-all") {
    const result = await readAllNotifications(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  const match = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (req.method === "PATCH" && match) {
    const result = await readNotification(permission.user, Number(match[1]));
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
