import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHttpClient, loginAs } from "./helpers/http-client.js";
import { startTestServer } from "./helpers/test-server.js";

let testServer;

before(async () => {
  testServer = await startTestServer({ initializationRuns: 2 });
});

after(async () => {
  await testServer?.stop();
});

test("platform auth, provisioning, update, password reset, invoices, and no-op auto-billing", async () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `safe-step-103-owner-${suffix}@example.test`;
  const originalPassword = "SafeStep103Original!";
  const resetPassword = "SafeStep103Reset!";
  const slug = `safe-step-103-${suffix}`;

  const unauthenticated = createHttpClient(testServer.baseUrl);
  assert.equal((await unauthenticated.get("/api/platform/tenants")).status, 401);

  const { client: platformOwner, response: ownerLogin } = await loginAs(testServer.baseUrl, "admin");
  assert.equal(ownerLogin.status, 200);
  assert.equal(ownerLogin.body.user.platformOwner, true);
  assert.equal((await platformOwner.get("/api/platform/tenants")).status, 200);

  const platformOwnerWithoutClinic = createHttpClient(testServer.baseUrl);
  const platformOwnerDirectLogin = await platformOwnerWithoutClinic.post("/api/login", {
    body: { username: "admin", password: "ChangeMe123!" },
  });
  assert.equal(platformOwnerDirectLogin.status, 200);
  assert.equal(platformOwnerDirectLogin.body.user.platformOwner, true);

  const invalidProvision = await platformOwner.post("/api/platform/tenants", { body: {} });
  assert.equal(invalidProvision.status, 400);
  assert.equal(typeof invalidProvision.body.error, "string");

  const provision = await platformOwner.post("/api/platform/tenants", {
    body: {
      clinicName: `SAFE STEP 103 Clinic ${suffix}`,
      slug,
      ownerName: "Safe Step 103 Owner",
      email: ownerEmail,
      password: originalPassword,
      plan: "starter",
      status: "trial",
    },
  });
  assert.equal(provision.status, 201);
  const tenantId = provision.body.tenant.id;
  assert.ok(tenantId);

  let tenantsResponse = await platformOwner.get("/api/platform/tenants");
  let tenant = tenantsResponse.body.tenants.find((item) => item.id === tenantId);
  assert.equal(tenant.slug, slug);
  assert.equal(tenant.subscriptionPlan, "starter");
  assert.equal(tenant.subscriptionStatus, "trial");

  const missingClinicLogin = await createHttpClient(testServer.baseUrl).post("/api/login", {
    body: { username: ownerEmail, password: originalPassword },
  });
  assert.equal(missingClinicLogin.status, 400);
  assert.deepEqual(missingClinicLogin.body, { error: "Clinic identifier is required." });

  const wrongClinicLogin = await createHttpClient(testServer.baseUrl).post("/api/login", {
    body: { username: ownerEmail, password: originalPassword, clinicIdentifier: "missing-clinic" },
  });
  assert.equal(wrongClinicLogin.status, 400);
  assert.deepEqual(wrongClinicLogin.body, { error: "Clinic identifier not found." });

  const wrongPasswordLogin = await createHttpClient(testServer.baseUrl).post("/api/login", {
    body: { username: ownerEmail, password: "WrongPassword!", clinicIdentifier: slug },
  });
  assert.equal(wrongPasswordLogin.status, 401);
  assert.deepEqual(wrongPasswordLogin.body, { error: "Invalid username or password." });
  assert.doesNotMatch(wrongPasswordLogin.body.error, /�|Ù|Ø|ðŸ/);

  const { client: clinicAdmin, response: clinicLogin } = await loginAs(testServer.baseUrl, ownerEmail, originalPassword, slug);
  assert.equal(clinicLogin.status, 200);
  assert.equal(clinicLogin.body.user.role, "admin");
  assert.equal(clinicLogin.body.user.platformOwner, false);
  assert.equal((await clinicAdmin.get("/api/bootstrap")).status, 200);
  assert.equal((await clinicAdmin.get("/api/platform/tenants")).status, 403);

  const invalidUpdate = await platformOwner.put(`/api/platform/tenants/${tenantId}`, { body: {} });
  assert.equal(invalidUpdate.status, 400);

  const billingUpdate = await platformOwner.put("/api/billing", {
    body: {
      plan: "starter",
      status: "trial",
      currentPeriodEnd: "2030-01-31T12:30:00.000Z",
    },
  });
  assert.equal(billingUpdate.status, 200);

  const update = await platformOwner.put(`/api/platform/tenants/${tenantId}`, {
    body: {
      plan: "growth",
      status: "active",
      billingDay: "31",
      autoBillingEnabled: true,
    },
  });
  assert.equal(update.status, 200);
  tenant = update.body.tenants.find((item) => item.id === tenantId);
  assert.equal(tenant.subscriptionPlan, "growth");
  assert.equal(tenant.subscriptionStatus, "active");
  assert.equal(Number(tenant.billingDay), 31);
  assert.equal(Number(tenant.autoBillingEnabled), 1);

  const invalidReset = await platformOwner.post(`/api/platform/tenants/${tenantId}/reset-password`, {
    body: { password: "short" },
  });
  assert.equal(invalidReset.status, 400);

  const reset = await platformOwner.post(`/api/platform/tenants/${tenantId}/reset-password`, {
    body: { password: resetPassword },
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.owner.email, ownerEmail);

  const resetLogin = await loginAs(testServer.baseUrl, ownerEmail, resetPassword, slug);
  assert.equal(resetLogin.response.status, 200);
  assert.equal(resetLogin.response.body.user.tenantId, tenantId);
  assert.equal((await resetLogin.client.get("/api/bootstrap")).status, 200);

  const secondSlug = `safe-step-103-b-${suffix}`;
  const secondOwnerEmail = `safe-step-103-owner-b-${suffix}@example.test`;
  const secondProvision = await platformOwner.post("/api/platform/tenants", {
    body: {
      clinicName: `SAFE STEP 103 Clinic B ${suffix}`,
      slug: secondSlug,
      ownerName: "Safe Step 103 Owner B",
      email: secondOwnerEmail,
      password: originalPassword,
      plan: "starter",
      status: "trial",
    },
  });
  assert.equal(secondProvision.status, 201);
  const secondTenantId = secondProvision.body.tenant.id;

  const sharedUsername = `shared-${suffix}`;
  const sharedPasswordA = "SharedTenantA123!";
  const sharedPasswordB = "SharedTenantB123!";
  const createSharedA = await resetLogin.client.post("/api/users", {
    body: {
      name: "Shared Tenant A",
      username: sharedUsername,
      email: `shared-a-${suffix}@example.test`,
      password: sharedPasswordA,
      role: "reception",
    },
  });
  assert.equal(createSharedA.status, 201);

  const { client: secondClinicAdmin, response: secondClinicLogin } = await loginAs(testServer.baseUrl, secondOwnerEmail, originalPassword, secondSlug);
  assert.equal(secondClinicLogin.status, 200);
  const createSharedB = await secondClinicAdmin.post("/api/users", {
    body: {
      name: "Shared Tenant B",
      username: sharedUsername,
      email: `shared-b-${suffix}@example.test`,
      password: sharedPasswordB,
      role: "reception",
    },
  });
  assert.equal(createSharedB.status, 201);

  const sharedALogin = await loginAs(testServer.baseUrl, sharedUsername, sharedPasswordA, slug);
  assert.equal(sharedALogin.response.status, 200);
  assert.equal(sharedALogin.response.body.user.tenantId, tenantId);

  const sharedWrongTenantLogin = await loginAs(testServer.baseUrl, sharedUsername, sharedPasswordB, slug);
  assert.equal(sharedWrongTenantLogin.response.status, 401);

  const sharedBLogin = await loginAs(testServer.baseUrl, sharedUsername, sharedPasswordB, secondSlug);
  assert.equal(sharedBLogin.response.status, 200);
  assert.equal(sharedBLogin.response.body.user.tenantId, secondTenantId);

  const defaultTenantDelete = await platformOwner.delete("/api/platform/tenants/1");
  assert.equal(defaultTenantDelete.status, 400);
  assert.deepEqual(defaultTenantDelete.body, { error: "Default tenant cannot be deactivated." });

  assert.equal((await createHttpClient(testServer.baseUrl).delete(`/api/platform/tenants/${secondTenantId}`)).status, 401);
  assert.equal((await resetLogin.client.delete(`/api/platform/tenants/${secondTenantId}`)).status, 403);

  const { client: reception } = await loginAs(testServer.baseUrl, "reception");
  assert.equal((await reception.delete(`/api/platform/tenants/${secondTenantId}`)).status, 403);
  const { client: therapist } = await loginAs(testServer.baseUrl, "sara");
  assert.equal((await therapist.delete(`/api/platform/tenants/${secondTenantId}`)).status, 403);

  const deactivateSecondTenant = await platformOwner.delete(`/api/platform/tenants/${secondTenantId}`);
  assert.equal(deactivateSecondTenant.status, 200);
  const deactivatedTenant = deactivateSecondTenant.body.tenants.find((item) => item.id === secondTenantId);
  assert.equal(deactivatedTenant.subscriptionStatus, "cancelled");

  for (const amount of ["not-a-number", "NaN", "Infinity", "", "   ", null, true]) {
    const invalidAmount = await platformOwner.post(`/api/platform/tenants/${tenantId}/invoices`, {
      body: { amount },
    });
    assert.equal(invalidAmount.status, 400, `amount=${String(amount)}`);
    assert.deepEqual(invalidAmount.body, { error: "Valid invoice amount is required." });
  }

  const missingTenantInvoice = await platformOwner.post("/api/platform/tenants/999999/invoices", {
    body: { amount: 123.45 },
  });
  assert.equal(missingTenantInvoice.status, 404);
  assert.deepEqual(missingTenantInvoice.body, { error: "Tenant not found" });

  const invoiceCreate = await platformOwner.post(`/api/platform/tenants/${tenantId}/invoices`, {
    body: {
      plan: "growth",
      status: "open",
      amount: 123.45,
      currency: "USD",
      periodStart: "2030-01-01",
      periodEnd: "2030-01-31",
      dueAt: "2030-01-15",
      notes: "Disposable SAFE STEP 103 invoice",
    },
  });
  assert.equal(invoiceCreate.status, 201);
  const invoiceId = invoiceCreate.body.invoiceId;

  tenant = invoiceCreate.body.tenants.find((item) => item.id === tenantId);
  let invoice = tenant.recentInvoices.find((item) => item.id === invoiceId);
  assert.equal(invoice.status, "open");
  assert.equal(invoice.amount, 123.45);
  assert.equal(invoice.currency, "USD");

  const billingInvoiceCreate = await platformOwner.post("/api/billing/invoices", {
    body: {
      amount: 49,
      periodStart: "2030-01-01",
      periodEnd: "2030-01-31",
      dueAt: "2030-01-15",
    },
  });
  assert.equal(billingInvoiceCreate.status, 201);

  const invoiceUpdate = await platformOwner.put(`/api/platform/invoices/${invoiceId}`, {
    body: { status: "paid" },
  });
  assert.equal(invoiceUpdate.status, 200);
  tenant = invoiceUpdate.body.tenants.find((item) => item.id === tenantId);
  invoice = tenant.recentInvoices.find((item) => item.id === invoiceId);
  assert.equal(invoice.status, "paid");

  tenantsResponse = await platformOwner.get("/api/platform/tenants");
  const invoiceCountBefore = tenantsResponse.body.tenants.find((item) => item.id === tenantId).invoices;

  const autoBilling = await platformOwner.post("/api/platform/billing/auto-run", {
    body: { runDate: "2030-01-01" },
  });
  assert.equal(autoBilling.status, 200);
  assert.equal(autoBilling.body.result.runDate, "2030-01-01");
  assert.equal(autoBilling.body.result.cycle, "2030-01");
  assert.ok(Array.isArray(autoBilling.body.result.created));
  assert.ok(Array.isArray(autoBilling.body.result.skipped));
  assert.ok(autoBilling.body.result.skipped.some((item) => item.tenantId === tenantId && item.reason === "not_due"));

  const invoiceCountAfter = autoBilling.body.tenants.find((item) => item.id === tenantId).invoices;
  assert.equal(invoiceCountAfter, invoiceCountBefore);
});
