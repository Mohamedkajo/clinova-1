import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { closeDatabase, initDatabase } from "./db.js";
import { heartbeatWorker, runWorkerCycle, safeJobError } from "./services/worker.service.js";
import { assertProductionEnvironment } from "./production-config.js";

const workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const startedAt = new Date();
let stopping = false;
let timer = null;
let running = null;

function scheduleNext() {
  if (stopping) return;
  timer = setTimeout(runCycle, config.worker.pollIntervalMs);
  timer.unref?.();
}

async function runCycle() {
  if (stopping || running) return;
  running = (async () => {
    await heartbeatWorker({ workerId, startedAt });
    const result = await runWorkerCycle({ workerId });
    if (result.completed || result.retried || result.failed) {
      console.log("worker_cycle", result);
    }
  })();
  try {
    await running;
  } catch (error) {
    console.error("worker_cycle_failed", safeJobError(error));
  } finally {
    running = null;
    scheduleNext();
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  if (timer) clearTimeout(timer);
  console.log("worker_shutdown", { signal });
  try {
    await running;
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error("worker_shutdown_failed", safeJobError(error));
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

assertProductionEnvironment();
await initDatabase();
console.log("worker_ready", { database: "connected" });
await runCycle();
process.send?.("ready");

if (String(process.env.WORKER_ONCE || "false").toLowerCase() === "true") {
  await shutdown("WORKER_ONCE");
}
