import { basename } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createBackup } from "../backup.js";
import { config } from "../config.js";
import { currentSchemaVersion } from "../schema-version.js";
import { assertProductionEnvironment } from "../production-config.js";

function safeRestoreTarget() {
  const raw = String(process.env.POSTGRES_RESTORE_TEST_URL || "");
  if (!raw) throw new Error("POSTGRES_RESTORE_TEST_URL is required.");
  const source = new URL(config.databaseUrl);
  const target = new URL(raw);
  const databaseName = target.pathname.slice(1);
  if (!/(restore|test)/i.test(databaseName)) throw new Error("Restore target database name must contain restore or test.");
  if (source.toString() === target.toString()) throw new Error("Restore target must be different from DATABASE_URL.");
  const local = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);
  if (!local && process.env.ALLOW_REMOTE_RESTORE_TEST !== "true") {
    throw new Error("Remote restore tests require ALLOW_REMOTE_RESTORE_TEST=true.");
  }
  return target.toString();
}

function runRestore(targetUrl, backupPath) {
  const pgRestore = process.env.PG_RESTORE_BIN || "pg_restore";
  const result = spawnSync(pgRestore, [
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--dbname",
    targetUrl,
    backupPath,
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && /\.cmd$/i.test(pgRestore),
  });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || "pg_restore failed").trim().slice(0, 500));
}

async function snapshot(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM tenants) AS tenants,
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM clients) AS clients,
      (SELECT COUNT(*)::int FROM appointments) AS appointments,
      (SELECT COUNT(*)::int FROM patient_ledger_entries) AS ledger
  `);
  return result.rows[0];
}

async function main() {
  let source;
  let target;
  try {
    assertProductionEnvironment();
    const targetUrl = safeRestoreTarget();
    source = new pg.Client({ connectionString: config.databaseUrl });
    target = new pg.Client({ connectionString: targetUrl });
    await source.connect();
    await target.connect();
    const expected = await snapshot(source);
    const backup = createBackup({ reason: "restore-verification" });
    await target.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await target.end();
    target = null;
    runRestore(targetUrl, backup.target);
    target = new pg.Client({ connectionString: targetUrl });
    await target.connect();
    const [actual, version, constraints, indexes] = await Promise.all([
      snapshot(target),
      target.query("SELECT version FROM schema_migrations WHERE version = $1", [currentSchemaVersion]),
      target.query("SELECT COUNT(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema = 'public'"),
      target.query("SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname = 'public'"),
    ]);
    const ok = JSON.stringify(actual) === JSON.stringify(expected)
      && version.rowCount === 1
      && constraints.rows[0].count > 0
      && indexes.rows[0].count > 0;
    process.stdout.write(`${JSON.stringify({
      ok,
      backup: basename(backup.target),
      schemaVersion: currentSchemaVersion,
      counts: actual,
      constraints: constraints.rows[0].count,
      indexes: indexes.rows[0].count,
    })}\n`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: String(error?.message || "Restore verification failed.").slice(0, 500) })}\n`);
    process.exitCode = 1;
  } finally {
    await source?.end().catch(() => {});
    await target?.end().catch(() => {});
  }
}

await main();
