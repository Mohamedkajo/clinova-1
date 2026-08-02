import { config } from "../../config.js";

const basePolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' https://fonts.gstatic.com data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
];

function requestOriginAllowed(req) {
  const origin = String(req.headers.origin || "");
  return !origin || config.corsAllowedOrigins.includes(origin);
}

export function applySecurityHeaders(req, res) {
  const policy = process.env.NODE_ENV === "production"
    ? [...basePolicy, "upgrade-insecure-requests"].join("; ")
    : basePolicy.join("; ");
  res.setHeader("Content-Security-Policy", policy);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const origin = String(req.headers.origin || "");
  if (origin && requestOriginAllowed(req)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
}

export function handleCors(req, res) {
  if (!requestOriginAllowed(req)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Origin is not allowed." }));
    return true;
  }
  if (req.method === "OPTIONS" && String(req.url || "").startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    });
    res.end();
    return true;
  }
  return false;
}
