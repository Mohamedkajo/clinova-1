import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

const projectRoot = resolve(process.cwd());
const productionTempRoots = [];
let tenantServer;

function runNode(args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => resolveRun({ code, signal, output }));
  });
}

async function createProductionEnvironment() {
  const root = await mkdtemp(join(tmpdir(), "clinova-production-bootstrap-test-"));
  productionTempRoots.push(root);
  const dataDir = join(root, "data");
  const uploadsDir = join(root, "uploads");
  const backupsDir = join(root, "backups");
  const logsDir = join(root, "logs");
  await Promise.all([
    mkdir(dataDir, { recursive: true }),
    mkdir(uploadsDir, { recursive: true }),
    mkdir(backupsDir, { recursive: true }),
    mkdir(logsDir, { recursive: true }),
  ]);
  return {
    root,
    databasePath: join(dataDir, "clinova.sqlite"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "0",
      APP_URL: "https://clinova.example.test",
      DATABASE_URL: "",
      DATABASE_PATH: join(dataDir, "clinova.sqlite"),
      UPLOAD_DIR: uploadsDir,
      BACKUP_DIR: backupsDir,
      LOG_DIR: logsDir,
      BACKUP_ENABLED: "false",
      BACKUP_RUN_ON_START: "false",
      WHATSAPP_ENABLED: "false",
      COOKIE_SECURE: "true",
      TRUSTED_PROXY_IPS: "127.0.0.1",
      UPLOAD_MAX_MB: "10",
      BACKUP_RETENTION: "30",
      WORKER_POLL_INTERVAL_MS: "5000",
      WORKER_STALE_AFTER_MS: "120000",
      WORKER_RETRY_BASE_MS: "5000",
      SESSION_SECRET: "clinova-production-bootstrap-test-secret-that-is-long-enough",
    },
  };
}

async function uploadConsent(client, title, categoryId = null) {
  const form = new FormData();
  form.append("title", title);
  if (categoryId) form.append("categoryId", String(categoryId));
  form.append("file", new Blob(["%PDF-1.4\n%%EOF\n"], { type: "application/pdf" }), `${title}.pdf`);
  const response = await client.post("/api/consents", { body: form });
  assert.equal(response.status, 201);
  return response.body.id;
}

before(async () => {
  tenantServer = await startTestServer({ envOverrides: { NODE_ENV: "development" } });
});

after(async () => {
  await tenantServer?.stop();
  await Promise.all(productionTempRoots.map((root) => rm(root, { recursive: true, force: true })));
});

test("production initialization rejects SQLite before creating a database or demo users", async () => {
  const environment = await createProductionEnvironment();
  const initArgs = [
    "--input-type=module",
    "-e",
    "const { initDatabase } = await import('./server/db.js'); await initDatabase();",
  ];

  const blockedInit = await runNode(initArgs, environment.env);
  assert.notEqual(blockedInit.code, 0);
  assert.match(blockedInit.output, /DATABASE_URL is required\./);

  const blockedStartup = await runNode(["server/app.js"], environment.env);
  assert.notEqual(blockedStartup.code, 0);
  assert.match(blockedStartup.output, /DATABASE_URL is required\./);
  assert.equal(existsSync(environment.databasePath), false);
});

test("foreign tenant references are rejected before appointment, gift, or consent writes", async () => {
  const suffix = Date.now().toString(36);
  const { client: platformOwner, response: ownerLogin } = await loginAs(tenantServer.baseUrl, "owner");
  assert.equal(ownerLogin.status, 200);

  const tenantBEmail = `tenant-b-${suffix}@example.test`;
  const tenantBPassword = "TenantBPassword123!";
  const tenantBSlug = `tenant-b-${suffix}`;
  const provision = await platformOwner.post("/api/platform/tenants", {
    body: {
      clinicName: `Tenant B ${suffix}`,
      slug: tenantBSlug,
      ownerName: "Tenant B Admin",
      email: tenantBEmail,
      password: tenantBPassword,
      plan: "starter",
      status: "active",
    },
  });
  assert.equal(provision.status, 201);

  const { client: tenantA } = await loginAs(tenantServer.baseUrl, "admin");
  const { client: tenantB } = await loginAs(tenantServer.baseUrl, tenantBEmail, tenantBPassword, tenantBSlug);

  const tenantABootstrap = await tenantA.get("/api/bootstrap");
  const tenantATherapistId = tenantABootstrap.body.users.find((user) => user.username === "sara").id;
  const tenantACategoryId = tenantABootstrap.body.categories[0].id;
  const tenantAServiceId = tenantABootstrap.body.services.find((service) => service.categoryId === tenantACategoryId).id;

  const tenantAClient = await tenantA.post("/api/clients", {
    body: {
      fname: "Tenant",
      lname: "A Client",
      phone: "0501000001",
      therapistId: tenantATherapistId,
    },
  });
  assert.equal(tenantAClient.status, 201);
  const tenantAClientId = tenantAClient.body.id;

  const tenantBUser = await tenantB.post("/api/users", {
    body: {
      username: `tenant-b-therapist-${suffix}`,
      email: `tenant-b-therapist-${suffix}@example.test`,
      password: "TenantBTherapist123!",
      name: "Tenant B Therapist",
      role: "therapist",
    },
  });
  assert.equal(tenantBUser.status, 201);
  const tenantBTherapistId = tenantBUser.body.id;

  const foreignTherapistClient = await tenantA.post("/api/clients", {
    body: {
      fname: "Foreign",
      lname: "Therapist",
      phone: "0501000002",
      therapistId: tenantBTherapistId,
    },
  });
  assert.equal(foreignTherapistClient.status, 404);
  assert.deepEqual(foreignTherapistClient.body, { error: "Therapist not found." });

  const foreignTherapistUpdate = await tenantA.put(`/api/clients/${tenantAClientId}`, {
    body: {
      fname: "Tenant",
      lname: "A Client",
      phone: "0501000001",
      therapistId: tenantBTherapistId,
    },
  });
  assert.equal(foreignTherapistUpdate.status, 404);
  assert.deepEqual(foreignTherapistUpdate.body, { error: "Therapist not found." });

  const tenantBCategory = await tenantB.post("/api/categories", { body: { name: `Tenant B Category ${suffix}` } });
  assert.equal(tenantBCategory.status, 201);
  const tenantBService = await tenantB.post("/api/services", {
    body: { name: `Tenant B Service ${suffix}`, categoryId: tenantBCategory.body.id, duration: 45, price: 100 },
  });
  assert.equal(tenantBService.status, 201);

  const tenantBClient = await tenantB.post("/api/clients", {
    body: {
      fname: "Tenant",
      lname: "B Client",
      phone: "0502000002",
      therapistId: tenantBTherapistId,
    },
  });
  assert.equal(tenantBClient.status, 201);

  const tenantBAppointment = await tenantB.post("/api/appointments", {
    body: {
      clientId: tenantBClient.body.id,
      serviceId: tenantBService.body.id,
      therapistId: tenantBTherapistId,
      date: "2035-02-10",
      time: "10:00",
      status: "pending",
    },
  });
  assert.equal(tenantBAppointment.status, 201);

  const validTenantAAppointment = {
    clientId: tenantAClientId,
    serviceId: tenantAServiceId,
    therapistId: tenantATherapistId,
    date: "2035-02-11",
    time: "11:00",
    status: "pending",
  };
  const tenantAAppointment = await tenantA.post("/api/appointments", { body: validTenantAAppointment });
  assert.equal(tenantAAppointment.status, 201);

  const foreignAppointmentReferences = [
    ["clientId", tenantBClient.body.id, "Client not found."],
    ["serviceId", tenantBService.body.id, "Service not found."],
    ["therapistId", tenantBTherapistId, "Therapist not found."],
  ];
  for (const [field, value, error] of foreignAppointmentReferences) {
    const create = await tenantA.post("/api/appointments", {
      body: { ...validTenantAAppointment, [field]: value, time: "12:00" },
    });
    assert.equal(create.status, 404, `create ${field}`);
    assert.deepEqual(create.body, { error }, `create ${field}`);

    const update = await tenantA.put(`/api/appointments/${tenantAAppointment.body.id}`, {
      body: { ...validTenantAAppointment, [field]: value, time: "13:00" },
    });
    assert.equal(update.status, 404, `update ${field}`);
    assert.deepEqual(update.body, { error }, `update ${field}`);
  }

  for (const body of [
    { fromClientId: tenantBClient.body.id, toClientId: tenantAClientId, serviceId: tenantAServiceId },
    { fromClientId: tenantAClientId, toClientId: tenantBClient.body.id, serviceId: tenantAServiceId },
    { fromClientId: tenantAClientId, toClientId: tenantAClientId, serviceId: tenantBService.body.id },
  ]) {
    const gift = await tenantA.post("/api/gifts", { body: { ...body, sessions: 1 } });
    assert.equal(gift.status, 404);
  }

  const tenantATask = await tenantA.post("/api/crm-tasks", {
    body: {
      clientId: tenantAClientId,
      assignedTo: tenantATherapistId,
      title: "Tenant A task",
      status: "open",
    },
  });
  assert.equal(tenantATask.status, 201);

  const foreignAssignedCreate = await tenantA.post("/api/crm-tasks", {
    body: {
      clientId: tenantAClientId,
      assignedTo: tenantBTherapistId,
      title: "Foreign assignee",
      status: "open",
    },
  });
  assert.equal(foreignAssignedCreate.status, 404);
  assert.deepEqual(foreignAssignedCreate.body, { error: "User not found." });

  const foreignAssignedUpdate = await tenantA.put(`/api/crm-tasks/${tenantATask.body.id}`, {
    body: {
      assignedTo: tenantBTherapistId,
      title: "Foreign assignee",
      status: "open",
    },
  });
  assert.equal(foreignAssignedUpdate.status, 404);
  assert.deepEqual(foreignAssignedUpdate.body, { error: "User not found." });

  const foreignCategoryConsent = new FormData();
  foreignCategoryConsent.append("title", `foreign-category-consent-${suffix}`);
  foreignCategoryConsent.append("categoryId", String(tenantBCategory.body.id));
  foreignCategoryConsent.append(
    "file",
    new Blob(["%PDF-1.4\n%%EOF\n"], { type: "application/pdf" }),
    `foreign-category-consent-${suffix}.pdf`,
  );
  const foreignCategoryResponse = await tenantA.post("/api/consents", { body: foreignCategoryConsent });
  assert.equal(foreignCategoryResponse.status, 404);
  assert.deepEqual(foreignCategoryResponse.body, { error: "Category not found." });

  const tenantAConsentId = await uploadConsent(tenantA, `tenant-a-consent-${suffix}`, tenantACategoryId);
  const tenantBConsentId = await uploadConsent(tenantB, `tenant-b-consent-${suffix}`);
  const signatureData = "data:image/png;base64,";

  const foreignConsentReferences = [
    [`/api/consents/${tenantBConsentId}/sign`, { clientId: tenantAClientId, appointmentId: tenantAAppointment.body.id }, "Consent file not found."],
    [`/api/consents/${tenantAConsentId}/sign`, { clientId: tenantBClient.body.id, appointmentId: tenantAAppointment.body.id }, "Client not found."],
    [`/api/consents/${tenantAConsentId}/sign`, { clientId: tenantAClientId, appointmentId: tenantBAppointment.body.id }, "Appointment not found."],
  ];
  for (const [path, references, error] of foreignConsentReferences) {
    const response = await tenantA.post(path, {
      body: { ...references, signerName: "Tenant Isolation Test", signatureData },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error });
  }
});
