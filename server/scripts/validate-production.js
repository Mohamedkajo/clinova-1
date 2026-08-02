import { assertProductionEnvironment } from "../production-config.js";

try {
  assertProductionEnvironment();
  process.stdout.write(`${JSON.stringify({ ok: true, environment: "production", database: "postgresql" })}\n`);
} catch (error) {
  process.stderr.write(`${String(error?.message || "Production configuration invalid.")}\n`);
  process.exitCode = 1;
}
