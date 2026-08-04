import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import {
  clearProductionInitEnvironment,
  ProductionInitError,
  readProductionInitInput,
} from "../production-init-input.js";

const temporaryRoots = [];

function validInput(overrides = {}) {
  return {
    INIT_PLATFORM_USERNAME: "platform-chief",
    INIT_PLATFORM_EMAIL: "platform@switchso.invalid",
    INIT_PLATFORM_NAME: "Platform Chief",
    INIT_PLATFORM_PASSWORD: "FirstOwner7!Safe",
    INIT_CLINIC_NAME: "First Clinic",
    INIT_CLINIC_SLUG: "first-clinic",
    INIT_CLINIC_ADMIN_USERNAME: "clinic-chief",
    INIT_CLINIC_ADMIN_EMAIL: "clinic@switchso.invalid",
    INIT_CLINIC_ADMIN_NAME: "Clinic Chief",
    INIT_CLINIC_ADMIN_PASSWORD: "FirstClinic7!Safe",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("production initialization input accepts the current authentication policy", () => {
  const input = readProductionInitInput(validInput());
  assert.equal(input.platform.username, "platform-chief");
  assert.equal(input.clinic.slug, "first-clinic");
  assert.equal(input.clinic.administrator.username, "clinic-chief");
});

test("missing initialization values are rejected without their values", () => {
  const env = validInput({ INIT_PLATFORM_EMAIL: "" });
  assert.throws(() => readProductionInitInput(env), (error) => {
    assert.ok(error instanceof ProductionInitError);
    assert.equal(error.code, "PRODUCTION_INIT_INPUT_MISSING:INIT_PLATFORM_EMAIL");
    assert.doesNotMatch(error.message, /FirstOwner7|FirstClinic7/);
    return true;
  });
});

test("weak, demo, and placeholder passwords are rejected", () => {
  for (const password of ["short", "ChangeMe123!", "ClinovaAlphaDemo!", "replace-with-secret"]) {
    assert.throws(
      () => readProductionInitInput(validInput({ INIT_PLATFORM_PASSWORD: password })),
      /PRODUCTION_INIT_INPUT_INVALID:INIT_PLATFORM_PASSWORD_/,
    );
  }
});

test("known demo usernames and demo clinic identity are rejected", () => {
  assert.throws(() => readProductionInitInput(validInput({ INIT_PLATFORM_USERNAME: "owner" })), /INIT_PLATFORM_USERNAME_DEMO/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_CLINIC_ADMIN_USERNAME: "admin" })), /INIT_CLINIC_ADMIN_USERNAME_DEMO/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_CLINIC_SLUG: "demo" })), /INIT_CLINIC_DEMO/);
});

test("invalid email, slug, username, and duplicate identities are rejected", () => {
  assert.throws(() => readProductionInitInput(validInput({ INIT_PLATFORM_EMAIL: "invalid" })), /INIT_PLATFORM_EMAIL/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_CLINIC_SLUG: "Invalid Slug" })), /INIT_CLINIC_SLUG/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_PLATFORM_USERNAME: "bad username" })), /INIT_PLATFORM_USERNAME/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_CLINIC_ADMIN_USERNAME: "platform-chief" })), /INIT_USERNAME_CONFLICT/);
  assert.throws(() => readProductionInitInput(validInput({ INIT_CLINIC_ADMIN_EMAIL: "platform@switchso.invalid" })), /INIT_EMAIL_CONFLICT/);
});

test("initialization environment values are explicitly cleared", () => {
  const env = validInput();
  clearProductionInitEnvironment(env);
  assert.deepEqual(Object.keys(env), []);
});

test("production CLI rejects non-PostgreSQL execution before database initialization", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinova-production-init-sqlite-"));
  temporaryRoots.push(root);
  const secret = "NeverEchoThisOwner7!";
  const result = spawnSync(process.execPath, ["server/scripts/production-init.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...validInput({ INIT_PLATFORM_PASSWORD: secret }),
      NODE_ENV: "production",
      CLINOVA_SKIP_ENV_FILE: "true",
      DATABASE_URL: "",
      DATABASE_PATH: join(root, "must-not-exist.sqlite"),
    },
  });
  const output = `${result.stdout}${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /PRODUCTION_POSTGRESQL_REQUIRED/);
  assert.doesNotMatch(output, new RegExp(secret));
});

test("official command and one-time deployment order are documented", async () => {
  const [packageInfo, deploy, runbook, releaseNotes, envExample] = await Promise.all([
    readFile(resolve("package.json"), "utf8").then(JSON.parse),
    readFile(resolve("PRODUCTION-DEPLOY.md"), "utf8"),
    readFile(resolve("docs/production/SPRINT-2.7-RELEASE-CANDIDATE.md"), "utf8"),
    readFile(resolve("docs/releases/1.8.0-rc.1.md"), "utf8"),
    readFile(resolve(".env.production.example"), "utf8"),
  ]);
  assert.equal(packageInfo.scripts["production:init"], "node server/scripts/production-init.js");
  for (const content of [deploy, runbook]) {
    assert.match(content, /npm ci[\s\S]*npm run release:validate[\s\S]*npm run db:migrate[\s\S]*npm run production:init[\s\S]*npm run db:verify[\s\S]*npm run start:production/);
  }
  assert.match(releaseNotes, /production:init/);
  assert.match(envExample, /INIT_PLATFORM_USERNAME=/);
  assert.match(envExample, /INIT_CLINIC_ADMIN_PASSWORD=/);
});
