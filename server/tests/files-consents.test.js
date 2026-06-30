import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

const fixtureContent = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  "utf8",
);

let testServer;
let removedRoot;
let fixturePath;
let validPdfFixture;
let appointmentFixtureCount = 0;

const signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARL8B9R9P7QAAAABJRU5ErkJggg==";

before(async () => {
  testServer = await startTestServer();
  removedRoot = testServer.root;
  const fixtureDir = join(testServer.root, "fixtures");
  fixturePath = join(fixtureDir, "safe-step-102-fixture.pdf");
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(fixturePath, fixtureContent);
  const pdf = await PDFDocument.create();
  pdf.addPage([320, 180]);
  validPdfFixture = Buffer.from(await pdf.save());
});

after(async () => {
  await testServer?.stop();
  await assert.rejects(access(removedRoot));
});

test("client file upload, list, download, and archive stay inside temporary uploads", async () => {
  const suffix = Date.now().toString(36);
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  assert.ok(therapist?.id);

  const createClient = await client.post("/api/clients", {
    body: {
      fname: "File",
      lname: `Fixture ${suffix}`,
      phone: "0500000102",
      email: `safe-step-102-${suffix}@example.test`,
      therapistId: therapist.id,
      notes: "Disposable file test client",
    },
  });
  assert.equal(createClient.status, 201);
  const clientId = createClient.body.id;

  assert.equal((await client.get(`/api/clients/${clientId}/files`)).status, 200);
  assert.equal((await client.post(`/api/clients/${clientId}/files`)).status, 400);

  const fixture = await readFile(fixturePath);
  const form = new FormData();
  form.append("name", "Safe Step 102 Client Fixture");
  form.append("notes", "Temporary upload fixture");
  form.append("file", new Blob([fixture], { type: "application/pdf" }), "safe-step-102-client.pdf");

  const upload = await client.post(`/api/clients/${clientId}/files`, { body: form });
  assert.equal(upload.status, 201);
  const fileId = upload.body.id;

  const files = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(files.status, 200);
  const uploaded = files.body.find((item) => item.id === fileId);
  assert.equal(uploaded.name, "Safe Step 102 Client Fixture");
  assert.equal(uploaded.mimeType, "application/pdf");

  const download = await client.get(`/api/client-files/${fileId}/download`, { responseType: "buffer" });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.match(download.headers.get("content-disposition") || "", /^inline; filename\*=UTF-8''/);
  assert.ok(download.buffer.length > 0);
  assert.deepEqual(download.buffer, fixture);

  assert.equal((await client.delete(`/api/client-files/${fileId}`)).status, 200);
  assert.ok(!(await client.get(`/api/clients/${clientId}/files`)).body.some((item) => item.id === fileId));
  assert.equal((await client.get(`/api/client-files/${fileId}/download`)).status, 404);

  assert.equal((await client.delete(`/api/clients/${clientId}`)).status, 200);
});

test("consent PDF upload, list, download, invalid sign, and archive use temporary storage", async () => {
  const suffix = Date.now().toString(36);
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const categories = await client.get("/api/categories");
  assert.equal(categories.status, 200);
  assert.ok(categories.body[0]?.id);

  assert.equal((await client.get("/api/consents")).status, 200);
  assert.equal((await client.post("/api/consents")).status, 400);

  const fixture = await readFile(fixturePath);
  const form = new FormData();
  form.append("title", `SAFE_STEP_102_CONSENT_${suffix}`);
  form.append("categoryId", String(categories.body[0].id));
  form.append("file", new Blob([fixture], { type: "application/pdf" }), "safe-step-102-consent.pdf");

  const upload = await client.post("/api/consents", { body: form });
  assert.equal(upload.status, 201);
  const consentId = upload.body.id;

  const consents = await client.get("/api/consents");
  assert.equal(consents.status, 200);
  const consent = consents.body.find((item) => item.id === consentId);
  assert.equal(consent.title, `SAFE_STEP_102_CONSENT_${suffix}`);
  assert.equal(consent.mimeType, "application/pdf");

  const download = await client.get(`/api/consents/${consentId}/download`, { responseType: "buffer" });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.match(download.headers.get("content-disposition") || "", /^inline; filename\*=UTF-8''/);
  assert.ok(download.buffer.length > 0);
  assert.deepEqual(download.buffer, fixture);

  const invalidSign = await client.post(`/api/consents/${consentId}/sign`, {
    body: { signerName: "Safe Step 102", signatureData: "" },
  });
  assert.equal(invalidSign.status, 400);
  assert.equal(invalidSign.body.error, "Signature is required.");

  assert.equal((await client.delete(`/api/consents/${consentId}`)).status, 200);
  assert.ok(!(await client.get("/api/consents")).body.some((item) => item.id === consentId));
  assert.equal((await client.get(`/api/consents/${consentId}/download`)).status, 404);
});

function withDatabase(callback) {
  const sqlite = new DatabaseSync(testServer.databasePath);
  try {
    return callback(sqlite);
  } finally {
    sqlite.close();
  }
}

async function createConsentFixture(client, { categoryId, title }) {
  const form = new FormData();
  form.append("title", title);
  form.append("categoryId", String(categoryId));
  form.append("file", new Blob([validPdfFixture], { type: "application/pdf" }), `${title}.pdf`);
  const upload = await client.post("/api/consents", { body: form });
  assert.equal(upload.status, 201);
  return upload.body.id;
}

async function createClientFixture(client, therapistId, suffix) {
  const created = await client.post("/api/clients", {
    body: {
      fname: "Consent",
      lname: `Signer ${suffix}`,
      phone: `05077${suffix.slice(-5).padStart(5, "0")}`,
      email: `consent-signer-${suffix}@example.test`,
      therapistId,
      notes: "Temporary consent signing client",
    },
  });
  assert.equal(created.status, 201);
  return created.body.id;
}

async function createAppointmentFixture(client, { clientId, serviceId, therapistId }) {
  const minutes = 10 * 60 + (appointmentFixtureCount * 30);
  appointmentFixtureCount += 1;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const created = await client.post("/api/appointments", {
    body: {
      clientId,
      serviceId,
      therapistId,
      date: "2035-06-18",
      time,
      status: "pending",
      paymentStatus: "unpaid",
      paidAmount: 0,
    },
  });
  assert.equal(created.status, 201);
  return created.body.id;
}

test("consent signing rejects appointments whose service has no matching valid consent document", async () => {
  const suffix = Date.now().toString(36);
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  const serviceWithDoc = bootstrap.body.services[0];
  assert.ok(therapist?.id);
  assert.ok(serviceWithDoc?.categoryId);

  const otherCategory = await client.post("/api/categories", { body: { name: `No consent category ${suffix}` } });
  assert.equal(otherCategory.status, 201);
  const serviceWithoutDoc = await client.post("/api/services", {
    body: { name: `No consent service ${suffix}`, categoryId: otherCategory.body.id, duration: 30, price: 100 },
  });
  assert.equal(serviceWithoutDoc.status, 201);

  const consentId = await createConsentFixture(client, { categoryId: serviceWithDoc.categoryId, title: `Valid consent ${suffix}` });
  const clientId = await createClientFixture(client, therapist.id, suffix);
  const appointmentId = await createAppointmentFixture(client, { clientId, serviceId: serviceWithoutDoc.body.id, therapistId: therapist.id });
  const beforeFiles = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(beforeFiles.status, 200);

  const sign = await client.post(`/api/consents/${consentId}/sign`, {
    body: { clientId, appointmentId, signerName: "בדיקת שירות", signatureData, lang: "he" },
  });
  assert.equal(sign.status, 400);
  assert.equal(sign.body.error, "Valid consent document is required for this service.");

  const afterFiles = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(afterFiles.status, 200);
  assert.equal(afterFiles.body.length, beforeFiles.body.length);
});

test("consent signing rejects missing stored documents without creating a client file", async () => {
  const suffix = `${Date.now().toString(36)}-missing`;
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  const service = bootstrap.body.services[0];
  assert.ok(therapist?.id);
  assert.ok(service?.id);

  const consentId = await createConsentFixture(client, { categoryId: service.categoryId, title: `Missing file consent ${suffix}` });
  withDatabase((sqlite) => sqlite.prepare("UPDATE consent_templates SET path = ? WHERE id = ?").run(join(testServer.root, "missing-consent.pdf"), consentId));

  const clientId = await createClientFixture(client, therapist.id, suffix.replace(/\W/g, ""));
  const appointmentId = await createAppointmentFixture(client, { clientId, serviceId: service.id, therapistId: therapist.id });
  const beforeFiles = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(beforeFiles.status, 200);

  const sign = await client.post(`/api/consents/${consentId}/sign`, {
    body: { clientId, appointmentId, signerName: "בדיקת מסמך חסר", signatureData, lang: "he" },
  });
  assert.equal(sign.status, 400);
  assert.equal(sign.body.error, "Valid consent document is required.");

  const afterFiles = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(afterFiles.status, 200);
  assert.equal(afterFiles.body.length, beforeFiles.body.length);
});

test("consent signing with a valid template creates readable signed client file metadata", async () => {
  const suffix = `${Date.now().toString(36)}-valid`;
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);

  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  const service = bootstrap.body.services[0];
  assert.ok(therapist?.id);
  assert.ok(service?.id);

  const consentId = await createConsentFixture(client, { categoryId: service.categoryId, title: `טופס תקין ${suffix}` });
  const clientId = await createClientFixture(client, therapist.id, suffix.replace(/\W/g, ""));
  const appointmentId = await createAppointmentFixture(client, { clientId, serviceId: service.id, therapistId: therapist.id });

  const sign = await client.post(`/api/consents/${consentId}/sign`, {
    body: { clientId, appointmentId, signerName: "לקוח בדיקה", signatureData, lang: "he" },
  });
  assert.equal(sign.status, 201);
  assert.ok(sign.body.clientFileId);

  const files = await client.get(`/api/clients/${clientId}/files`);
  assert.equal(files.status, 200);
  const signedFile = files.body.find((item) => item.id === sign.body.clientFileId);
  assert.ok(signedFile);
  assert.match(signedFile.name, /^טופס חתום - /);
  assert.equal(signedFile.notes, "טופס משפטי חתום");
  assert.doesNotMatch(signedFile.name, /[�]/);
  assert.doesNotMatch(signedFile.notes, /[�]/);

  const download = await client.get(`/api/client-files/${sign.body.clientFileId}/download`, { responseType: "buffer" });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/pdf");
  assert.match(download.buffer.subarray(0, 5).toString("utf8"), /^%PDF/);
});
