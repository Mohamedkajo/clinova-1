import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { validateProductionEnvironment } from "../production-config.js";
import { startTestServer } from "./helpers/test-server.js";

let server;

function productionEnv(root, overrides = {}) {
  return {
    ...process.env,
    NODE_ENV: "production",
    CLINOVA_SKIP_ENV_FILE: "true",
    APP_URL: "https://clinova.example.test",
    DATABASE_URL: "postgres://clinova:CorrectHorseBatteryStaple@127.0.0.1:5432/clinova",
    DATABASE_SSL: "false",
    SESSION_SECRET: "a-production-session-value-that-is-longer-than-forty-eight-characters",
    COOKIE_SECURE: "true",
    TRUSTED_PROXY_IPS: "127.0.0.1,::1",
    CORS_ALLOWED_ORIGINS: "https://clinova.example.test",
    UPLOAD_DIR: join(root, "uploads"),
    BACKUP_DIR: join(root, "backups"),
    LOG_DIR: join(root, "logs"),
    UPLOAD_MAX_MB: "10",
    BACKUP_ENABLED: "true",
    BACKUP_RETENTION: "30",
    WORKER_POLL_INTERVAL_MS: "5000",
    WORKER_STALE_AFTER_MS: "120000",
    WORKER_RETRY_BASE_MS: "5000",
    ...overrides,
  };
}

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.stop();
});

test("release version is consistent across official metadata and notes", async () => {
  const [packageInfo, lockInfo, version, index, notes] = await Promise.all([
    readFile(resolve("package.json"), "utf8").then(JSON.parse),
    readFile(resolve("package-lock.json"), "utf8").then(JSON.parse),
    readFile(resolve("VERSION"), "utf8"),
    readFile(resolve("client/index.html"), "utf8"),
    readFile(resolve("docs/releases/1.8.0-rc.1.md"), "utf8"),
  ]);
  assert.equal(packageInfo.version, "1.8.0-rc.1");
  assert.equal(lockInfo.version, packageInfo.version);
  assert.equal(lockInfo.packages[""].version, packageInfo.version);
  assert.equal(version.trim(), packageInfo.version);
  assert.match(index, /app\.js\?v=1\.8\.0-rc\.1/);
  assert.match(notes, /controlled Release Candidate/i);
});

test("production validation rejects SQLite, weak secrets, insecure cookies, and unsafe storage without echoing values", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinova-rc-validation-"));
  try {
    const unsafeSecret = "do-not-echo-this-secret";
    const invalid = productionEnv(root, {
      DATABASE_URL: "",
      SESSION_SECRET: unsafeSecret,
      COOKIE_SECURE: "false",
      APP_URL: "http://clinova.example.test",
      TRUSTED_PROXY_IPS: "",
      BACKUP_ENABLED: "false",
      BACKUP_DIR: join(root, "same"),
      UPLOAD_DIR: join(root, "same"),
      LOG_DIR: resolve("client", "logs"),
    });
    const result = validateProductionEnvironment(invalid);
    assert.equal(result.ok, false);
    const output = result.errors.join("\n");
    assert.match(output, /DATABASE_URL is required/);
    assert.match(output, /COOKIE_SECURE must be true/);
    assert.match(output, /APP_URL must use HTTPS/);
    assert.match(output, /TRUSTED_PROXY_IPS is required/);
    assert.match(output, /must be different directories/);
    assert.doesNotMatch(output, new RegExp(unsafeSecret));
    assert.equal(validateProductionEnvironment(productionEnv(root)).ok, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("production validation CLI creates private runtime directories and never reports secret values", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinova-rc-cli-"));
  try {
    const env = productionEnv(root);
    const result = spawnSync(process.execPath, ["server/scripts/validate-production.js"], {
      cwd: process.cwd(), env, encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true, environment: "production", database: "postgresql" });
    assert.equal(`${result.stdout}${result.stderr}`.includes(env.SESSION_SECRET), false);
    for (const name of ["uploads", "backups", "logs"]) assert.equal(existsSync(join(root, name)), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("security headers are applied and unapproved cross-origin API requests are rejected", async () => {
  const response = await fetch(`${server.baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const policy = response.headers.get("content-security-policy") || "";
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /script-src 'self'/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");

  const blocked = await fetch(`${server.baseUrl}/api/health`, { headers: { Origin: "https://attacker.example" } });
  assert.equal(blocked.status, 403);
  assert.deepEqual(await blocked.json(), { error: "Origin is not allowed." });
});

test("upload backup creates and verifies a retained archive without exposing source paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinova-rc-uploads-"));
  try {
    await mkdir(join(root, "uploads", "tenants", "1"), { recursive: true });
    await writeFile(join(root, "uploads", "tenants", "1", "sample.pdf"), "%PDF-1.4\nrelease-candidate\n");
    const result = spawnSync(process.execPath, ["server/scripts/backup-uploads.js"], {
      cwd: process.cwd(), env: productionEnv(root), encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.verified, true);
    assert.match(payload.archive, /^clinova-uploads-.*\.tar\.gz$/);
    assert.equal(existsSync(join(root, "backups", payload.archive)), true);
    assert.equal(result.stdout.includes(root), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("production process and proxy definitions include only controlled runtime processes", () => {
  const ecosystem = readFileSync(resolve("ecosystem.config.cjs"), "utf8");
  const nginx = readFileSync(resolve("deploy/nginx/clinova.conf"), "utf8");
  const packageInfo = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  assert.match(ecosystem, /clinova-worker/);
  assert.match(ecosystem, /clinova-backup/);
  assert.match(ecosystem, /wait_ready:\s*true/);
  assert.doesNotMatch(packageInfo.scripts["start:production"], /demo|sqlite/i);
  assert.match(nginx, /listen 443 ssl/);
  assert.match(nginx, /return 301 https:/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000/);
});
