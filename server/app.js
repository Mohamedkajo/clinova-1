import { createServer } from "node:http";
import { config } from "./config.js";
import { assertProductionPlatformOwner } from "./db.js";
import { json } from "./shared/http/json-response.js";
import { serveStatic } from "./shared/http/static-server.js";
import { apiNotFound } from "./shared/http/api-not-found.js";
import { checkRouteRateLimit } from "./shared/http/rate-limit.js";
import { publicErrorResponse } from "./shared/http/public-error.js";
import { authRoutes } from "./routes/auth.routes.js";
import { clientsRoutes } from "./routes/clients.routes.js";
import { appointmentsRoutes } from "./routes/appointments.routes.js";
import { usersRoutes } from "./routes/users.routes.js";
import { invitationsRoutes } from "./routes/invitations.routes.js";
import { reportsRoutes } from "./routes/reports.routes.js";
import { auditRoutes } from "./routes/audit.routes.js";
import { whatsappRoutes } from "./routes/whatsapp.routes.js";
import { settingsRoutes } from "./routes/settings.routes.js";
import { filesRoutes } from "./routes/files.routes.js";
import { consentsRoutes } from "./routes/consents.routes.js";
import { searchRoutes } from "./routes/search.routes.js";
import { feedbackRoutes } from "./routes/feedback.routes.js";
import { crmRoutes } from "./routes/crm.routes.js";
import { billingRoutes } from "./routes/billing.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { giftsRoutes } from "./modules/gifts/gifts.routes.js";
import { statusRoutes } from "./modules/status/status.routes.js";
import { accountRoutes } from "./modules/account/account.routes.js";
import { signupRoutes } from "./modules/signup/signup.routes.js";
import { bootstrapRoutes } from "./modules/bootstrap/bootstrap.routes.js";
import { platformRoutes } from "./modules/platform/platform.routes.js";
import { systemRoutes } from "./modules/system/system.routes.js";
import { routeMatches } from "./routes/route-utils.js";
import { handleAuthRoute } from "./controllers/auth.controller.js";
import { handleUsersRoute } from "./controllers/users.controller.js";
import { handleInvitationsRoute } from "./controllers/invitations.controller.js";
import { handleClientsRoute } from "./controllers/clients.controller.js";
import { handleAppointmentsRoute } from "./controllers/appointments.controller.js";
import { handleSettingsRoute } from "./controllers/settings.controller.js";
import { handleTenantDomainsRoute } from "./controllers/tenant-domains.controller.js";
import { handleFilesRoute } from "./controllers/files.controller.js";
import { handleConsentsRoute } from "./controllers/consents.controller.js";
import { handleSearchRoute } from "./controllers/search.controller.js";
import { handleReportsRoute } from "./controllers/reports.controller.js";
import { handleAuditRoute } from "./controllers/audit.controller.js";
import { handleFeedbackRoute } from "./controllers/feedback.controller.js";
import { handleCrmRoute } from "./controllers/crm.controller.js";
import { handleBillingRoute } from "./controllers/billing.controller.js";
import { handleWhatsAppRoute } from "./controllers/whatsapp.controller.js";
import { handleCatalogRoute } from "./modules/catalog/catalog.controller.js";
import { handleGiftsRoute } from "./modules/gifts/gifts.controller.js";
import { handleStatusRoute } from "./modules/status/status.controller.js";
import { handleAccountRoute } from "./modules/account/account.controller.js";
import { handleSignupRoute } from "./modules/signup/signup.controller.js";
import { handleBootstrapRoute } from "./modules/bootstrap/bootstrap.controller.js";
import { handlePlatformRoute } from "./modules/platform/platform.controller.js";
import { handlePlatformInvoicesRoute } from "./modules/platform/platform-invoices.controller.js";
import { handlePlatformBillingRoute } from "./modules/platform/platform-billing.controller.js";
import { handlePlatformPasswordRoute } from "./modules/platform/platform-password.controller.js";
import { handlePlatformProvisioningRoute } from "./modules/platform/platform-provisioning.controller.js";
import { handleSystemRoute } from "./modules/system/system.controller.js";

const registeredRoutes = [
  ...statusRoutes,
  ...accountRoutes,
  ...signupRoutes,
  ...authRoutes,
  ...bootstrapRoutes,
  ...platformRoutes,
  ...systemRoutes,
  ...filesRoutes,
  ...consentsRoutes,
  ...searchRoutes,
  ...auditRoutes,
  ...feedbackRoutes,
  ...crmRoutes,
  ...billingRoutes,
  ...whatsappRoutes,
  ...catalogRoutes,
  ...giftsRoutes,
  ...clientsRoutes,
  ...appointmentsRoutes,
  ...usersRoutes,
  ...invitationsRoutes,
  ...reportsRoutes,
  ...settingsRoutes,
];

async function handleApi(req, res, url) {
  const matchedRoute = registeredRoutes.find((routeDef) => routeMatches(routeDef, req, url));
  if (matchedRoute) {
    if (matchedRoute.module === "status") {
      if (await handleStatusRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "auth") {
      if (await handleAuthRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "account") {
      if (await handleAccountRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "signup") {
      if (await handleSignupRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "bootstrap") {
      if (await handleBootstrapRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "platform") {
      if (await handlePlatformRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "platform-provisioning") {
      if (await handlePlatformProvisioningRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "platform-invoices") {
      if (await handlePlatformInvoicesRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "platform-billing") {
      if (await handlePlatformBillingRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "platform-password") {
      if (await handlePlatformPasswordRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "system") {
      if (await handleSystemRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "users") {
      if (await handleUsersRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "invitations") {
      if (await handleInvitationsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "clients") {
      if (await handleClientsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "appointments") {
      if (await handleAppointmentsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "settings") {
      if (await handleSettingsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "tenant-domains") {
      if (await handleTenantDomainsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "files") {
      if (await handleFilesRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "consents") {
      if (await handleConsentsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "search") {
      if (await handleSearchRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "reports") {
      if (await handleReportsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "audit") {
      if (await handleAuditRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "feedback") {
      if (await handleFeedbackRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "crm") {
      if (await handleCrmRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "billing") {
      if (await handleBillingRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "whatsapp") {
      if (await handleWhatsAppRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "catalog") {
      if (await handleCatalogRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    if (matchedRoute.module === "gifts") {
      if (await handleGiftsRoute(req, res, url)) return;
      apiNotFound(res);
      return;
    }
    apiNotFound(res);
    return;
  }

  apiNotFound(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const rateLimit = checkRouteRateLimit(req, url.pathname);
      if (!rateLimit.allowed) {
        json(res, rateLimit.status, rateLimit.body);
        return;
      }
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    const response = publicErrorResponse(error);
    json(res, response.status, response.body);
  }
});

await assertProductionPlatformOwner();

server.listen(config.port, config.host, () => {
  console.log(`Clinic system running on http://${config.host}:${config.port}`);
});
