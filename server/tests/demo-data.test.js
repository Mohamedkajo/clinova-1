import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(process.cwd());
const testDataDir = resolve(projectRoot, ".demo", "tests", `demo-data-${process.pid}`);
const databasePath = join(testDataDir, "clinova-alpha.sqlite");
const demoPassword = "ClinovaAlphaTest!42";

function runDemo(mode, overrides = {}) {
  return spawnSync(process.execPath, ["server/scripts/demo-data.js", mode], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: "",
      DEMO_DATA_DIR: testDataDir,
      DEMO_PASSWORD: demoPassword,
      ...overrides,
    },
    encoding: "utf8",
  });
}

test.after(() => {
  const expectedParent = resolve(projectRoot, ".demo", "tests");
  assert.ok(testDataDir.startsWith(expectedParent));
  rmSync(testDataDir, { recursive: true, force: true });
});

test("demo seed creates repeatable fictional workflow data in an isolated SQLite database", () => {
  const first = runDemo("reset");
  assert.equal(first.status, 0, first.stderr);
  assert.ok(existsSync(databasePath));

  let database = new DatabaseSync(databasePath);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM tenants").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM users").get().count, 4);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM clients").get().count, 4);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM appointments").get().count, 4);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM appointments WHERE status = 'pending' AND date = date('now')").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM crm_events WHERE type = 'appointment_status_changed'").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM clients WHERE email NOT LIKE '%@example.test'").get().count, 0);
  database.close();

  const second = runDemo("seed");
  assert.equal(second.status, 0, second.stderr);
  database = new DatabaseSync(databasePath);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM clients").get().count, 4);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM appointments").get().count, 4);
  database.close();
});

test("demo tooling refuses production, external data paths, and weak passwords", () => {
  const production = runDemo("seed", { NODE_ENV: "production" });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /disabled in production/i);

  const external = runDemo("seed", { DEMO_DATA_DIR: resolve(projectRoot, "data", "unsafe-demo") });
  assert.notEqual(external.status, 0);
  assert.match(external.stderr, /outside/i);

  const weak = runDemo("seed", { DEMO_PASSWORD: "short" });
  assert.notEqual(weak.status, 0);
  assert.match(weak.stderr, /at least 12/i);
});
