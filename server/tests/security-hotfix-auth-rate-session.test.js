import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let authServer;
let rateServer;

before(async () => {
  authServer = await startTestServer({ envOverrides: { NODE_ENV: "development" } });
  rateServer = await startTestServer({
    envOverrides: {
      NODE_ENV: "development",
      RATE_LIMIT_PUBLIC_FEEDBACK_MAX: "2",
      RATE_LIMIT_WHATSAPP_MAX: "1",
      RATE_LIMIT_WINDOW_MS: "60000",
      TRUSTED_PROXY_IPS: "",
    },
  });
});

after(async () => {
  await Promise.all([authServer?.stop(), rateServer?.stop()]);
});

test("therapist cannot update another therapist appointment or CRM task and cannot bootstrap unrelated CRM events", async () => {
  const { client: admin, response: adminLogin } = await loginAs(authServer.baseUrl, "admin");
  assert.equal(adminLogin.status, 200);
  const bootstrap = await admin.get("/api/bootstrap");
  const sara = bootstrap.body.users.find((user) => user.username === "sara");
  const lina = bootstrap.body.users.find((user) => user.username === "lina");
  const service = bootstrap.body.services[0];
  assert.ok(sara && lina && service);

  const clientResponse = await admin.post("/api/clients", {
    body: {
      fname: "Restricted",
      lname: "Patient",
      phone: "0507770101",
      therapistId: lina.id,
    },
  });
  assert.equal(clientResponse.status, 201);
  const clientId = clientResponse.body.id;

  const appointmentBody = {
    clientId,
    serviceId: service.id,
    therapistId: lina.id,
    date: "2037-04-10",
    time: "10:00",
    status: "pending",
  };
  const appointment = await admin.post("/api/appointments", { body: appointmentBody });
  assert.equal(appointment.status, 201);

  const task = await admin.post("/api/crm-tasks", {
    body: {
      clientId,
      assignedTo: lina.id,
      title: "Private Lina follow up",
      dueDate: "2037-04-11",
      priority: "normal",
      status: "open",
      notes: "Not visible to Sara",
    },
  });
  assert.equal(task.status, 201);

  const { client: therapistA, response: therapistLogin } = await loginAs(authServer.baseUrl, "sara");
  assert.equal(therapistLogin.status, 200);

  const appointmentUpdate = await therapistA.put(`/api/appointments/${appointment.body.id}`, {
    body: { ...appointmentBody, therapistId: sara.id, time: "10:30" },
  });
  assert.equal(appointmentUpdate.status, 404);
  assert.deepEqual(appointmentUpdate.body, { error: "Appointment not found." });

  const taskUpdate = await therapistA.put(`/api/crm-tasks/${task.body.id}`, {
    body: {
      assignedTo: sara.id,
      title: "Unauthorized edit",
      dueDate: "2037-04-12",
      priority: "normal",
      status: "done",
      notes: "",
    },
  });
  assert.equal(taskUpdate.status, 404);
  assert.deepEqual(taskUpdate.body, { error: "Task not found." });

  const therapistBootstrap = await therapistA.get("/api/bootstrap");
  assert.equal(therapistBootstrap.status, 200);
  assert.equal(therapistBootstrap.body.crmTasks.some((row) => Number(row.id) === Number(task.body.id)), false);
  assert.equal(therapistBootstrap.body.crmEvents.some((row) => Number(row.clientId) === Number(clientId)), false);
});

test("route rate limits block repeated requests and ignore spoofed forwarded IP by default", async () => {
  const anonymous = createHttpClient(rateServer.baseUrl);
  for (const forwardedFor of ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4", "198.51.100.5"]) {
    const response = await anonymous.post("/api/login", {
      headers: { "x-forwarded-for": forwardedFor },
      body: { username: "rate-limit-user", password: "wrong-password" },
    });
    assert.equal(response.status, 401);
  }
  const blockedLogin = await anonymous.post("/api/login", {
    headers: { "x-forwarded-for": "198.51.100.6" },
    body: { username: "rate-limit-user", password: "wrong-password" },
  });
  assert.equal(blockedLogin.status, 429);
  assert.equal(typeof blockedLogin.body.error, "string");
  assert.ok(blockedLogin.body.error.length > 0);

  assert.equal((await anonymous.post("/api/public/feedback/missing-one", { body: { rating: 5, comment: "" } })).status, 404);
  assert.equal((await anonymous.post("/api/public/feedback/missing-two", { body: { rating: 5, comment: "" } })).status, 404);
  const blockedFeedback = await anonymous.post("/api/public/feedback/missing-three", { body: { rating: 5, comment: "" } });
  assert.equal(blockedFeedback.status, 429);

  const { client: admin, response: adminLogin } = await loginAs(rateServer.baseUrl, "admin");
  assert.equal(adminLogin.status, 200);
  assert.equal((await admin.post("/api/appointments/999999/whatsapp")).status, 404);
  assert.equal((await admin.post("/api/appointments/999999/whatsapp")).status, 429);
});

test("admin password update and platform owner reset revoke target user sessions", async () => {
  const { client: admin, response: adminLogin } = await loginAs(authServer.baseUrl, "admin");
  assert.equal(adminLogin.status, 200);
  const usersResponse = await admin.get("/api/users");
  const reception = usersResponse.body.find((user) => user.username === "reception");
  assert.ok(reception);

  const { client: receptionSession, response: receptionLogin } = await loginAs(authServer.baseUrl, "reception");
  assert.equal(receptionLogin.status, 200);
  const temporaryReceptionPassword = "ReceptionReset123!";
  const receptionReset = await admin.put(`/api/users/${reception.id}`, {
    body: {
      username: reception.username,
      email: reception.email || "",
      name: reception.name,
      title: reception.title || "",
      role: reception.role,
      workdays: reception.workdays || [],
      serviceIds: reception.serviceIds || [],
      active: true,
      password: temporaryReceptionPassword,
    },
  });
  assert.equal(receptionReset.status, 200);
  assert.equal((await receptionSession.get("/api/bootstrap")).status, 401);

  const restoreReception = await admin.put(`/api/users/${reception.id}`, {
    body: {
      username: reception.username,
      email: reception.email || "",
      name: reception.name,
      title: reception.title || "",
      role: reception.role,
      workdays: reception.workdays || [],
      serviceIds: reception.serviceIds || [],
      active: true,
      password: "ChangeMe123!",
    },
  });
  assert.equal(restoreReception.status, 200);

  const { client: adminSession, response: secondAdminLogin } = await loginAs(authServer.baseUrl, "admin");
  assert.equal(secondAdminLogin.status, 200);
  const { client: owner, response: ownerLogin } = await loginAs(authServer.baseUrl, "owner");
  assert.equal(ownerLogin.status, 200);
  const temporaryAdminPassword = "AdminReset123!";
  const platformReset = await owner.post("/api/platform/tenants/1/reset-password", {
    body: { password: temporaryAdminPassword },
  });
  assert.equal(platformReset.status, 200);
  assert.equal((await adminSession.get("/api/bootstrap")).status, 401);

  const restoreAdmin = await owner.post("/api/platform/tenants/1/reset-password", {
    body: { password: "ChangeMe123!" },
  });
  assert.equal(restoreAdmin.status, 200);
});
