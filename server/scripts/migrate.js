import { existsSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { basename, dirname, resolve } from "node:path";
import { config } from "../config.js";

let recoveryBackup = null;

try {
  if (!config.databaseUrl && existsSync(config.databasePath)) {
    mkdirSync(config.backup.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    recoveryBackup = resolve(config.backup.dir, `pre-migration-${stamp}.sqlite`);
    const sqlite = new DatabaseSync(config.databasePath, { readOnly: true });
    try {
      sqlite.exec(`VACUUM INTO '${recoveryBackup.replace(/'/g, "''")}'`);
    } finally {
      sqlite.close();
    }
  } else if (!config.databaseUrl) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
  }

  const { closeDatabase, databaseEngine, initDatabase, schemaVersionStatus } = await import("../db.js");
  await initDatabase();
  const migrations = await schemaVersionStatus();
  if (!migrations.upToDate) throw new Error("Schema version verification failed.");
  console.log(JSON.stringify({
    ok: true,
    databaseEngine,
    schemaVersion: migrations.current,
    recoveryBackup: recoveryBackup ? basename(recoveryBackup) : null,
  }));
  await closeDatabase();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || "Migration failed.").slice(0, 240),
    recoveryBackup: recoveryBackup ? basename(recoveryBackup) : null,
  }));
  process.exitCode = 1;
}
