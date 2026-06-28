import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { loginAs } from "./helpers/http-client.js";
import {
  assertSafeRestoreEnvironment,
  cleanupRestoreEnvironment,
  expectRestoreExit,
  startInitializedRestoreServer,
  startRestoreServer,
  stopRestoreServer,
} from "./helpers/restore-test-server.js";

function pathIsInside(parent, child) {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("valid restore applies exported SQLite backup in a disposable environment", async () => {
  let serverA;
  let serverB;
  let root;
  const suffix = Date.now().toString(36);
  const markerSlug = `restore-marker-${suffix}`;

  try {
    serverA = await startInitializedRestoreServer({ initializationRuns: 2 });
    root = serverA.root;
    assert.equal(assertSafeRestoreEnvironment(serverA), true);

    const { client: platformOwner, response: login } = await loginAs(serverA.baseUrl, "admin");
    assert.equal(login.status, 200);
    assert.equal(login.body.user.platformOwner, true);

    const exported = await platformOwner.get("/api/system/export", { responseType: "buffer" });
    assert.equal(exported.status, 200);
    assert.ok(exported.buffer.length > 0);

    const marker = await platformOwner.post("/api/platform/tenants", {
      body: {
        clinicName: `Restore Marker ${suffix}`,
        slug: markerSlug,
        ownerName: "Restore Marker Owner",
        email: `restore-marker-${suffix}@example.test`,
        password: "ChangeMe123!",
        plan: "starter",
        status: "trial",
      },
    });
    assert.equal(marker.status, 201);

    const withMarker = await platformOwner.get("/api/platform/tenants");
    assert.ok(withMarker.body.tenants.some((tenant) => tenant.slug === markerSlug));

    const form = new FormData();
    form.append("backup", new Blob([exported.buffer], { type: "application/vnd.sqlite3" }), "valid-restore.sqlite");
    const restore = await platformOwner.post("/api/system/restore", { body: form });
    assert.equal(restore.status, 200);
    assert.equal(restore.body.ok, true);
    assert.equal(restore.body.restarting, true);
    assert.equal(typeof restore.body.safetyBackup, "string");
    assert.equal(restore.body.safetyBackup.includes("/") || restore.body.safetyBackup.includes("\\"), false);
    const safetyBackupPath = join(serverA.backupsDir, restore.body.safetyBackup);
    assert.ok(pathIsInside(serverA.backupsDir, safetyBackupPath));
    assert.equal(await pathExists(safetyBackupPath), true);

    await expectRestoreExit(serverA);
    assert.equal(await pathExists(`${serverA.backupsDir}/pending-restore.sqlite`), true);
    assert.equal(await pathExists(`${serverA.backupsDir}/pending-restore.json`), true);

    serverB = await startRestoreServer(serverA);
    const { client: restoredOwner, response: restoredLogin } = await loginAs(serverB.baseUrl, "admin");
    assert.equal(restoredLogin.status, 200);
    assert.equal(restoredLogin.body.user.platformOwner, true);

    const restoredTenants = await restoredOwner.get("/api/platform/tenants");
    assert.equal(restoredTenants.status, 200);
    assert.ok(!restoredTenants.body.tenants.some((tenant) => tenant.slug === markerSlug));

    assert.equal(await pathExists(`${serverB.backupsDir}/pending-restore.sqlite`), false);
    assert.equal(await pathExists(`${serverB.backupsDir}/pending-restore.json`), false);
    const backupFiles = await readdir(serverB.backupsDir);
    assert.ok(backupFiles.some((name) => name.startsWith("before-pending-restore-") && name.endsWith(".sqlite")));
  } finally {
    await stopRestoreServer(serverA);
    await stopRestoreServer(serverB);
    if (serverA) await cleanupRestoreEnvironment(serverA);
  }

  assert.equal(await pathExists(root), false);
});
