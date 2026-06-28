import { json } from "../../shared/http/json-response.js";
import { requirePlatformOwner } from "../../services/permissions.service.js";
import { createInvoice, updateInvoice } from "./platform-invoices.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

export async function handlePlatformInvoicesRoute(req, res, url) {
  const createMatch = req.method === "POST" ? url.pathname.match(/^\/api\/platform\/tenants\/(\d+)\/invoices$/) : null;
  const updateMatch = req.method === "PUT" ? url.pathname.match(/^\/api\/platform\/invoices\/(\d+)$/) : null;
  if (!createMatch && !updateMatch) return false;

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  const body = await readJsonBody(req);
  const result = createMatch
    ? await createInvoice(auth.user, Number(createMatch[1]), body)
    : await updateInvoice(auth.user, Number(updateMatch[1]), body);
  json(res, result.status, result.body);
  return true;
}
