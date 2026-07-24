import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { translate as foundationText } from "../../client/foundation-shell.js";
import { escapeAttribute, escapeHtml, safeSetText } from "../../client/safe-html.js";
import { searchScore } from "../services/search.service.js";

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

test("patient profile exposes permission-controlled note action and the server timeline", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const profileRenderer = await readFile(new URL("../../client/patient-workspace.js", import.meta.url), "utf8");

  assert.match(profileRenderer, /clientNoteForm/);
  assert.match(profileRenderer, /capabilities\.write && capabilities\.clinicalNotes/);
  assert.match(profileRenderer, /data\.timeline/);
  assert.match(source, /\/api\/clients\/\$\{id\}\/notes/);
  assert.match(source, /\/api\/clients\/\$\{id\}\/history/);
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
  const loginStart = source.lastIndexOf("renderLogin = function");
  const loginEnd = source.indexOf("function uiText", loginStart);
  const loginRenderer = source.slice(loginStart, loginEnd);
  const platformStart = source.indexOf("function platformClinicRow");
  const platformEnd = source.indexOf("function renderPlatformClients", platformStart);
  const platformRenderer = source.slice(platformStart, platformEnd);

  assert.match(loginRenderer, /name="clinicIdentifier"/);
  assert.match(loginRenderer, /foundationText\(state\.lang, "auth\.clinic"\)/);
  assert.equal(foundationText("he", "auth.clinic"), "\u05de\u05d6\u05d4\u05d4 \u05e7\u05dc\u05d9\u05e0\u05d9\u05e7\u05d4");
  assert.equal(foundationText("ar", "auth.clinic"), "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0639\u064a\u0627\u062f\u0629");
  assert.match(platformRenderer, /data-platform-tenant-deactivate/);
  assert.match(source, /\/api\/platform\/tenants\/\$\{button\.dataset\.platformTenantDeactivate\}/);
});
test("CSV exports include UTF-8 BOM for Excel multilingual readability", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  assert.match(source, /new Blob\(\["\\uFEFF", csv\]/);
  assert.match(source, /new Blob\(\["\\uFEFF", content\]/);
});

test("final login renderer includes clinic identifier directly in form markup", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const loginStart = source.lastIndexOf("renderLogin = function");
  const loginEnd = source.indexOf("function uiText", loginStart);
  const loginRenderer = source.slice(loginStart, loginEnd);

  assert.match(loginRenderer, /name="clinicIdentifier"/);
  assert.match(loginRenderer, /autocomplete="organization"/);
  assert.match(loginRenderer, /foundationText\(state\.lang, "auth\.clinic"\)/);
  assert.equal(foundationText("he", "auth.clinic"), "\u05de\u05d6\u05d4\u05d4 \u05e7\u05dc\u05d9\u05e0\u05d9\u05e7\u05d4");
  assert.equal(foundationText("ar", "auth.clinic"), "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0639\u064a\u0627\u062f\u0629");
  assert.doesNotMatch(loginRenderer, /querySelector\("input\[name='clinicIdentifier'\]"\)/);
});

test("settings success and common error messages are readable", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  assert.match(source, /تم حفظ الإعدادات بنجاح/);
  assert.match(source, /ההגדרות נשמרו בהצלחה/);
  assert.match(source, /حدث خطأ\. حاول مرة أخرى\./);
  assert.match(source, /אירעה שגיאה\. נסו שוב\./);
  assert.match(source, /اسم المستخدم أو كلمة المرور غير صحيحة/);
  assert.match(source, /שם המשתמש או הסיסמה שגויים/);
  assert.match(source, /مطلوب معرّف العيادة/);
  assert.match(source, /נדרש מזהה מרפאה/);
});

test("appointment validation errors are mapped to localized frontend messages", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  const start = source.indexOf("localizedError = function");
  const end = source.indexOf("function successText", start);
  const errors = source.slice(start, end);

  assert.match(source, /error\.code = data\.code \|\| data\.error \|\| ""/);
  assert.match(errors, /APPOINTMENT_IN_PAST/);
  assert.match(errors, /APPOINTMENT_OUTSIDE_WORK_HOURS/);
  assert.match(errors, /\\u05d0\\u05d9 \\u05d0\\u05e4\\u05e9\\u05e8 \\u05dc\\u05e7\\u05d1\\u05d5\\u05e2 \\u05ea\\u05d5\\u05e8 \\u05d1\\u05d6\\u05de\\u05df \\u05e9\\u05db\\u05d1\\u05e8 \\u05e2\\u05d1\\u05e8/);
  assert.match(errors, /\\u0644\\u0627 \\u064a\\u0645\\u0643\\u0646 \\u062d\\u062c\\u0632 \\u0645\\u0648\\u0639\\u062f \\u0641\\u064a \\u0648\\u0642\\u062a \\u0645\\u0636\\u0649/);
  assert.match(errors, /Appointment cannot be booked in the past/);
  assert.match(errors, /Appointment must be within clinic working hours/);
});

test("quick search hides on outside click without removing result click handlers", async () => {
  const source = await readFile(new URL("../../client/app.js", import.meta.url), "utf8");
  assert.match(source, /closeQuickSearchOnOutsideClick/);
  assert.match(source, /wrapper\.contains\(event\.target\)/);
  assert.match(source, /panel\?\.classList\.add\("hidden"\)/);
  assert.match(source, /\[data-quick-profile\]/);
  assert.match(source, /\[data-quick-appointment\]/);
});

test("search score narrows toward exact and prefix matches as query grows", () => {
  const exact = searchScore("سارة خليل", "سارة");
  const prefix = searchScore("سارة خليل", "سار");
  const broad = searchScore("زيارة متابعة لسارة خليل", "سار");
  const unrelated = searchScore("ليلى منصور", "سارة");

  assert.ok(exact > prefix);
  assert.ok(prefix > broad);
  assert.equal(unrelated, 0);
  assert.ok(searchScore("0501234567", "050123", "0501234567") > searchScore("0501234567", "050", "0501234567"));
});
