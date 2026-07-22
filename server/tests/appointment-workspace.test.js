import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let testServer;

before(async () => {
  testServer = await startTestServer({ envOverrides: { NODE_ENV: "development" } });
});

after(async () => {
  await testServer?.stop();
});

test("appointment workspace endpoints enforce auth, roles, tenant scope, and queue semantics", async () => {
  const date = "2035-09-12";
  const anonymous = createHttpClient(testServer.baseUrl);
  assert.equal((await anonymous.get("/api/appointments")).status, 401);
  assert.equal((await anonymous.get(`/api/appointments/queue?date=${date}`)).status, 401);

  const { client: platformOwner, response: ownerLogin } = await loginAs(testServer.baseUrl, "owner");
  assert.equal(ownerLogin.status, 200);
  assert.equal(ownerLogin.body.user.platformOwner, true);
  assert.equal((await platformOwner.get("/api/appointments")).status, 403);
  assert.equal((await platformOwner.get(`/api/appointments/queue?date=${date}`)).status, 403);

  const { client: tenantA, response: tenantALogin } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(tenantALogin.status, 200);
  const bootstrap = await tenantA.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  assert.ok(therapist?.id);

  const category = await tenantA.post("/api/categories", { body: { name: `Workspace category ${Date.now()}` } });
  assert.equal(category.status, 201);
  const service = await tenantA.post("/api/services", {
    body: { name: "Workspace consultation", categoryId: category.body.id, duration: 45, price: 240, active: true },
  });
  assert.equal(service.status, 201);
  const patient = await tenantA.post("/api/clients", {
    body: { fname: "Workspace", lname: "Patient", phone: "0509990101", therapistId: therapist.id, notes: "Tenant A patient" },
  });
  assert.equal(patient.status, 201);

  const pending = await tenantA.post("/api/appointments", {
    body: { clientId: patient.body.id, serviceId: service.body.id, therapistId: therapist.id, date, time: "09:00", status: "pending", notes: "Read-only details" },
  });
  assert.equal(pending.status, 201);
  const cancelled = await tenantA.post("/api/appointments", {
    body: { clientId: patient.body.id, serviceId: service.body.id, therapistId: therapist.id, date, time: "11:00", status: "cancelled" },
  });
  assert.equal(cancelled.status, 201);

  const list = await tenantA.get("/api/appointments");
  assert.equal(list.status, 200);
  assert.ok(list.body.some((item) => item.id === pending.body.id && item.duration === 45));

  const detail = await tenantA.get(`/api/appointments/${pending.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.clientName, "Workspace Patient");
  assert.equal(detail.body.serviceName, "Workspace consultation");
  assert.equal(detail.body.therapistId, therapist.id);
  assert.equal(detail.body.notes, "Read-only details");

  const queue = await tenantA.get(`/api/appointments/queue?date=${date}`);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.date, date);
  assert.ok(queue.body.items.some((item) => item.id === pending.body.id));
  assert.equal(queue.body.items.some((item) => item.id === cancelled.body.id), false);
  assert.equal((await tenantA.get("/api/appointments/queue?date=not-a-date")).status, 400);

  const suffix = Date.now().toString(36);
  const tenantBEmail = `workspace-b-${suffix}@example.test`;
  const tenantBPassword = "WorkspaceTenantB123!";
  const tenantBSlug = `workspace-b-${suffix}`;
  const provision = await platformOwner.post("/api/platform/tenants", {
    body: {
      clinicName: `Workspace Tenant B ${suffix}`,
      slug: tenantBSlug,
      ownerName: "Workspace Tenant B Admin",
      email: tenantBEmail,
      password: tenantBPassword,
      plan: "starter",
      status: "active",
    },
  });
  assert.equal(provision.status, 201);
  const { client: tenantB, response: tenantBLogin } = await loginAs(testServer.baseUrl, tenantBEmail, tenantBPassword, tenantBSlug);
  assert.equal(tenantBLogin.status, 200);
  assert.equal((await tenantB.get(`/api/appointments/${pending.body.id}`)).status, 404);
  const tenantBQueue = await tenantB.get(`/api/appointments/queue?date=${date}`);
  assert.equal(tenantBQueue.status, 200);
  assert.equal(tenantBQueue.body.items.some((item) => item.id === pending.body.id), false);

  const { client: therapistClient, response: therapistLogin } = await loginAs(testServer.baseUrl, "sara");
  assert.equal(therapistLogin.status, 200);
  assert.equal((await therapistClient.get(`/api/appointments/${pending.body.id}`)).status, 200);
  assert.ok((await therapistClient.get(`/api/appointments/queue?date=${date}`)).body.items.every((item) => item.therapistId === therapist.id));
});
