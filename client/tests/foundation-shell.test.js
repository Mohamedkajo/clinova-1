import assert from "node:assert/strict";
import test from "node:test";

import {
  can,
  directionForLanguage,
  navigationFor,
  pageLabel,
  resolveProtectedRoute,
  translate,
} from "../foundation-shell.js";

const admin = { role: "admin", platformOwner: false };
const reception = { role: "reception", platformOwner: false };
const therapist = { role: "therapist", platformOwner: false };

test("Hebrew is RTL and is the complete default shell dictionary", () => {
  assert.equal(directionForLanguage("he"), "rtl");
  assert.equal(directionForLanguage("ar"), "rtl");
  assert.equal(directionForLanguage("en"), "ltr");
  assert.equal(translate("he", "nav.dashboard"), "לוח בקרה");
  assert.equal(translate("he", "nav.patients"), "מטופלים");
  assert.equal(pageLabel("he", "settings"), "הגדרות");
});

test("admin navigation renders the eight sprint navigation areas", () => {
  const pages = navigationFor(admin).primary.map((item) => item.page);
  assert.deepEqual(pages, [
    "dashboard",
    "calendar",
    "appointments",
    "clients",
    "services",
    "billing",
    "reports",
    "settings",
  ]);
});

test("permission-based navigation follows the accepted clinic role model", () => {
  const receptionPages = navigationFor(reception).all.map((item) => item.page);
  const therapistPages = navigationFor(therapist).all.map((item) => item.page);

  assert.equal(receptionPages.includes("dashboard"), false);
  assert.equal(receptionPages.includes("appointments"), true);
  assert.equal(receptionPages.includes("clients"), true);
  assert.equal(receptionPages.includes("reports"), false);
  assert.equal(receptionPages.includes("feedback"), true);

  assert.equal(therapistPages.includes("appointments"), true);
  assert.equal(therapistPages.includes("consents"), true);
  assert.equal(therapistPages.includes("feedback"), false);
  assert.equal(therapistPages.includes("users"), false);

  assert.equal(can(admin, "canManageSettings"), true);
  assert.equal(can(reception, "canManageSettings"), false);
  assert.equal(can(therapist, "canViewPatients"), true);
});

test("protected route resolution redirects anonymous and unauthorized routes", () => {
  assert.deepEqual(resolveProtectedRoute("#/dashboard", null), {
    page: "login",
    redirect: "#/login",
  });
  assert.deepEqual(resolveProtectedRoute("#/login", null), {
    page: "login",
    redirect: null,
  });

  const adminFromLogin = resolveProtectedRoute("#/login", admin);
  assert.equal(adminFromLogin.page, "dashboard");
  assert.equal(adminFromLogin.redirect, "#/dashboard");

  const receptionFromForbiddenDashboard = resolveProtectedRoute("#/dashboard", reception);
  assert.equal(receptionFromForbiddenDashboard.page, "calendar");
  assert.equal(receptionFromForbiddenDashboard.redirect, "#/calendar");

  assert.deepEqual(resolveProtectedRoute("#/clients", therapist), {
    page: "clients",
    redirect: null,
  });
});

test("platform owner navigation remains separate from clinic navigation", () => {
  const pages = navigationFor({ role: "admin", platformOwner: true }).all.map((item) => item.page);
  assert.deepEqual(pages, ["platform", "platformBilling", "platformReports", "platformHealth"]);
  assert.equal(pages.includes("dashboard"), false);
});
