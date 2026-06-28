import { config } from "../../config.js";
import { audit } from "../../db.js";
import { createBackup } from "../../backup.js";
import { basename, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { copyFile, ensureDirectory, readBackupFile, removeFile, writeBufferFile, writeJsonFile } from "./system.repository.js";

export function createSystemExport() {
  const exportBackup = createBackup({ reason: "download-export" });
  const backup = readBackupFile(exportBackup.target);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return {
    backup,
    headers: {
      "Content-Type": config.databaseUrl ? "application/octet-stream" : "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="clinova-${stamp}.${config.databaseUrl ? "dump" : "sqlite"}"`,
      "Content-Length": backup.length,
      "X-Content-Type-Options": "nosniff",
    },
  };
}

export async function auditSystemExport(user) {
  await audit(user.id, "export", "system", null, { tenantId: user.tenantId });
}

function safeFileName(name) {
  const parsed = basename(String(name || "file")).replace(/[^\p{L}\p{N}._ -]/gu, "_").trim();
  return parsed || "file";
}

function assertValidSqliteBackup(path) {
  const sqlite = new DatabaseSync(path, { readOnly: true });
  try {
    const row = sqlite.prepare("PRAGMA integrity_check").get();
    if (row.integrity_check !== "ok") {
      const error = new Error("SQLite backup integrity check failed.");
      error.status = 400;
      throw error;
    }
  } finally {
    sqlite.close();
  }
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

async function readMultipart(req) {
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

export async function scheduleSystemRestore(req, user) {
  if (config.databaseUrl) {
    return {
      ok: false,
      status: 400,
      body: { error: "Restore upload is available for SQLite. Use pg_restore for PostgreSQL backups." },
    };
  }

  const { files } = await readMultipart(req);
  const file = files.backup;
  if (!file || file.buffer.length === 0) {
    return {
      ok: false,
      status: 400,
      body: { error: "Choose a backup file to restore." },
    };
  }

  const restoreDir = resolve(config.backup.dir, "restore-uploads");
  ensureDirectory(restoreDir);
  const source = resolve(restoreDir, `${Date.now()}-${safeFileName(file.filename)}`);
  writeBufferFile(source, file.buffer);
  try {
    assertValidSqliteBackup(source);
  } catch {
    removeFile(source);
    return {
      ok: false,
      status: 400,
      body: { error: "SQLite backup integrity check failed." },
    };
  }

  const safety = createBackup({ reason: "before-restore" });
  const pending = resolve(config.backup.dir, "pending-restore.sqlite");
  copyFile(source, pending);
  writeJsonFile(resolve(config.backup.dir, "pending-restore.json"), {
    uploadedName: file.filename,
    source,
    requestedBy: user.id,
    safetyBackup: safety.target,
    createdAt: new Date().toISOString(),
  });
  await audit(user.id, "restore_scheduled", "system", null, { tenantId: user.tenantId, source: file.filename, safetyBackup: safety.target });

  return {
    ok: true,
    body: { ok: true, safetyBackup: basename(safety.target), restarting: true },
  };
}

export function scheduleProcessExitAfterRestore() {
  setTimeout(() => process.exit(0), 500);
}
