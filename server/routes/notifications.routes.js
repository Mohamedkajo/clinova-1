import { exact, matches, route } from "./route-utils.js";

export const notificationsRoutes = [
  route("GET", exact("/api/notifications"), { module: "notifications" }),
  route("POST", exact("/api/notifications/read-all"), { module: "notifications" }),
  route("PATCH", matches(/^\/api\/notifications\/\d+\/read$/), { module: "notifications" }),
];
