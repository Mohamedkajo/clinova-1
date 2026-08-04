import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import pg from "pg";
import { verifyPassword, hashPassword } from "../security.js";

const rawDatabaseUrl = String(process.env.POSTGRES_TEST_URL || "");
const platformPassword = "FirstOwner7!Safe";
const clinicPassword = "FirstClinic7!Safe";
let databaseUrl;
let pool;
let root;

function safeDatabaseUrl() {
  if (!rawDatabaseUrl) throw new Error("POSTGRES_TEST_URL is required for production initialization tests.");
  const parsed = new URL(rawDatabaseUrl);
  if (!/(?:^|_)test(?:$|_)/i.test(parsed.pathname.slice(1))) throw new Error("POSTGRES_TEST_URL must name a test database.");
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) throw new Error("Production initialization tests require local PostgreSQL.");
  return parsed.toString();
}

function environment(overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: "production",
    CLINOVA_SKIP_ENV_FILE: "true",
    APP_URL: "https://clinova-init.invalid",
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: "false",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    SESSION_SECRET: "production-init-test-session-secret-longer-than-forty-eight-characters",
    COOKIE_SECURE: "true",
    TRUSTED_PROXY_IPS: "127.0.0.1,::1",
    CORS_ALLOWED_ORIGINS: "https://clinova-init.invalid",
    UPLOAD_DIR: join(root, "uploads"),
    BACKUP_DIR: join(root, "backups"),
    LOG_DIR: join(root, "logs"),
    UPLOAD_MAX_MB: "10",
    BACKUP_ENABLED: "true",
    BACKUP_RETENTION: "2",
    WORKER_POLL_INTERVAL_MS: "250",
    WORKER_STALE_AFTER_MS: "5000",
    WORKER_RETRY_BASE_MS: "250",
    INIT_PLATFORM_USERNAME: "platform-chief",
    INIT_PLATFORM_EMAIL: "platform@switchso.invalid",
    INIT_PLATFORM_NAME: "Platform Chief",
    INIT_PLATFORM_PASSWORD: platformPassword,
    INIT_CLINIC_NAME: "First Clinic",
    INIT_CLINIC_SLUG: "first-clinic",
    INIT_CLINIC_ADMIN_USERNAME: "clinic-chief",
    INIT_CLINIC_ADMIN_EMAIL: "clinic@switchso.invalid",
    INIT_CLINIC_ADMIN_NAME: "Clinic Chief",
    INIT_CLINIC_ADMIN_PASSWORD: clinicPassword,
    ...overrides,
  };
}

function runNode(script, overrides = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment(overrides),
  });
  return { code: result.status, output: `${result.stdout || ""}${result.stderr || ""}` };
}

async function resetMigratedDatabase() {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  const migration = runNode("server/scripts/migrate.js");
  assert.equal(migration.code, 0, migration.output);
  assert.match(migration.output, /\"databaseEngine\":\"postgresql\"/);
  const version = await pool.query("SELECT version FROM schema_migrations WHERE version = '2026.08.01.1'");
  assert.equal(version.rowCount, 1);
}

async function databaseSnapshot() {
  const result = {};
  for (const table of ["tenants", "users", "subscriptions", "clinic_settings", "audit_log"]) {
    const order = table === "clinic_settings" ? "tenant_id, key" : "id";
    const rows = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
    result[table] = rows.rows;
  }
  return result;
}

async function seedTenant({ slug = "existing-clinic", username, email, platformOwner = false, active = true } = {}) {
  const tenant = await pool.query(`
    INSERT INTO tenants (name, slug, status, plan, billing_email)
    VALUES ('Existing Clinic', $1, 'active', 'starter', '') RETURNING id
  `, [slug]);
  if (username || email || platformOwner) {
    await pool.query(`
      INSERT INTO users (tenant_id, username, email, password_hash, name, title, role, is_platform_owner, active)
      VALUES ($1, $2, $3, $4, 'Existing User', 'Existing', 'admin', $5, $6)
    `, [tenant.rows[0].id, username || "existing-user", email || "existing@switchso.invalid", hashPassword("Existing7!Safe"), platformOwner ? 1 : 0, active ? 1 : 0]);
  }
  return Number(tenant.rows[0].id);
}

before(async () => {
  databaseUrl = safeDatabaseUrl();
  root = await mkdtemp(join(tmpdir(), "clinova-production-init-pg-"));
  await Promise.all([mkdir(join(root, "uploads")), mkdir(join(root, "backups")), mkdir(join(root, "logs"))]);
  pool = new pg.Pool({ connectionString: databaseUrl });
});

after(async () => {
  await pool?.end();
  await rm(root, { recursive: true, force: true });
});

test("production initialization is transactional, idempotent, audited, and conflict-safe on PostgreSQL", async (t) => {
  await t.test("initializes an empty migrated database with secure users, provisioning defaults, and audits", async () => {
    await resetMigratedDatabase();
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM tenants")).rows[0].count), 0);
    const result = runNode("server/scripts/production-init.js");
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, new RegExp(platformPassword));
    assert.doesNotMatch(result.output, new RegExp(clinicPassword));
    assert.doesNotMatch(result.output, /scrypt:/);
    const summary = JSON.parse(result.output.trim());
    assert.equal(summary.status, "PRODUCTION_INITIALIZED");
    assert.equal(summary.platformOwner.username, "platform-chief");
    assert.equal(summary.clinic.slug, "first-clinic");
    assert.equal(summary.clinic.administrator.username, "clinic-chief");
    assert.deepEqual(Object.keys(summary.platformOwner).sort(), ["id", "username"]);

    const users = await pool.query("SELECT username, email, password_hash, role, is_platform_owner, active FROM users ORDER BY is_platform_owner DESC");
    assert.equal(users.rowCount, 2);
    const owner = users.rows.find((row) => Number(row.is_platform_owner) === 1);
    const administrator = users.rows.find((row) => Number(row.is_platform_owner) === 0);
    assert.equal(owner.username, "platform-chief");
    assert.equal(owner.role, "admin");
    assert.equal(Number(owner.active), 1);
    assert.equal(verifyPassword(platformPassword, owner.password_hash), true);
    assert.notEqual(owner.password_hash, platformPassword);
    assert.equal(administrator.username, "clinic-chief");
    assert.equal(verifyPassword(clinicPassword, administrator.password_hash), true);

    const tenant = await pool.query("SELECT id, slug FROM tenants");
    assert.equal(tenant.rowCount, 1);
    assert.equal(tenant.rows[0].slug, "first-clinic");
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM subscriptions WHERE tenant_id = $1", [tenant.rows[0].id])).rows[0].count), 1);
    assert.ok(Number((await pool.query("SELECT COUNT(*) AS count FROM clinic_settings WHERE tenant_id = $1", [tenant.rows[0].id])).rows[0].count) >= 17);
    const audits = await pool.query("SELECT action, details FROM audit_log ORDER BY id");
    assert.deepEqual(audits.rows.map((row) => row.action), ["platform_create_tenant", "production_initialize"]);
    assert.doesNotMatch(JSON.stringify(audits.rows), /FirstOwner7|FirstClinic7|scrypt:/);
  });

  await t.test("a second execution returns the required code and leaves all records unchanged", async () => {
    const before = await databaseSnapshot();
    const result = runNode("server/scripts/production-init.js");
    assert.notEqual(result.code, 0);
    assert.equal(result.output.trim(), "PRODUCTION_ALREADY_INITIALIZED");
    assert.deepEqual(await databaseSnapshot(), before);
  });

  await t.test("an existing active Platform Owner is rejected without writes", async () => {
    await resetMigratedDatabase();
    await seedTenant({ platformOwner: true });
    const before = await databaseSnapshot();
    const result = runNode("server/scripts/production-init.js");
    assert.notEqual(result.code, 0);
    assert.equal(result.output.trim(), "PRODUCTION_ALREADY_INITIALIZED");
    assert.deepEqual(await databaseSnapshot(), before);
  });

  await t.test("conflicting username, email, and tenant slug are rejected without modifying existing data", async () => {
    const cases = [
      { seed: { username: "platform-chief" }, code: "PRODUCTION_CONFLICT_USERNAME" },
      { seed: { email: "clinic@switchso.invalid" }, code: "PRODUCTION_CONFLICT_EMAIL" },
      { seed: { slug: "first-clinic" }, code: "PRODUCTION_CONFLICT_TENANT_SLUG" },
    ];
    for (const item of cases) {
      await resetMigratedDatabase();
      await seedTenant(item.seed);
      const before = await databaseSnapshot();
      const result = runNode("server/scripts/production-init.js");
      assert.notEqual(result.code, 0);
      assert.equal(result.output.trim(), item.code);
      assert.deepEqual(await databaseSnapshot(), before);
    }
  });

  await t.test("a partial clinic state is rejected rather than guessed or repaired", async () => {
    await resetMigratedDatabase();
    await seedTenant();
    const before = await databaseSnapshot();
    const result = runNode("server/scripts/production-init.js");
    assert.notEqual(result.code, 0);
    assert.equal(result.output.trim(), "PRODUCTION_PARTIAL_STATE");
    assert.deepEqual(await databaseSnapshot(), before);
  });

  await t.test("the exact legacy schema placeholder is removable but custom tenant data is not", async () => {
    await resetMigratedDatabase();
    await pool.query("INSERT INTO tenants (id, name, slug, status, plan, billing_email) VALUES (1, 'Clinova Clinic', 'primary', 'active', 'starter', '')");
    await pool.query("INSERT INTO clinic_settings (tenant_id, key, value) VALUES (1, 'clinicName', 'Clinova')");
    const result = runNode("server/scripts/production-init.js");
    assert.equal(result.code, 0, result.output);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM tenants WHERE slug = 'primary'")).rows[0].count), 0);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM tenants WHERE slug = 'first-clinic'")).rows[0].count), 1);
  });

  await t.test("a simulated failure rolls back tenant, users, settings, subscriptions, and audits", async () => {
    await resetMigratedDatabase();
    const result = runNode("server/tests/helpers/production-init-failure.js");
    assert.notEqual(result.code, 0);
    assert.equal(result.output.trim(), "PRODUCTION_INITIALIZATION_FAILED");
    assert.doesNotMatch(result.output, /FirstOwner7|FirstClinic7|scrypt:/);
    for (const table of ["tenants", "users", "subscriptions", "clinic_settings", "audit_log"]) {
      assert.equal(Number((await pool.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count), 0, table);
    }
  });
});
