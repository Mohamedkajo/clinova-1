import { exact, matches, route } from "./route-utils.js";

export const patientFinanceRoutes = [
  route("GET", exact("/api/patient-finance/invoices"), { module: "patient-finance" }),
  route("POST", exact("/api/patient-finance/invoices"), { module: "patient-finance" }),
  route("GET", matches(/^\/api\/patient-finance\/invoices\/\d+$/), { module: "patient-finance" }),
  route("PUT", matches(/^\/api\/patient-finance\/invoices\/\d+$/), { module: "patient-finance" }),
  route("POST", matches(/^\/api\/patient-finance\/invoices\/\d+\/issue$/), { module: "patient-finance" }),
  route("POST", matches(/^\/api\/patient-finance\/invoices\/\d+\/cancel$/), { module: "patient-finance" }),
  route("POST", exact("/api/patient-finance/payments"), { module: "patient-finance" }),
  route("POST", matches(/^\/api\/patient-finance\/payments\/\d+\/reverse$/), { module: "patient-finance" }),
  route("GET", matches(/^\/api\/patient-finance\/patients\/\d+\/ledger$/), { module: "patient-finance" }),
];
