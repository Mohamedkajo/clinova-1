import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkDatabaseConnection, databaseEngine, schemaVersionStatus } from "../../db.js";
import { operationalReadiness, workerStatus } from "../../services/worker.service.js";

const packageInfo = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

export async function health() {
  try {
    const [database, migration, worker] = await Promise.all([
      checkDatabaseConnection(),
      schemaVersionStatus(),
      workerStatus(),
    ]);
    const checks = {
      database,
      databaseEngine,
      migrations: migration.upToDate,
      worker: worker.status,
      time: new Date().toISOString(),
    };
    const ok = database && migration.upToDate;
    return { status: ok ? 200 : 503, body: { ok, version: packageInfo.version, checks } };
  } catch {
    return {
      status: 503,
      body: {
        ok: false,
        version: packageInfo.version,
        checks: { database: false, databaseEngine, migrations: false, worker: "unknown", time: new Date().toISOString() },
      },
    };
  }
}

export async function readiness(user) {
  const [migration, operations] = await Promise.all([
    schemaVersionStatus(),
    operationalReadiness(user.tenantId),
  ]);
  const ready = migration.upToDate && operations.worker.status === "running";
  return {
    status: ready ? 200 : 503,
    body: {
      ok: ready,
      database: { engine: databaseEngine, ready: true },
      migrations: migration,
      worker: operations.worker,
      queue: operations.queue,
    },
  };
}

export async function version() {
  return {
    status: 200,
    body: {
      name: "Clinova",
      version: packageInfo.version,
      node: process.version,
      environment: process.env.NODE_ENV || "development",
    },
  };
}
