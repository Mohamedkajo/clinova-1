import { audit } from "../db.js";
import { config } from "../config.js";
import { expirePatientConsents } from "../repositories/consents.repository.js";
import {
  activeWorkerTenants,
  claimNextBackgroundJob,
  completeBackgroundJob,
  enqueueBackgroundJob,
  latestWorkerHeartbeat,
  recordWorkerHeartbeat,
  recoverStaleBackgroundJobs,
  retryOrFailBackgroundJob,
  tenantQueueSummary,
} from "../repositories/jobs.repository.js";
import { processTenantReminderDispatch, syncTenantReminders } from "./reminders.service.js";

const jobTypes = ["prepare_reminders", "dispatch_reminders", "expire_consents"];

function iso(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function minuteBucket(now) {
  return iso(now).slice(0, 16);
}

export function safeJobError(error) {
  const name = String(error?.name || "Error").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40) || "Error";
  const message = String(error?.message || "job_failed")
    .replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi, "[redacted]")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${name}:${message || "job_failed"}`;
}

export async function scheduleTenantWorkerJobs(now = new Date()) {
  const runAt = iso(now);
  const bucket = minuteBucket(now);
  const tenants = await activeWorkerTenants();
  let scheduled = 0;
  for (const tenant of tenants) {
    for (const type of jobTypes) {
      const job = await enqueueBackgroundJob({
        tenantId: tenant.id,
        type,
        dedupeKey: `${type}:${bucket}`,
        runAt,
      });
      if (job?.status === "queued" && Number(job.attempts) === 0) scheduled += 1;
    }
  }
  return scheduled;
}

export const defaultWorkerHandlers = {
  async prepare_reminders(job) {
    await syncTenantReminders({ tenantId: Number(job.tenantId), actorUserId: null });
  },
  async dispatch_reminders(job) {
    await processTenantReminderDispatch({ tenantId: Number(job.tenantId) });
  },
  async expire_consents(job) {
    await expirePatientConsents(Number(job.tenantId));
  },
};

export async function recoverStaleJobs(now = new Date()) {
  const cutoff = new Date(new Date(now).getTime() - config.worker.staleAfterMs).toISOString();
  return recoverStaleBackgroundJobs(cutoff, iso(now));
}

export async function runWorkerCycle({ workerId, now = new Date(), handlers = defaultWorkerHandlers, maxJobs = 50 } = {}) {
  if (!workerId) throw new Error("workerId is required");
  const cycleNow = new Date(now);
  await recoverStaleJobs(cycleNow);
  await scheduleTenantWorkerJobs(cycleNow);
  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (let index = 0; index < maxJobs; index += 1) {
    const job = await claimNextBackgroundJob({ workerId, now: iso(cycleNow) });
    if (!job) break;
    try {
      const handler = handlers[job.type];
      if (typeof handler !== "function") throw new Error("unsupported_job_type");
      await handler(job);
      if (await completeBackgroundJob(job.id, workerId)) completed += 1;
    } catch (error) {
      const backoff = config.worker.retryBaseMs * (2 ** Math.max(Number(job.attempts) - 1, 0));
      const result = await retryOrFailBackgroundJob({
        id: job.id,
        workerId,
        retryAt: new Date(cycleNow.getTime() + backoff).toISOString(),
        lastError: safeJobError(error),
      });
      if (result?.terminal) {
        failed += 1;
        await audit(null, "job_failed", "background_jobs", job.id, {
          tenantId: Number(job.tenantId),
          jobType: job.type,
          attempts: result.attempts,
        });
      } else if (result) {
        retried += 1;
      }
    }
  }
  return { completed, retried, failed };
}

export async function heartbeatWorker({ workerId, startedAt, now = new Date() }) {
  await recordWorkerHeartbeat({ workerId, startedAt: iso(startedAt), now: iso(now) });
}

export async function workerStatus(now = new Date()) {
  const heartbeat = await latestWorkerHeartbeat();
  if (!heartbeat) return { status: "not_started", lastHeartbeatAt: null };
  const lastHeartbeatAt = new Date(heartbeat.heartbeatAt).toISOString();
  const ageMs = Math.max(0, new Date(now).getTime() - new Date(lastHeartbeatAt).getTime());
  return {
    status: ageMs <= config.worker.staleAfterMs ? "running" : "stale",
    lastHeartbeatAt,
  };
}

export async function operationalReadiness(tenantId) {
  const [worker, queue] = await Promise.all([workerStatus(), tenantQueueSummary(tenantId)]);
  return { worker, queue };
}
