import { json } from "../shared/http/json-response.js";
import { requirePermission } from "../services/permissions.service.js";
import { exportReportsCsv, getReports } from "../services/reports.service.js";

export async function handleReportsRoute(req, res, url) {
  if (req.method !== "GET" || !url.pathname.startsWith("/api/reports")) return false;
  const permission = await requirePermission(req, "reports");
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }
  const query = Object.fromEntries(url.searchParams);
  if (url.pathname === "/api/reports/export.csv") {
    const result = await exportReportsCsv(permission.user, query);
    if (result.status !== 200) json(res, result.status, result.body);
    else {
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(result.body);
    }
    return true;
  }
  if (url.pathname !== "/api/reports") return false;
  const result = await getReports(permission.user, query);
  json(res, result.status, result.body);
  return true;
}
