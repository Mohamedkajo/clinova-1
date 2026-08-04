import { closeDatabase, databaseEngine, schemaVersionStatus } from "../../db.js";
import { initializeProductionInstallation } from "../../modules/platform/production-bootstrap.service.js";
import {
  clearProductionInitEnvironment,
  ProductionInitError,
  readProductionInitInput,
  safeProductionInitCode,
} from "../../production-init-input.js";

try {
  if (process.env.NODE_ENV !== "production" || databaseEngine !== "postgresql") {
    throw new ProductionInitError("PRODUCTION_POSTGRESQL_REQUIRED");
  }
  const migrations = await schemaVersionStatus();
  if (!migrations.upToDate) throw new ProductionInitError("PRODUCTION_MIGRATIONS_NOT_CURRENT");
  const input = readProductionInitInput();
  await initializeProductionInstallation(input, {
    afterTenantProvisioned: async () => {
      throw new Error("simulated failure");
    },
  });
  process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${safeProductionInitCode(error)}\n`);
  process.exitCode = 1;
} finally {
  clearProductionInitEnvironment();
  await closeDatabase();
}
