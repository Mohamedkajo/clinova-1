import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { escapeAttribute, escapeHtml, safeSetText } from "../../client/safe-html.js";

const payloads = [
  "<img src=x onerror=alert(1)>",
  "<script>alert(1)</script>",
  "\"><svg onload=alert(1)>",
];

test("frontend escaping renders XSS payloads as text", () => {
  for (const payload of payloads) {
    const escaped = escapeHtml(payload);
    assert.equal(escaped.includes("<script"), false);
    assert.equal(escaped.includes("<img"), false);
    assert.equal(escaped.includes("<svg"), false);
    assert.match(escaped, /&lt;/);
  }
});

test("attribute escaping neutralizes quotes and tags", () => {
  assert.equal(
    escapeAttribute("\"><svg onload=alert(1)>"),
    "&quot;&gt;&lt;svg onload=alert(1)&gt;",
  );
});

test("escaping preserves multilingual text and line breaks", () => {
  const value = "العربية\nעברית\nEnglish";
  assert.equal(escapeHtml(value), value);
});

test("safeSetText uses textContent instead of HTML parsing", () => {
  const element = { textContent: "" };
  safeSetText(element, payloads[0]);
  assert.equal(element.textContent, payloads[0]);
});

test("public feedback rendering does not inject API values with innerHTML", async () => {
  const source = await readFile(new URL("../../client/feedback.html", import.meta.url), "utf8");
  assert.doesNotMatch(source, /app\.innerHTML\s*=/);
  assert.match(source, /safeSetText\(details,/);
  assert.match(source, /app\.replaceChildren\(/);
});

test("shared table and high-risk compound renderers escape untrusted text", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  assert.match(source, /renderText\(cell\)/);
  assert.match(source, /escapeHtml\(client\.notes \|\| ""\)/);
  assert.match(source, /escapeHtml\(task\.notes \|\| ""\)/);
  assert.match(source, /escapeHtml\(r\.comment\)/);
  assert.match(source, /Object\.entries\(rawInvoice\).*escapeHtml\(value\)/);
});

test("invitation acceptance escapes all server-controlled display values", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const start = source.indexOf("async function renderAcceptInvitation");
  const end = source.indexOf("async function openClientProfile", start);
  const invitationRenderer = source.slice(start, end);

  assert.match(invitationRenderer, /escapeHtml\(err\.message\)/);
  assert.match(invitationRenderer, /escapeHtml\(invitation\.clinicName \|\| ""\)/);
  assert.match(invitationRenderer, /escapeHtml\(error\)/);
  assert.match(invitationRenderer, /escapeHtml\(invitation\.name\)/);
  assert.match(invitationRenderer, /escapeHtml\(invitation\.email\)/);
  assert.match(invitationRenderer, /escapeHtml\(roleLabel\(invitation\.role\)\)/);
  assert.doesNotMatch(invitationRenderer, /\$\{invitation\.(?:clinicName|name|email)\}/);
});

test("legal forms page does not expose direct signing while appointment signing remains", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const start = source.lastIndexOf("renderConsents = function");
  const end = source.indexOf("renderClientsHe = function", start);
  const legalFormsRenderer = source.slice(start, end);
  const appointmentStart = source.indexOf("function openAppointmentConsentModal");
  const appointmentEnd = source.indexOf("function openConsentSignModal", appointmentStart);
  const appointmentConsentFlow = source.slice(appointmentStart, appointmentEnd);

  assert.doesNotMatch(legalFormsRenderer, /data-sign-consent/);
  assert.match(source, /data-sign-appointment/);
  assert.match(appointmentConsentFlow, /matchingTemplates/);
  assert.match(appointmentConsentFlow, /openConsentSignModal/);
});

test("client profile exposes controlled note action and limits visible CRM events", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const start = source.indexOf("openClientProfile = async function");
  const end = source.indexOf("topActionI18n = function", start);
  const profileRenderer = source.slice(start, end);

  assert.match(profileRenderer, /clientNoteForm/);
  assert.match(profileRenderer, /\/api\/clients\/\$\{id\}\/notes/);
  assert.match(profileRenderer, /crmEvents\.slice\(0, 3\)/);
  assert.match(profileRenderer, /hiddenCrmEvents/);
  assert.match(profileRenderer, /details><summary/);
});

test("services and users actions keep working through shared action handlers", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const actionStart = source.indexOf("function bindPageActions");
  const actionEnd = source.indexOf("async function boot", actionStart);
  const actions = source.slice(actionStart, actionEnd);
  const restoredStart = source.indexOf("function bindRestoredSectionActions");
  const restoredEnd = source.indexOf("function openConsentUploadModal", restoredStart);
  const restoredActions = source.slice(restoredStart, restoredEnd);
  const usersStart = source.lastIndexOf("renderTeamUsers = function");
  const usersEnd = source.indexOf("renderCrm = function", usersStart);
  const usersRenderer = source.slice(usersStart, usersEnd);

  assert.match(actions, /\[data-new\]/);
  assert.match(actions, /\[data-edit\]/);
  assert.match(actions, /\[data-delete\]/);
  assert.match(actions, /showCenterError\(localizedError\(err\)\)/);
  assert.match(actions, /bindRestoredSectionActions\(\)/);
  assert.match(restoredActions, /inviteUserForm/);
  assert.match(restoredActions, /\/api\/invitations/);
  assert.match(usersRenderer, /inviteUserForm/);
  assert.match(usersRenderer, /data-copy-invite/);
  assert.match(usersRenderer, /data-revoke-invite/);
});

test("login form exposes clinic identifier and platform tenant deactivate action", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const loginStart = source.indexOf("document.getElementById(\"loginForm\")");
  const loginEnd = source.indexOf("async function renderAcceptInvitation", loginStart);
  const loginRenderer = source.slice(loginStart, loginEnd);
  const platformStart = source.indexOf("function platformClinicRow");
  const platformEnd = source.indexOf("function renderPlatformClients", platformStart);
  const platformRenderer = source.slice(platformStart, platformEnd);

  assert.match(loginRenderer, /clinicIdentifier/);
  assert.match(loginRenderer, /מזהה מרפאה/);
  assert.match(loginRenderer, /معرّف العيادة/);
  assert.match(platformRenderer, /data-platform-tenant-deactivate/);
  assert.match(source, /\/api\/platform\/tenants\/\$\{button\.dataset\.platformTenantDeactivate\}/);
});
