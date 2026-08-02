import { config } from "../../config.js";

function normalizeIp(value) {
  const ip = String(value || "").trim();
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function isTrustedProxy(req) {
  return config.trustedProxyIps.includes(normalizeIp(req.socket?.remoteAddress || "unknown"));
}

export function resolveClientIp(req) {
  const remoteIp = normalizeIp(req.socket?.remoteAddress || "unknown");
  if (!isTrustedProxy(req)) return remoteIp;

  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map(normalizeIp)
    .filter(Boolean);
  return forwarded[0] || remoteIp;
}
