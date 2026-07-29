import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { contentDispositionName, readMultipart } from "../services/files.service.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  addConsentTemplate,
  assignPatientConsent,
  changePatientConsentStatus,
  deactivateConsentTemplate,
  editConsentTemplate,
  getConsentDownload,
  getConsentTemplates,
  getConsents,
  getPatientConsents,
  removeConsent,
  signAssignedConsent,
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
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox",
  });
  res.end(result.buffer);
}

export async function handleConsentsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[1];

  if (resource === "consent-templates") {
    const id = parts[2] && /^\d+$/.test(parts[2]) ? Number(parts[2]) : null;
    if (parts[2] && !id) {
      apiNotFound(res);
      return true;
    }
    const permission = await requirePermission(req, req.method === "GET" ? "consents" : "consent_templates_manage");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    if (req.method === "GET" && !id) {
      const result = await getConsentTemplates(permission.user, url.searchParams.get("includeInactive") === "1");
      json(res, result.status, result.body);
      return true;
    }
    if (req.method === "POST" && !id) {
      const result = await addConsentTemplate(permission.user, await readJsonBody(req));
      json(res, result.status, result.body);
      return true;
    }
    if (req.method === "PUT" && id) {
      const result = await editConsentTemplate(permission.user, id, await readJsonBody(req));
      json(res, result.status, result.body);
      return true;
    }
    if (req.method === "POST" && id && parts[3] === "deactivate") {
      const result = await deactivateConsentTemplate(permission.user, id);
      json(res, result.status, result.body);
      return true;
    }
    return false;
  }

  if (resource === "clients" && /^\d+$/.test(parts[2] || "") && parts[3] === "consents") {
    const clientId = Number(parts[2]);
    const permission = await requirePermission(req, req.method === "GET" ? "consents" : "patient_consents_write");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = req.method === "GET"
      ? await getPatientConsents(permission.user, clientId)
      : await assignPatientConsent(permission.user, clientId, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (resource === "patient-consents" && /^\d+$/.test(parts[2] || "")) {
    const permissionKey = parts[3] === "sign" ? "consents" : "patient_consents_write";
    const permission = await requirePermission(req, permissionKey);
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const body = await readJsonBody(req, {
      maxBytes: parts[3] === "sign" ? CONSENT_SIGNATURE_JSON_LIMIT_BYTES : undefined,
    });
    const result = parts[3] === "sign"
      ? await signAssignedConsent(permission.user, Number(parts[2]), body)
      : await changePatientConsentStatus(permission.user, Number(parts[2]), body);
    json(res, result.status, result.body);
    return true;
  }

  if (parts[2] && !/^\d+$/.test(parts[2])) {
    apiNotFound(res);
    return true;
  }
  const id = parts[2] ? Number(parts[2]) : null;
  if (id && parts[3] && parts[3] !== "sign" && parts[3] !== "download") {
    apiNotFound(res);
    return true;
  }

  const permissionKey = req.method === "GET" || parts[3] === "sign" ? "consents" : "consent_templates_manage";
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
