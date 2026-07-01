import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHttpClient } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let testServer;

before(async () => {
  testServer = await startTestServer();
});

after(async () => {
  await testServer?.stop();
});

test("public smoke endpoints and static fallback remain available", async () => {
  const client = createHttpClient(testServer.baseUrl);

  assert.equal((await client.get("/api/health")).status, 200);
  assert.equal((await client.get("/api/version")).status, 200);
  assert.equal((await client.get("/")).status, 200);
  assert.equal((await client.get("/non-existing-static-file")).status, 200);
});

test("unmatched API methods return the same 404 response", async () => {
  const client = createHttpClient(testServer.baseUrl);
  const getResponse = await client.get("/api/unknown");
  const postResponse = await client.post("/api/unknown");

  assert.equal(getResponse.status, 404);
  assert.equal(postResponse.status, 404);
  assert.deepEqual(postResponse.body, getResponse.body);
  assert.equal(typeof getResponse.body.error, "string");
});

test("unauthenticated protected endpoints remain protected", async () => {
  const client = createHttpClient(testServer.baseUrl);
  const cases = [
    ["GET", "/api/bootstrap"],
    ["GET", "/api/platform/tenants"],
    ["GET", "/api/system/export"],
    ["POST", "/api/system/restore"],
  ];

  for (const [method, path] of cases) {
    const response = await client.request(method, path);
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});

test("signup remains disabled with its exact response", async () => {
  const client = createHttpClient(testServer.baseUrl);
  const response = await client.post("/api/signup", { body: {} });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    error: "Clinic creation is managed by the platform owner.",
  });
});

test("seeded clinic admin can login, read me/bootstrap, and logout", async () => {
  const client = createHttpClient(testServer.baseUrl);
  const login = await client.post("/api/login", {
    body: { username: "admin", password: "ChangeMe123!", clinicIdentifier: "demo" },
  });

  assert.equal(login.status, 200);
  assert.equal(login.body.user.username, "admin");
  assert.equal(login.body.user.role, "admin");

  const me = await client.get("/api/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, "admin");

  const bootstrap = await client.get("/api/bootstrap");
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.body.user.username, "admin");

  const logout = await client.post("/api/logout");
  assert.equal(logout.status, 200);
  assert.deepEqual(logout.body, { ok: true });

  // Current API contract: /api/me is public and returns a null user after logout.
  const meAfterLogout = await client.get("/api/me");
  assert.equal(meAfterLogout.status, 200);
  assert.equal(meAfterLogout.body.user, null);
  assert.equal((await client.get("/api/bootstrap")).status, 401);
});

test("invalid broad-resource subpaths return the final API 404", async () => {
  const client = createHttpClient(testServer.baseUrl);
  const login = await client.post("/api/login", {
    body: { username: "reception", password: "ChangeMe123!", clinicIdentifier: "demo" },
  });
  assert.equal(login.status, 200);

  const paths = [
    "/api/clients/3/unknown",
    "/api/appointments/1/unknown",
    "/api/consents/1/unknown",
    "/api/categories/1/unknown",
    "/api/services/1/unknown",
    "/api/gifts/1/unknown",
    "/api/tenant/domains/1/unknown",
  ];

  const expectedBody = (await client.get("/api/unknown")).body;
  for (const path of paths) {
    const response = await client.get(path);
    assert.equal(response.status, 404, path);
    assert.deepEqual(response.body, expectedBody, path);
  }
});
