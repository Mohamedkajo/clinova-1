import { resolveClientIp } from "./client-ip.js";

const buckets = new Map();

const policies = [
  { id: "invitation-accept", method: "POST", match: /^\/api\/invitations\/[^/]+\/accept$/, max: 10, env: "RATE_LIMIT_INVITATION_ACCEPT_MAX" },
  { id: "public-feedback", method: "POST", match: /^\/api\/public\/feedback\/[^/]+$/, max: 10, env: "RATE_LIMIT_PUBLIC_FEEDBACK_MAX" },
  { id: "account-password", method: "POST", match: /^\/api\/account\/password$/, max: 5, env: "RATE_LIMIT_PASSWORD_MAX" },
  { id: "platform-password", method: "POST", match: /^\/api\/platform\/tenants\/\d+\/reset-password$/, max: 5, env: "RATE_LIMIT_PASSWORD_MAX" },
  { id: "user-password", method: "PUT", match: /^\/api\/users\/\d+$/, max: 30, env: "RATE_LIMIT_USER_UPDATE_MAX" },
  { id: "whatsapp", method: "POST", match: /^\/api\/(?:appointments|gifts)\/\d+\/whatsapp$/, max: 20, env: "RATE_LIMIT_WHATSAPP_MAX" },
  { id: "client-upload", method: "POST", match: /^\/api\/clients\/\d+\/files$/, max: 20, env: "RATE_LIMIT_UPLOAD_MAX" },
  { id: "consent-upload", method: "POST", match: /^\/api\/consents$/, max: 20, env: "RATE_LIMIT_UPLOAD_MAX" },
  { id: "backup-create", method: "POST", match: /^\/api\/platform\/backups$/, max: 5, env: "RATE_LIMIT_BACKUP_MAX" },
  { id: "restore", method: "POST", match: /^\/api\/system\/restore$/, max: 3, env: "RATE_LIMIT_RESTORE_MAX" },
];

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function policyFor(req, pathname) {
  return policies.find((policy) => policy.method === req.method && policy.match.test(pathname));
}

export function checkRouteRateLimit(req, pathname, now = Date.now()) {
  const policy = policyFor(req, pathname);
  if (!policy) return { allowed: true };

  const windowMs = positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  const max = positiveInteger(process.env[policy.env], policy.max);
  const key = `${policy.id}:${resolveClientIp(req)}`;
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { count: 0, startedAt: now };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count <= max) return { allowed: true };
  return {
    allowed: false,
    status: 429,
    body: { error: "Too many requests." },
  };
}
