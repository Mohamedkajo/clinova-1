import assert from "node:assert/strict";
import { access, readdir, stat } from "node:fs/promises";
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
    "/api/reports": 200,
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
    "/api/reports": 200,
    "/api/audit": 403,
    "/api/search": 200,
  },
};

let clinicServer;
let platformServer;
let developmentServer;

before(async () => {
  [clinicServer, platformServer, developmentServer] = await Promise.all([
    startTestServer(),
    startTestServer({ initializationRuns: 2 }),
    startTestServer({ envOverrides: { NODE_ENV: "development" } }),
  ]);
});

after(async () => {
  await Promise.all([clinicServer?.stop(), platformServer?.stop(), developmentServer?.stop()]);
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

test("development seed provides a dedicated platform owner without elevating clinic admin", async () => {
  const { response: adminLogin } = await loginAs(developmentServer.baseUrl, "admin");
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.platformOwner, false);

  const { client: ownerClient, response: ownerLogin } = await loginAs(developmentServer.baseUrl, "owner");
  assert.equal(ownerLogin.status, 200);
  assert.equal(ownerLogin.body.user.username, "owner");
  assert.equal(ownerLogin.body.user.role, "admin");
  assert.equal(ownerLogin.body.user.platformOwner, true);

  const health = await ownerClient.get("/api/platform/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.api.ok, true);
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

test("platform backup center is restricted and creates backups only in the configured directory", async () => {
  const unauthenticated = createHttpClient(clinicServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/platform/backups")).status, 401);
  assert.equal((await unauthenticated.post("/api/platform/backups")).status, 401);

  for (const [role, username] of Object.entries(clinicRoles)) {
    const { client } = await loginAs(clinicServer.baseUrl, username);
    assert.equal((await client.get("/api/platform/backups")).status, 403, `${role} GET`);
    assert.equal((await client.post("/api/platform/backups")).status, 403, `${role} POST`);
  }

  const { client: platformOwner } = await loginAs(platformServer.baseUrl, "admin");
  const before = await platformOwner.get("/api/platform/backups");
  assert.equal(before.status, 200);
  assert.equal(typeof before.body.count, "number");
  assert.ok(Array.isArray(before.body.backups));

  const created = await platformOwner.post("/api/platform/backups");
  assert.equal(created.status, 201);
  assert.equal(created.body.ok, true);
  assert.match(created.body.backup.filename, /^clinova-manual-\d{8}-\d{6}\.sqlite$/);
  assert.equal(created.body.backup.id, created.body.backup.filename);
  assert.equal(typeof created.body.backup.createdAt, "string");
  assert.ok(created.body.backup.size > 0);

  const files = await readdir(platformServer.backupsDir);
  assert.ok(files.includes(created.body.backup.filename));
  const createdStats = await stat(join(platformServer.backupsDir, created.body.backup.filename));
  assert.ok(createdStats.isFile());

  const after = await platformOwner.get("/api/platform/backups");
  assert.equal(after.status, 200);
  assert.equal(after.body.count, before.body.count + 1);
  assert.equal(after.body.latest.filename, created.body.backup.filename);
  assert.ok(after.body.backups.some((item) => item.filename === created.body.backup.filename));

  const serialized = JSON.stringify({ created: created.body, listed: after.body });
  assert.ok(!serialized.includes(platformServer.backupsDir));
  assert.ok(!serialized.includes(platformServer.databasePath));
  assert.ok(!serialized.includes("DATABASE_URL"));
  assert.ok(!serialized.includes("SESSION_SECRET"));
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
