import { exact, route } from "../../routes/route-utils.js";

export const statusRoutes = [
  route("GET", exact("/api/health"), { module: "status" }),
  route("GET", exact("/api/version"), { module: "status" }),
  route("GET", exact("/api/operations/readiness"), { module: "status" }),
];
