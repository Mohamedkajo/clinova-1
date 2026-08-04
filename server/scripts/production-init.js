import { assertProductionEnvironment } from "../production-config.js";
import {
  clearProductionInitEnvironment,
  ProductionInitError,
  readProductionInitInput,
  safeProductionInitCode,
} from "../production-init-input.js";

let closeDatabase;

try {
  if (process.env.NODE_ENV !== "production") throw new ProductionInitError("PRODUCTION_ENVIRONMENT_REQUIRED");
  const databaseUrl = String(process.env.DATABASE_URL || "");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new ProductionInitError("PRODUCTION_POSTGRESQL_REQUIRED");
  assertProductionEnvironment();
  const input = readProductionInitInput();
  const database = await import("../db.js");
  closeDatabase = database.closeDatabase;
  if (database.databaseEngine !== "postgresql") throw new ProductionInitError("PRODUCTION_POSTGRESQL_REQUIRED");
  const migrations = await database.schemaVersionStatus();
  if (!migrations.upToDate) throw new ProductionInitError("PRODUCTION_MIGRATIONS_NOT_CURRENT");
  const { initializeProductionInstallation } = await import("../modules/platform/production-bootstrap.service.js");
  const summary = await initializeProductionInstallation(input);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
} catch (error) {
  process.stderr.write(`${safeProductionInitCode(error)}\n`);
  process.exitCode = 1;
} finally {
  clearProductionInitEnvironment();
  if (closeDatabase) {
    try {
      await closeDatabase();
    } catch {
      process.exitCode = 1;
    }
  }
}
