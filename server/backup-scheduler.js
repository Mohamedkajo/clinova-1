import { config } from "./config.js";
import { createBackup } from "./backup.js";
import { assertProductionEnvironment } from "./production-config.js";

assertProductionEnvironment();

let lastDailyRun = "";
let lastIntervalRun = 0;
let running = false;

function nowParts() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return { now, date, time };
}

async function runBackup(reason) {
  if (running) return;
  running = true;
  try {
    createBackup({ reason });
    lastIntervalRun = Date.now();
  } catch (error) {
    console.error(`[backup-scheduler] ${error.message}`);
  } finally {
    running = false;
  }
}

function shouldRunDaily() {
  const { date, time } = nowParts();
  if (!config.backup.time || time !== config.backup.time) return false;
  if (lastDailyRun === date) return false;
  lastDailyRun = date;
  return true;
}

function shouldRunInterval() {
  if (config.backup.time) return false;
  const intervalMs = config.backup.intervalHours * 60 * 60 * 1000;
  return Date.now() - lastIntervalRun >= intervalMs;
}

async function tick() {
  if (!config.backup.enabled) return;
  if (shouldRunDaily()) await runBackup("scheduled-daily");
  else if (shouldRunInterval()) await runBackup("scheduled-interval");
}

console.log(`[backup-scheduler] enabled=${config.backup.enabled} dir=${config.backup.dir} retention=${config.backup.retention} time=${config.backup.time || "interval"} intervalHours=${config.backup.intervalHours}`);
process.send?.("ready");

if (config.backup.enabled && config.backup.runOnStart) {
  await runBackup("scheduler-start");
}

setInterval(tick, 60 * 1000);
await tick();
