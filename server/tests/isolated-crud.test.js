import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let clinicServer;
let platformServer;

before(async () => {
  [clinicServer, platformServer] = await Promise.all([
    startTestServer(),
    startTestServer({ initializationRuns: 2 }),
  ]);
});

after(async () => {
  await Promise.all([clinicServer?.stop(), platformServer?.stop()]);
});

test("clinic CRUD workflow uses disposable records and archives supported records", async () => {
  const suffix = Date.now().toString(36);
  const { client, response: login } = await loginAs(clinicServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  assert.ok(therapist?.id);

  const categoryName = `SAFE_STEP_101_CATEGORY_${suffix}`;
  const categoryCreate = await client.post("/api/categories", { body: { name: categoryName } });
  assert.equal(categoryCreate.status, 201);
  const categoryId = categoryCreate.body.id;

  const categoryUpdate = await client.put(`/api/categories/${categoryId}`, {
    body: { name: `${categoryName}_UPDATED` },
  });
  assert.equal(categoryUpdate.status, 200);
  assert.ok((await client.get("/api/categories")).body.some((item) => item.id === categoryId));

  const serviceName = `SAFE_STEP_101_SERVICE_${suffix}`;
  const serviceCreate = await client.post("/api/services", {
    body: { name: serviceName, categoryId: String(categoryId), duration: "45", price: "101", active: true },
  });
  assert.equal(serviceCreate.status, 201);
  const serviceId = serviceCreate.body.id;

  const serviceUpdate = await client.put(`/api/services/${serviceId}`, {
    body: { name: `${serviceName}_UPDATED`, categoryId, duration: 60, price: 202, active: true },
  });
  assert.equal(serviceUpdate.status, 200);
  assert.ok((await client.get("/api/services")).body.some((item) => item.id === serviceId && item.price === 202));

  const clientCreate = await client.post("/api/clients", {
    body: {
      fname: "Safe",
      lname: `Client ${suffix}`,
      phone: "0500000101",
      email: `safe-step-101-${suffix}@example.test`,
      therapistId: therapist.id,
      stage: "lead",
      source: "automated-test",
      tags: ["safe-step-101"],
      notes: "Disposable isolated CRUD test client",
    },
  });
  assert.equal(clientCreate.status, 201);
  const clientId = clientCreate.body.id;

  const clientUpdate = await client.put(`/api/clients/${clientId}`, {
    body: {
      fname: "Safe",
      lname: `Client Updated ${suffix}`,
      phone: "0500000101",
      email: `safe-step-101-${suffix}@example.test`,
      therapistId: therapist.id,
      stage: "contacted",
      source: "automated-test",
      tags: ["safe-step-101", "updated"],
      notes: "Updated disposable client",
    },
  });
  assert.equal(clientUpdate.status, 200);
  assert.ok((await client.get("/api/clients")).body.some((item) => item.id === clientId && item.stage === "contacted"));

  const followUpUpdate = await client.put(`/api/clients/${clientId}`, {
    body: {
      fname: "Safe",
      lname: `Client Updated ${suffix}`,
      phone: "0500000101",
      email: `safe-step-101-${suffix}@example.test`,
      therapistId: therapist.id,
      stage: "follow_up",
      source: "automated-test",
      tags: ["safe-step-101", "updated"],
      notes: "Updated disposable client",
    },
  });
  assert.equal(followUpUpdate.status, 200);
  assert.ok((await client.get("/api/clients")).body.some((item) => item.id === clientId && item.stage === "follow_up"));

  const invalidStage = await client.put(`/api/clients/${clientId}`, {
    body: {
      fname: "Safe",
      lname: `Client Updated ${suffix}`,
      phone: "0500000101",
      email: `safe-step-101-${suffix}@example.test`,
      therapistId: therapist.id,
      stage: "not-a-stage",
      source: "automated-test",
      tags: ["safe-step-101", "updated"],
      notes: "Updated disposable client",
    },
  });
  assert.equal(invalidStage.status, 400);
  assert.equal(invalidStage.body.error, "Valid client stage is required.");

  const noteOne = await client.post(`/api/clients/${clientId}/notes`, { body: { note: `First CRM note ${suffix}` } });
  assert.equal(noteOne.status, 201);
  const noteTwo = await client.post(`/api/clients/${clientId}/notes`, { body: { note: `Latest CRM note ${suffix}` } });
  assert.equal(noteTwo.status, 201);
  const noteHistory = await client.get(`/api/clients/${clientId}/history`);
  assert.equal(noteHistory.status, 200);
  assert.ok(noteHistory.body.crmEvents.some((event) => event.description === `Latest CRM note ${suffix}`));
  assert.equal(noteHistory.body.crmEvents[0].description, `Latest CRM note ${suffix}`);

  const { client: therapistHttp, response: therapistLogin } = await loginAs(clinicServer.baseUrl, "sara");
  assert.equal(therapistLogin.status, 200);
  const therapistNote = await therapistHttp.post(`/api/clients/${clientId}/notes`, { body: { note: "Therapist should not write direct client notes" } });
  assert.equal(therapistNote.status, 403);

  const appointmentBody = {
    clientId: String(clientId),
    serviceId: String(serviceId),
    therapistId: String(therapist.id),
    date: "2031-01-15",
    time: "10:00",
    status: "pending",
    paymentStatus: "deposit",
    paidAmount: "50",
    notes: "Disposable isolated appointment",
  };
  const appointmentCreate = await client.post("/api/appointments", { body: appointmentBody });
  assert.equal(appointmentCreate.status, 201);
  const appointmentId = appointmentCreate.body.id;

  const conflict = await client.post("/api/appointments", {
    body: { ...appointmentBody, time: "10:30" },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, "appointment_category_conflict");

  const appointmentUpdate = await client.put(`/api/appointments/${appointmentId}`, {
    body: { ...appointmentBody, time: "12:00", notes: "Updated disposable appointment" },
  });
  assert.equal(appointmentUpdate.status, 200);
  assert.ok((await client.get("/api/appointments")).body.some((item) => item.id === appointmentId && item.time === "12:00"));

  const giftCreate = await client.post("/api/gifts", {
    body: {
      fromClientId: clientId,
      toClientId: clientId,
      serviceId,
      sessions: "2",
      message: "Disposable isolated gift",
    },
  });
  assert.equal(giftCreate.status, 201);
  const giftId = giftCreate.body.id;
  assert.ok((await client.get("/api/gifts")).body.some((item) => item.id === giftId));
  assert.equal((await client.put(`/api/gifts/${giftId}`, { body: { status: "cancelled" } })).status, 200);
  assert.ok((await client.get("/api/gifts")).body.some((item) => item.id === giftId && item.status === "cancelled"));

  const taskCreate = await client.post("/api/crm-tasks", {
    body: {
      clientId,
      assignedTo: therapist.id,
      type: "follow_up",
      title: `SAFE_STEP_101_TASK_${suffix}`,
      dueDate: "2031-01-20",
      priority: "normal",
      notes: "Disposable isolated task",
    },
  });
  assert.equal(taskCreate.status, 201);
  const taskId = taskCreate.body.id;
  assert.ok((await client.get("/api/crm-tasks")).body.some((item) => item.id === taskId));
  assert.equal((await client.put(`/api/crm-tasks/${taskId}`, {
    body: { title: `SAFE_STEP_101_TASK_UPDATED_${suffix}`, status: "cancelled", assignedTo: therapist.id },
  })).status, 200);
  assert.ok((await client.get("/api/crm-tasks")).body.some((item) => item.id === taskId && item.status === "cancelled"));

  const invitationCreate = await client.post("/api/invitations", {
    body: {
      email: `safe-step-101-${suffix}@example.test`,
      name: "Safe Step Invitation",
      role: "reception",
    },
  });
  assert.equal(invitationCreate.status, 201);
  const invitationId = invitationCreate.body.id;
  const invitationToken = invitationCreate.body.token;
  assert.equal((await client.get(`/api/invitations/${invitationToken}`)).status, 200);
  assert.equal((await client.delete(`/api/invitations/${invitationId}`)).status, 200);

  const feedbackCreate = await client.post("/api/feedback", {
    body: { appointmentId },
  });
  assert.equal(feedbackCreate.status, 201);
  assert.equal(feedbackCreate.body.ok, false);
  assert.equal(feedbackCreate.body.configured, false);
  const feedbackRows = await client.get("/api/feedback");
  const feedback = feedbackRows.body.find((item) => item.id === feedbackCreate.body.id);
  assert.ok(feedback?.token);
  assert.equal((await client.get(`/api/public/feedback/${feedback.token}`)).status, 200);
  const feedbackSubmit = await client.post(`/api/public/feedback/${feedback.token}`, {
    body: { rating: 5, comment: `Great visit ${suffix}` },
  });
  assert.equal(feedbackSubmit.status, 200);
  const submittedFeedbackRows = await client.get("/api/feedback");
  const submittedFeedback = submittedFeedbackRows.body.find((item) => item.id === feedbackCreate.body.id);
  assert.equal(submittedFeedback.status, "submitted");
  assert.equal(submittedFeedback.rating, 5);
  assert.equal(submittedFeedback.comment, `Great visit ${suffix}`);

  assert.equal((await client.delete(`/api/appointments/${appointmentId}`)).status, 200);
  assert.ok(!(await client.get("/api/appointments")).body.some((item) => item.id === appointmentId));
  assert.equal((await client.delete(`/api/clients/${clientId}`)).status, 200);
  assert.ok(!(await client.get("/api/clients")).body.some((item) => item.id === clientId));
  assert.equal((await client.delete(`/api/services/${serviceId}`)).status, 200);
  assert.ok((await client.get("/api/services")).body.some((item) => item.id === serviceId && Number(item.active) === 0));
  assert.equal((await client.delete(`/api/categories/${categoryId}`)).status, 200);
  assert.ok(!(await client.get("/api/categories")).body.some((item) => item.id === categoryId));
});

test("platform owner creates, updates, and deletes a disposable tenant domain", async () => {
  const suffix = Date.now().toString(36);
  const { client, response: login } = await loginAs(platformServer.baseUrl, "admin");
  assert.equal(login.status, 200);
  assert.equal(login.body.user.platformOwner, true);

  const domain = `safe-step-101-${suffix}.example.test`;
  const create = await client.post("/api/tenant/domains", {
    body: { domain, isPrimary: false },
  });
  assert.equal(create.status, 201);
  const domainId = create.body.id;
  assert.ok(create.body.domains.some((item) => item.id === domainId && item.domain === domain));

  const update = await client.put(`/api/tenant/domains/${domainId}`, {
    body: { status: "active", isPrimary: false },
  });
  assert.equal(update.status, 200);
  assert.ok(update.body.domains.some((item) => item.id === domainId && item.status === "active"));

  const remove = await client.delete(`/api/tenant/domains/${domainId}`);
  assert.equal(remove.status, 200);
  assert.ok(!remove.body.domains.some((item) => item.id === domainId));
});
