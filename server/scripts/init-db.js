import { existsSync, readFileSync } from "node:fs";

function loadImplicitDevelopmentEnvironment() {
  if (process.env.NODE_ENV || existsSync(".env") || !existsSync(".env.development")) return;

  for (const line of readFileSync(".env.development", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
}

try {
  loadImplicitDevelopmentEnvironment();
  const { initDatabase } = await import("../db.js");
  await initDatabase();
  console.log("DB_INIT_DONE");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
