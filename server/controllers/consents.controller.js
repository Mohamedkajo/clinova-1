import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { contentDispositionName, readMultipart } from "../services/files.service.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  getConsentDownload,
  getConsents,
  removeConsent,
  signConsent,
  uploadConsent,
} from "../services/consents.service.js";
import { CONSENT_SIGNATURE_JSON_LIMIT_BYTES, readJsonBody } from "../shared/http/json-body.js";

function sendDownload(res, result) {
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Length": result.buffer.length,
    "Content-Disposition": `inline; filename*=UTF-8''${contentDispositionName(result.file.originalName || result.file.title)}`,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(result.buffer);
}

export async function handleConsentsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;
  if (id && parts[3] && parts[3] !== "sign" && parts[3] !== "download") {
    apiNotFound(res);
    return true;
  }

  const permissionKey = req.method === "GET" || parts[3] === "sign" ? "consents" : "consents_write";
  const permission = await requirePermission(req, permissionKey);
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  if (req.method === "POST" && id && parts[3] === "sign") {
    const result = await signConsent(permission.user, id, await readJsonBody(req, { maxBytes: CONSENT_SIGNATURE_JSON_LIMIT_BYTES }));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && id && parts[3] === "download") {
    const result = await getConsentDownload(permission.user, id);
    if (result.buffer) {
      sendDownload(res, result);
      return true;
    }
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && !id) {
    const result = await getConsents(permission.user);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && !id) {
    const result = await uploadConsent(permission.user, await readMultipart(req));
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "DELETE" && id) {
    const result = await removeConsent(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
