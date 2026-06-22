import { exact, matches, route } from "../../routes/route-utils.js";

export const platformRoutes = [
  route("GET", exact("/api/platform/health"), { module: "platform" }),
  route("GET", exact("/api/platform/backups"), { module: "platform" }),
  route("POST", exact("/api/platform/backups"), { module: "platform" }),
  route("GET", exact("/api/platform/tenants"), { module: "platform" }),
  route("POST", exact("/api/platform/tenants"), { module: "platform-provisioning" }),
  route("PUT", matches(/^\/api\/platform\/tenants\/\d+$/), { module: "platform" }),
  route("POST", matches(/^\/api\/platform\/tenants\/\d+\/invoices$/), { module: "platform-invoices" }),
  route("PUT", matches(/^\/api\/platform\/invoices\/\d+$/), { module: "platform-invoices" }),
  route("POST", exact("/api/platform/billing/auto-run"), { module: "platform-billing" }),
  route("POST", matches(/^\/api\/platform\/tenants\/\d+\/reset-password$/), { module: "platform-password" }),
];
