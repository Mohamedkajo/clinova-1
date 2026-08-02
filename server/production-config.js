import { mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const placeholderPattern = /(change[-_ ]?me|replace[-_ ]?with|dev[-_ ]?only|demo|example|password|secret-at-least)/i;

function required(env, name, errors) {
  const value = String(env[name] || "").trim();
  if (!value) errors.push(`${name} is required.`);
  return value;
}

function positiveNumber(env, name, errors, minimum = 1) {
  const value = Number(env[name]);
  if (!Number.isFinite(value) || value < minimum) errors.push(`${name} must be at least ${minimum}.`);
}

function isInside(parent, child) {
  const nested = relative(resolve(parent), resolve(child));
  return nested === "" || (!nested.startsWith("..") && !isAbsolute(nested));
}

export function validateProductionEnvironment(env = process.env) {
  if (env.NODE_ENV !== "production") return { ok: true, errors: [] };

  const errors = [];
  const databaseUrl = required(env, "DATABASE_URL", errors);
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        errors.push("DATABASE_URL must use PostgreSQL in production.");
      }
      if (!parsed.hostname || !parsed.pathname.slice(1)) errors.push("DATABASE_URL must include a host and database name.");
      if (!parsed.password || placeholderPattern.test(parsed.password)) {
        errors.push("DATABASE_URL must contain a non-placeholder database password.");
      }
    } catch {
      errors.push("DATABASE_URL must be a valid PostgreSQL URL.");
    }
  }

  const sessionSecret = required(env, "SESSION_SECRET", errors);
  if (sessionSecret && (sessionSecret.length < 48 || placeholderPattern.test(sessionSecret))) {
    errors.push("SESSION_SECRET must be a non-placeholder value of at least 48 characters.");
  }
  if (String(env.COOKIE_SECURE || "").toLowerCase() !== "true") {
    errors.push("COOKIE_SECURE must be true in production.");
  }

  const appUrl = required(env, "APP_URL", errors);
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== "https:") errors.push("APP_URL must use HTTPS in production.");
      if (parsed.username || parsed.password || parsed.hash) errors.push("APP_URL must not contain credentials or a fragment.");
    } catch {
      errors.push("APP_URL must be a valid HTTPS URL.");
    }
  }

  const uploadDir = required(env, "UPLOAD_DIR", errors);
  const backupDir = required(env, "BACKUP_DIR", errors);
  const logDir = required(env, "LOG_DIR", errors);
  const directories = [uploadDir, backupDir, logDir].filter(Boolean).map((value) => resolve(value));
  if (new Set(directories).size !== directories.length) errors.push("UPLOAD_DIR, BACKUP_DIR, and LOG_DIR must be different directories.");
  for (const [name, value] of [["UPLOAD_DIR", uploadDir], ["BACKUP_DIR", backupDir], ["LOG_DIR", logDir]]) {
    if (value && isInside(resolve("client"), value)) errors.push(`${name} must not be inside the public client directory.`);
  }

  if (!required(env, "TRUSTED_PROXY_IPS", errors)) {
    // The reverse proxy is mandatory in the controlled deployment architecture.
  }
  if (String(env.BACKUP_ENABLED || "").toLowerCase() !== "true") errors.push("BACKUP_ENABLED must be true in production.");
  positiveNumber(env, "WORKER_POLL_INTERVAL_MS", errors, 250);
  positiveNumber(env, "WORKER_STALE_AFTER_MS", errors, 5000);
  positiveNumber(env, "WORKER_RETRY_BASE_MS", errors, 250);
  positiveNumber(env, "UPLOAD_MAX_MB", errors, 1);
  positiveNumber(env, "BACKUP_RETENTION", errors, 1);

  return { ok: errors.length === 0, errors };
}

export function assertProductionEnvironment(env = process.env, { createDirectories = true } = {}) {
  const result = validateProductionEnvironment(env);
  if (!result.ok) {
    throw new Error(`Production configuration invalid:\n- ${result.errors.join("\n- ")}`);
  }
  if (env.NODE_ENV === "production" && createDirectories) {
    for (const name of ["UPLOAD_DIR", "BACKUP_DIR", "LOG_DIR"]) {
      mkdirSync(resolve(env[name]), { recursive: true, mode: 0o700 });
    }
  }
  return result;
}
