import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = process.env.CLINOVA_SKIP_ENV_FILE === "true"
  ? ""
  : process.env.NODE_ENV === "development" && existsSync(".env.development")
    ? ".env.development"
    : ".env";

if (envFile && existsSync(envFile)) {
  const lines = readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "0.0.0.0",
  databasePath: resolve(process.env.DATABASE_PATH || "./data/clinic.sqlite"),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: String(process.env.DATABASE_SSL || "").toLowerCase() === "true",
  databaseSslRejectUnauthorized: String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
  databaseConnectionTimeoutMs: Math.max(1000, Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10000)),
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
  cookieSecure: String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true",
  trustedProxyIps: String(process.env.TRUSTED_PROXY_IPS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  backup: {
    enabled: String(process.env.BACKUP_ENABLED || "true").toLowerCase() !== "false",
    dir: resolve(process.env.BACKUP_DIR || "./backups"),
    retention: Math.max(1, Number(process.env.BACKUP_RETENTION || 14)),
    intervalHours: Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24)),
    time: process.env.BACKUP_TIME || "02:00",
    runOnStart: String(process.env.BACKUP_RUN_ON_START || "false").toLowerCase() === "true",
  },
  uploads: {
    dir: resolve(process.env.UPLOAD_DIR || "./uploads"),
    maxBytes: Math.max(1024 * 1024, Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024),
    allowedTypes: String(process.env.UPLOAD_ALLOWED_TYPES || "image/jpeg,image/png,image/webp,application/pdf")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  },
  whatsapp: {
    enabled: String(process.env.WHATSAPP_ENABLED || "false").toLowerCase() === "true",
    dryRun: String(process.env.WHATSAPP_DRY_RUN || "false").toLowerCase() === "true",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v21.0",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "972",
  },
};
