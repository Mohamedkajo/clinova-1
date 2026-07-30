import { exact, route } from "./route-utils.js";

export const remindersRoutes = [
  route("GET", exact("/api/reminders"), { module: "reminders" }),
  route("POST", exact("/api/reminders/prepare"), { module: "reminders" }),
  route("POST", exact("/api/reminders/simulate-dispatch"), { module: "reminders" }),
];
