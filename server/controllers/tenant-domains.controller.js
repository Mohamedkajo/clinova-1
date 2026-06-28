import { json } from "../shared/http/json-response.js";
import { apiNotFound } from "../shared/http/api-not-found.js";
import { requirePlatformOwner } from "../services/permissions.service.js";
import { addTenantDomain, editTenantDomain, listTenantDomains, removeTenantDomain } from "../services/tenant-domains.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleTenantDomainsRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[1] === "tenant" && parts[2] === "domains" && parts.length > 4) {
    apiNotFound(res);
    return true;
  }

  const auth = await requirePlatformOwner(req);
  if (!auth.ok) {
    json(res, auth.status, auth.body);
    return true;
  }

  if (url.pathname === "/api/tenant/domains" && req.method === "GET") {
    const result = await listTenantDomains(auth.user);
    json(res, result.status, result.body);
    return true;
  }

  if (url.pathname === "/api/tenant/domains" && req.method === "POST") {
    const result = await addTenantDomain(auth.user, await readJsonBody(req));
    json(res, result.status, result.body);
    return true;
  }

  if (url.pathname.startsWith("/api/tenant/domains/")) {
    const domainId = Number(url.pathname.split("/").pop());
    if (req.method === "PUT") {
      const result = await editTenantDomain(auth.user, domainId, await readJsonBody(req));
      json(res, result.status, result.body);
      return true;
    }
    if (req.method === "DELETE") {
      const result = await removeTenantDomain(auth.user, domainId);
      json(res, result.status, result.body);
      return true;
    }
  }

  return false;
}
