import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const demoRoot = resolve(projectRoot, ".demo");

function isInside(parent, target) {
  const pathFromParent = relative(parent, target);
  return pathFromParent !== "" && !pathFromParent.startsWith("..") && !isAbsolute(pathFromParent);
}

export function configureDemoEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo mode is disabled in production.");
  }
  if (String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("Demo mode supports only its isolated local SQLite database; DATABASE_URL must be unset.");
  }

  const dataDir = resolve(process.env.DEMO_DATA_DIR || demoRoot);
  if (dataDir !== demoRoot && !isInside(demoRoot, dataDir)) {
    throw new Error(`Refusing demo data directory outside ${demoRoot}.`);
  }

  const databasePath = resolve(dataDir, "clinova-alpha.sqlite");
  if (!isInside(demoRoot, databasePath)) {
    throw new Error(`Refusing demo database path outside ${demoRoot}.`);
  }

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(resolve(dataDir, "uploads"), { recursive: true });
  mkdirSync(resolve(dataDir, "backups"), { recursive: true });

  Object.assign(process.env, {
    NODE_ENV: "demo",
    CLINOVA_SKIP_ENV_FILE: "true",
    DATABASE_URL: "",
    DATABASE_PATH: databasePath,
    UPLOAD_DIR: resolve(dataDir, "uploads"),
    BACKUP_DIR: resolve(dataDir, "backups"),
    BACKUP_ENABLED: "false",
    BACKUP_RUN_ON_START: "false",
    WHATSAPP_ENABLED: "false",
    WHATSAPP_DRY_RUN: "true",
    COOKIE_SECURE: "false",
  });

  return { dataDir, databasePath, demoRoot, projectRoot };
}
