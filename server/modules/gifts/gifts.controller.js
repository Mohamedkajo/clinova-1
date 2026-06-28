import { json } from "../../shared/http/json-response.js";
import { requirePermission } from "../../services/permissions.service.js";
import { addGift, editGift, getGifts } from "./gifts.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

async function send(res, result) {
  json(res, result.status, result.body);
  return true;
}

export async function handleGiftsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[2] ? Number(parts[2]) : null;

  const auth = await requirePermission(req, "gifts");
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/gifts") {
    return send(res, await getGifts(auth.user));
  }

  if (req.method === "POST" && url.pathname === "/api/gifts") {
    return send(res, await addGift(auth.user, await readJsonBody(req)));
  }

  if (req.method === "PUT" && id && parts.length === 3) {
    return send(res, await editGift(auth.user, id, await readJsonBody(req)));
  }

  return false;
}
