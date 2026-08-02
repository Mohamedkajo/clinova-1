import { accessSync, constants, statfsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import { assertProductionEnvironment } from "../production-config.js";

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function directoryCheck(path) {
  accessSync(path, constants.R_OK | constants.W_OK);
  const stats = statfsSync(path);
  return { writable: true, availableBytes: Number(stats.bavail) * Number(stats.bsize) };
}

async function waitForHealth() {
  const url = process.env.HEALTHCHECK_URL || `http://127.0.0.1:${config.port}/api/health`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      lastStatus = response.status;
      if (response.ok && (await response.json()).ok === true) return true;
    } catch {
      lastStatus = 0;
    }
    await wait(1000);
  }
  throw new Error(`Web health check failed${lastStatus ? ` with status ${lastStatus}` : ""}.`);
}

async function main() {
  let closeDatabase;
  try {
    assertProductionEnvironment();
    await waitForHealth();
    const database = await import("../db.js");
    const worker = await import("../services/worker.service.js");
    closeDatabase = database.closeDatabase;
    await database.initDatabase();
    const [connected, migrations, workerState, jobs] = await Promise.all([
      database.checkDatabaseConnection(),
      database.schemaVersionStatus(),
      worker.workerStatus(),
      database.db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) AS queued,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
        FROM background_jobs
      `).get(),
    ]);
    const checks = {
      web: true,
      database: connected && database.databaseEngine === "postgresql",
      migrations: migrations.upToDate,
      worker: workerState.status === "running",
      jobs: {
        queued: Number(jobs?.queued || 0),
        processing: Number(jobs?.processing || 0),
        failed: Number(jobs?.failed || 0),
      },
      disk: {
        uploads: directoryCheck(config.uploads.dir),
        backups: directoryCheck(config.backup.dir),
        logs: directoryCheck(config.logDir),
      },
    };
    const ok = checks.web && checks.database && checks.migrations && checks.worker && checks.jobs.failed === 0;
    process.stdout.write(`${JSON.stringify({ ok, version: process.env.npm_package_version || "1.8.0-rc.1", checks })}\n`);
    if (!ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: String(error?.message || "Readiness failed.").slice(0, 300) })}\n`);
    process.exitCode = 1;
  } finally {
    if (closeDatabase) await closeDatabase().catch(() => {});
  }
}

await main();
