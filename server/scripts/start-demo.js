import { existsSync } from "node:fs";
import { configureDemoEnvironment } from "./demo-environment.js";

const sessionSecret = String(process.env.DEMO_SESSION_SECRET || "");
if (sessionSecret.length < 24) {
  throw new Error("DEMO_SESSION_SECRET must contain at least 24 characters.");
}

const { databasePath } = configureDemoEnvironment();
if (!existsSync(databasePath)) {
  throw new Error("Demo database is missing. Run npm run demo:seed first.");
}

Object.assign(process.env, {
  HOST: "127.0.0.1",
  PORT: String(process.env.DEMO_PORT || "4300"),
  SESSION_SECRET: sessionSecret,
});

await import("../app.js");
