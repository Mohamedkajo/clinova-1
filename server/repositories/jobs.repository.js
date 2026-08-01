import { db } from "../db.js";

const jobSelect = `
  SELECT id, tenant_id AS tenantId, type, dedupe_key AS dedupeKey, status,
         attempts, max_attempts AS maxAttempts, run_at AS runAt,
         locked_at AS lockedAt, locked_by AS lockedBy, last_error AS lastError,
         completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt
  FROM background_jobs
`;

export async function activeWorkerTenants() {
  return await db.prepare(`
    SELECT id
    FROM tenants
    WHERE status IN ('trial','active','past_due')
    ORDER BY id
  `).all();
}

export async function enqueueBackgroundJob({ tenantId, type, dedupeKey, runAt, maxAttempts = 3 }) {
  await db.prepare(`
    INSERT INTO background_jobs (tenant_id, type, dedupe_key, payload, run_at, max_attempts)
    VALUES (?, ?, ?, '{}', ?, ?)
    ON CONFLICT DO NOTHING
  `).run(tenantId, type, dedupeKey, runAt, maxAttempts);
  return await db.prepare(`${jobSelect}
    WHERE tenant_id = ? AND dedupe_key = ?
    ORDER BY id DESC LIMIT 1
  `).get(tenantId, dedupeKey);
}

export async function recoverStaleBackgroundJobs(cutoff, now) {
  const result = await db.prepare(`
    UPDATE background_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
        run_at = CASE WHEN attempts >= max_attempts THEN run_at ELSE ? END,
        locked_at = NULL,
        locked_by = NULL,
        last_error = 'stale_lock_recovered',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing' AND locked_at IS NOT NULL AND locked_at <= ?
  `).run(now, cutoff);
  return Number(result.changes || 0);
}

export async function claimNextBackgroundJob({ workerId, now }) {
  return db.transaction(async (connection) => {
    const candidate = await connection.prepare(`${jobSelect}
      WHERE status = 'queued' AND run_at <= ?
      ORDER BY run_at, id
      LIMIT 1
    `).get(now);
    if (!candidate) return null;
    const claimed = await connection.prepare(`
      UPDATE background_jobs
      SET status = 'processing', attempts = attempts + 1,
          locked_at = ?, locked_by = ?, last_error = '', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'
    `).run(now, workerId, candidate.id);
    if (!claimed.changes) return null;
    return await connection.prepare(`${jobSelect} WHERE id = ?`).get(candidate.id);
  });
}

export async function completeBackgroundJob(id, workerId) {
  const result = await db.prepare(`
    UPDATE background_jobs
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
        locked_at = NULL, locked_by = NULL, last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing' AND locked_by = ?
  `).run(id, workerId);
  return Number(result.changes || 0);
}

export async function retryOrFailBackgroundJob({ id, workerId, retryAt, lastError }) {
  const job = await db.prepare(`${jobSelect}
    WHERE id = ? AND status = 'processing' AND locked_by = ?
  `).get(id, workerId);
  if (!job) return null;
  const terminal = Number(job.attempts) >= Number(job.maxAttempts);
  await db.prepare(`
    UPDATE background_jobs
    SET status = ?, run_at = ?, locked_at = NULL, locked_by = NULL,
        last_error = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'processing' AND locked_by = ?
  `).run(terminal ? "failed" : "queued", retryAt, lastError, id, workerId);
  return { terminal, attempts: Number(job.attempts), maxAttempts: Number(job.maxAttempts) };
}

export async function recordWorkerHeartbeat({ workerId, startedAt, now }) {
  await db.prepare(`
    INSERT INTO worker_heartbeats (worker_id, started_at, heartbeat_at)
    VALUES (?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET
      started_at = excluded.started_at,
      heartbeat_at = excluded.heartbeat_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(workerId, startedAt, now);
}

export async function latestWorkerHeartbeat() {
  return await db.prepare(`
    SELECT worker_id AS workerId, started_at AS startedAt, heartbeat_at AS heartbeatAt
    FROM worker_heartbeats
    ORDER BY heartbeat_at DESC
    LIMIT 1
  `).get();
}

export async function tenantQueueSummary(tenantId) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
      COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) AS processing,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
    FROM background_jobs
    WHERE tenant_id = ? AND status IN ('queued','processing','failed')
  `).get(tenantId);
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, Number(value || 0)]));
}

export async function backgroundJobById(id, tenantId) {
  return await db.prepare(`${jobSelect} WHERE id = ? AND tenant_id = ?`).get(id, tenantId);
}
