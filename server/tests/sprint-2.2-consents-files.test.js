import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARL8B9R9P7QAAAABJRU5ErkJggg==";
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
let server;

before(async () => {
  server = await startTestServer({ envOverrides: { NODE_ENV: "development", UPLOAD_MAX_MB: "1" } });
});

after(async () => {
  await server?.stop();
});

function uploadForm(filename = "../../unsafe.pdf", type = "application/pdf", bytes = pdf) {
  const form = new FormData();
  form.append("name", "Clinical attachment");
  form.append("category", "diagnostic");
  form.append("file", new Blob([bytes], { type }), filename);
  return form;
}

test("Sprint 2.2 consent lifecycle, file RBAC, isolation, timeline, and audit are enforced", async () => {
  const anonymous = createHttpClient(server.baseUrl);
  assert.equal((await anonymous.get("/api/consent-templates")).status, 401);

  const { client: owner } = await loginAs(server.baseUrl, "owner");
  assert.equal((await owner.get("/api/consent-templates")).status, 403);

  const { client: admin } = await loginAs(server.baseUrl, "admin");
  const bootstrap = await admin.get("/api/bootstrap");
  const sara = bootstrap.body.users.find((user) => user.username === "sara");
  const lina = bootstrap.body.users.find((user) => user.username === "lina");
  assert.ok(sara?.id && lina?.id);

  const suffix = Date.now().toString(36);
  const patient = await admin.post("/api/clients", {
    body: {
      fname: "Consent",
      lname: "Patient",
      phone: `052${String(Date.now()).slice(-7)}`,
      email: `consent-file-${suffix}@example.test`,
      therapistId: sara.id,
    },
  });
  assert.equal(patient.status, 201);
  const unrelated = await admin.post("/api/clients", {
    body: {
      fname: "Other",
      lname: "Patient",
      phone: `053${String(Date.now() + 1).slice(-7)}`,
      email: `other-${suffix}@example.test`,
      therapistId: lina.id,
    },
  });
  assert.equal(unrelated.status, 201);

  const template = await admin.post("/api/consent-templates", {
    body: {
      title: `<img src=x onerror=alert("${suffix}")>`,
      description: "Treatment authorization",
      consentText: "Sensitive consent text must never enter the timeline.",
      language: "en",
      expirationDays: 1,
    },
  });
  assert.equal(template.status, 201);
  assert.equal(template.body.language, "en");

  const updated = await admin.put(`/api/consent-templates/${template.body.id}`, {
    body: {
      title: `Treatment consent ${suffix}`,
      description: "Updated description",
      consentText: "Updated sensitive consent text.",
      language: "en",
      expirationDays: 1,
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.id, template.body.id);

  const { client: reception } = await loginAs(server.baseUrl, "reception");
  assert.equal((await reception.post("/api/consent-templates", {
    body: { title: "Unauthorized", consentText: "Blocked", language: "en" },
  })).status, 403);

  const assigned = await reception.post(`/api/clients/${patient.body.id}/consents`, {
    body: { templateId: template.body.id },
  });
  assert.equal(assigned.status, 201);
  assert.equal(assigned.body.status, "pending");
  assert.equal((await reception.post(`/api/clients/${patient.body.id}/consents`, {
    body: { templateId: template.body.id },
  })).status, 409);

  const { client: therapist } = await loginAs(server.baseUrl, "sara");
  assert.equal((await therapist.get(`/api/clients/${unrelated.body.id}/consents`)).status, 404);
  const signed = await therapist.post(`/api/patient-consents/${assigned.body.id}/sign`, {
    body: { signerName: "Consent Patient", signatureData, witness: true },
  });
  assert.equal(signed.status, 200);
  assert.equal(signed.body.status, "signed");
  assert.equal(signed.body.witnessUserId, sara.id);
  assert.ok(signed.body.clientFileId);
  assert.equal((await reception.patch(`/api/patient-consents/${assigned.body.id}/status`, {
    body: { status: "declined" },
  })).status, 409);

  const versioned = await admin.put(`/api/consent-templates/${template.body.id}`, {
    body: {
      title: `Treatment consent v2 ${suffix}`,
      description: "Version two",
      consentText: "Version two consent text.",
      language: "en",
      expirationDays: 30,
    },
  });
  assert.equal(versioned.status, 200);
  assert.equal(versioned.body.previousTemplateId, template.body.id);
  assert.equal(versioned.body.version, 2);

  const declineTemplate = await admin.post("/api/consent-templates", {
    body: { title: `Decline ${suffix}`, consentText: "Declinable consent.", language: "en" },
  });
  const toDecline = await reception.post(`/api/clients/${patient.body.id}/consents`, {
    body: { templateId: declineTemplate.body.id },
  });
  assert.equal((await reception.patch(`/api/patient-consents/${toDecline.body.id}/status`, {
    body: { status: "declined" },
  })).body.status, "declined");

  const uploaded = await therapist.post(`/api/clients/${patient.body.id}/files`, {
    body: uploadForm(),
  });
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.body.storedName, /^[0-9a-f-]+\.pdf$/);
  assert.doesNotMatch(uploaded.body.storedName, /\.\./);
  assert.equal((await therapist.post(`/api/clients/${unrelated.body.id}/files`, {
    body: uploadForm("unrelated.pdf"),
  })).status, 403);
  assert.equal((await reception.post(`/api/clients/${patient.body.id}/files`, {
    body: uploadForm("reception.pdf"),
  })).status, 403);

  const receptionFiles = await reception.get(`/api/clients/${patient.body.id}/files`);
  const receptionFile = receptionFiles.body.find((item) => item.id === uploaded.body.id);
  assert.equal(receptionFile.canDownload, false);
  assert.equal("url" in receptionFile, false);
  assert.equal((await reception.get(`/api/client-files/${uploaded.body.id}/download`)).status, 403);

  const download = await therapist.get(`/api/client-files/${uploaded.body.id}/download`, { responseType: "buffer" });
  assert.equal(download.status, 200);
  assert.deepEqual(download.buffer, pdf);
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.equal(download.headers.get("content-security-policy"), "sandbox");

  assert.equal((await therapist.post(`/api/clients/${patient.body.id}/files`, {
    body: uploadForm("spoof.pdf", "application/pdf", Buffer.from("MZ executable")),
  })).status, 400);
  assert.equal((await therapist.post(`/api/clients/${patient.body.id}/files`, {
    body: uploadForm("script.exe", "application/octet-stream", Buffer.from("MZ")),
  })).status, 400);
  const oversizedPdf = Buffer.alloc((1024 * 1024) + 1, 0x20);
  pdf.copy(oversizedPdf, 0);
  assert.equal((await therapist.post(`/api/clients/${patient.body.id}/files`, {
    body: uploadForm("oversized.pdf", "application/pdf", oversizedPdf),
  })).status, 413);

  const database = new DatabaseSync(server.databasePath);
  try {
    database.prepare("UPDATE patient_consents SET expires_at = '2000-01-01 00:00:00' WHERE id = ?").run(assigned.body.id);
  } finally {
    database.close();
  }
  const consents = await therapist.get(`/api/clients/${patient.body.id}/consents`);
  assert.equal(consents.body.find((item) => item.id === assigned.body.id).status, "expired");

  const history = await therapist.get(`/api/clients/${patient.body.id}/history`);
  for (const type of ["consent_assigned", "consent_signed", "consent_declined", "consent_expired", "file_uploaded"]) {
    assert.ok(history.body.timeline.some((event) => event.type === type), type);
  }
  assert.equal(history.body.timeline.filter((event) => event.type === "consent_signed").length, 1);
  const timelineText = JSON.stringify(history.body.timeline);
  assert.doesNotMatch(timelineText, /Sensitive consent text|Updated sensitive|data:image|MZ executable/);

  assert.equal((await admin.post(`/api/consent-templates/${versioned.body.id}/deactivate`)).status, 200);

  const databaseAudit = new DatabaseSync(server.databasePath, { readOnly: true });
  try {
    const actions = databaseAudit.prepare(`
      SELECT action FROM audit_log
      WHERE entity IN ('consent_templates','patient_consents','client_files')
      ORDER BY id
    `).all().map((row) => row.action);
    for (const action of [
      "create",
      "update",
      "deactivate",
      "assign",
      "sign",
      "status_declined",
      "status_expired",
      "upload",
      "download",
    ]) {
      assert.ok(actions.includes(action) || (action === "update" && actions.includes("update_version")), action);
    }
  } finally {
    databaseAudit.close();
  }

  const tenantEmail = `tenant-b-${suffix}@example.test`;
  const tenantPassword = "TenantBPassword123!";
  const tenantSlug = `tenant-b-${suffix}`;
  assert.equal((await owner.post("/api/platform/tenants", {
    body: {
      clinicName: `Tenant B ${suffix}`,
      slug: tenantSlug,
      ownerName: "Tenant B Admin",
      email: tenantEmail,
      password: tenantPassword,
      plan: "starter",
      status: "active",
    },
  })).status, 201);
  const { client: tenantB } = await loginAs(server.baseUrl, tenantEmail, tenantPassword, tenantSlug);
  assert.equal((await tenantB.get(`/api/clients/${patient.body.id}/consents`)).status, 404);
  assert.equal((await tenantB.get(`/api/client-files/${uploaded.body.id}/download`)).status, 404);
});
