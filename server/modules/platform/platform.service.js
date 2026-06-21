import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../../config.js";
import { checkDatabaseConnection, databaseEngine } from "../../db.js";
import { analyzeDiskUsagePaths } from "../../shared/monitoring/disk-usage.js";
import {
  auditPlatformTenantUpdate,
  createSubscription,
  findTenant,
  latestSubscription,
  planCatalog,
  platformTenants,
  updateSubscription,
  updateTenantPlanStatus,
} from "./platform.repository.js";

const packageInfo = JSON.parse(readFileSync(resolve("package.json"), "utf8"));

function directoryStatus(path) {
  const exists = existsSync(path);
  if (!exists) return { exists: false, writable: false };
  try {
    accessSync(path, constants.W_OK);
    return { exists: true, writable: true };
  } catch {
    return { exists: true, writable: false };
  }
}

export async function getPlatformHealth() {
  let databaseOk = false;
  try {
    databaseOk = await checkDatabaseConnection();
  } catch {
    databaseOk = false;
  }

  const uploads = directoryStatus(config.uploads.dir);
  const backups = directoryStatus(config.backup.dir);
  const disk = await analyzeDiskUsagePaths([
    { label: "uploads", path: config.uploads.dir },
    { label: "backups", path: config.backup.dir },
  ]);
  const memory = process.memoryUsage();

  return {
    status: 200,
    body: {
      ok: databaseOk && uploads.exists && uploads.writable && backups.exists && backups.writable,
      api: {
        ok: true,
      },
      app: {
        name: "Clinova",
        version: packageInfo.version,
        environment: process.env.NODE_ENV || "development",
      },
      runtime: {
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        serverTime: new Date().toISOString(),
      },
      database: {
        engine: databaseEngine,
        connectionOk: databaseOk,
      },
      storage: {
        uploads,
        backups,
      },
      disk: {
        status: disk.status,
        paths: disk.paths.map(({ label, exists, status, sizeBytes, sizeMb }) => ({
          label,
          exists,
          status,
          sizeBytes,
          sizeMb,
        })),
      },
      memory: {
        rssBytes: memory.rss,
        heapTotalBytes: memory.heapTotal,
        heapUsedBytes: memory.heapUsed,
        externalBytes: memory.external,
      },
    },
  };
}

function validOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return true;
  const validType = typeof value === "number" || typeof value === "string";
  return validType && !(typeof value === "string" && value.trim() === "") && Number.isFinite(Number(value));
}

export async function getPlatformTenants() {
  return { status: 200, body: { tenants: await platformTenants() } };
}

export async function updatePlatformTenant(user, tenantId, body) {
  const plan = planCatalog[body.plan] ? body.plan : "";
  const status = ["trial", "active", "past_due", "suspended", "cancelled"].includes(body.status) ? body.status : "";
  if (!validOptionalNumber(body.billingDay)) return { status: 400, body: { error: "Valid billing day is required." } };
  const billingDay = Math.min(Math.max(Number(body.billingDay || 1), 1), 31);
  const autoBillingEnabled = body.autoBillingEnabled === true || body.autoBillingEnabled === "true" || body.autoBillingEnabled === "on";
  if (!tenantId || !plan || !status) return { status: 400, body: { error: "Valid tenant, plan, and status are required." } };

  const tenant = await findTenant(tenantId);
  if (!tenant) return { status: 404, body: { error: "Tenant not found" } };

  const existing = await latestSubscription(tenantId);
  if (existing) {
    await updateSubscription(existing.id, tenantId, { plan, status, billingDay, autoBillingEnabled });
  } else {
    await createSubscription(tenantId, { plan, status, billingDay, autoBillingEnabled });
  }

  await updateTenantPlanStatus(tenantId, plan, status);
  await auditPlatformTenantUpdate(user, tenantId, plan, status);
  return { status: 200, body: { tenants: await platformTenants() } };
}
