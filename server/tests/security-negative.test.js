import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let clinicServer;
let platformServer;

function isoDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return isoDateOffset(0);
}

before(async () => {
  const fixedNow = `${todayIso()}T15:00`;
  [clinicServer, platformServer] = await Promise.all([
    startTestServer({ envOverrides: { CLINOVA_TEST_NOW: fixedNow } }),
    startTestServer({ envOverrides: { CLINOVA_TEST_NOW: fixedNow }, initializationRuns: 2 }),
  ]);
});

after(async () => {
  await Promise.all([clinicServer?.stop(), platformServer?.stop()]);
});

test("authentication negatives preserve unauthorized boundaries", async () => {
  const client = createHttpClient(clinicServer.baseUrl);

  assert.equal((await client.post("/api/login", {
    body: { username: "admin", password: "wrong-password", clinicIdentifier: "demo" },
  })).status, 401);
  assert.equal((await client.post("/api/login", {
    body: { username: "unknown-safe-step-105", password: "wrong-password", clinicIdentifier: "demo" },
  })).status, 401);

  const invalidCookie = await client.get("/api/bootstrap", {
    headers: { cookie: "clinic_session=invalid-session-token" },
  });
  assert.equal(invalidCookie.status, 401);

  const login = await client.post("/api/login", {
    body: { username: "admin", password: "ChangeMe123!", clinicIdentifier: "demo" },
  });
  assert.equal(login.status, 200);
  assert.equal((await client.post("/api/logout")).status, 200);
  assert.equal((await client.get("/api/bootstrap")).status, 401);

  const signup = await client.post("/api/signup", { body: {} });
  assert.equal(signup.status, 403);
  assert.deepEqual(signup.body, {
    error: "Clinic creation is managed by the platform owner.",
  });
});

test("clinic and platform roles remain separated", async () => {
  const { client: therapist } = await loginAs(clinicServer.baseUrl, "sara");
  assert.equal((await therapist.get("/api/audit")).status, 403);
  assert.equal((await therapist.get("/api/users")).status, 403);
  assert.equal((await therapist.delete("/api/services/1")).status, 403);
  assert.equal((await therapist.post("/api/invitations", {
    body: { email: "therapist-invite@example.test", name: "Therapist Invite", role: "reception" },
  })).status, 403);

  const { client: reception } = await loginAs(clinicServer.baseUrl, "reception");
  assert.equal((await reception.get("/api/audit")).status, 403);
  assert.equal((await reception.get("/api/reports")).status, 200);
  assert.equal((await reception.delete("/api/services/1")).status, 403);
  assert.equal((await reception.delete("/api/users/1")).status, 403);
  assert.equal((await reception.post("/api/invitations", {
    body: { email: "reception-invite@example.test", name: "Reception Invite", role: "therapist" },
  })).status, 403);

  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const clinicForbidden = [
    ["GET", "/api/platform/tenants"],
    ["POST", "/api/platform/tenants"],
    ["POST", "/api/platform/billing/auto-run"],
    ["GET", "/api/system/export"],
    ["POST", "/api/system/restore"],
  ];
  for (const [method, path] of clinicForbidden) {
    assert.equal((await clinicAdmin.request(method, path)).status, 403, `${method} ${path}`);
  }

  const unauthenticated = createHttpClient(clinicServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/platform/tenants")).status, 401);

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  assert.equal((await platformOwner.get("/api/clients")).status, 403);
});

test("platform invalid mutations fail without side effects", async () => {
  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");

  assert.equal((await platformOwner.post("/api/platform/tenants", { body: {} })).status, 400);
  assert.equal((await platformOwner.put("/api/platform/invoices/999999", { body: {} })).status, 400);
  assert.equal((await platformOwner.post("/api/platform/tenants/999999/reset-password", {
    body: { password: "short" },
  })).status, 400);

  const invalidRestore = await platformOwner.post("/api/system/restore", { body: {} });
  assert.equal(invalidRestore.status, 400);

  const emptyMultipart = new FormData();
  const missingBackup = await platformOwner.post("/api/system/restore", { body: emptyMultipart });
  assert.equal(missingBackup.status, 400);
  assert.equal(missingBackup.body.error, "Choose a backup file to restore.");

  const invalidBackup = new FormData();
  invalidBackup.append("backup", new Blob(["not a sqlite backup"]), "invalid-backup.sqlite");
  const invalidBackupResponse = await platformOwner.post("/api/system/restore", { body: invalidBackup });
  assert.equal(invalidBackupResponse.status, 400);
  assert.deepEqual(invalidBackupResponse.body, { error: "SQLite backup integrity check failed." });

  await assert.rejects(access(join(platformServer.backupsDir, "pending-restore.sqlite")));
  await assert.rejects(access(join(platformServer.backupsDir, "pending-restore.json")));
  assert.deepEqual(await readdir(join(platformServer.backupsDir, "restore-uploads")), []);
  assert.equal((await platformOwner.get("/api/health")).status, 200);
});

test("invalid JSON is rejected consistently by mutable clinic endpoints", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const paths = [
    "/api/clients",
    "/api/appointments",
    "/api/categories",
    "/api/services",
    "/api/gifts",
    "/api/crm-tasks",
    "/api/invitations",
    "/api/feedback",
  ];

  for (const path of paths) {
    const response = await clinicAdmin.post(path, {
      body: "{invalid-json",
      headers: { "content-type": "application/json" },
    });
    assert.equal(response.status, 400, path);
    assert.deepEqual(response.body, { error: "Invalid JSON body" }, path);
  }

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const domainResponse = await platformOwner.post("/api/tenant/domains", {
    body: "{invalid-json",
    headers: { "content-type": "application/json" },
  });
  assert.equal(domainResponse.status, 400);
  assert.deepEqual(domainResponse.body, { error: "Invalid JSON body" });
});

test("missing required core create fields return controlled validation errors", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const cases = [
    {
      path: "/api/clients",
      body: { fname: "Required", lname: "Fields", phone: "0500000110" },
      fields: ["fname", "lname", "phone"],
      error: "First name, last name, and phone are required.",
    },
    {
      path: "/api/appointments",
      body: { clientId: 1, serviceId: 1, therapistId: 1, date: "2031-01-15", time: "10:00" },
      fields: ["clientId", "serviceId", "therapistId", "date", "time"],
      error: "Client, service, therapist, date, and time are required.",
    },
    {
      path: "/api/categories",
      body: { name: "Required Fields" },
      fields: ["name"],
      error: "Category name is required.",
    },
    {
      path: "/api/services",
      body: { name: "Required Fields", categoryId: 1, duration: 30, price: 50 },
      fields: ["name", "categoryId", "duration", "price"],
      error: "Service name, category, duration, and price are required.",
    },
    {
      path: "/api/users",
      body: { username: "required-fields", password: "ChangeMe123!", name: "Required Fields", role: "reception" },
      fields: ["name", "role"],
      error: "Name and role are required.",
    },
  ];

  for (const { path, body, fields, error } of cases) {
    for (const field of fields) {
      const missing = { ...body };
      delete missing[field];
      const response = await clinicAdmin.post(path, { body: missing });
      assert.equal(response.status, 400, `${path} missing ${field}`);
      assert.deepEqual(response.body, { error }, `${path} missing ${field}`);
    }
  }
});

test("client update requires first name, last name, and phone", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const createClient = await clinicAdmin.post("/api/clients", {
    body: {
      fname: "Update",
      lname: "Required",
      phone: "0500000116",
      email: "safe-step-116@example.test",
    },
  });
  assert.equal(createClient.status, 201);

  const validBody = {
    fname: "Update",
    lname: "Required",
    phone: "0500000116",
    email: "safe-step-116@example.test",
  };
  const invalidBodies = [
    {},
    (() => { const body = { ...validBody }; delete body.fname; return body; })(),
    (() => { const body = { ...validBody }; delete body.lname; return body; })(),
    (() => { const body = { ...validBody }; delete body.phone; return body; })(),
    { ...validBody, fname: "   " },
    { ...validBody, lname: "   " },
    { ...validBody, phone: "   " },
  ];

  try {
    for (const body of invalidBodies) {
      const response = await clinicAdmin.put(`/api/clients/${createClient.body.id}`, { body });
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.deepEqual(response.body, { error: "First name, last name, and phone are required." });
    }

    const validUpdate = await clinicAdmin.put(`/api/clients/${createClient.body.id}`, {
      body: { ...validBody, lname: "Required Updated" },
    });
    assert.equal(validUpdate.status, 200);
    assert.deepEqual(validUpdate.body, { ok: true });
  } finally {
    assert.equal((await clinicAdmin.delete(`/api/clients/${createClient.body.id}`)).status, 200);
  }
});

test("missing client delete returns not found", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const response = await clinicAdmin.delete("/api/clients/999999");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Client not found" });
});

test("appointment update requires full replacement fields", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const validBody = {
    clientId: 1,
    serviceId: 1,
    therapistId: 1,
    date: "2031-01-15",
    time: "10:00",
  };
  const invalidBodies = [
    {},
    (() => { const body = { ...validBody }; delete body.clientId; return body; })(),
    (() => { const body = { ...validBody }; delete body.serviceId; return body; })(),
    (() => { const body = { ...validBody }; delete body.therapistId; return body; })(),
    (() => { const body = { ...validBody }; delete body.date; return body; })(),
    (() => { const body = { ...validBody }; delete body.time; return body; })(),
  ];

  for (const body of invalidBodies) {
    const response = await clinicAdmin.put("/api/appointments/1", { body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { error: "Client, service, therapist, date, and time are required." });
  }

  for (const body of [{ ...validBody, date: "   " }, { ...validBody, time: "   " }]) {
    const response = await clinicAdmin.put("/api/appointments/1", { body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { error: "Valid appointment date and time are required." });
  }
});

test("missing appointment update and delete return not found", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const validBody = {
    clientId: 1,
    serviceId: 1,
    therapistId: 1,
    date: "2031-01-15",
    time: "10:00",
  };

  const update = await clinicAdmin.put("/api/appointments/999999", { body: validBody });
  assert.equal(update.status, 404);
  assert.deepEqual(update.body, { error: "Appointment not found." });

  const remove = await clinicAdmin.delete("/api/appointments/999999");
  assert.equal(remove.status, 404);
  assert.deepEqual(remove.body, { error: "Appointment not found." });
});

test("category update requires a name", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const invalidBodies = [
    {},
    { name: null },
    { name: "" },
    { name: "   " },
  ];

  for (const body of invalidBodies) {
    const response = await clinicAdmin.put("/api/categories/1", { body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { error: "Category name is required." });
  }
});

test("service update requires full replacement fields", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const validBody = {
    name: "Required Service Update",
    categoryId: 1,
    duration: 30,
    price: 50,
  };
  const invalidBodies = [
    {},
    (() => { const body = { ...validBody }; delete body.name; return body; })(),
    (() => { const body = { ...validBody }; delete body.categoryId; return body; })(),
    (() => { const body = { ...validBody }; delete body.duration; return body; })(),
    (() => { const body = { ...validBody }; delete body.price; return body; })(),
    { ...validBody, name: null },
    { ...validBody, name: "" },
    { ...validBody, name: "   " },
  ];

  for (const body of invalidBodies) {
    const response = await clinicAdmin.put("/api/services/1", { body });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(response.body, { error: "Service name, category, duration, and price are required." });
  }
});

test("missing catalog category and service updates return not found", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");

  const categoryUpdate = await clinicAdmin.put("/api/categories/999999", {
    body: { name: "Missing Category" },
  });
  assert.equal(categoryUpdate.status, 404);
  assert.deepEqual(categoryUpdate.body, { error: "Category not found." });

  const categoryDelete = await clinicAdmin.delete("/api/categories/999999");
  assert.equal(categoryDelete.status, 404);
  assert.deepEqual(categoryDelete.body, { error: "Category not found." });

  const serviceUpdate = await clinicAdmin.put("/api/services/999999", {
    body: { name: "Missing Service", categoryId: 1, duration: 30, price: 50 },
  });
  assert.equal(serviceUpdate.status, 404);
  assert.deepEqual(serviceUpdate.body, { error: "Service not found." });

  const serviceDelete = await clinicAdmin.delete("/api/services/999999");
  assert.equal(serviceDelete.status, 404);
  assert.deepEqual(serviceDelete.body, { error: "Service not found." });
});

test("missing gift update returns not found", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const response = await clinicAdmin.put("/api/gifts/999999", { body: { status: "cancelled" } });
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Gift card not found." });
});

test("missing invitation delete returns not found while token preview remains unchanged", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const remove = await clinicAdmin.delete("/api/invitations/999999");
  assert.equal(remove.status, 404);
  assert.deepEqual(remove.body, { error: "Invitation not found." });

  const preview = await clinicAdmin.get("/api/invitations/not-a-number");
  assert.equal(preview.status, 404);
  assert.deepEqual(preview.body, { error: "Invitation not found." });
});

test("user update requires name and role", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const suffix = Date.now().toString(36);
  const createUser = await clinicAdmin.post("/api/users", {
    body: {
      username: `safe-step-120-${suffix}`,
      password: "ChangeMe123!",
      name: "Safe Step User",
      role: "reception",
    },
  });
  assert.equal(createUser.status, 201);

  const validBody = {
    username: `safe-step-120-${suffix}`,
    name: "Safe Step User",
    role: "reception",
  };
  const invalidBodies = [
    {},
    (() => { const body = { ...validBody }; delete body.name; return body; })(),
    (() => { const body = { ...validBody }; delete body.role; return body; })(),
    { ...validBody, name: null },
    { ...validBody, name: "" },
    { ...validBody, name: "   " },
  ];

  try {
    for (const body of invalidBodies) {
      const response = await clinicAdmin.put(`/api/users/${createUser.body.id}`, { body });
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.deepEqual(response.body, { error: "Name and role are required." });
    }

    const validUpdate = await clinicAdmin.put(`/api/users/${createUser.body.id}`, {
      body: { ...validBody, name: "Safe Step User Updated" },
    });
    assert.equal(validUpdate.status, 200);
    assert.deepEqual(validUpdate.body, { ok: true });
  } finally {
    assert.equal((await clinicAdmin.delete(`/api/users/${createUser.body.id}`)).status, 200);
  }
});

test("invalid numeric inputs return controlled validation errors", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const invalidValues = ["not-a-number", "Infinity", true];
  const serviceBody = { name: "Numeric Validation", categoryId: 1, duration: 30, price: 50 };
  const appointmentBody = {
    clientId: 1,
    serviceId: 1,
    therapistId: 1,
    date: "2031-01-15",
    time: "10:00",
    paidAmount: 0,
  };

  const invalidServiceValues = {
    categoryId: [...invalidValues, 0, -1, 1.5],
    duration: [...invalidValues, 0, -1],
    price: [...invalidValues, -1],
  };
  for (const [field, values] of Object.entries(invalidServiceValues)) {
    for (const value of values) {
      const body = { ...serviceBody, [field]: value };
      for (const [method, path] of [["POST", "/api/services"], ["PUT", "/api/services/1"]]) {
        const response = await clinicAdmin.request(method, path, { body });
        assert.equal(response.status, 400, `${method} ${path} ${field}=${String(value)}`);
        assert.deepEqual(response.body, { error: "Valid category, duration, and price are required." });
      }
    }
  }

  const invalidAppointmentValues = {
    clientId: [...invalidValues, 0, -1, 1.5],
    serviceId: [...invalidValues, 0, -1, 1.5],
    therapistId: [...invalidValues, 0, -1, 1.5],
    paidAmount: invalidValues,
  };
  for (const [field, values] of Object.entries(invalidAppointmentValues)) {
    for (const value of values) {
      const body = { ...appointmentBody, [field]: value };
      for (const [method, path] of [["POST", "/api/appointments"], ["PUT", "/api/appointments/1"]]) {
        const response = await clinicAdmin.request(method, path, { body });
        assert.equal(response.status, 400, `${method} ${path} ${field}=${String(value)}`);
        assert.deepEqual(response.body, {
          error: field === "paidAmount"
            ? "Valid paid amount is required."
            : "Valid client, service, and therapist are required.",
        });
      }
    }
  }

  for (const value of invalidValues) {
    const gift = await clinicAdmin.post("/api/gifts", { body: { sessions: value } });
    assert.equal(gift.status, 400, `gift sessions=${String(value)}`);
    assert.deepEqual(gift.body, { error: "Valid gift sessions are required." });
  }

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const tenants = await platformOwner.get("/api/platform/tenants");
  const tenantId = tenants.body.tenants[0].id;
  for (const value of invalidValues) {
    const tenantUpdate = await platformOwner.put(`/api/platform/tenants/${tenantId}`, {
      body: { plan: "starter", status: "trial", billingDay: value },
    });
    assert.equal(tenantUpdate.status, 400, `billingDay=${String(value)}`);
    assert.deepEqual(tenantUpdate.body, { error: "Valid billing day is required." });

    const invoice = await platformOwner.post("/api/billing/invoices", { body: { amount: value } });
    assert.equal(invoice.status, 400, `billing amount=${String(value)}`);
    assert.deepEqual(invoice.body, { error: "Valid invoice amount is required." });
  }
});

test("invalid date and time inputs return controlled validation errors", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const appointmentBody = {
    clientId: 1,
    serviceId: 1,
    therapistId: 1,
    date: "2031-01-15",
    time: "10:00",
  };

  for (const [field, values] of Object.entries({
    date: ["not-a-date", "2030-02-30", "2030-99-99", ""],
    time: ["not-a-time", "24:00", "10:60", ""],
  })) {
    for (const value of values) {
      const body = { ...appointmentBody, [field]: value };
      for (const [method, path] of [["POST", "/api/appointments"], ["PUT", "/api/appointments/1"]]) {
        const response = await clinicAdmin.request(method, path, { body });
        assert.equal(response.status, 400, `${method} ${path} ${field}=${value}`);
        assert.deepEqual(response.body, { error: "Valid appointment date and time are required." });
      }
    }
  }

  for (const value of ["not-a-date", "2030-02-30", "2030-99-99"]) {
    for (const [method, path] of [["POST", "/api/crm-tasks"], ["PUT", "/api/crm-tasks/1"]]) {
      const response = await clinicAdmin.request(method, path, {
        body: { clientId: 1, dueDate: value },
      });
      assert.equal(response.status, 400, `${method} ${path} dueDate=${value}`);
      assert.deepEqual(response.body, { error: "Valid due date is required." });
    }
  }

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const tenants = await platformOwner.get("/api/platform/tenants");
  const tenantId = tenants.body.tenants[0].id;
  for (const field of ["periodStart", "periodEnd", "dueAt"]) {
    for (const value of ["not-a-date", "2030-02-30", "2030-99-99"]) {
      const platformInvoice = await platformOwner.post(`/api/platform/tenants/${tenantId}/invoices`, {
        body: { [field]: value },
      });
      assert.equal(platformInvoice.status, 400, `platform invoice ${field}=${value}`);
      assert.deepEqual(platformInvoice.body, { error: "Valid invoice dates are required." });

      const billingInvoice = await platformOwner.post("/api/billing/invoices", {
        body: { [field]: value },
      });
      assert.equal(billingInvoice.status, 400, `billing invoice ${field}=${value}`);
      assert.deepEqual(billingInvoice.body, { error: "Valid invoice dates are required." });
    }
  }

  for (const value of ["not-a-date", "2030-02-30", "2030-99-99"]) {
    const autoBilling = await platformOwner.post("/api/platform/billing/auto-run", {
      body: { runDate: value },
    });
    assert.equal(autoBilling.status, 400, `runDate=${value}`);
    assert.deepEqual(autoBilling.body, { error: "Valid run date is required." });
  }

  for (const value of ["not-a-date", "2030-02-30", "2030-99-99", "2030-01-01T24:00"]) {
    const billing = await platformOwner.put("/api/billing", {
      body: { plan: "starter", status: "trial", currentPeriodEnd: value },
    });
    assert.equal(billing.status, 400, `currentPeriodEnd=${value}`);
    assert.deepEqual(billing.body, { error: "Valid current period end is required." });
  }
});

test("appointment booking rejects past dates and times outside clinic working hours", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const bootstrap = await clinicAdmin.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.role === "therapist");
  assert.ok(therapist?.id);
  const patient = await clinicAdmin.post("/api/clients", {
    body: { fname: "Date", lname: "Validation", phone: `055${String(Date.now()).slice(-7)}`, therapistId: therapist.id },
  });
  assert.equal(patient.status, 201);
  const appointmentBody = {
    clientId: patient.body.id,
    serviceId: 1,
    therapistId: therapist.id,
    date: isoDateOffset(30),
    time: "10:00",
  };

  const pastDate = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, date: isoDateOffset(-1) },
  });
  assert.equal(pastDate.status, 400);
  assert.deepEqual(pastDate.body, { error: "Appointment cannot be booked in the past", code: "APPOINTMENT_IN_PAST" });

  const earlierToday = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, date: todayIso(), time: "10:00" },
  });
  assert.equal(earlierToday.status, 400);
  assert.deepEqual(earlierToday.body, { error: "Appointment cannot be booked in the past", code: "APPOINTMENT_IN_PAST" });

  const laterToday = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, date: todayIso(), time: "16:00" },
  });
  assert.equal(laterToday.status, 201);
  assert.ok(laterToday.body.id);
  assert.equal((await clinicAdmin.delete(`/api/appointments/${laterToday.body.id}`)).status, 200);

  const beforeWorkday = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, time: "08:00" },
  });
  assert.equal(beforeWorkday.status, 400);
  assert.deepEqual(beforeWorkday.body, { error: "Appointment must be within clinic working hours", code: "APPOINTMENT_OUTSIDE_WORK_HOURS" });

  const endsAfterWorkday = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, time: "17:30" },
  });
  assert.equal(endsAfterWorkday.status, 400);
  assert.deepEqual(endsAfterWorkday.body, { error: "Appointment must be within clinic working hours", code: "APPOINTMENT_OUTSIDE_WORK_HOURS" });

  const validAppointment = await clinicAdmin.post("/api/appointments", {
    body: { ...appointmentBody, time: "11:00" },
  });
  assert.equal(validAppointment.status, 201);
  assert.ok(validAppointment.body.id);
  assert.equal((await clinicAdmin.delete(`/api/appointments/${validAppointment.body.id}`)).status, 200);
});

test("invalid enum and status inputs return controlled validation errors", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const appointmentBody = {
    clientId: 1,
    serviceId: 1,
    therapistId: 1,
    date: "2031-01-15",
    time: "10:00",
  };

  for (const [field, error] of Object.entries({
    status: "Valid appointment status is required.",
    paymentStatus: "Valid payment status is required.",
  })) {
    for (const [method, path] of [["POST", "/api/appointments"], ["PUT", "/api/appointments/1"]]) {
      const response = await clinicAdmin.request(method, path, {
        body: { ...appointmentBody, [field]: "invalid-status" },
      });
      assert.equal(response.status, 400, `${method} ${path} ${field}`);
      assert.deepEqual(response.body, { error });
    }
  }

  const gift = await clinicAdmin.put("/api/gifts/1", { body: { status: "invalid-status" } });
  assert.equal(gift.status, 400);
  assert.deepEqual(gift.body, { error: "Valid gift status is required." });

  for (const [field, error] of Object.entries({
    status: "Valid CRM status is required.",
    priority: "Valid CRM priority is required.",
  })) {
    for (const [method, path] of [["POST", "/api/crm-tasks"], ["PUT", "/api/crm-tasks/1"]]) {
      const response = await clinicAdmin.request(method, path, {
        body: { clientId: 1, [field]: "invalid-status" },
      });
      assert.equal(response.status, 400, `${method} ${path} ${field}`);
      assert.deepEqual(response.body, { error });
    }
  }

  const invalidUserRole = await clinicAdmin.post("/api/users", {
    body: {
      username: `invalid-role-${Date.now()}`,
      password: "ChangeMe123!",
      name: "Invalid Role",
      role: "owner",
    },
  });
  assert.equal(invalidUserRole.status, 400);
  assert.deepEqual(invalidUserRole.body, { error: "Valid role is required." });

  const users = await clinicAdmin.get("/api/users");
  assert.equal(users.status, 200);
  const editableUserId = users.body.find((row) => row.role !== "admin")?.id || users.body[0]?.id;
  const invalidUserEdit = await clinicAdmin.put(`/api/users/${editableUserId}`, {
    body: { name: "Invalid Role Edit", role: "owner" },
  });
  assert.equal(invalidUserEdit.status, 400);
  assert.deepEqual(invalidUserEdit.body, { error: "Valid role is required." });

  const invalidInvitationRole = await clinicAdmin.post("/api/invitations", {
    body: { email: "invalid-role@example.test", name: "Invalid Invite Role", role: "owner" },
  });
  assert.equal(invalidInvitationRole.status, 400);
  assert.deepEqual(invalidInvitationRole.body, { error: "Valid role is required." });

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  for (const body of [
    {
      clinicName: "Invalid Plan Clinic",
      slug: `invalid-plan-${Date.now()}`,
      ownerName: "Invalid Plan",
      email: `invalid-plan-${Date.now()}@example.test`,
      password: "ChangeMe123!",
      plan: "enterprise",
    },
    {
      clinicName: "Invalid Status Clinic",
      slug: `invalid-status-${Date.now()}`,
      ownerName: "Invalid Status",
      email: `invalid-status-${Date.now()}@example.test`,
      password: "ChangeMe123!",
      status: "enabled",
    },
  ]) {
    const response = await platformOwner.post("/api/platform/tenants", { body });
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Valid plan and status are required." });
  }

  const tenants = await platformOwner.get("/api/platform/tenants");
  assert.equal(tenants.status, 200);
  const tenantId = tenants.body.tenants[0].id;
  assert.equal((await platformOwner.put(`/api/platform/tenants/${tenantId}`, {
    body: { plan: "enterprise", status: "trial" },
  })).status, 400);
  assert.equal((await platformOwner.put(`/api/platform/tenants/${tenantId}`, {
    body: { plan: "starter", status: "enabled" },
  })).status, 400);

  const invalidPlatformInvoiceStatus = await platformOwner.post(`/api/platform/tenants/${tenantId}/invoices`, {
    body: { status: "paid" },
  });
  assert.equal(invalidPlatformInvoiceStatus.status, 400);
  assert.deepEqual(invalidPlatformInvoiceStatus.body, { error: "Valid invoice status is required." });

  const invalidBillingInvoiceStatus = await platformOwner.post("/api/billing/invoices", {
    body: { status: "paid" },
  });
  assert.equal(invalidBillingInvoiceStatus.status, 400);
  assert.deepEqual(invalidBillingInvoiceStatus.body, { error: "Valid invoice status is required." });

  const domainName = `enum-${Date.now()}.example.test`;
  const createdDomain = await platformOwner.post("/api/tenant/domains", { body: { domain: domainName } });
  assert.equal(createdDomain.status, 201);
  try {
    const invalidDomainStatus = await platformOwner.put(`/api/tenant/domains/${createdDomain.body.id}`, {
      body: { status: "verified" },
    });
    assert.equal(invalidDomainStatus.status, 400);
    assert.deepEqual(invalidDomainStatus.body, { error: "Valid domain status is required." });
  } finally {
    assert.equal((await platformOwner.delete(`/api/tenant/domains/${createdDomain.body.id}`)).status, 200);
  }
});

test("file, consent, and restore safety inputs remain rejected", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const createClient = await clinicAdmin.post("/api/clients", {
    body: {
      fname: "Security",
      lname: "Fixture",
      phone: "0500000105",
      email: "safe-step-105@example.test",
    },
  });
  assert.equal(createClient.status, 201);

  assert.equal((await clinicAdmin.post(`/api/clients/${createClient.body.id}/files`)).status, 400);
  assert.equal((await clinicAdmin.post("/api/consents")).status, 400);
  assert.equal((await clinicAdmin.delete(`/api/clients/${createClient.body.id}`)).status, 200);
});

test("missing client file delete returns not found without touching uploads", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const before = JSON.stringify(await readdir(clinicServer.uploadsDir, { recursive: true }));
  const response = await clinicAdmin.delete("/api/client-files/999999");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "File not found." });
  const after = JSON.stringify(await readdir(clinicServer.uploadsDir, { recursive: true }));
  assert.equal(after, before);
});

test("missing consent delete returns not found without touching uploads", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const before = JSON.stringify(await readdir(clinicServer.uploadsDir, { recursive: true }));
  const response = await clinicAdmin.delete("/api/consents/999999");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Consent file not found." });
  const after = JSON.stringify(await readdir(clinicServer.uploadsDir, { recursive: true }));
  assert.equal(after, before);
});

test("missing-record affected-row boundaries return not found consistently", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");

  const clinicCases = [
    {
      method: "PUT",
      path: "/api/appointments/999999",
      body: { clientId: 1, serviceId: 1, therapistId: 1, date: "2031-01-15", time: "10:00" },
      expected: { error: "Appointment not found." },
    },
    { method: "DELETE", path: "/api/appointments/999999", expected: { error: "Appointment not found." } },
    { method: "PUT", path: "/api/categories/999999", body: { name: "Missing Category" }, expected: { error: "Category not found." } },
    { method: "DELETE", path: "/api/categories/999999", expected: { error: "Category not found." } },
    {
      method: "PUT",
      path: "/api/services/999999",
      body: { name: "Missing Service", categoryId: 1, duration: 30, price: 50 },
      expected: { error: "Service not found." },
    },
    { method: "DELETE", path: "/api/services/999999", expected: { error: "Service not found." } },
    { method: "DELETE", path: "/api/clients/999999", expected: { error: "Client not found" } },
    { method: "PUT", path: "/api/gifts/999999", body: { status: "cancelled" }, expected: { error: "Gift card not found." } },
    {
      method: "PUT",
      path: "/api/crm-tasks/999999",
      body: { title: "Missing CRM Task", status: "open", priority: "normal", dueDate: "2031-01-20" },
      expected: { error: "Task not found." },
    },
    { method: "DELETE", path: "/api/invitations/999999", expected: { error: "Invitation not found." } },
    { method: "DELETE", path: "/api/client-files/999999", expected: { error: "File not found." } },
    { method: "DELETE", path: "/api/consents/999999", expected: { error: "Consent file not found." } },
    {
      method: "PUT",
      path: "/api/users/999999",
      body: { username: "missing-user", name: "Missing User", role: "reception" },
      expected: { error: "User not found." },
    },
    { method: "DELETE", path: "/api/users/999999", expected: { error: "User not found." } },
  ];

  const platformCases = [
    {
      method: "PUT",
      path: "/api/tenant/domains/999999",
      body: { status: "active", isPrimary: false },
      expected: { error: "Domain not found" },
    },
    { method: "DELETE", path: "/api/tenant/domains/999999", expected: { error: "Domain not found" } },
    {
      method: "PUT",
      path: "/api/billing/invoices/999999",
      body: { status: "paid" },
      expected: { error: "Invoice not found" },
    },
    {
      method: "PUT",
      path: "/api/platform/tenants/999999",
      body: { plan: "starter", status: "trial", billingDay: 1, autoBillingEnabled: false },
      expected: { error: "Tenant not found" },
    },
    {
      method: "POST",
      path: "/api/platform/tenants/999999/reset-password",
      body: { password: "ChangeMe123!" },
      expected: { error: "Tenant not found" },
    },
    {
      method: "POST",
      path: "/api/platform/tenants/999999/invoices",
      body: { amount: 123.45 },
      expected: { error: "Tenant not found" },
    },
    {
      method: "PUT",
      path: "/api/platform/invoices/999999",
      body: { status: "paid" },
      expected: { error: "Invoice not found" },
    },
  ];

  for (const item of clinicCases) {
    const response = await clinicAdmin.request(item.method, item.path, item.body ? { body: item.body } : {});
    assert.equal(response.status, 404, `${item.method} ${item.path}`);
    assert.deepEqual(response.body, item.expected, `${item.method} ${item.path}`);
  }

  for (const item of platformCases) {
    const response = await platformOwner.request(item.method, item.path, item.body ? { body: item.body } : {});
    assert.equal(response.status, 404, `${item.method} ${item.path}`);
    assert.deepEqual(response.body, item.expected, `${item.method} ${item.path}`);
  }
});

test("malformed nested paths return the generic API 404", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const expected = await clinicAdmin.get("/api/unknown");
  const paths = [
    "/api/clients/3/unknown",
    "/api/appointments/1/unknown",
    "/api/clients/3/files/1/unknown",
    "/api/consents/1/unknown",
    "/api/categories/1/unknown",
    "/api/services/1/unknown",
    "/api/gifts/1/unknown",
    "/api/tenant/domains/1/unknown",
    "/api/public/feedback/token/unknown",
  ];

  for (const path of paths) {
    const response = await clinicAdmin.get(path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, expected.body, path);
  }
});

test("non-numeric resource IDs return the generic API 404", async () => {
  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const expected = await clinicAdmin.get("/api/unknown");

  for (const path of [
    "/api/clients/not-a-number",
    "/api/appointments/not-a-number",
    "/api/categories/not-a-number",
    "/api/services/not-a-number",
    "/api/crm-tasks/not-a-number",
    "/api/users/not-a-number",
    "/api/consents/not-a-number",
    "/api/client-files/not-a-number/download",
    "/api/gifts/not-a-number",
  ]) {
    const response = await clinicAdmin.get(path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, expected.body, path);
  }

  for (const path of [
    "/api/tenant/domains/not-a-number",
    "/api/platform/tenants/not-a-number",
    "/api/platform/invoices/not-a-number",
    "/api/billing/invoices/not-a-number",
  ]) {
    const response = await platformOwner.get(path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, expected.body, path);
  }

  assert.equal((await clinicAdmin.delete("/api/invitations/not-a-number")).status, 404);
  assert.equal((await platformOwner.put("/api/platform/tenants/not-a-number", {
    body: { plan: "starter", status: "trial" },
  })).status, 404);
  assert.equal((await platformOwner.put("/api/platform/invoices/not-a-number", {
    body: { status: "paid" },
  })).status, 404);
  assert.equal((await platformOwner.put("/api/billing/invoices/not-a-number", {
    body: { status: "paid" },
  })).status, 404);
  assert.equal((await platformOwner.put("/api/tenant/domains/not-a-number", {
    body: { status: "active" },
  })).status, 404);
});
