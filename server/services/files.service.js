import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { hasValidFileSignature } from "../shared/uploads/file-signatures.js";
import {
  archiveClientFile,
  auditFile,
  canSeeClient,
  clientFileById,
  createClientFile,
  listClientFiles,
  updateClientFileUrl,
} from "../repositories/files.repository.js";

const clientAccessError = "لا تملك صلاحية لهذا العميل";

export function safeFileName(name) {
  const parsed = basename(String(name || "file")).replace(/[^\p{L}\p{N}._ -]/gu, "_").trim();
  return parsed || "file";
}

export function contentDispositionName(name) {
  return encodeURIComponent(safeFileName(name)).replace(/['()]/g, escape);
}

async function readRawBody(req, maxBytes = config.uploads.maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error(`הקובץ גדול מדי. הגודל המקסימלי הוא ${Math.round(maxBytes / 1024 / 1024)}MB`);
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) {
    const error = new Error("בקשת העלאה לא תקינה");
    error.status = 400;
    throw error;
  }

  const raw = await readRawBody(req);
  const body = raw.toString("latin1");
  const fields = {};
  const files = {};

  for (const part of body.split(`--${boundary}`)) {
    if (!part || part === "--\r\n" || part === "--") continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const header = part.slice(0, headerEnd);
    let content = part.slice(headerEnd + 4);
    if (content.endsWith("\r\n")) content = content.slice(0, -2);
    if (content.endsWith("--")) content = content.slice(0, -2);

    const disposition = header.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    const type = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";

    if (filename) {
      files[name] = {
        filename: safeFileName(filename),
        type,
        buffer: Buffer.from(content, "latin1"),
      };
    } else {
      fields[name] = Buffer.from(content, "latin1").toString("utf8");
    }
  }

  return { fields, files };
}

export async function getClientFiles(user, clientId) {
  if (!await canSeeClient(user, clientId)) {
    return { status: 403, body: { error: clientAccessError } };
  }
  return { status: 200, body: await listClientFiles(clientId, user.tenantId) };
}

export async function uploadClientFile(user, clientId, multipart) {
  if (!await canSeeClient(user, clientId)) {
    return { status: 403, body: { error: clientAccessError } };
  }
  const file = multipart.files.file;
  if (!file || file.buffer.length === 0) {
    return { status: 400, body: { error: "יש לבחור קובץ להעלאה" } };
  }
  if (!config.uploads.allowedTypes.includes(file.type)) {
    return { status: 400, body: { error: "סוג הקובץ אינו נתמך" } };
  }

  if (!hasValidFileSignature(file)) {
    return { status: 400, body: { error: "File content does not match its type." } };
  }

  const ext = extname(file.filename).toLowerCase();
  const clientDir = resolve(config.uploads.dir, "clients", String(clientId));
  mkdirSync(clientDir, { recursive: true });
  const storedName = `${Date.now()}-${randomUUID()}${ext}`;
  const target = resolve(clientDir, storedName);
  writeFileSync(target, file.buffer);

  const displayName = String(multipart.fields.name || file.filename).trim() || file.filename;
  const id = await createClientFile({
    tenantId: user.tenantId,
    clientId,
    name: displayName,
    originalName: file.filename,
    mimeType: file.type,
    size: file.buffer.length,
    path: target,
    notes: multipart.fields.notes || "",
  });
  const url = `/api/client-files/${id}/download`;
  await updateClientFileUrl(id, url);
  await auditFile(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id, url } };
}

export async function getClientFileDownload(user, id) {
  const file = await clientFileById(id, user.tenantId);
  if (!file) return { status: 404, body: { error: "הקובץ לא נמצא" } };
  if (!await canSeeClient(user, file.clientId)) {
    return { status: 403, body: { error: "אין הרשאה לקובץ זה" } };
  }
  if (!file.path) {
    return { status: 302, location: file.url };
  }
  if (!existsSync(file.path)) {
    return { status: 404, body: { error: "הקובץ לא נמצא באחסון" } };
  }
  const buffer = readFileSync(file.path);
  return { status: 200, file, buffer };
}

export async function removeClientFile(user, id) {
  const changes = await archiveClientFile(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "File not found." } };
  await auditFile(user.id, "archive", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
