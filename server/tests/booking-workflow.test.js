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

test("end-to-end booking workflow enforces conflicts, roles, tenant scope, queue, and timeline", async () => {
  const date = "2038-04-10";
  const anonymous = createHttpClient(testServer.baseUrl);
  assert.equal((await anonymous.post("/api/appointments", { body: {} })).status, 401);

  const { client: owner } = await loginAs(testServer.baseUrl, "owner");
  assert.equal((await owner.post("/api/appointments", { body: {} })).status, 403);

  const { client: admin } = await loginAs(testServer.baseUrl, "admin");
  const bootstrap = await admin.get("/api/bootstrap");
  const sara = bootstrap.body.users.find((user) => user.username === "sara");
  const lina = bootstrap.body.users.find((user) => user.username === "lina");
  const adminUser = bootstrap.body.users.find((user) => user.username === "admin");
  assert.ok(sara?.id && lina?.id && adminUser?.id);

  const suffix = Date.now().toString(36);
  const categoryA = await admin.post("/api/categories", { body: { name: `Booking A ${suffix}` } });
  const categoryB = await admin.post("/api/categories", { body: { name: `Booking B ${suffix}` } });
  const serviceA = await admin.post("/api/services", { body: { name: "Booking consultation", categoryId: categoryA.body.id, duration: 45, price: 200, active: true } });
  const serviceB = await admin.post("/api/services", { body: { name: "Booking follow-up", categoryId: categoryB.body.id, duration: 30, price: 100, active: true } });

  const { client: reception } = await loginAs(testServer.baseUrl, "reception");
  const phone = `052${String(Date.now()).slice(-7)}`;
  const email = `booking-${suffix}@example.test`;
  const patient = await reception.post("/api/clients", {
    body: { fname: "Booking", lname: "Patient", phone, email, therapistId: sara.id },
  });
  assert.equal(patient.status, 201);
  const duplicatePhone = await reception.post("/api/clients", {
    body: { fname: "Duplicate", lname: "Phone", phone, email: `other-${suffix}@example.test`, therapistId: sara.id },
  });
  assert.equal(duplicatePhone.status, 409);
  assert.equal(duplicatePhone.body.code, "CLIENT_DUPLICATE");
  const duplicateEmail = await reception.post("/api/clients", {
    body: { fname: "Duplicate", lname: "Email", phone: `053${String(Date.now()).slice(-7)}`, email: email.toUpperCase(), therapistId: sara.id },
  });
  assert.equal(duplicateEmail.status, 409);

  const appointmentBody = {
    clientId: patient.body.id,
    serviceId: serviceA.body.id,
    therapistId: sara.id,
    date,
    time: "09:00",
    status: "pending",
    notes: "Reception booking",
  };
  const appointment = await reception.post("/api/appointments", { body: appointmentBody });
  assert.equal(appointment.status, 201);

  const calendar = await reception.get("/api/appointments");
  assert.ok(calendar.body.some((item) => item.id === appointment.body.id && item.date === date));
  const queueBefore = await reception.get(`/api/appointments/queue?date=${date}`);
  assert.ok(queueBefore.body.items.some((item) => item.id === appointment.body.id));

  const duplicateCategory = await reception.post("/api/appointments", {
    body: { ...appointmentBody, time: "09:15", therapistId: lina.id },
  });
  assert.equal(duplicateCategory.status, 409);
  assert.equal(duplicateCategory.body.error, "appointment_category_conflict");
  const therapistConflict = await reception.post("/api/appointments", {
    body: { ...appointmentBody, serviceId: serviceB.body.id, time: "09:15" },
  });
  assert.equal(therapistConflict.status, 409);
  assert.equal(therapistConflict.body.error, "appointment_therapist_conflict");

  assert.equal((await reception.post("/api/appointments", { body: { ...appointmentBody, therapistId: adminUser.id, time: "12:00" } })).status, 404);
  assert.equal((await reception.post("/api/appointments", { body: { ...appointmentBody, clientId: 999999, time: "12:00" } })).status, 404);
  assert.equal((await reception.post("/api/appointments", { body: { ...appointmentBody, serviceId: 999999, time: "12:00" } })).status, 404);

  const beforeStatusTimeline = await reception.get(`/api/clients/${patient.body.id}/history`);
  assert.ok(beforeStatusTimeline.body.timeline.some((event) => event.type === "client_created"));
  assert.ok(beforeStatusTimeline.body.timeline.some((event) => event.type === "appointment_created" && event.related?.appointmentId === appointment.body.id));

  const { client: therapist } = await loginAs(testServer.baseUrl, "sara");
  const changed = await therapist.patch(`/api/appointments/${appointment.body.id}/status`, { body: { status: "done" } });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.status, "done");
  assert.equal((await therapist.patch(`/api/appointments/${appointment.body.id}/status`, { body: { status: "invalid" } })).status, 400);

  const queueAfter = await reception.get(`/api/appointments/queue?date=${date}`);
  assert.equal(queueAfter.body.items.some((item) => item.id === appointment.body.id), false);
  const afterStatusTimeline = await reception.get(`/api/clients/${patient.body.id}/history`);
  assert.ok(afterStatusTimeline.body.timeline.some((event) => event.type === "appointment_status_changed"
    && event.description === "pending -> done"
    && event.related?.appointmentId === appointment.body.id));

  const otherPatient = await reception.post("/api/clients", {
    body: { fname: "Lina", lname: "Only", phone: `054${String(Date.now()).slice(-7)}`, therapistId: lina.id },
  });
  assert.equal(otherPatient.status, 201);
  const linaAppointment = await reception.post("/api/appointments", {
    body: { clientId: otherPatient.body.id, serviceId: serviceB.body.id, therapistId: lina.id, date, time: "13:00", status: "pending" },
  });
  assert.equal(linaAppointment.status, 201);
  assert.equal((await therapist.patch(`/api/appointments/${linaAppointment.body.id}/status`, { body: { status: "cancelled" } })).status, 404);
  assert.equal((await therapist.post("/api/appointments", {
    body: { clientId: otherPatient.body.id, serviceId: serviceB.body.id, therapistId: sara.id, date, time: "14:00", status: "pending" },
  })).status, 404);

  const tenantSlug = `booking-b-${suffix}`;
  const tenantEmail = `booking-b-${suffix}@example.test`;
  const tenantPassword = "BookingTenantB123!";
  const provision = await owner.post("/api/platform/tenants", {
    body: { clinicName: `Booking B ${suffix}`, slug: tenantSlug, ownerName: "Tenant B", email: tenantEmail, password: tenantPassword, plan: "starter", status: "active" },
  });
  assert.equal(provision.status, 201);
  const { client: tenantB } = await loginAs(testServer.baseUrl, tenantEmail, tenantPassword, tenantSlug);
  assert.equal((await tenantB.get(`/api/appointments/${appointment.body.id}`)).status, 404);
  assert.equal((await tenantB.patch(`/api/appointments/${appointment.body.id}/status`, { body: { status: "cancelled" } })).status, 404);
  assert.equal((await tenantB.post("/api/appointments", { body: { ...appointmentBody, time: "15:00" } })).status, 404);
});
