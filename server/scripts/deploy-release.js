import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { assertProductionEnvironment } from "../production-config.js";

function run(label, args) {
  process.stdout.write(`[release] ${label}\n`);
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed; deployment stopped.`);
}

function pm2(label, args) {
  process.stdout.write(`[release] ${label}\n`);
  const cli = resolve("node_modules", "pm2", "bin", "pm2");
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed.`);
}

try {
  assertProductionEnvironment();
  run("pre-deployment upload backup", ["server/scripts/backup-uploads.js"]);
  run("pre-deployment PostgreSQL backup", ["server/backup.js", "pre-deployment"]);
  run("database migration", ["server/scripts/migrate.js"]);
  run("schema verification", ["server/scripts/verify-schema.js"]);
  pm2("graceful web/worker/backup reload", ["startOrReload", "ecosystem.config.cjs", "--update-env"]);
  pm2("persist process list", ["save"]);
  run("post-deployment readiness gate", ["server/scripts/check-production-readiness.js"]);
  process.stdout.write("[release] deployment gate passed\n");
} catch (error) {
  process.stderr.write(`[release] ${String(error?.message || "Deployment failed.")}\n`);
  process.exitCode = 1;
}
