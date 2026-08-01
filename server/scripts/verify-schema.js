import { checkDatabaseConnection, closeDatabase, databaseEngine, schemaVersionStatus } from "../db.js";

try {
  const connected = await checkDatabaseConnection();
  const migrations = await schemaVersionStatus();
  const ok = connected && migrations.upToDate;
  console.log(JSON.stringify({ ok, databaseEngine, migrations }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, databaseEngine, error: String(error?.message || "Schema verification failed.").slice(0, 240) }));
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
