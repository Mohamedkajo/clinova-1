import { config } from "../../config.js";
import { isTrustedProxy } from "./client-ip.js";

export function inviteUrl(req, token) {
  if (config.appUrl) return `${config.appUrl.replace(/\/$/, "")}/?invite=${encodeURIComponent(token)}`;
  const trusted = isTrustedProxy(req);
  const proto = trusted ? req.headers["x-forwarded-proto"] : (config.cookieSecure ? "https" : "http");
  const host = trusted ? req.headers["x-forwarded-host"] : req.headers.host;
  return `${proto || "http"}://${host || "127.0.0.1:3000"}/?invite=${encodeURIComponent(token)}`;
}
