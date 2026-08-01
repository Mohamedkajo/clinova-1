import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import pg from "pg";
import { createHttpClient, loginAs } from "./helpers/http-client.js";

const databaseUrl = String(process.env.POSTGRES_TEST_URL || "");
let pool;
let serverChild;
let serverOutput = [];
let baseUrl;

function safeTestDatabaseUrl() {
  if (!databaseUrl) throw new Error("POSTGRES_TEST_URL is required for PostgreSQL validation.");
  const parsed = new URL(databaseUrl);
  if (!/(?:^|_)test(?:$|_)/i.test(parsed.pathname.slice(1))) {
    throw new Error("POSTGRES_TEST_URL must target a database whose name contains 'test'.");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error("PostgreSQL destructive test reset is restricted to a local test database.");
  }
  return parsed.toString();
}

function childEnv(overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: "test",
    CLINOVA_SKIP_ENV_FILE: "true",
    DATABASE_URL: safeTestDatabaseUrl(),
    DATABASE_SSL: "false",
    SESSION_SECRET: "clinova-postgres-production-readiness-test",
    BACKUP_ENABLED: "false",
    WHATSAPP_ENABLED: "false",
    WHATSAPP_DRY_RUN: "true",
    COOKIE_SECURE: "false",
    ...overrides,
  };
}

function runNode(args, overrides = {}) {
  return new Promise((resolve, reject) => {
    const output = [];
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: childEnv(overrides),
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

function freePort() {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  serverChild = spawn(process.execPath, ["server/app.js"], {
    cwd: process.cwd(),
    env: childEnv({ PORT: String(port), HOST: "127.0.0.1", CLINOVA_TEST_NOW: "2035-09-10 09:00" }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverChild.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  serverChild.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));
  baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serverChild.exitCode !== null) throw new Error(`PostgreSQL server exited:\n${serverOutput.join("")}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).status === 200) return;
    } catch {
      // Server is still binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`PostgreSQL server health timeout:\n${serverOutput.join("")}`);
}

async function stopServer() {
  if (!serverChild || serverChild.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (serverChild.exitCode === null) serverChild.kill("SIGKILL");
    }, 8_000);
    serverChild.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    serverChild.kill("SIGTERM");
  });
}

before(async () => {
  const connectionString = safeTestDatabaseUrl();
  const reset = new pg.Client({ connectionString });
  await reset.connect();
  await reset.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await reset.end();

  await runNode(["server/scripts/migrate.js"]);
  pool = new pg.Pool({ connectionString });
  await pool.query("INSERT INTO clinic_settings (tenant_id, key, value) VALUES (1, 'upgrade_marker', 'preserved')");
  await runNode(["server/scripts/migrate.js"]);
  await startServer();
});

after(async () => {
  await stopServer();
  await pool?.end();
});

test("fresh and upgrade migrations preserve data and install constraints and indexes", async () => {
  const version = await pool.query("SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1");
  assert.equal(version.rows[0].version, "2026.08.01.1");
  assert.equal((await pool.query("SELECT value FROM clinic_settings WHERE tenant_id = 1 AND key = 'upgrade_marker'")).rows[0].value, "preserved");

  const tables = (await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  `)).rows.map((row) => row.table_name);
  for (const table of [
    "appointments", "clinical_visits", "client_files", "patient_consents", "notifications",
    "appointment_reminders", "patient_invoices", "patient_ledger_entries", "background_jobs", "worker_heartbeats",
  ]) assert.ok(tables.includes(table), table);

  const indexes = (await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((row) => row.indexname);
  for (const index of [
    "idx_reports_appointments", "idx_reports_ledger", "idx_reminders_tenant_status_schedule",
    "idx_notifications_user_status", "idx_patient_ledger_patient", "idx_jobs_claim", "idx_jobs_dedupe",
  ]) assert.ok(indexes.includes(index), index);

  const foreignKeys = Number((await pool.query(`
    SELECT COUNT(*) AS count FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY'
  `)).rows[0].count);
  assert.ok(foreignKeys >= 35);
  await assert.rejects(pool.query(`
    INSERT INTO appointments (tenant_id, client_id, service_id, therapist_id, date, time, status)
    VALUES (1, 999999, 999999, 999999, '2035-01-01', '09:00', 'pending')
  `));
});

test("PostgreSQL API validates tenant isolation, clinical records, reminders, finance, and reports", async () => {
  const anonymous = createHttpClient(baseUrl);
  assert.equal((await anonymous.get("/api/operations/readiness")).status, 401);
  const { client: admin, response: login } = await loginAs(baseUrl, "admin");
  assert.equal(login.status, 200);
  const { client: reception } = await loginAs(baseUrl, "reception");
  const { client: therapist } = await loginAs(baseUrl, "sara");
  assert.equal((await reception.get("/api/operations/readiness")).status, 403);

  const bootstrap = await admin.get("/api/bootstrap");
  assert.equal(bootstrap.status, 200);
  const therapistUser = bootstrap.body.users.find((user) => user.username === "sara");
  const service = bootstrap.body.services.find((item) => item.active !== false);
  const suffix = Date.now().toString(36);
  const patient = await reception.post("/api/clients", {
    body: {
      fname: "PostgreSQL", lname: "Patient", phone: `052${String(Date.now()).slice(-7)}`,
      email: `pg-${suffix}@example.test`, therapistId: therapistUser.id,
    },
  });
  assert.equal(patient.status, 201);
  const appointment = await reception.post("/api/appointments", {
    body: {
      clientId: patient.body.id, serviceId: service.id, therapistId: therapistUser.id,
      date: "2035-09-12", time: "10:00", status: "pending", notes: "not for worker payload",
    },
  });
  assert.equal(appointment.status, 201);
  assert.ok((await therapist.get("/api/notifications")).body.items.some((item) => item.relatedEntityId === appointment.body.id));
  assert.ok((await reception.get("/api/reminders")).body.items.some((item) => item.appointmentId === appointment.body.id));

  const visit = await therapist.post("/api/clinical-visits", {
    body: { appointmentId: appointment.body.id, treatmentSummary: "PostgreSQL clinical record", followUpInstructions: "Follow up" },
  });
  assert.equal(visit.status, 201);
  assert.equal((await therapist.post(`/api/clinical-visits/${visit.body.id}/complete`)).status, 200);

  const invoice = await reception.post("/api/patient-finance/invoices", {
    body: {
      patientId: patient.body.id,
      appointmentId: appointment.body.id,
      currency: "ILS",
      items: [
        { description: "Decimal A", quantity: 3, unitPrice: "0.10" },
        { description: "Decimal B", quantity: 1, unitPrice: "100.05", discount: "0.05", tax: "0.10" },
      ],
    },
  });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.body.invoice.total, "100.40");
  assert.equal((await reception.post(`/api/patient-finance/invoices/${invoice.body.invoice.id}/issue`)).status, 200);
  assert.equal((await reception.post("/api/patient-finance/payments", {
    body: { patientId: patient.body.id, invoiceId: invoice.body.invoice.id, amount: "40.15", paymentMethod: "card" },
  })).status, 201);
  const ledger = await reception.get(`/api/patient-finance/patients/${patient.body.id}/ledger`);
  assert.equal(ledger.status, 200);
  assert.equal(ledger.body.balance, "60.25");

  const report = await admin.get("/api/reports?from=2035-09-01&to=2035-09-30");
  assert.equal(report.status, 200, `${JSON.stringify(report.body)}\n${serverOutput.join("")}`);
  assert.ok(report.body.appointments.summary.total >= 1);
  const postedMonth = new Date().toISOString().slice(0, 7);
  const postedReport = await admin.get(`/api/reports?from=${postedMonth}-01&to=${postedMonth}-28`);
  assert.equal(postedReport.status, 200);
  assert.equal(postedReport.body.financial.summary.paymentsReceived, "40.15");

  const tenant = await pool.query(`
    INSERT INTO tenants (name, slug, status, plan) VALUES ('Isolated', $1, 'active', 'starter') RETURNING id
  `, [`isolated-${suffix}`]);
  const tenantId = tenant.rows[0].id;
  const { hashPassword } = await import("../security.js");
  await pool.query(`
    INSERT INTO users (tenant_id, username, email, password_hash, name, role)
    VALUES ($1, $2, $2, $3, 'Other Admin', 'admin')
  `, [tenantId, `other-${suffix}@example.test`, hashPassword("OtherTenant123!")]);
  const { client: otherTenant } = await loginAs(baseUrl, `other-${suffix}@example.test`, "OtherTenant123!", `isolated-${suffix}`);
  assert.equal((await otherTenant.get(`/api/patient-finance/invoices/${invoice.body.invoice.id}`)).status, 404);
  assert.equal((await otherTenant.get(`/api/clients/${patient.body.id}/history`)).status, 404);
});

test("PostgreSQL transactions roll back and the worker is idempotent and restart-safe", async () => {
  const transaction = await pool.connect();
  try {
    await transaction.query("BEGIN");
    await transaction.query("INSERT INTO clinic_settings (tenant_id, key, value) VALUES (1, 'rollback_probe', 'must_disappear')");
    await transaction.query("ROLLBACK");
  } finally {
    transaction.release();
  }
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM clinic_settings WHERE key = 'rollback_probe'")).rows[0].count), 0);

  await pool.query("DELETE FROM background_jobs; DELETE FROM worker_heartbeats");
  await pool.query(`
    INSERT INTO background_jobs (tenant_id, type, dedupe_key, run_at)
    VALUES (1, 'expire_consents', 'parallel-claim-probe', NOW() - INTERVAL '1 minute')
  `);
  const claimScript = `
    const { closeDatabase, db } = await import('./server/db.js');
    const { claimNextBackgroundJob, completeBackgroundJob } = await import('./server/repositories/jobs.repository.js');
    const workerId = process.env.CLAIM_WORKER;
    const job = await claimNextBackgroundJob({ workerId, now: new Date().toISOString() });
    if (job) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await db.prepare("INSERT INTO audit_log (tenant_id, action, entity, entity_id, details) VALUES (?, 'parallel_claim_probe', 'background_jobs', ?, '{}')").run(job.tenantId, job.id);
      await completeBackgroundJob(job.id, workerId);
    }
    await closeDatabase();
  `;
  await Promise.all([
    runNode(["--input-type=module", "-e", claimScript], { CLAIM_WORKER: "claim-a" }),
    runNode(["--input-type=module", "-e", claimScript], { CLAIM_WORKER: "claim-b" }),
  ]);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM audit_log WHERE action = 'parallel_claim_probe'")).rows[0].count), 1);
  assert.equal((await pool.query("SELECT status FROM background_jobs WHERE dedupe_key = 'parallel-claim-probe'")).rows[0].status, "completed");

  await pool.query("DELETE FROM background_jobs");
  await runNode(["server/worker.js"], { WORKER_ONCE: "true", CLINOVA_TEST_NOW: "2035-09-10T09:00:00.000Z" });
  const firstCount = Number((await pool.query("SELECT COUNT(*) AS count FROM background_jobs")).rows[0].count);
  assert.ok(firstCount >= 3);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM background_jobs WHERE status != 'completed'")).rows[0].count), 0);
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM background_jobs WHERE payload != '{}'")).rows[0].count), 0);
  await runNode(["server/worker.js"], { WORKER_ONCE: "true", CLINOVA_TEST_NOW: "2035-09-10T09:00:00.000Z" });
  assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM background_jobs")).rows[0].count), firstCount);

  await pool.query(`
    INSERT INTO background_jobs (
      tenant_id, type, dedupe_key, status, attempts, max_attempts, run_at, locked_at, locked_by
    ) VALUES (1, 'expire_consents', 'pg-stale-recovery', 'processing', 0, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 'dead-worker')
  `);
  await runNode(["server/worker.js"], { WORKER_ONCE: "true" });
  const recovered = (await pool.query("SELECT status, attempts, locked_by FROM background_jobs WHERE dedupe_key = 'pg-stale-recovery'")).rows[0];
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.attempts, 1);
  assert.equal(recovered.locked_by, null);

  const { client: admin } = await loginAs(baseUrl, "admin");
  const readiness = await admin.get("/api/operations/readiness");
  assert.equal(readiness.status, 200);
  assert.equal(readiness.body.worker.status, "running");
});

test("verified PostgreSQL query plans can use production indexes", async () => {
  const connection = await pool.connect();
  try {
    await connection.query("SET enable_seqscan = off");
    const cases = [
      ["calendar", "EXPLAIN SELECT id FROM appointments WHERE tenant_id = 1 AND date BETWEEN '2035-01-01' AND '2035-12-31' AND active = 1", /idx_reports_appointments|idx_appointments_tenant|idx_appointments_date/],
      ["patient search", "EXPLAIN SELECT id FROM clients WHERE tenant_id = 1 AND active = 1 ORDER BY updated_at DESC LIMIT 120", /idx_clients_tenant_active_updated/],
      ["patient history appointments", "EXPLAIN SELECT id FROM appointments WHERE tenant_id = 1 AND client_id = 1 AND active = 1 ORDER BY date", /idx_appointments_tenant_client_date/],
      ["patient history timeline", "EXPLAIN SELECT id FROM crm_events WHERE tenant_id = 1 AND client_id = 1 ORDER BY id DESC LIMIT 100", /idx_crm_events_tenant_client/],
      ["ledger", "EXPLAIN SELECT id FROM patient_ledger_entries WHERE tenant_id = 1 AND patient_id = 1 ORDER BY posted_at, id", /idx_patient_ledger_patient/],
      ["reports", "EXPLAIN SELECT COUNT(*) FROM appointments WHERE tenant_id = 1 AND date BETWEEN '2035-01-01' AND '2035-12-31'", /idx_reports_appointments|idx_appointments_tenant/],
      ["reminders", "EXPLAIN SELECT id FROM appointment_reminders WHERE tenant_id = 1 AND status = 'ready' ORDER BY scheduled_for", /idx_reminders_tenant_status_schedule/],
      ["notifications", "EXPLAIN SELECT id FROM notifications WHERE tenant_id = 1 AND user_id = 1 AND status = 'unread' ORDER BY created_at", /idx_notifications_user_status/],
    ];
    for (const [name, sql, expected] of cases) {
      const plan = (await connection.query(sql)).rows.map((row) => row["QUERY PLAN"]).join("\n");
      assert.match(plan, expected, name);
    }
  } finally {
    connection.release();
  }
});

test("current stable SQLite data migrates transactionally without losing module records", async () => {
  await stopServer();
  const root = await mkdtemp(join(tmpdir(), "clinova-pg-upgrade-"));
  const sqlitePath = join(root, "stable.sqlite");
  try {
    await runNode(["server/scripts/migrate.js"], {
      DATABASE_URL: "",
      DATABASE_PATH: sqlitePath,
      BACKUP_DIR: join(root, "backups"),
    });
    const sqlite = new DatabaseSync(sqlitePath);
    try {
      sqlite.exec("PRAGMA foreign_keys = ON");
      const adminId = sqlite.prepare("SELECT id FROM users WHERE username = 'admin'").get().id;
      const therapistId = sqlite.prepare("SELECT id FROM users WHERE role = 'therapist' ORDER BY id LIMIT 1").get().id;
      const serviceId = sqlite.prepare("SELECT id FROM services ORDER BY id LIMIT 1").get().id;
      const patientId = Number(sqlite.prepare(`
        INSERT INTO clients (tenant_id, fname, lname, phone, email, therapist_id)
        VALUES (1, 'Migration', 'Marker', '0500000001', 'migration-marker@example.test', ?)
      `).run(therapistId).lastInsertRowid);
      const appointmentId = Number(sqlite.prepare(`
        INSERT INTO appointments (tenant_id, client_id, service_id, therapist_id, date, time, status)
        VALUES (1, ?, ?, ?, '2036-01-10', '10:00', 'pending')
      `).run(patientId, serviceId, therapistId).lastInsertRowid);
      sqlite.prepare("INSERT INTO crm_tasks (tenant_id, client_id, assigned_to, title) VALUES (1, ?, ?, 'Migration task')").run(patientId, therapistId);
      sqlite.prepare("INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description) VALUES (1, ?, ?, ?, 'migration', '')").run(patientId, adminId, appointmentId);
      sqlite.prepare(`
        INSERT INTO clinical_visits (
          tenant_id, appointment_id, client_id, therapist_id, service_id, visit_date, visit_time,
          treatment_summary, status, created_by, updated_by
        ) VALUES (1, ?, ?, ?, ?, '2036-01-10', '10:00', 'Migration clinical marker', 'draft', ?, ?)
      `).run(appointmentId, patientId, therapistId, serviceId, therapistId, therapistId);
      const templateId = Number(sqlite.prepare(`
        INSERT INTO consent_templates (tenant_id, service_id, title, consent_text, language, url, created_by)
        VALUES (1, ?, 'Migration consent', 'Safe text', 'en', '/migration.pdf', ?)
      `).run(serviceId, adminId).lastInsertRowid);
      const signatureId = Number(sqlite.prepare(`
        INSERT INTO consent_signatures (tenant_id, template_id, client_id, appointment_id, signer_name, signature_data)
        VALUES (1, ?, ?, ?, 'Migration Signer', 'data:image/png;base64,AA==')
      `).run(templateId, patientId, appointmentId).lastInsertRowid);
      sqlite.prepare(`
        INSERT INTO patient_consents (
          tenant_id, template_id, client_id, appointment_id, service_id, status,
          signature_id, assigned_by, signed_at
        ) VALUES (1, ?, ?, ?, ?, 'signed', ?, ?, CURRENT_TIMESTAMP)
      `).run(templateId, patientId, appointmentId, serviceId, signatureId, adminId);
      sqlite.prepare(`
        INSERT INTO client_files (tenant_id, client_id, appointment_id, name, url, original_name, path, uploaded_by)
        VALUES (1, ?, ?, 'Migration file', '/files/migration', 'migration.pdf', 'safe/migration.pdf', ?)
      `).run(patientId, appointmentId, adminId);
      sqlite.prepare(`
        INSERT INTO notifications (tenant_id, user_id, type, title, message, related_entity_type, related_entity_id)
        VALUES (1, ?, 'migration', 'Migration notification', 'Safe notification', 'appointment', ?)
      `).run(therapistId, appointmentId);
      sqlite.prepare(`
        INSERT INTO appointment_reminders (
          tenant_id, appointment_id, reminder_type, channel, recipient, scheduled_for, status, created_by
        ) VALUES (1, ?, '24h', 'email', 'migration@example.test', '2036-01-09T10:00:00.000Z', 'pending', ?)
      `).run(appointmentId, adminId);
      const invoiceId = Number(sqlite.prepare(`
        INSERT INTO patient_invoices (
          tenant_id, patient_id, appointment_id, invoice_number, status,
          subtotal_minor, discount_minor, tax_minor, total_minor, created_by
        ) VALUES (1, ?, ?, 'MIG-1', 'issued', 1005, 0, 0, 1005, ?)
      `).run(patientId, appointmentId, adminId).lastInsertRowid);
      sqlite.prepare(`
        INSERT INTO patient_invoice_items (
          tenant_id, invoice_id, service_id, description, quantity, unit_price_minor, line_total_minor
        ) VALUES (1, ?, ?, 'Migration item', 1, 1005, 1005)
      `).run(invoiceId, serviceId);
      sqlite.prepare(`
        INSERT INTO patient_ledger_entries (
          tenant_id, patient_id, type, reference_type, reference_id, debit_minor, credit_minor, created_by
        ) VALUES (1, ?, 'invoice', 'invoice', ?, 1005, 0, ?)
      `).run(patientId, invoiceId, adminId);
      sqlite.prepare("INSERT INTO feedback_requests (tenant_id, appointment_id, token) VALUES (1, ?, 'migration-feedback')").run(appointmentId);
      sqlite.prepare("INSERT INTO gift_cards (tenant_id, code, from_client_id, service_id) VALUES (1, 'MIG-GIFT', ?, ?)").run(patientId, serviceId);
      sqlite.prepare(`
        INSERT INTO message_logs (tenant_id, user_id, entity, entity_id, recipient, message, status)
        VALUES (1, ?, 'appointment', ?, 'migration@example.test', 'Safe migration message', 'dry_run')
      `).run(adminId, appointmentId);
      sqlite.prepare(`
        INSERT INTO user_invitations (tenant_id, email, name, role, token, invited_by, expires_at)
        VALUES (1, 'invite-migration@example.test', 'Invite Marker', 'reception', 'migration-token', ?, 4102444800000)
      `).run(adminId);
      const tenantId = Number(sqlite.prepare(`
        INSERT INTO tenants (name, slug, status, plan) VALUES ('Migration Tenant', 'migration-tenant', 'active', 'starter')
      `).run().lastInsertRowid);
      sqlite.prepare("INSERT INTO subscriptions (tenant_id, status, plan) VALUES (?, 'active', 'starter')").run(tenantId);
    } finally {
      sqlite.close();
    }

    await pool.query("TRUNCATE schema_migrations");
    await runNode(["server/postgres/migrate-sqlite-to-postgres.js"], { DATABASE_PATH: sqlitePath });
    assert.equal((await pool.query("SELECT COUNT(*) AS count FROM schema_migrations WHERE version = '2026.08.01.1'")).rows[0].count, "1");
    assert.equal((await pool.query("SELECT COUNT(*) AS count FROM tenants WHERE slug = 'migration-tenant'")).rows[0].count, "1");
    assert.equal((await pool.query("SELECT COUNT(*) AS count FROM subscriptions s JOIN tenants t ON t.id = s.tenant_id WHERE t.slug = 'migration-tenant'")).rows[0].count, "1");
    for (const [table, predicate] of [
      ["clients", "email = 'migration-marker@example.test'"],
      ["crm_tasks", "title = 'Migration task'"],
      ["crm_events", "type = 'migration'"],
      ["clinical_visits", "treatment_summary = 'Migration clinical marker'"],
      ["consent_templates", "title = 'Migration consent'"],
      ["client_files", "name = 'Migration file'"],
      ["notifications", "type = 'migration'"],
      ["appointment_reminders", "recipient = 'migration@example.test'"],
      ["patient_invoices", "invoice_number = 'MIG-1'"],
      ["patient_ledger_entries", "debit_minor = 1005"],
      ["feedback_requests", "token = 'migration-feedback'"],
      ["gift_cards", "code = 'MIG-GIFT'"],
      ["message_logs", "message = 'Safe migration message'"],
      ["user_invitations", "token = 'migration-token'"],
    ]) {
      assert.equal((await pool.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${predicate}`)).rows[0].count, "1", table);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
