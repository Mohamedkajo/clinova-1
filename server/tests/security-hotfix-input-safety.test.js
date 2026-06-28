import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { publicErrorResponse } from "../shared/http/public-error.js";
import { loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let testServer;

before(async () => {
  testServer = await startTestServer();
});

after(async () => {
  await testServer?.stop();
});

async function uploadClientFile(client, clientId, { bytes, type, name }) {
  const form = new FormData();
  form.append("name", name);
  form.append("file", new Blob([bytes], { type }), name);
  return client.post(`/api/clients/${clientId}/files`, { body: form });
}

test("bounded JSON reader preserves valid requests and rejects invalid or oversized bodies", async () => {
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);
  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  assert.ok(therapist);

  const valid = await client.post("/api/clients", {
    body: {
      fname: "Body",
      lname: "Limit",
      phone: "0509000001",
      therapistId: therapist.id,
    },
  });
  assert.equal(valid.status, 201);

  const invalid = await client.post("/api/clients", {
    body: "{invalid-json",
    headers: { "content-type": "application/json" },
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(invalid.body, { error: "Invalid JSON body" });

  const oversized = await client.post("/api/clients", {
    body: JSON.stringify({ notes: "x".repeat(300 * 1024) }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, { error: "Request body is too large." });

  const oversizedSignature = await client.post("/api/consents/1/sign", {
    body: JSON.stringify({ signatureData: `data:image/png;base64,${"A".repeat(2 * 1024 * 1024)}` }),
    headers: { "content-type": "application/json" },
  });
  assert.equal(oversizedSignature.status, 413);
  assert.deepEqual(oversizedSignature.body, { error: "Request body is too large." });
});

test("uploads validate magic bytes in addition to MIME type and extension", async () => {
  const { client, response: login } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(login.status, 200);
  const bootstrap = await client.get("/api/bootstrap");
  const therapist = bootstrap.body.users.find((user) => user.username === "sara");
  const createdClient = await client.post("/api/clients", {
    body: {
      fname: "Magic",
      lname: "Bytes",
      phone: "0509000002",
      therapistId: therapist.id,
    },
  });
  assert.equal(createdClient.status, 201);
  const clientId = createdClient.body.id;

  const fakePdf = await uploadClientFile(client, clientId, {
    bytes: Buffer.from("<script>alert(1)</script>"),
    type: "application/pdf",
    name: "fake.pdf",
  });
  assert.equal(fakePdf.status, 400);
  assert.deepEqual(fakePdf.body, { error: "File content does not match its type." });

  const validPdf = await uploadClientFile(client, clientId, {
    bytes: Buffer.from("%PDF-1.4\n%%EOF\n"),
    type: "application/pdf",
    name: "valid.pdf",
  });
  assert.equal(validPdf.status, 201);

  const fakePng = await uploadClientFile(client, clientId, {
    bytes: Buffer.from("not a png"),
    type: "image/png",
    name: "fake.png",
  });
  assert.equal(fakePng.status, 400);

  const validPng = await uploadClientFile(client, clientId, {
    bytes: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("test"),
    ]),
    type: "image/png",
    name: "valid.png",
  });
  assert.equal(validPng.status, 201);

  const fakeConsent = new FormData();
  fakeConsent.append("title", "Fake consent");
  fakeConsent.append("file", new Blob(["plain text"], { type: "application/pdf" }), "fake-consent.pdf");
  const fakeConsentResponse = await client.post("/api/consents", { body: fakeConsent });
  assert.equal(fakeConsentResponse.status, 400);
  assert.deepEqual(fakeConsentResponse.body, { error: "File content does not match its type." });
});

test("production internal errors are generic while controlled and non-production errors remain useful", () => {
  const internal = new Error("SQLITE_CONSTRAINT at C:\\private\\clinic.sqlite");
  assert.deepEqual(publicErrorResponse(internal, "production"), {
    status: 500,
    body: { error: "Internal server error." },
  });
  assert.deepEqual(publicErrorResponse(internal, "test"), {
    status: 500,
    body: { error: internal.message },
  });

  const controlled = new Error("Invalid JSON body");
  controlled.status = 400;
  assert.deepEqual(publicErrorResponse(controlled, "production"), {
    status: 400,
    body: { error: "Invalid JSON body" },
  });
});
