import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let server;

before(async () => {
  server = await startTestServer({
    envOverrides: {
      NODE_ENV: "development",
      CLINOVA_TEST_NOW: "2035-09-10 09:00",
    },
  });
});

after(async () => {
  await server?.stop();
});

test("Sprint 2.3 notifications and reminders enforce recipients, lifecycle, safety, and isolation", async () => {
  const { client: owner } = await loginAs(server.baseUrl, "owner");
  assert.equal((await owner.get("/api/notifications")).status, 403);

  const { client: admin } = await loginAs(server.baseUrl, "admin");
  const { client: reception } = await loginAs(server.baseUrl, "reception");
  const { client: sara } = await loginAs(server.baseUrl, "sara");
  const { client: lina } = await loginAs(server.baseUrl, "lina");
  const bootstrap = await admin.get("/api/bootstrap");
  const saraUser = bootstrap.body.users.find((user) => user.username === "sara");
  const service = bootstrap.body.services.find((item) => item.active !== false);
  assert.ok(saraUser?.id && service?.id);

  const settings = await admin.put("/api/settings", {
    body: {
      appointmentRemindersEnabled: "true",
      reminderTimingHours: "24",
      sameDayReminderEnabled: "true",
      sameDayReminderTime: "08:00",
      reminderChannel: "whatsapp",
    },
  });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.settings.reminderTimingHours, "24");

  const suffix = Date.now().toString(36);
  const patient = await admin.post("/api/clients", {
    body: {
      fname: `<img src=x onerror=alert("${suffix}")>`,
      lname: "Reminder Patient",
      phone: `052${String(Date.now()).slice(-7)}`,
      email: `reminder-${suffix}@example.test`,
      therapistId: saraUser.id,
      notes: "SECRET CLINICAL NOTE MUST NOT APPEAR",
    },
  });
  assert.equal(patient.status, 201);

  const template = await admin.post("/api/consent-templates", {
    body: {
      title: `Required consent ${suffix}`,
      consentText: "SECRET CONSENT TEXT MUST NOT APPEAR",
      language: "en",
      serviceId: service.id,
    },
  });
  assert.equal(template.status, 201);

  const appointmentBody = {
    clientId: patient.body.id,
    serviceId: service.id,
    therapistId: saraUser.id,
    date: "2035-09-12",
    time: "10:00",
    status: "pending",
    notes: "SECRET APPOINTMENT NOTE MUST NOT APPEAR",
  };
  const appointment = await reception.post("/api/appointments", { body: appointmentBody });
  assert.equal(appointment.status, 201);

  const saraNotifications = await sara.get("/api/notifications");
  assert.equal(saraNotifications.status, 200);
  assert.ok(saraNotifications.body.unreadCount >= 2);
  assert.ok(saraNotifications.body.items.some((item) => item.type === "appointment_assigned"
    && item.relatedEntityId === appointment.body.id));
  assert.ok(saraNotifications.body.items.some((item) => item.type === "consent_pending"
    && item.relatedEntityId === appointment.body.id));
  const serializedNotifications = JSON.stringify(saraNotifications.body.items);
  assert.doesNotMatch(serializedNotifications, /SECRET CLINICAL|SECRET CONSENT|SECRET APPOINTMENT|paid_amount|payment/i);

  const linaNotifications = await lina.get("/api/notifications");
  assert.equal(linaNotifications.body.items.some((item) => item.relatedEntityId === appointment.body.id), false);

  const firstUnread = saraNotifications.body.items.find((item) => item.status === "unread");
  const readOne = await sara.patch(`/api/notifications/${firstUnread.id}/read`);
  assert.equal(readOne.status, 200);
  assert.equal(readOne.body.unreadCount, saraNotifications.body.unreadCount - 1);
  const readAll = await sara.post("/api/notifications/read-all");
  assert.deepEqual(readAll.body, { ok: true, unreadCount: 0 });
  assert.equal((await sara.get("/api/notifications")).body.unreadCount, 0);

  const adminNotification = (await admin.get("/api/notifications")).body.items[0];
  assert.ok(adminNotification?.id);
  assert.equal((await sara.patch(`/api/notifications/${adminNotification.id}/read`)).status, 404);

  const initialReminders = await reception.get("/api/reminders");
  const initialActive = initialReminders.body.items.filter((item) => item.appointmentId === appointment.body.id
    && ["pending", "ready"].includes(item.status));
  assert.deepEqual(initialActive.map((item) => item.reminderType).sort(), ["24h", "same_day"]);
  await reception.post("/api/reminders/prepare");
  const afterDuplicatePrepare = (await reception.get("/api/reminders")).body.items
    .filter((item) => item.appointmentId === appointment.body.id && ["pending", "ready"].includes(item.status));
  assert.equal(afterDuplicatePrepare.length, 2);
  assert.equal((await sara.get("/api/reminders")).status, 403);

  const rescheduled = await reception.put(`/api/appointments/${appointment.body.id}`, {
    body: { ...appointmentBody, date: "2035-09-13", time: "11:00" },
  });
  assert.equal(rescheduled.status, 200);
  const afterReschedule = (await reception.get("/api/reminders")).body.items
    .filter((item) => item.appointmentId === appointment.body.id);
  assert.equal(afterReschedule.filter((item) => item.status === "cancelled").length, 2);
  assert.equal(afterReschedule.filter((item) => ["pending", "ready"].includes(item.status)).length, 2);
  assert.ok((await sara.get("/api/notifications")).body.items.some((item) => item.type === "appointment_rescheduled"));

  const cancelled = await reception.patch(`/api/appointments/${appointment.body.id}/status`, {
    body: { status: "cancelled" },
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await reception.get("/api/reminders")).body.items
    .filter((item) => item.appointmentId === appointment.body.id && ["pending", "ready"].includes(item.status)).length, 0);
  assert.ok((await sara.get("/api/notifications")).body.items.some((item) => item.type === "appointment_cancelled"));

  const invalidContact = await admin.post("/api/clients", {
    body: {
      fname: "Invalid",
      lname: "Contact",
      phone: "bad",
      email: "not-an-email",
      therapistId: saraUser.id,
    },
  });
  const excludedAppointment = await reception.post("/api/appointments", {
    body: {
      ...appointmentBody,
      clientId: invalidContact.body.id,
      date: "2035-09-14",
      time: "10:00",
    },
  });
  assert.equal(excludedAppointment.status, 201);
  assert.equal((await reception.get("/api/reminders")).body.items
    .some((item) => item.appointmentId === excludedAppointment.body.id), false);

  assert.equal((await admin.put("/api/settings", {
    body: {
      appointmentRemindersEnabled: "true",
      reminderTimingHours: "25",
      sameDayReminderEnabled: "false",
      sameDayReminderTime: "08:00",
      reminderChannel: "whatsapp",
    },
  })).status, 200);
  const dispatchAppointment = await reception.post("/api/appointments", {
    body: {
      ...appointmentBody,
      date: "2035-09-11",
      time: "10:00",
    },
  });
  assert.equal(dispatchAppointment.status, 201);
  const dispatch = await reception.post("/api/reminders/simulate-dispatch");
  assert.equal(dispatch.status, 200);
  assert.ok(dispatch.body.simulated >= 1);
  assert.ok((await reception.get("/api/reminders")).body.items.some((item) => item.appointmentId === dispatchAppointment.body.id
    && item.status === "sent"));
  await reception.post("/api/reminders/prepare");
  const afterSentPrepare = (await reception.get("/api/reminders")).body.items
    .filter((item) => item.appointmentId === dispatchAppointment.body.id && item.status !== "cancelled");
  assert.equal(afterSentPrepare.length, 1);
  assert.equal(afterSentPrepare.filter((item) => item.reminderType === "24h" && item.status === "sent").length, 1);

  const clinical = await sara.post("/api/clinical-visits", {
    body: {
      appointmentId: dispatchAppointment.body.id,
      treatmentSummary: "SECRET TREATMENT SUMMARY",
      followUpInstructions: "SECRET FOLLOW-UP INSTRUCTIONS",
    },
  });
  assert.equal(clinical.status, 201);
  assert.equal((await sara.post(`/api/clinical-visits/${clinical.body.id}/complete`)).status, 200);
  const followUpNotifications = await sara.get("/api/notifications");
  assert.ok(followUpNotifications.body.items.some((item) => item.type === "follow_up_required"));
  assert.doesNotMatch(JSON.stringify(followUpNotifications.body.items), /SECRET TREATMENT|SECRET FOLLOW-UP/);
  assert.ok((await reception.get("/api/notifications")).body.items.some((item) => item.type === "clinical_visit_completed"));

  const tenantEmail = `notify-tenant-${suffix}@example.test`;
  const tenantPassword = "TenantNotification123!";
  const tenantSlug = `notify-${suffix}`;
  assert.equal((await owner.post("/api/platform/tenants", {
    body: {
      clinicName: `Notification Tenant ${suffix}`,
      slug: tenantSlug,
      ownerName: "Tenant B Admin",
      email: tenantEmail,
      password: tenantPassword,
      plan: "starter",
      status: "active",
    },
  })).status, 201);
  const { client: tenantB } = await loginAs(server.baseUrl, tenantEmail, tenantPassword, tenantSlug);
  assert.equal((await tenantB.patch(`/api/notifications/${firstUnread.id}/read`)).status, 404);
  assert.equal((await tenantB.get("/api/reminders")).body.items
    .some((item) => item.appointmentId === dispatchAppointment.body.id), false);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  try {
    const actions = database.prepare(`
      SELECT action
      FROM audit_log
      WHERE entity IN ('appointment_reminders','settings')
      ORDER BY id
    `).all().map((row) => row.action);
    for (const action of ["update", "create", "cancel", "simulated_dispatch"]) {
      assert.ok(actions.includes(action), action);
    }
  } finally {
    database.close();
  }
});
