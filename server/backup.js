import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "./config.js";
import { assertProductionEnvironment } from "./production-config.js";

const APP_PREFIX = "clinova";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function ensureBackupDir() {
  mkdirSync(config.backup.dir, { recursive: true });
  return config.backup.dir;
}

function backupSqlite() {
  if (!existsSync(config.databasePath)) {
    throw new Error(`SQLite database file not found: ${config.databasePath}`);
  }

  const backupDir = ensureBackupDir();
  const target = resolve(backupDir, `${APP_PREFIX}-sqlite-${timestamp()}${extname(config.databasePath) || ".sqlite"}`);
  const sqlite = new DatabaseSync(config.databasePath, { readOnly: true });

  try {
    sqlite.exec(`VACUUM INTO ${sqlString(target)}`);
  } finally {
    sqlite.close();
  }

  return target;
}

function backupPostgres() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL backups.");
  }

  const backupDir = ensureBackupDir();
  const target = resolve(backupDir, `${APP_PREFIX}-postgres-${timestamp()}.dump`);
  const pgDump = process.env.PG_DUMP_BIN || "pg_dump";
  const result = spawnSync(pgDump, ["--format=custom", "--no-owner", "--file", target, postgresDumpUrl()], {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32" && /\.cmd$/i.test(pgDump),
  });

  if (result.status !== 0) {
    const details = result.stderr || result.stdout || "pg_dump failed";
    throw new Error(details.trim());
  }

  return target;
}

function postgresDumpUrl() {
  if (!config.databaseSsl) return config.databaseUrl;
  const url = new URL(config.databaseUrl);
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", config.databaseSslRejectUnauthorized ? "verify-full" : "require");
  }
  return url.toString();
}

function cleanupBackups() {
  const backupDir = ensureBackupDir();
  const files = readdirSync(backupDir)
    .filter((name) => name.startsWith(`${APP_PREFIX}-`) && (name.endsWith(".sqlite") || name.endsWith(".dump")))
    .map((name) => {
      const path = join(backupDir, name);
      return { path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const file of files.slice(config.backup.retention)) {
    rmSync(file.path, { force: true });
  }
}

export function createBackup({ reason = "manual" } = {}) {
  assertProductionEnvironment();
  const startedAt = new Date();
  const target = config.databaseUrl ? backupPostgres() : backupSqlite();
  cleanupBackups();
  const finishedAt = new Date();

  const result = {
    ok: true,
    reason,
    target,
    database: config.databaseUrl ? "postgresql" : "sqlite",
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };

  console.log(JSON.stringify({ ...result, target: basename(result.target) }));
  return result;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (pathToFileURL(entryFile).href === pathToFileURL(currentFile).href) {
  try {
    createBackup({ reason: process.argv[2] || "manual" });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
