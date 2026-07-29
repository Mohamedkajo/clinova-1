import { json } from "../shared/http/json-response.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  contentDispositionName,
  getClientFileDownload,
  getClientFiles,
  readMultipart,
  removeClientFile,
  uploadClientFile,
} from "../services/files.service.js";

function sendDownload(res, result) {
  res.writeHead(200, {
    "Content-Type": result.file.mimeType || "application/octet-stream",
    "Content-Length": result.buffer.length,
    "Content-Disposition": `inline; filename*=UTF-8''${contentDispositionName(result.file.originalName || result.file.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox",
  });
  res.end(result.buffer);
}

export async function handleFilesRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[1];
  const id = parts[2] ? Number(parts[2]) : null;

  if (resource === "clients" && id && parts[3] === "files") {
    const permission = await requirePermission(req, req.method === "GET" ? "client_files_metadata" : "client_files_write");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }

    if (req.method === "GET") {
      const result = await getClientFiles(permission.user, id);
      json(res, result.status, result.body);
      return true;
    }

    if (req.method === "POST") {
      const result = await uploadClientFile(permission.user, id, await readMultipart(req));
      json(res, result.status, result.body);
      return true;
    }
  }

  if (resource === "client-files" && id && parts[3] === "download" && req.method === "GET") {
    const permission = await requirePermission(req, "client_files_read");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = await getClientFileDownload(permission.user, id);
    if (result.buffer) {
      sendDownload(res, result);
      return true;
    }
    json(res, result.status, result.body);
    return true;
  }

  if (resource === "client-files" && id && req.method === "DELETE") {
    const permission = await requirePermission(req, "client_files_delete");
    if (!permission.ok) {
      json(res, permission.status, permission.body);
      return true;
    }
    const result = await removeClientFile(permission.user, id);
    json(res, result.status, result.body);
    return true;
  }

  return false;
}
