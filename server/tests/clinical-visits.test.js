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

test("clinical visit workflow persists drafts, enforces RBAC and tenant scope, and updates timeline", async () => {
  const anonymous = createHttpClient(testServer.baseUrl);
  assert.equal((await anonymous.get("/api/clinical-visits/appointment/1")).status, 401);

  const { client: owner } = await loginAs(testServer.baseUrl, "owner");
  assert.equal((await owner.get("/api/clinical-visits/appointment/1")).status, 403);

  const { client: admin } = await loginAs(testServer.baseUrl, "admin");
  const bootstrap = await admin.get("/api/bootstrap");
  const sara = bootstrap.body.users.find((user) => user.username === "sara");
  const lina = bootstrap.body.users.find((user) => user.username === "lina");
  assert.ok(sara?.id && lina?.id);

  const suffix = Date.now().toString(36);
  const category = await admin.post("/api/categories", { body: { name: `Clinical ${suffix}` } });
  const service = await admin.post("/api/services", {
    body: { name: `Clinical service ${suffix}`, categoryId: category.body.id, duration: 45, price: 250, active: true },
  });
  assert.equal(service.status, 201);

  const { client: reception } = await loginAs(testServer.baseUrl, "reception");
  const patient = await reception.post("/api/clients", {
    body: {
      fname: "Clinical",
      lname: "Patient",
      phone: `055${String(Date.now()).slice(-7)}`,
      email: `clinical-${suffix}@example.test`,
      therapistId: sara.id,
    },
  });
  assert.equal(patient.status, 201);
  const appointment = await reception.post("/api/appointments", {
    body: {
      clientId: patient.body.id,
      serviceId: service.body.id,
      therapistId: sara.id,
      date: "2038-07-14",
      time: "10:00",
      status: "pending",
    },
  });
  assert.equal(appointment.status, 201);

  assert.equal((await reception.post("/api/clinical-visits", {
    body: { appointmentId: appointment.body.id, treatmentSummary: "Unauthorized reception content" },
  })).status, 403);

  const { client: therapist } = await loginAs(testServer.baseUrl, "sara");
  assert.equal((await therapist.post("/api/clinical-visits", {
    body: { appointmentId: appointment.body.id },
  })).status, 400);

  const created = await therapist.post("/api/clinical-visits", {
    body: {
      appointmentId: appointment.body.id,
      patientId: 999999,
      therapistId: lina.id,
      serviceId: 999999,
      treatmentSummary: "Mobility treatment",
      clinicalObservations: "Range improved",
      recommendations: "Continue exercises",
      followUpInstructions: "Review in two weeks",
      internalNotes: "Private therapist note",
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.patientId, patient.body.id);
  assert.equal(created.body.therapistId, sara.id);
  assert.equal(created.body.serviceId, service.body.id);
  assert.equal(created.body.status, "draft");

  const duplicate = await therapist.post("/api/clinical-visits", {
    body: { appointmentId: appointment.body.id, treatmentSummary: "Duplicate" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "CLINICAL_VISIT_EXISTS");

  const receptionView = await reception.get(`/api/clinical-visits/appointment/${appointment.body.id}`);
  assert.equal(receptionView.status, 200);
  assert.equal(receptionView.body.visit.id, created.body.id);
  assert.equal("treatmentSummary" in receptionView.body.visit, false);
  assert.equal("internalNotes" in receptionView.body.visit, false);
  assert.equal(receptionView.body.capabilities.write, false);
  assert.equal((await reception.put(`/api/clinical-visits/${created.body.id}`, {
    body: { treatmentSummary: "Forbidden" },
  })).status, 403);

  const { client: otherTherapist } = await loginAs(testServer.baseUrl, "lina");
  assert.equal((await otherTherapist.get(`/api/clinical-visits/appointment/${appointment.body.id}`)).status, 404);
  assert.equal((await otherTherapist.put(`/api/clinical-visits/${created.body.id}`, {
    body: { treatmentSummary: "Forbidden cross-therapist update" },
  })).status, 404);

  const updated = await therapist.put(`/api/clinical-visits/${created.body.id}`, {
    body: {
      treatmentSummary: "Mobility treatment updated",
      clinicalObservations: "Range improved again",
      recommendations: "Continue exercises",
      followUpInstructions: "Review in ten days",
      internalNotes: "Updated private note",
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.treatmentSummary, "Mobility treatment updated");

  const beforeCompleteAppointment = await therapist.get(`/api/appointments/${appointment.body.id}`);
  assert.equal(beforeCompleteAppointment.body.status, "pending");
  const completed = await therapist.post(`/api/clinical-visits/${created.body.id}/complete`);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  const afterCompleteAppointment = await therapist.get(`/api/appointments/${appointment.body.id}`);
  assert.equal(afterCompleteAppointment.body.status, "pending");

  const therapistProfile = await therapist.get(`/api/clients/${patient.body.id}/history`);
  assert.equal(therapistProfile.status, 200);
  assert.equal(therapistProfile.body.clinicalVisits[0].treatmentSummary, "Mobility treatment updated");
  assert.ok(therapistProfile.body.timeline.some((event) => event.type === "clinical_visit_started"));
  assert.ok(therapistProfile.body.timeline.some((event) => event.type === "clinical_visit_updated"));
  assert.ok(therapistProfile.body.timeline.some((event) => event.type === "clinical_visit_completed"));
  assert.equal(therapistProfile.body.timeline.some((event) => String(event.description).includes("Mobility treatment")), false);

  const receptionProfile = await reception.get(`/api/clients/${patient.body.id}/history`);
  assert.equal(receptionProfile.body.clinicalVisits.length, 1);
  assert.equal("treatmentSummary" in receptionProfile.body.clinicalVisits[0], false);
  assert.equal(receptionProfile.body.capabilities.clinicalVisits, false);

  const audit = await admin.get("/api/audit");
  const visitActions = audit.body.filter((entry) => entry.entity === "clinical_visits" && entry.entityId === created.body.id);
  assert.ok(visitActions.some((entry) => entry.action === "create"));
  assert.ok(visitActions.some((entry) => entry.action === "update"));
  assert.ok(visitActions.some((entry) => entry.action === "complete"));
  assert.equal(visitActions.some((entry) => JSON.stringify(entry.details).includes("Mobility treatment")), false);

  const tenantSlug = `clinical-b-${suffix}`;
  const tenantEmail = `clinical-b-${suffix}@example.test`;
  const tenantPassword = "ClinicalTenantB123!";
  const provision = await owner.post("/api/platform/tenants", {
    body: { clinicName: `Clinical B ${suffix}`, slug: tenantSlug, ownerName: "Tenant B", email: tenantEmail, password: tenantPassword, plan: "starter", status: "active" },
  });
  assert.equal(provision.status, 201);
  const { client: tenantB } = await loginAs(testServer.baseUrl, tenantEmail, tenantPassword, tenantSlug);
  assert.equal((await tenantB.get(`/api/clinical-visits/appointment/${appointment.body.id}`)).status, 404);
  assert.equal((await tenantB.put(`/api/clinical-visits/${created.body.id}`, {
    body: { treatmentSummary: "Cross tenant" },
  })).status, 404);
  assert.equal((await tenantB.post(`/api/clinical-visits/${created.body.id}/complete`)).status, 404);
});
