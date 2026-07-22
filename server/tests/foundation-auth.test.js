import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createHttpClient } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let server;

before(async () => {
  server = await startTestServer({ envOverrides: { NODE_ENV: "development" } });
});

after(async () => {
  await server?.stop();
});

test("foundation authentication covers invalid login, restoration, protection, and logout", async () => {
  const anonymous = createHttpClient(server.baseUrl);

  const protectedBeforeLogin = await anonymous.get("/api/bootstrap");
  assert.equal(protectedBeforeLogin.status, 401);

  const invalid = await anonymous.post("/api/login", {
    body: { identifier: "admin", clinicIdentifier: "demo", password: "incorrect-password" },
  });
  assert.equal(invalid.status, 401);
  assert.equal(typeof invalid.body.error, "string");

  const valid = await anonymous.post("/api/login", {
    body: { identifier: "admin", clinicIdentifier: "demo", password: "ChangeMe123!" },
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.user.username, "admin");
  assert.equal(valid.body.user.role, "admin");
  const cookieHeader = valid.headers.get("set-cookie") || "";
  assert.match(cookieHeader, /clinic_session=/);
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);

  const restored = await anonymous.get("/api/me");
  assert.equal(restored.status, 200);
  assert.equal(restored.body.user.username, "admin");

  const protectedAfterLogin = await anonymous.get("/api/bootstrap");
  assert.equal(protectedAfterLogin.status, 200);
  assert.equal(protectedAfterLogin.body.user.username, "admin");

  const logout = await anonymous.post("/api/logout");
  assert.equal(logout.status, 200);
  assert.equal(logout.body.ok, true);
  assert.match(logout.headers.get("set-cookie") || "", /clinic_session=;/);

  const afterLogout = await anonymous.get("/api/me");
  assert.equal(afterLogout.status, 200);
  assert.equal(afterLogout.body.user, null);
  assert.equal((await anonymous.get("/api/bootstrap")).status, 401);
});
