import { exact, resource, route } from "./route-utils.js";

export const appointmentsRoutes = [
  route("GET", exact("/api/appointments/queue"), { module: "appointments" }),
  route("GET", resource("appointments"), { module: "appointments" }),
  route("POST", resource("appointments"), { module: "appointments" }),
  route("PUT", resource("appointments"), { module: "appointments" }),
  route("PATCH", resource("appointments"), { module: "appointments" }),
  route("DELETE", resource("appointments"), { module: "appointments" }),
];
