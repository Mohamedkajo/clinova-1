import { matches, route } from "./route-utils.js";

export const clinicalVisitsRoutes = [
  route("GET", matches(/^\/api\/clinical-visits\/appointment\/\d+$/), { module: "clinical-visits" }),
  route("POST", matches(/^\/api\/clinical-visits$/), { module: "clinical-visits" }),
  route("PUT", matches(/^\/api\/clinical-visits\/\d+$/), { module: "clinical-visits" }),
  route("POST", matches(/^\/api\/clinical-visits\/\d+\/complete$/), { module: "clinical-visits" }),
];
