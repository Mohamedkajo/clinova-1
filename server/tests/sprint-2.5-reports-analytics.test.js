import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let server;
const range = "from=2035-09-01&to=2035-09-30";

before(async () => {
  server = await startTestServer({ envOverrides: { NODE_ENV: "development", CLINOVA_TEST_NOW: "2035-09-10 09:00" } });
});

after(async () => server?.stop());

async function createAppointment(client, context, values = {}) {
  const response = await client.post("/api/appointments", {
    body: {
      clientId: context.patientId,
      serviceId: context.serviceId,
      therapistId: values.therapistId || context.saraId,
      date: "2035-09-15",
      time: values.time || "10:00",
      status: values.status || "pending",
      notes: "SECRET APPOINTMENT NOTE",
    },
  });
  assert.equal(response.status, 201);
  return response.body.id;
}

test("reports aggregate operational, clinical, consent and ledger data with role and tenant isolation", async () => {
  const anonymous = createHttpClient(server.baseUrl);
  const { client: owner } = await loginAs(server.baseUrl, "owner");
  const { client: admin } = await loginAs(server.baseUrl, "admin");
  const { client: reception } = await loginAs(server.baseUrl, "reception");
  const { client: sara } = await loginAs(server.baseUrl, "sara");
  assert.equal((await anonymous.get(`/api/reports?${range}`)).status, 401);
  assert.equal((await owner.get(`/api/reports?${range}`)).status, 403);

  const bootstrap = await admin.get("/api/bootstrap");
  const saraUser = bootstrap.body.users.find((user) => user.username === "sara");
  const linaUser = bootstrap.body.users.find((user) => user.username === "lina");
  const service = bootstrap.body.services.find((item) => item.active !== false);
  assert.ok(saraUser && linaUser && service);
  const suffix = Date.now().toString(36);
  const patient = await admin.post("/api/clients", {
    body: {
      fname: "Report",
      lname: "Patient",
      phone: `052${String(Date.now()).slice(-7)}`,
      email: `report-${suffix}@example.test`,
      therapistId: saraUser.id,
    },
  });
  assert.equal(patient.status, 201);
  const context = { patientId: patient.body.id, serviceId: service.id, saraId: saraUser.id };
  const doneId = await createAppointment(admin, context, { status: "done", time: "10:00" });
  const pendingId = await createAppointment(admin, context, { status: "pending", time: "12:00", therapistId: linaUser.id });
  await createAppointment(admin, context, { status: "cancelled", time: "14:00" });

  const invoice = await reception.post("/api/patient-finance/invoices", {
    body: { patientId: context.patientId, appointmentId: doneId, items: [{ serviceId: service.id, description: "Report service", quantity: 1, unitPrice: "100.00" }] },
  });
  assert.equal(invoice.status, 201);
  const invoiceId = invoice.body.invoice.id;
  assert.equal((await reception.post(`/api/patient-finance/invoices/${invoiceId}/issue`)).status, 200);
  assert.equal((await reception.post("/api/patient-finance/payments", {
    body: { patientId: context.patientId, invoiceId, amount: "40.00", paymentMethod: "card" },
  })).status, 201);
  const details = await admin.get(`/api/patient-finance/invoices/${invoiceId}`);
  assert.equal((await admin.post(`/api/patient-finance/payments/${details.body.invoice.payments[0].id}/reverse`)).status, 200);
  assert.equal((await reception.post("/api/patient-finance/payments", {
    body: { patientId: context.patientId, invoiceId, amount: "60.00", paymentMethod: "cash" },
  })).status, 201);
  const cancelledInvoice = await reception.post("/api/patient-finance/invoices", {
    body: { patientId: context.patientId, items: [{ description: "Cancelled", quantity: 1, unitPrice: "25.00" }] },
  });
  assert.equal(cancelledInvoice.status, 201);
  assert.equal((await reception.post(`/api/patient-finance/invoices/${cancelledInvoice.body.invoice.id}/issue`)).status, 200);
  assert.equal((await admin.post(`/api/patient-finance/invoices/${cancelledInvoice.body.invoice.id}/cancel`)).status, 200);

  const database = new DatabaseSync(server.databasePath);
  database.prepare("UPDATE clients SET created_at = '2035-09-05 08:00:00' WHERE id = ?").run(context.patientId);
  database.prepare("UPDATE patient_ledger_entries SET posted_at = '2035-09-16 09:00:00' WHERE tenant_id = 1 AND patient_id = ?").run(context.patientId);
  database.prepare(`INSERT INTO appointments (tenant_id, client_id, service_id, therapist_id, date, time, status, active)
    VALUES (1, ?, ?, ?, '2035-08-20', '09:00', 'done', 1)`).run(context.patientId, service.id, saraUser.id);
  database.prepare(`INSERT INTO clinical_visits (tenant_id, appointment_id, client_id, therapist_id, service_id, visit_date, visit_time,
    treatment_summary, clinical_observations, recommendations, follow_up_instructions, internal_notes, status, created_by, updated_by)
    VALUES (1, ?, ?, ?, ?, '2035-09-15', '10:00', 'SECRET TREATMENT', 'SECRET OBSERVATION', 'SECRET RECOMMENDATION', 'Review in 7 days', 'SECRET NOTE', 'completed', ?, ?)`)
    .run(doneId, context.patientId, saraUser.id, service.id, saraUser.id, saraUser.id);
  database.prepare(`INSERT INTO clinical_visits (tenant_id, appointment_id, client_id, therapist_id, service_id, visit_date, visit_time,
    treatment_summary, clinical_observations, recommendations, follow_up_instructions, internal_notes, status, created_by, updated_by)
    VALUES (1, ?, ?, ?, ?, '2035-09-15', '12:00', 'SECRET LINA', '', '', '', '', 'draft', ?, ?)`)
    .run(pendingId, context.patientId, linaUser.id, service.id, linaUser.id, linaUser.id);
  const templateId = Number(database.prepare(`INSERT INTO consent_templates (tenant_id, service_id, title, consent_text, url, created_by, updated_by, active)
    VALUES (1, ?, '=CONSENT()', 'SECRET CONSENT BODY', '/safe.pdf', ?, ?, 1)`).run(service.id, saraUser.id, saraUser.id).lastInsertRowid);
  const consentInsert = database.prepare(`INSERT INTO patient_consents
    (tenant_id, template_id, client_id, appointment_id, service_id, status, assigned_by, expires_at, created_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, '2035-09-12 08:00:00')`);
  consentInsert.run(templateId, context.patientId, pendingId, service.id, "pending", saraUser.id, "2035-10-01 00:00:00");
  consentInsert.run(templateId, context.patientId, doneId, service.id, "signed", saraUser.id, "2036-01-01 00:00:00");
  consentInsert.run(templateId, context.patientId, doneId, service.id, "declined", saraUser.id, null);
  consentInsert.run(templateId, context.patientId, pendingId, service.id, "expired", saraUser.id, "2035-08-01 00:00:00");
  database.prepare("UPDATE services SET name = '=2+3' WHERE id = ?").run(service.id);
  database.close();

  const adminReport = await admin.get(`/api/reports?${range}`);
  assert.equal(adminReport.status, 200);
  assert.deepEqual(
    { total: adminReport.body.appointments.summary.total, completed: adminReport.body.appointments.summary.completed, pending: adminReport.body.appointments.summary.pending, cancelled: adminReport.body.appointments.summary.cancelled },
    { total: 3, completed: 1, pending: 1, cancelled: 1 },
  );
  assert.equal(adminReport.body.appointments.summary.completionRate, 33.3);
  assert.equal(adminReport.body.patients.summary.newPatients, 1);
  assert.equal(adminReport.body.patients.summary.activePatients, 1);
  assert.equal(adminReport.body.patients.summary.returningPatients, 1);
  assert.deepEqual(
    { started: adminReport.body.clinical.summary.started, completed: adminReport.body.clinical.summary.completed, draft: adminReport.body.clinical.summary.draft, followUpRequired: adminReport.body.clinical.summary.followUpRequired },
    { started: 2, completed: 1, draft: 1, followUpRequired: 1 },
  );
  assert.deepEqual(adminReport.body.financial.summary, {
    issuedInvoices: 2,
    grossInvoiced: "100.00",
    paymentsReceived: "60.00",
    outstandingBalance: "40.00",
    cancelledInvoices: 1,
    reversedPayments: 1,
  });
  assert.deepEqual(adminReport.body.consents.summary, { pending: 1, signed: 1, declined: 1, expired: 1, upcomingMissingRequired: 1 });
  assert.doesNotMatch(JSON.stringify(adminReport.body), /SECRET TREATMENT|SECRET OBSERVATION|SECRET CONSENT BODY|SECRET NOTE/);

  const completedOnly = await admin.get(`/api/reports?${range}&appointmentStatus=done&therapistId=${saraUser.id}&serviceId=${service.id}`);
  assert.equal(completedOnly.status, 200);
  assert.equal(completedOnly.body.appointments.summary.total, 1);

  const receptionReport = await reception.get(`/api/reports?${range}`);
  assert.equal(receptionReport.status, 200);
  assert.equal(receptionReport.body.permissions.clinical, false);
  assert.equal(receptionReport.body.clinical, null);
  assert.equal(receptionReport.body.permissions.financial, true);

  const therapistReport = await sara.get(`/api/reports?${range}`);
  assert.equal(therapistReport.status, 200);
  assert.equal(therapistReport.body.permissions.clinicalScope, "own");
  assert.equal(therapistReport.body.appointments.summary.total, 2);
  assert.equal(therapistReport.body.clinical.summary.started, 1);
  assert.equal(therapistReport.body.financial, null);
  assert.equal(therapistReport.body.patients, null);
  assert.equal(therapistReport.body.consents, null);
  assert.equal((await sara.get(`/api/reports?${range}&therapistId=${linaUser.id}`)).status, 403);

  const foreignSlug = `reports-${suffix}`;
  const foreignEmail = `reports-${suffix}@example.test`;
  const foreignPassword = "ForeignReports123!";
  assert.equal((await owner.post("/api/platform/tenants", {
    body: { clinicName: "Foreign Reports", slug: foreignSlug, ownerName: "Foreign Admin", email: foreignEmail, password: foreignPassword, plan: "starter", status: "active" },
  })).status, 201);
  const { client: foreign } = await loginAs(server.baseUrl, foreignEmail, foreignPassword, foreignSlug);
  const foreignReport = await foreign.get(`/api/reports?${range}`);
  assert.equal(foreignReport.status, 200);
  assert.equal(foreignReport.body.appointments.summary.total, 0);
  assert.equal(foreignReport.body.financial.summary.paymentsReceived, "0.00");

  const csv = await admin.get(`/api/reports/export.csv?${range}`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(csv.headers.get("content-disposition"), /attachment/);
  assert.match(csv.body, /'=2\+3/);
  assert.doesNotMatch(csv.body, /SECRET|"=2\+3"/);
  const auditDb = new DatabaseSync(server.databasePath, { readOnly: true });
  const exportAudit = auditDb.prepare("SELECT action, details FROM audit_log WHERE action = 'report_export' ORDER BY id DESC LIMIT 1").get();
  assert.equal(exportAudit.action, "report_export");
  assert.doesNotMatch(exportAudit.details, /SECRET|2\+3/);
  auditDb.close();
});

test("report filters reject invalid and unrestricted date ranges", async () => {
  const { client: admin } = await loginAs(server.baseUrl, "admin");
  for (const query of [
    "from=not-a-date&to=2035-09-30",
    "from=2035-09-30&to=2035-09-01",
    "from=2034-01-01&to=2035-09-30",
    "from=2035-09-01&to=2035-09-30&appointmentStatus=no_show",
    "from=2035-09-01&to=2035-09-30&serviceId=999999",
  ]) assert.equal((await admin.get(`/api/reports?${query}`)).status, 400, query);
});
