import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

const clinicRoles = {
  admin: "admin",
  reception: "reception",
  therapist: "sara",
};

const readExpectations = {
  admin: {
    "/api/clients": 200,
    "/api/appointments": 200,
    "/api/categories": 200,
    "/api/services": 200,
    "/api/gifts": 200,
    "/api/settings": 200,
    "/api/tenant": 200,
    "/api/tenant/domains": 403,
    "/api/crm": 200,
    "/api/crm-tasks": 200,
    "/api/consents": 200,
    "/api/message-logs": 200,
    "/api/reports": 200,
    "/api/audit": 200,
    "/api/search": 200,
  },
  reception: {
    "/api/clients": 200,
    "/api/appointments": 200,
    "/api/categories": 403,
    "/api/services": 403,
    "/api/gifts": 200,
    "/api/settings": 200,
    "/api/tenant": 200,
    "/api/tenant/domains": 403,
    "/api/crm": 200,
    "/api/crm-tasks": 200,
    "/api/consents": 200,
    "/api/message-logs": 200,
    "/api/reports": 403,
    "/api/audit": 403,
    "/api/search": 200,
  },
  therapist: {
    "/api/clients": 200,
    "/api/appointments": 200,
    "/api/categories": 403,
    "/api/services": 403,
    "/api/gifts": 403,
    "/api/settings": 200,
    "/api/tenant": 200,
    "/api/tenant/domains": 403,
    "/api/crm": 200,
    "/api/crm-tasks": 200,
    "/api/consents": 200,
    "/api/message-logs": 403,
    "/api/reports": 403,
    "/api/audit": 403,
    "/api/search": 200,
  },
};

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

test("clinic roles can login and /api/me preserves their identity", async () => {
  for (const [role, username] of Object.entries(clinicRoles)) {
    const { client, response } = await loginAs(clinicServer.baseUrl, username);
    assert.equal(response.status, 200, role);
    assert.equal(response.body.user.role, role, role);
    assert.equal(response.body.user.platformOwner, false, role);

    const me = await client.get("/api/me");
    assert.equal(me.status, 200, role);
    assert.equal(me.body.user.username, username, role);
    assert.equal(me.body.user.role, role, role);
  }
});

test("platform owner can login and /api/me exposes platform ownership", async () => {
  const { client, response } = await loginAs(platformServer.baseUrl, "admin");
  assert.equal(response.status, 200);
  assert.equal(response.body.user.platformOwner, true);

  const me = await client.get("/api/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, "admin");
  assert.equal(me.body.user.platformOwner, true);
});

test("bootstrap preserves role visibility and platform tenant visibility", async () => {
  const bootstraps = {};

  for (const [role, username] of Object.entries(clinicRoles)) {
    const { client } = await loginAs(clinicServer.baseUrl, username);
    const response = await client.get("/api/bootstrap");
    assert.equal(response.status, 200, role);
    assert.equal(response.body.user.role, role, role);
    assert.ok(Array.isArray(response.body.clients), role);
    assert.ok(Array.isArray(response.body.appointments), role);
    bootstraps[role] = response.body;
  }

  assert.ok(bootstraps.therapist.clients.length <= bootstraps.admin.clients.length);
  assert.deepEqual(bootstraps.therapist.audits, []);

  const { client: platformClient } = await loginAs(platformServer.baseUrl, "admin");
  const platformBootstrap = await platformClient.get("/api/bootstrap");
  assert.equal(platformBootstrap.status, 200);
  assert.equal(platformBootstrap.body.user.platformOwner, true);
  assert.ok(Array.isArray(platformBootstrap.body.platformTenants));
  assert.ok(platformBootstrap.body.platformTenants.length > 0);
});

test("clinic read-only endpoint permissions remain stable by role", async () => {
  for (const [role, username] of Object.entries(clinicRoles)) {
    const { client } = await loginAs(clinicServer.baseUrl, username);

    for (const [path, expectedStatus] of Object.entries(readExpectations[role])) {
      const response = await client.get(path);
      assert.equal(response.status, expectedStatus, `${role} GET ${path}`);
      if (expectedStatus === 200) {
        assert.ok(response.body !== null && typeof response.body === "object", `${role} GET ${path}`);
      } else {
        assert.equal(typeof response.body.error, "string", `${role} GET ${path}`);
      }
    }
  }
});

test("platform tenant read access remains separated from clinic and unauthenticated users", async () => {
  const unauthenticated = createHttpClient(clinicServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/platform/tenants")).status, 401);

  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  assert.equal((await clinicAdmin.get("/api/platform/tenants")).status, 403);

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const response = await platformOwner.get("/api/platform/tenants");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.tenants));
  assert.ok(response.body.tenants.length > 0);
});

test("platform health is visible only to the platform owner", async () => {
  const unauthenticated = createHttpClient(clinicServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/platform/health")).status, 401);

  for (const [role, username] of Object.entries(clinicRoles)) {
    const { client } = await loginAs(clinicServer.baseUrl, username);
    const response = await client.get("/api/platform/health");
    assert.equal(response.status, 403, role);
    assert.equal(response.body.error, "Platform owner access is required.", role);
  }

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const response = await platformOwner.get("/api/platform/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.api.ok, true);
  assert.equal(response.body.app.name, "Clinova");
  assert.equal(typeof response.body.app.version, "string");
  assert.equal(response.body.database.connectionOk, true);
  assert.equal(response.body.storage.uploads.exists, true);
  assert.equal(response.body.storage.uploads.writable, true);
  assert.equal(response.body.storage.backups.exists, true);
  assert.equal(response.body.storage.backups.writable, true);
  assert.equal(typeof response.body.runtime.uptimeSeconds, "number");
  assert.equal(typeof response.body.memory.rssBytes, "number");
  assert.equal(response.body.disk.paths.length, 2);
  assert.ok(response.body.disk.paths.every((item) => !("path" in item)));

  const serialized = JSON.stringify(response.body);
  for (const forbiddenKey of ["SESSION_SECRET", "DATABASE_URL", "WHATSAPP_ACCESS_TOKEN", "databasePath", "backupDir", "uploadsDir"]) {
    assert.ok(!serialized.includes(forbiddenKey), forbiddenKey);
  }
});

test("system export permissions and invalid restore remain non-destructive", async () => {
  const unauthenticated = createHttpClient(clinicServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/system/export")).status, 401);

  const { client: clinicAdmin } = await loginAs(clinicServer.baseUrl, "admin");
  assert.equal((await clinicAdmin.get("/api/system/export")).status, 403);

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const exportResponse = await platformOwner.get("/api/system/export");
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition") || "", /^attachment; filename="clinova-.+\.sqlite"$/);
  assert.equal(exportResponse.headers.get("content-type"), "application/vnd.sqlite3");

  const restoreResponse = await platformOwner.post("/api/system/restore", { body: {} });
  assert.equal(restoreResponse.status, 400);
  await assert.rejects(access(join(platformServer.backupsDir, "pending-restore.sqlite")));
  await assert.rejects(access(join(platformServer.backupsDir, "pending-restore.json")));
});
