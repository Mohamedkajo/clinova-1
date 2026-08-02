import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import pg from "pg";
import { hashPassword } from "../security.js";
import { createHttpClient, loginAs } from "./helpers/http-client.js";

const databaseUrl = String(process.env.POSTGRES_TEST_URL || "");
const restoreUrl = String(process.env.POSTGRES_RESTORE_TEST_URL || "");
const clinicPassword = "ReleaseCandidateClinic123!";
const ownerPassword = "ReleaseCandidateOwner123!";
let root;
let pool;
let web;
let worker;
let baseUrl;
const output = [];

function safeUrl(raw, kind) {
  if (!raw) throw new Error(`${kind} is required.`);
  const parsed = new URL(raw);
  if (!/(test|restore)/i.test(parsed.pathname.slice(1))) throw new Error(`${kind} must target a test or restore database.`);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) throw new Error(`${kind} must be local.`);
  return parsed.toString();
}

function environment(overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: "production",
    CLINOVA_SKIP_ENV_FILE: "true",
    APP_URL: "https://clinova.example.test",
    DATABASE_URL: safeUrl(databaseUrl, "POSTGRES_TEST_URL"),
    DATABASE_SSL: "false",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    SESSION_SECRET: "release-candidate-postgres-session-secret-over-forty-eight-characters",
    COOKIE_SECURE: "true",
    TRUSTED_PROXY_IPS: "127.0.0.1,::1",
    CORS_ALLOWED_ORIGINS: "https://clinova.example.test",
    UPLOAD_DIR: join(root, "uploads"),
    BACKUP_DIR: join(root, "backups"),
    LOG_DIR: join(root, "logs"),
    UPLOAD_MAX_MB: "10",
    BACKUP_ENABLED: "true",
    BACKUP_RETENTION: "30",
    WORKER_POLL_INTERVAL_MS: "250",
    WORKER_STALE_AFTER_MS: "5000",
    WORKER_RETRY_BASE_MS: "250",
    WHATSAPP_ENABLED: "false",
    ...overrides,
  };
}

function runNode(args, overrides = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const chunks = [];
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(), env: environment(overrides), stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => chunks.push(chunk.toString()));
    child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));
    child.once("error", rejectRun);
    child.once("exit", (code) => code === 0
      ? resolveRun(chunks.join(""))
      : rejectRun(new Error(`Child failed (${code}):\n${chunks.join("")}`)));
  });
}

async function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const listener = createServer();
    listener.once("error", rejectPort);
    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close((error) => error ? rejectPort(error) : resolvePort(port));
    });
  });
}

function launch(script, overrides = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: process.cwd(), env: environment(overrides), stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolveStop) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    child.once("exit", () => { clearTimeout(timer); resolveStop(); });
    child.kill("SIGTERM");
  });
}

async function startProcesses() {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  worker = launch("server/worker.js");
  web = launch("server/app.js", { PORT: String(port), HOST: "127.0.0.1", HEALTHCHECK_URL: `${baseUrl}/api/health` });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (web.exitCode !== null || worker.exitCode !== null) throw new Error(`Production process exited:\n${output.join("")}`);
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.ok && (await health.json()).checks.worker === "running") return;
    } catch {
      // Processes are starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Production process health timeout:\n${output.join("")}`);
}

before(async () => {
  safeUrl(restoreUrl, "POSTGRES_RESTORE_TEST_URL");
  root = await mkdtemp(join(tmpdir(), "clinova-pg-rc-"));
  await Promise.all([mkdir(join(root, "uploads")), mkdir(join(root, "backups")), mkdir(join(root, "logs"))]);
  const reset = new pg.Client({ connectionString: safeUrl(databaseUrl, "POSTGRES_TEST_URL") });
  await reset.connect();
  await reset.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await reset.end();

  await runNode(["server/scripts/migrate.js"], { NODE_ENV: "test", COOKIE_SECURE: "false", BACKUP_ENABLED: "false" });
  pool = new pg.Pool({ connectionString: databaseUrl });
  await pool.query("UPDATE tenants SET name = 'RC Test Clinic', slug = 'rc-test', status = 'active' WHERE id = 1");
  await pool.query("UPDATE users SET password_hash = $1, is_platform_owner = 0", [hashPassword(clinicPassword)]);
  await pool.query(`
    INSERT INTO users (tenant_id, username, email, password_hash, name, title, role, is_platform_owner, active)
    VALUES (1, 'rc-owner', 'rc-owner@example.test', $1, 'RC Platform Owner', 'Platform owner', 'admin', 1, 1)
  `, [hashPassword(ownerPassword)]);
  await runNode(["server/scripts/migrate.js"]);
  await startProcesses();
});

after(async () => {
  await stop(web);
  await stop(worker);
  await pool?.end();
  await rm(root, { recursive: true, force: true });
});

test("production web, worker, version, security headers, roles, and readiness are healthy", async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.version, "1.8.0-rc.1");
  assert.equal(healthBody.checks.databaseEngine, "postgresql");
  assert.equal(healthBody.checks.migrations, true);
  assert.equal(healthBody.checks.worker, "running");
  assert.equal(health.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(health.headers.get("x-frame-options"), "DENY");

  const { client: admin, response: adminLogin } = await loginAs(baseUrl, "admin", clinicPassword, "rc-test");
  const { client: reception, response: receptionLogin } = await loginAs(baseUrl, "reception", clinicPassword, "rc-test");
  const { client: therapist, response: therapistLogin } = await loginAs(baseUrl, "sara", clinicPassword, "rc-test");
  assert.equal(adminLogin.status, 200);
  assert.equal(receptionLogin.status, 200);
  assert.equal(therapistLogin.status, 200);
  assert.equal((await admin.get("/api/operations/readiness")).status, 200);
  assert.equal((await reception.get("/api/operations/readiness")).status, 403);
  const therapistReport = await therapist.get("/api/reports?from=2035-01-01&to=2035-12-31");
  assert.equal(therapistReport.status, 200);
  assert.equal(therapistReport.body.permissions.clinicWide, false);
  assert.equal(therapistReport.body.permissions.financial, false);
  assert.equal(therapistReport.body.financial, null);

  const owner = createHttpClient(baseUrl);
  assert.equal((await owner.post("/api/login", { body: { username: "rc-owner", password: ownerPassword } })).status, 200);
  assert.equal((await owner.get("/api/platform/health")).status, 200);
  assert.equal((await owner.get("/api/operations/readiness")).status, 403);
  assert.equal((await admin.post("/api/logout")).status, 200);
  const loggedOut = await admin.get("/api/me");
  assert.equal(loggedOut.status, 200);
  assert.equal(loggedOut.body.user, null);
});

test("controlled PostgreSQL workflow covers booking, queue, notifications, files, finance, CSV, and audit", async () => {
  const { client: admin } = await loginAs(baseUrl, "admin", clinicPassword, "rc-test");
  const { client: reception } = await loginAs(baseUrl, "reception", clinicPassword, "rc-test");
  const { client: therapist } = await loginAs(baseUrl, "sara", clinicPassword, "rc-test");
  const bootstrap = await admin.get("/api/bootstrap");
  const therapistUser = bootstrap.body.users.find((user) => user.username === "sara");
  const service = bootstrap.body.services[0];
  const suffix = Date.now().toString(36);
  const patient = await reception.post("/api/clients", { body: {
    fname: "Release", lname: "Candidate", phone: `052${String(Date.now()).slice(-7)}`,
    email: `rc-${suffix}@example.test`, therapistId: therapistUser.id,
  } });
  assert.equal(patient.status, 201);
  const appointment = await reception.post("/api/appointments", { body: {
    clientId: patient.body.id, serviceId: service.id, therapistId: therapistUser.id,
    date: "2037-05-20", time: "10:00", status: "pending", notes: "RC workflow",
  } });
  assert.equal(appointment.status, 201);
  assert.ok((await reception.get("/api/appointments?from=2037-05-01&to=2037-05-31")).body.some((item) => item.id === appointment.body.id));
  assert.ok((await reception.get("/api/appointments/queue?date=2037-05-20")).body.items.some((item) => item.id === appointment.body.id));
  assert.ok((await therapist.get("/api/notifications")).body.items.some((item) => item.relatedEntityId === appointment.body.id));

  const template = await admin.post("/api/consent-templates", { body: {
    title: `RC consent ${suffix}`, consentText: "Release candidate consent text.", language: "en", expirationDays: 30,
  } });
  assert.equal(template.status, 201);
  const consent = await reception.post(`/api/clients/${patient.body.id}/consents`, { body: {
    templateId: template.body.id, appointmentId: appointment.body.id,
  } });
  assert.equal(consent.status, 201);
  const signed = await therapist.post(`/api/patient-consents/${consent.body.id}/sign`, { body: {
    signerName: "Release Candidate",
    signatureData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARL8B9R9P7QAAAABJRU5ErkJggg==",
    witness: true,
  } });
  assert.equal(signed.status, 200);

  const pdf = Buffer.from("%PDF-1.4\nRC protected file\n");
  const form = new FormData();
  form.append("name", "RC file");
  form.append("file", new Blob([pdf], { type: "application/pdf" }), "rc.pdf");
  const uploaded = await therapist.post(`/api/clients/${patient.body.id}/files`, { body: form });
  assert.equal(uploaded.status, 201);
  assert.equal((await reception.get(`/api/client-files/${uploaded.body.id}/download`)).status, 403);
  const download = await therapist.get(`/api/client-files/${uploaded.body.id}/download`, { responseType: "buffer" });
  assert.equal(download.status, 200);
  assert.deepEqual(download.buffer, pdf);

  const visit = await therapist.post("/api/clinical-visits", { body: {
    appointmentId: appointment.body.id, treatmentSummary: "RC visit", followUpInstructions: "Return safely",
  } });
  assert.equal(visit.status, 201);
  assert.equal((await therapist.post(`/api/clinical-visits/${visit.body.id}/complete`)).status, 200);
  assert.equal((await therapist.patch(`/api/appointments/${appointment.body.id}/status`, { body: { status: "done" } })).status, 200);

  const invoice = await reception.post("/api/patient-finance/invoices", { body: {
    patientId: patient.body.id, appointmentId: appointment.body.id,
    items: [{ description: "RC treatment", quantity: 1, unitPrice: "100.05", tax: "0.10" }],
  } });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.body.invoice.total, "100.15");
  assert.equal((await reception.post(`/api/patient-finance/invoices/${invoice.body.invoice.id}/issue`)).status, 200);
  assert.equal((await reception.post("/api/patient-finance/payments", { body: {
    patientId: patient.body.id, invoiceId: invoice.body.invoice.id, amount: "40.15", paymentMethod: "card",
  } })).status, 201);
  assert.equal((await reception.get(`/api/patient-finance/patients/${patient.body.id}/ledger`)).body.balance, "60.00");

  const report = await admin.get("/api/reports?from=2037-05-01&to=2037-05-31");
  assert.equal(report.status, 200);
  const csv = await admin.get("/api/reports/export.csv?from=2037-05-01&to=2037-05-31");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.equal((await admin.get("/api/audit")).status, 200);
});

test("web and worker recover after graceful restart with healthy readiness", async () => {
  await stop(web);
  await stop(worker);
  await startProcesses();
  const { client: admin } = await loginAs(baseUrl, "admin", clinicPassword, "rc-test");
  const readiness = await admin.get("/api/operations/readiness");
  assert.equal(readiness.status, 200, `${JSON.stringify(readiness.body)}\n${output.join("")}`);
  assert.equal(readiness.body.worker.status, "running");
});

test("a real custom-format backup restores into the isolated PostgreSQL target", async () => {
  const restored = await runNode(["server/scripts/verify-postgres-restore.js"], {
    POSTGRES_RESTORE_TEST_URL: safeUrl(restoreUrl, "POSTGRES_RESTORE_TEST_URL"),
  });
  const lines = restored.trim().split(/\r?\n/).filter(Boolean);
  const result = JSON.parse(lines.at(-1));
  assert.equal(result.ok, true, restored);
  assert.equal(result.schemaVersion, "2026.08.01.1");
  assert.ok(result.constraints > 0);
  assert.ok(result.indexes > 0);
  assert.ok(result.counts.appointments > 0);
});
