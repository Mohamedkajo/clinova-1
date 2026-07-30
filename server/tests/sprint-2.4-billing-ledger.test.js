import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let server;

before(async () => {
  server = await startTestServer({ envOverrides: { NODE_ENV: "development", CLINOVA_TEST_NOW: "2035-09-10 09:00" } });
});

after(async () => {
  await server?.stop();
});

async function createPatientAndAppointment(client, suffix) {
  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.role === "therapist");
  const service = bootstrap.body.services.find((item) => item.active !== false);
  const patient = await client.post("/api/clients", {
    body: {
      fname: `<img src=x onerror=alert("${suffix}")>`,
      lname: "Ledger Patient",
      phone: `054${String(Date.now()).slice(-7)}`,
      email: `ledger-${suffix}@example.test`,
      therapistId: therapist.id,
    },
  });
  assert.equal(patient.status, 201);
  const appointment = await client.post("/api/appointments", {
    body: {
      clientId: patient.body.id,
      serviceId: service.id,
      therapistId: therapist.id,
      date: "2035-09-15",
      time: "10:00",
      status: "done",
      notes: "No clinical data belongs in finance records",
    },
  });
  assert.equal(appointment.status, 201);
  return { patientId: patient.body.id, appointmentId: appointment.body.id, serviceId: service.id };
}

test("patient invoices, payments, reversals and ledger are decimal-safe, isolated and RBAC protected", async () => {
  const { client: owner } = await loginAs(server.baseUrl, "owner");
  const { client: admin } = await loginAs(server.baseUrl, "admin");
  const { client: reception } = await loginAs(server.baseUrl, "reception");
  const { client: therapist } = await loginAs(server.baseUrl, "sara");
  assert.equal((await createHttpClient(server.baseUrl).get("/api/patient-finance/invoices")).status, 401);
  assert.equal((await owner.get("/api/patient-finance/invoices")).status, 403);
  assert.equal((await therapist.get("/api/patient-finance/invoices")).status, 403);
  assert.equal((await reception.get("/api/patient-finance/invoices")).status, 200);

  const suffix = Date.now().toString(36);
  const context = await createPatientAndAppointment(admin, suffix);
  const draft = await reception.post("/api/patient-finance/invoices", {
    body: {
      patientId: context.patientId,
      appointmentId: context.appointmentId,
      currency: "ILS",
      discount: "0.10",
      tax: "0.20",
      balance: "-999999",
      items: [
        { serviceId: context.serviceId, description: `<script>alert("${suffix}")</script>`, quantity: 3, unitPrice: "0.10", discount: "0.00", tax: "0.00" },
        { description: "Professional service", quantity: 1, unitPrice: "100.05", discount: "0.05", tax: "0.10" },
      ],
    },
  });
  assert.equal(draft.status, 201);
  assert.equal(draft.body.invoice.subtotal, "100.35");
  assert.equal(draft.body.invoice.discount, "0.15");
  assert.equal(draft.body.invoice.tax, "0.30");
  assert.equal(draft.body.invoice.total, "100.50");
  assert.match(draft.body.invoice.invoiceNumber, /^INV-/);
  const invoiceId = draft.body.invoice.id;

  const duplicate = await reception.post("/api/patient-finance/invoices", {
    body: { patientId: context.patientId, appointmentId: context.appointmentId, items: [{ description: "Duplicate", quantity: 1, unitPrice: "1.00" }] },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "DUPLICATE_APPOINTMENT_INVOICE");

  const edited = await reception.put(`/api/patient-finance/invoices/${invoiceId}`, {
    body: {
      patientId: context.patientId,
      items: [{ serviceId: context.serviceId, description: "Final item", quantity: 1, unitPrice: "100.50", discount: "0", tax: "0" }],
      currency: "ILS",
    },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.invoice.total, "100.50");
  assert.equal((await reception.post(`/api/patient-finance/invoices/${invoiceId}/issue`)).status, 200);
  assert.equal((await reception.put(`/api/patient-finance/invoices/${invoiceId}`, { body: edited.body.invoice })).status, 409);

  let ledger = await reception.get(`/api/patient-finance/patients/${context.patientId}/ledger`);
  assert.equal(ledger.status, 200);
  assert.equal(ledger.body.balance, "100.50");
  assert.equal(ledger.body.entries.length, 1);
  assert.equal(ledger.body.entries[0].debit, "100.50");

  const partial = await reception.post("/api/patient-finance/payments", {
    body: { patientId: context.patientId, invoiceId, amount: "40.25", paymentMethod: "card", reference: `<svg onload=alert("${suffix}")>` },
  });
  assert.equal(partial.status, 201);
  let details = await reception.get(`/api/patient-finance/invoices/${invoiceId}`);
  assert.equal(details.body.invoice.status, "partially_paid");
  assert.equal(details.body.invoice.outstanding, "60.25");
  const paymentId = details.body.invoice.payments[0].id;

  assert.equal((await reception.post("/api/patient-finance/payments", {
    body: { patientId: context.patientId, invoiceId, amount: "60.26", paymentMethod: "cash" },
  })).status, 409);
  assert.equal((await reception.post("/api/patient-finance/payments", {
    body: { patientId: context.patientId, invoiceId, amount: "60.25", paymentMethod: "cash" },
  })).status, 201);
  details = await admin.get(`/api/patient-finance/invoices/${invoiceId}`);
  assert.equal(details.body.invoice.status, "paid");
  assert.equal(details.body.invoice.outstanding, "0.00");

  assert.equal((await reception.post(`/api/patient-finance/payments/${paymentId}/reverse`)).status, 403);
  assert.equal((await admin.post(`/api/patient-finance/payments/${paymentId}/reverse`)).status, 200);
  details = await admin.get(`/api/patient-finance/invoices/${invoiceId}`);
  assert.equal(details.body.invoice.status, "partially_paid");
  assert.equal(details.body.invoice.outstanding, "40.25");

  assert.equal((await reception.post(`/api/patient-finance/invoices/${invoiceId}/cancel`)).status, 403);
  assert.equal((await admin.post(`/api/patient-finance/invoices/${invoiceId}/cancel`)).status, 200);
  ledger = await admin.get(`/api/patient-finance/patients/${context.patientId}/ledger`);
  assert.equal(ledger.body.balance, "-60.25");
  assert.deepEqual(new Set(ledger.body.entries.map((entry) => entry.type)), new Set(["invoice", "payment", "payment_reversal", "invoice_reversal"]));

  const adminProfile = await admin.get(`/api/clients/${context.patientId}/history`);
  assert.equal(adminProfile.status, 200);
  assert.equal(adminProfile.body.capabilities.financial, true);
  assert.equal(adminProfile.body.financial.balance, "-60.25");
  const therapistProfile = await therapist.get(`/api/clients/${context.patientId}/history`);
  assert.equal(therapistProfile.status, 200);
  assert.equal(therapistProfile.body.capabilities.financial, false);
  assert.equal(Object.hasOwn(therapistProfile.body, "financial"), false);

  const foreignSlug = `finance-${suffix}`;
  const foreignEmail = `finance-${suffix}@example.test`;
  const foreignPassword = "ForeignTenant123!";
  const provision = await owner.post("/api/platform/tenants", {
    body: { clinicName: `Finance ${suffix}`, slug: foreignSlug, ownerName: "Foreign Admin", email: foreignEmail, password: foreignPassword, plan: "starter", status: "active" },
  });
  assert.equal(provision.status, 201);
  const { client: foreign } = await loginAs(server.baseUrl, foreignEmail, foreignPassword, foreignSlug);
  assert.equal((await foreign.get(`/api/patient-finance/invoices/${invoiceId}`)).status, 404);
  assert.equal((await foreign.get(`/api/patient-finance/patients/${context.patientId}/ledger`)).status, 404);

  const database = new DatabaseSync(server.databasePath, { readOnly: true });
  const audits = database.prepare("SELECT action, details FROM audit_log WHERE entity IN ('patient_invoices', 'patient_payments')").all();
  assert.ok(audits.some((row) => row.action === "invoice_issued"));
  assert.ok(audits.some((row) => row.action === "payment_posted"));
  assert.ok(audits.some((row) => row.action === "payment_reversed"));
  assert.ok(audits.every((row) => !row.details.includes("100.50") && !row.details.includes("svg") && !row.details.includes("script")));
  database.close();
});

test("payment posting rolls back payment, ledger and audit together on failure", async () => {
  const isolated = await startTestServer({
    envOverrides: { NODE_ENV: "development", CLINOVA_TEST_FINANCE_FAIL_STAGE: "payment_after_ledger" },
  });
  try {
    const { client: admin } = await loginAs(isolated.baseUrl, "admin");
    const { patientId } = await createPatientAndAppointment(admin, `rollback-${Date.now()}`);
    const response = await admin.post("/api/patient-finance/payments", {
      body: { patientId, amount: "25.00", paymentMethod: "cash", reference: "atomicity" },
    });
    assert.equal(response.status, 500);
    const database = new DatabaseSync(isolated.databasePath, { readOnly: true });
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM patient_payments WHERE patient_id = ?").get(patientId).count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM patient_ledger_entries WHERE patient_id = ?").get(patientId).count, 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE entity = 'patient_payments'").get().count, 0);
    database.close();
  } finally {
    await isolated.stop();
  }
});
