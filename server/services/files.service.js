import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { hasValidFileSignature } from "../shared/uploads/file-signatures.js";
import {
  addFileTimelineEvent,
  archiveClientFile,
  auditFile,
  canSeeClient,
  clientFileById,
  createClientFile,
  linkedFileContext,
  listClientFiles,
  updateClientFileUrl,
} from "../repositories/files.repository.js";

const clientAccessError = "You do not have access to this patient.";
const clinicalFileTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const fileCategories = new Set(["clinical", "diagnostic", "treatment", "consent", "other"]);

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
      const error = new Error(`File is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)}MB.`);
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readMultipart(req) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    const error = new Error("Invalid upload request.");
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
      files[name] = { filename: safeFileName(filename), type, buffer: Buffer.from(content, "latin1") };
    } else {
      fields[name] = Buffer.from(content, "latin1").toString("utf8");
    }
  }
  return { fields, files };
}

function publicFileMetadata(file, canDownload) {
  return {
    id: file.id,
    clientId: file.clientId,
    appointmentId: file.appointmentId,
    clinicalVisitId: file.clinicalVisitId,
    name: file.name,
    originalName: file.originalName,
    storedName: file.storedName,
    mimeType: file.mimeType,
    size: file.size,
    category: file.category,
    uploadedBy: file.uploadedBy,
    uploaderName: file.uploaderName || "",
    createdAt: file.createdAt,
    canDownload,
    ...(canDownload ? { url: file.url, notes: file.notes } : {}),
  };
}

export async function getClientFiles(user, clientId) {
  if (!await canSeeClient(user, clientId)) return { status: 403, body: { error: clientAccessError } };
  const canDownload = user.role === "admin" || user.role === "therapist";
  return {
    status: 200,
    body: (await listClientFiles(clientId, user.tenantId)).map((file) => publicFileMetadata(file, canDownload)),
  };
}

function optionalId(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
}

export async function uploadClientFile(user, clientId, multipart) {
  if (!await canSeeClient(user, clientId)) return { status: 403, body: { error: clientAccessError } };
  const file = multipart.files.file;
  if (!file || file.buffer.length === 0) return { status: 400, body: { error: "Choose a file to upload." } };
  if (!clinicalFileTypes.has(file.type) || !config.uploads.allowedTypes.includes(file.type)) {
    return { status: 400, body: { error: "Unsupported clinical file type." } };
  }
  if (!hasValidFileSignature(file)) {
    return { status: 400, body: { error: "File content does not match its type." } };
  }

  let appointmentId = optionalId(multipart.fields.appointmentId);
  const clinicalVisitId = optionalId(multipart.fields.clinicalVisitId);
  if (Number.isNaN(appointmentId) || Number.isNaN(clinicalVisitId)) {
    return { status: 400, body: { error: "Invalid appointment or clinical visit reference." } };
  }
  const linkedContext = await linkedFileContext({ tenantId: user.tenantId, clientId, appointmentId, clinicalVisitId });
  if (!linkedContext) {
    return { status: 404, body: { error: "Linked appointment or clinical visit was not found for this patient." } };
  }
  appointmentId = linkedContext.appointmentId;
  const category = String(multipart.fields.category || "clinical").trim().toLowerCase();
  if (!fileCategories.has(category)) return { status: 400, body: { error: "Invalid clinical file category." } };

  const extension = extname(file.filename).toLowerCase();
  const clientDir = resolve(config.uploads.dir, "tenants", String(user.tenantId), "clients", String(clientId));
  mkdirSync(clientDir, { recursive: true });
  const storedName = `${randomUUID()}${extension}`;
  const target = resolve(clientDir, storedName);
  writeFileSync(target, file.buffer);

  const displayName = String(multipart.fields.name || file.filename).trim().slice(0, 180) || file.filename;
  const id = await createClientFile({
    tenantId: user.tenantId,
    clientId,
    appointmentId,
    clinicalVisitId,
    name: displayName,
    originalName: file.filename,
    storedName,
    mimeType: file.type,
    size: file.buffer.length,
    path: target,
    notes: String(multipart.fields.notes || "").slice(0, 1000),
    category,
    uploadedBy: user.id,
  });
  const url = `/api/client-files/${id}/download`;
  await updateClientFileUrl(id, url);
  await addFileTimelineEvent({ tenantId: user.tenantId, clientId, userId: user.id, appointmentId, fileId: id });
  await auditFile(user.id, "upload", id, user.tenantId, { clientId, appointmentId, clinicalVisitId, category });
  return { status: 201, body: { id, url, storedName } };
}

export async function getClientFileDownload(user, id) {
  const file = await clientFileById(id, user.tenantId);
  if (!file) return { status: 404, body: { error: "File not found." } };
  if (!await canSeeClient(user, file.clientId)) return { status: 403, body: { error: "You do not have access to this file." } };
  if (!file.path) return { status: 404, body: { error: "Stored file is unavailable." } };

  const tenantClientRoot = `${resolve(
    config.uploads.dir,
    "tenants",
    String(user.tenantId),
    "clients",
    String(file.clientId),
  )}${sep}`;
  const legacyClientRoot = `${resolve(config.uploads.dir, "clients", String(file.clientId))}${sep}`;
  const resolvedPath = resolve(file.path);
  if (!resolvedPath.startsWith(tenantClientRoot) && !resolvedPath.startsWith(legacyClientRoot)) {
    await auditFile(user.id, "download_blocked", id, user.tenantId, { reason: "invalid_storage_path" });
    return { status: 403, body: { error: "Stored file path is invalid." } };
  }
  if (!existsSync(resolvedPath)) return { status: 404, body: { error: "File is missing from storage." } };
  const buffer = readFileSync(resolvedPath);
  await auditFile(user.id, "download", id, user.tenantId, { clientId: file.clientId });
  return { status: 200, file, buffer };
}

export async function removeClientFile(user, id) {
  const file = await clientFileById(id, user.tenantId);
  if (!file || !await canSeeClient(user, file.clientId)) return { status: 404, body: { error: "File not found." } };
  const changes = await archiveClientFile(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "File not found." } };
  await auditFile(user.id, "archive", id, user.tenantId, { clientId: file.clientId });
  return { status: 200, body: { ok: true } };
}
