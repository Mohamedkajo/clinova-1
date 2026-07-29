import { matches, resource, route } from "./route-utils.js";

export const consentsRoutes = [
  route("GET", resource("consents"), { module: "consents" }),
  route("POST", resource("consents"), { module: "consents" }),
  route("DELETE", resource("consents"), { module: "consents" }),
  route("GET", resource("consent-templates"), { module: "consents" }),
  route("POST", resource("consent-templates"), { module: "consents" }),
  route("PUT", resource("consent-templates"), { module: "consents" }),
  route("GET", matches(/^\/api\/clients\/\d+\/consents$/), { module: "consents" }),
  route("POST", matches(/^\/api\/clients\/\d+\/consents$/), { module: "consents" }),
  route("POST", matches(/^\/api\/patient-consents\/\d+\/sign$/), { module: "consents" }),
  route("PATCH", matches(/^\/api\/patient-consents\/\d+\/status$/), { module: "consents" }),
];
