import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../../config.js";
import { audit } from "../../db.js";

const BACKUP_EXTENSIONS = new Set([".sqlite", ".db", ".backup", ".dump"]);
const RECENT_BACKUP_LIMIT = 20;

function backupTimestamp(date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}`;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isBackupFile(name) {
  return name.startsWith("clinova-") && BACKUP_EXTENSIONS.has(extname(name).toLowerCase());
}

function backupMetadata(name) {
  const path = join(config.backup.dir, name);
  const stats = statSync(path);
  return {
    id: name,
    filename: name,
    createdAt: stats.mtime.toISOString(),
    size: stats.size,
  };
}

export function listPlatformBackups() {
  if (!existsSync(config.backup.dir)) {
    return { count: 0, latest: null, backups: [] };
  }

  const backups = readdirSync(config.backup.dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isBackupFile(entry.name))
    .map((entry) => backupMetadata(entry.name))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    count: backups.length,
    latest: backups[0] || null,
    backups: backups.slice(0, RECENT_BACKUP_LIMIT),
  };
}

function nextManualBackupPath(now = new Date()) {
  for (let offsetSeconds = 0; offsetSeconds < 60; offsetSeconds += 1) {
    const timestamp = backupTimestamp(new Date(now.getTime() + offsetSeconds * 1000));
    const path = resolve(config.backup.dir, `clinova-manual-${timestamp}.sqlite`);
    if (!existsSync(path)) return path;
  }
  throw new Error("Unable to allocate a unique manual backup filename.");
}

export async function createPlatformBackup(user) {
  if (config.databaseUrl) {
    return {
      status: 501,
      body: { error: "Manual platform backups are not supported for PostgreSQL yet." },
    };
  }
  if (!existsSync(config.databasePath)) {
    return {
      status: 503,
      body: { error: "SQLite database file is unavailable." },
    };
  }

  mkdirSync(config.backup.dir, { recursive: true });
  const target = nextManualBackupPath();
  const sqlite = new DatabaseSync(config.databasePath, { readOnly: true });
  try {
    sqlite.exec(`VACUUM INTO ${sqlString(target)}`);
  } finally {
    sqlite.close();
  }

  const createdBackup = backupMetadata(basename(target));
  await audit(user.id, "backup_created", "system", null, {
    tenantId: user.tenantId,
    filename: createdBackup.filename,
  });

  return {
    status: 201,
    body: {
      ok: true,
      backup: createdBackup,
    },
  };
}
