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

test("patient workspace enforces access, scope, filters, timeline, and sensitive fields", async () => {
  const anonymous = createHttpClient(testServer.baseUrl);
  assert.equal((await anonymous.get("/api/clients/workspace")).status, 401);
  const { client: owner } = await loginAs(testServer.baseUrl, "owner");
  assert.equal((await owner.get("/api/clients/workspace")).status, 403);

  const { client: admin } = await loginAs(testServer.baseUrl, "admin");
  const bootstrap = await admin.get("/api/bootstrap");
  const sara = bootstrap.body.users.find((user) => user.username === "sara");
  const lina = bootstrap.body.users.find((user) => user.username === "lina");
  assert.ok(sara?.id && lina?.id);

  const suffix = Date.now().toString(36);
  const category = await admin.post("/api/categories", { body: { name: `Patient workspace ${suffix}` } });
  const service = await admin.post("/api/services", { body: { name: "Workspace consultation", categoryId: category.body.id, duration: 45, price: 250, active: true } });
  const assigned = await admin.post("/api/clients", { body: { fname: `Search${suffix}`, lname: "Assigned", phone: `050${String(Date.now()).slice(-7)}`, email: `assigned-${suffix}@example.test`, therapistId: sara.id, stage: "active", notes: "Restricted clinical note" } });
  const other = await admin.post("/api/clients", { body: { fname: `Other${suffix}`, lname: "Patient", phone: "0507771212", therapistId: lina.id, stage: "lead", notes: "Other clinical note" } });
  assert.equal(assigned.status, 201);
  assert.equal(other.status, 201);

  const appointment = await admin.post("/api/appointments", { body: { clientId: assigned.body.id, serviceId: service.body.id, therapistId: sara.id, date: "2035-09-12", time: "09:00", status: "pending", paymentStatus: "paid", paidAmount: 125, notes: "Restricted appointment note" } });
  assert.equal(appointment.status, 201);
  assert.equal((await admin.post(`/api/clients/${assigned.body.id}/notes`, { body: { note: "Restricted timeline note" } })).status, 201);

  const search = await admin.get(`/api/clients/workspace?q=${suffix}&status=active&therapistId=${sara.id}&upcoming=yes&page=1&pageSize=1`);
  assert.equal(search.status, 200);
  assert.equal(search.body.total, 1);
  assert.equal(search.body.items[0].id, assigned.body.id);
  assert.equal(search.body.items[0].nextAppointmentDate, "2035-09-12");
  assert.equal(search.body.pageSize, 1);

  const empty = await admin.get(`/api/clients/workspace?q=missing-${suffix}`);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.items, []);
  assert.equal(empty.body.total, 0);
  assert.equal((await admin.get("/api/clients/workspace?status=invalid")).status, 400);
  assert.equal((await admin.get("/api/clients/999999/history")).status, 404);

  const adminProfile = await admin.get(`/api/clients/${assigned.body.id}/history`);
  assert.equal(adminProfile.status, 200);
  assert.equal(adminProfile.body.patient.name, `Search${suffix} Assigned`);
  assert.equal(adminProfile.body.patient.notes, "Restricted clinical note");
  assert.equal(adminProfile.body.upcomingAppointment.id, appointment.body.id);
  assert.ok(adminProfile.body.timeline.some((event) => event.type === "client_created"));
  assert.ok(adminProfile.body.timeline.some((event) => event.type === "clinical_note"));
  assert.ok(adminProfile.body.timeline.some((event) => event.related?.appointmentId === appointment.body.id && event.financial?.paidAmount === 125));

  const { client: therapist } = await loginAs(testServer.baseUrl, "sara");
  const therapistList = await therapist.get("/api/clients/workspace");
  assert.equal(therapistList.status, 200);
  assert.ok(therapistList.body.items.some((item) => item.id === assigned.body.id));
  assert.equal(therapistList.body.items.some((item) => item.id === other.body.id), false);
  assert.equal((await therapist.get(`/api/clients/${other.body.id}/history`)).status, 404);
  const therapistProfile = await therapist.get(`/api/clients/${assigned.body.id}/history`);
  assert.equal(therapistProfile.status, 200);
  assert.equal(therapistProfile.body.patient.notes, "Restricted clinical note");
  assert.equal(Object.hasOwn(therapistProfile.body.appointments[0], "paymentStatus"), false);
  assert.ok(therapistProfile.body.timeline.every((event) => !event.financial));
  const therapistBootstrap = await therapist.get("/api/bootstrap");
  assert.equal(Object.hasOwn(therapistBootstrap.body.appointments.find((item) => item.id === appointment.body.id), "paymentStatus"), false);

  const { client: reception } = await loginAs(testServer.baseUrl, "reception");
  const receptionProfile = await reception.get(`/api/clients/${assigned.body.id}/history`);
  assert.equal(receptionProfile.status, 200);
  assert.equal(Object.hasOwn(receptionProfile.body.patient, "notes"), false);
  assert.equal(receptionProfile.body.timeline.some((event) => event.type === "clinical_note"), false);
  assert.equal(receptionProfile.body.appointments[0].paymentStatus, "paid");
  assert.equal((await reception.post(`/api/clients/${assigned.body.id}/notes`, { body: { note: "Reception must not write clinical notes" } })).status, 403);
  const receptionBootstrap = await reception.get("/api/bootstrap");
  assert.equal(Object.hasOwn(receptionBootstrap.body.clients.find((item) => item.id === assigned.body.id), "notes"), false);
  assert.equal(Object.hasOwn(receptionBootstrap.body.appointments.find((item) => item.id === appointment.body.id), "notes"), false);

  const tenantSlug = `patient-b-${suffix}`;
  const tenantEmail = `patient-b-${suffix}@example.test`;
  const tenantPassword = "PatientTenantB123!";
  const provision = await owner.post("/api/platform/tenants", { body: { clinicName: `Patient B ${suffix}`, slug: tenantSlug, ownerName: "Patient B Admin", email: tenantEmail, password: tenantPassword, plan: "starter", status: "active" } });
  assert.equal(provision.status, 201);
  const { client: tenantB } = await loginAs(testServer.baseUrl, tenantEmail, tenantPassword, tenantSlug);
  assert.equal((await tenantB.get(`/api/clients/${assigned.body.id}/history`)).status, 404);
  const tenantBList = await tenantB.get(`/api/clients/workspace?q=${suffix}`);
  assert.equal(tenantBList.status, 200);
  assert.equal(tenantBList.body.total, 0);
});
