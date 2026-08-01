import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let testServer;

function runNode(args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const output = [];
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        CLINOVA_SKIP_ENV_FILE: "true",
        DATABASE_URL: "",
        DATABASE_PATH: testServer.databasePath,
        BACKUP_DIR: testServer.backupsDir,
        BACKUP_ENABLED: "false",
        SESSION_SECRET: "clinova-api-test-secret-only",
        WORKER_POLL_INTERVAL_MS: "250",
        WORKER_STALE_AFTER_MS: "5000",
        WORKER_RETRY_BASE_MS: "250",
        ...envOverrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => output.push(chunk.toString()));
    child.stderr.on("data", (chunk) => output.push(chunk.toString()));
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve(output.join(""))
      : reject(new Error(`Child failed (${code}):\n${output.join("")}`)));
  });
}

function withSqlite(callback) {
  const sqlite = new DatabaseSync(testServer.databasePath);
  try {
    sqlite.exec("PRAGMA foreign_keys = ON");
    return callback(sqlite);
  } finally {
    sqlite.close();
  }
}

before(async () => {
  testServer = await startTestServer();
});

after(async () => {
  await testServer?.stop();
});

test("schema version, public health, and admin-only readiness are safe", async () => {
  const { client: admin } = await loginAs(testServer.baseUrl, "admin");
  const { client: reception } = await loginAs(testServer.baseUrl, "reception");
  const publicHealth = await admin.get("/api/health");
  assert.equal(publicHealth.status, 200);
  assert.equal(publicHealth.body.checks.database, true);
  assert.equal(publicHealth.body.checks.migrations, true);
  assert.equal(publicHealth.body.checks.worker, "not_started");
  assert.equal("current" in publicHealth.body.checks, false);

  const readiness = await admin.get("/api/operations/readiness");
  assert.equal(readiness.status, 503);
  assert.equal(readiness.body.ok, false);
  assert.equal(readiness.body.migrations.current, "2026.08.01.1");
  assert.equal((await reception.get("/api/operations/readiness")).status, 403);

  withSqlite((sqlite) => {
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?").get("2026.08.01.1").count, 1);
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    assert.ok(tables.includes("background_jobs"));
    assert.ok(tables.includes("worker_heartbeats"));
    const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
    assert.ok(indexes.includes("idx_jobs_dedupe"));
  });
});

test("worker is idempotent, dispatches locally, expires consents, and recovers stale jobs", async () => {
  withSqlite((sqlite) => {
    sqlite.exec("DELETE FROM background_jobs; DELETE FROM worker_heartbeats; DELETE FROM appointment_reminders;");
    const admin = sqlite.prepare("SELECT id FROM users WHERE username = 'admin' AND tenant_id = 1").get();
    const therapist = sqlite.prepare("SELECT id FROM users WHERE role = 'therapist' AND tenant_id = 1 ORDER BY id LIMIT 1").get();
    const service = sqlite.prepare("SELECT id FROM services WHERE tenant_id = 1 ORDER BY id LIMIT 1").get();
    const clientId = Number(sqlite.prepare(`
      INSERT INTO clients (tenant_id, fname, lname, phone, email, therapist_id, active)
      VALUES (1, 'Worker', 'Patient', '0501234567', 'worker-patient@example.test', ?, 1)
    `).run(therapist.id).lastInsertRowid);
    sqlite.prepare(`
      INSERT INTO appointments (tenant_id, client_id, service_id, therapist_id, date, time, status, active)
      VALUES (1, ?, ?, ?, '2026-08-02', '10:00', 'pending', 1)
    `).run(clientId, service.id, therapist.id);
    sqlite.prepare("UPDATE clinic_settings SET value = 'true' WHERE tenant_id = 1 AND key = 'appointmentRemindersEnabled'").run();
    sqlite.prepare("UPDATE clinic_settings SET value = '24' WHERE tenant_id = 1 AND key = 'reminderTimingHours'").run();
    const templateId = Number(sqlite.prepare(`
      INSERT INTO consent_templates (tenant_id, title, consent_text, language, url, created_by, active)
      VALUES (1, 'Worker expiry test', 'Safe consent', 'en', '/test.pdf', ?, 1)
    `).run(admin.id).lastInsertRowid);
    sqlite.prepare(`
      INSERT INTO patient_consents (
        tenant_id, template_id, client_id, status, assigned_by, signed_at, expires_at
      ) VALUES (1, ?, ?, 'signed', ?, '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')
    `).run(templateId, clientId, admin.id);
  });

  await runNode(["server/worker.js"], {
    WORKER_ONCE: "true",
    CLINOVA_TEST_NOW: "2026-08-01T11:00:00.000Z",
  });

  const initialCounts = withSqlite((sqlite) => {
    assert.equal(sqlite.prepare("SELECT status FROM patient_consents WHERE template_id = ?").get(
      sqlite.prepare("SELECT id FROM consent_templates WHERE title = 'Worker expiry test'").get().id,
    ).status, "expired");
    assert.ok(sqlite.prepare("SELECT COUNT(*) AS count FROM appointment_reminders WHERE status = 'sent'").get().count >= 1);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM background_jobs WHERE status != 'completed'").get().count, 0);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM background_jobs WHERE payload != '{}'").get().count, 0);
    assert.ok(sqlite.prepare("SELECT COUNT(*) AS count FROM worker_heartbeats").get().count >= 1);
    return sqlite.prepare("SELECT COUNT(*) AS count FROM background_jobs").get().count;
  });

  await runNode(["server/worker.js"], {
    WORKER_ONCE: "true",
    CLINOVA_TEST_NOW: "2026-08-01T11:00:00.000Z",
  });
  assert.equal(withSqlite((sqlite) => sqlite.prepare("SELECT COUNT(*) AS count FROM background_jobs").get().count), initialCounts);

  withSqlite((sqlite) => {
    sqlite.prepare(`
      INSERT INTO background_jobs (
        tenant_id, type, dedupe_key, status, attempts, max_attempts, run_at, locked_at, locked_by
      ) VALUES (1, 'expire_consents', 'stale-recovery-test', 'processing', 0, 3, ?, ?, 'dead-worker')
    `).run("2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z");
  });
  await runNode(["server/worker.js"], { WORKER_ONCE: "true" });
  const recovered = withSqlite((sqlite) => sqlite.prepare("SELECT status, attempts, locked_by AS lockedBy FROM background_jobs WHERE dedupe_key = 'stale-recovery-test'").get());
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.attempts, 1);
  assert.equal(recovered.lockedBy, null);

  withSqlite((sqlite) => sqlite.prepare("UPDATE users SET is_platform_owner = 0 WHERE tenant_id = 1 AND username = 'admin'").run());
  const { client: admin } = await loginAs(testServer.baseUrl, "admin");
  const readiness = await admin.get("/api/operations/readiness");
  assert.equal(readiness.status, 200);
  assert.equal(readiness.body.worker.status, "running");
  assert.equal(readiness.body.queue.failed, 0);
});

test("failed jobs retry with a cap and expose no sensitive payload", async () => {
  withSqlite((sqlite) => {
    sqlite.prepare(`
      INSERT INTO background_jobs (tenant_id, type, dedupe_key, max_attempts, run_at)
      VALUES (1, 'prepare_reminders', 'retry-limit-test', 2, '2020-01-01T00:00:00.000Z')
    `).run();
  });
  const script = `
    const { closeDatabase } = await import('./server/db.js');
    const { runWorkerCycle } = await import('./server/services/worker.service.js');
    const fail = async () => { throw new Error('postgres://secret:password@private-host/clinical'); };
    await runWorkerCycle({ workerId: 'retry-test-worker', now: new Date(process.env.RUN_NOW), maxJobs: 4,
      handlers: { prepare_reminders: fail, dispatch_reminders: fail, expire_consents: fail } });
    await closeDatabase();
  `;
  await runNode(["--input-type=module", "-e", script], { RUN_NOW: "2030-01-01T00:00:00.000Z" });
  await runNode(["--input-type=module", "-e", script], { RUN_NOW: "2030-01-01T00:00:01.000Z" });
  const failed = withSqlite((sqlite) => sqlite.prepare(`
    SELECT status, attempts, last_error AS lastError, payload
    FROM background_jobs WHERE dedupe_key = 'retry-limit-test'
  `).get());
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempts, 2);
  assert.equal(failed.payload, "{}");
  assert.equal(failed.lastError.includes("password"), false);
  assert.equal(failed.lastError.includes("private-host"), false);
});
