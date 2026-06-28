import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePermission } from "../services/permissions.service.js";
import { createFeedback, getFeedback, getPublicFeedback, submitFeedback } from "../services/feedback.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleFeedbackRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts[1] === "public" && parts[2] === "feedback" && parts.length !== 4) {
    apiNotFound(res);
    return true;
  }

  if (parts[1] === "public" && parts[2] === "feedback" && parts.length === 4) {
    const token = parts[3];
    const result = req.method === "GET"
      ? await getPublicFeedback(token)
      : await submitFeedback(token, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (url.pathname !== "/api/feedback") return false;
  const permission = await requirePermission(req, "feedback");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "GET") {
    const result = await getFeedback(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST") {
    const result = await createFeedback(permission.user, await readJsonBody(req), req);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
