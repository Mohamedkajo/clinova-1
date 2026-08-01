import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { currentMonthRange, renderReportsWorkspace } from "../reports-workspace.js";

const data = {
  filters: { from: "2035-09-01", to: "2035-09-30", therapistId: "", serviceId: "", appointmentStatus: "", paymentStatus: "" },
  permissions: { appointments: true, patients: true, clinical: true, financial: true, consents: true, clinicWide: true },
  options: { therapists: [{ id: 1, name: '<img src=x onerror="alert(1)">' }], services: [{ id: 2, name: "=2+3" }], appointmentStatuses: ["pending", "done", "cancelled"], paymentStatuses: ["unpaid", "deposit", "paid"] },
  appointments: { summary: { total: 4, completed: 2, pending: 1, cancelled: 1, completionRate: 50, cancellationRate: 25 }, byTherapist: [{ name: "Sara", total: 4 }], byService: [{ name: "Therapy", total: 4 }], dailyTrend: [{ period: "2035-09-10", total: 4 }] },
  patients: { summary: { newPatients: 1, returningPatients: 1, activePatients: 2, followUpRequired: 1, pendingConsent: 1 }, byAssignedTherapist: [] },
  clinical: { summary: { started: 2, completed: 1, draft: 1, followUpRequired: 1 }, byTherapist: [], byService: [] },
  financial: { summary: { issuedInvoices: 1, grossInvoiced: "100.00", paymentsReceived: "60.00", outstandingBalance: "40.00", cancelledInvoices: 0, reversedPayments: 1 }, byService: [], byTherapist: [], dailyTrend: [{ period: "2035-09-10", payments: "60.00" }] },
  consents: { summary: { pending: 1, signed: 1, declined: 0, expired: 0, upcomingMissingRequired: 1 } },
};

test("reports workspace renders states, secure data and role-aware sections", () => {
  assert.match(renderReportsWorkspace({ language: "en", workspace: { status: "loading" } }), /Loading reports/);
  assert.match(renderReportsWorkspace({ language: "ar", workspace: { status: "error", error: "Offline" } }), /data-report-retry/);
  const html = renderReportsWorkspace({ language: "en", workspace: { status: "ready", data, filters: data.filters, section: "overview" } });
  assert.match(html, /data-report-filters/);
  assert.match(html, /data-report-export/);
  assert.match(html, /data-report-print/);
  assert.match(html, /data-report-section="clinical"/);
  assert.doesNotMatch(html, /<img|<script/i);
  assert.match(html, /&lt;img/);

  const therapistData = { ...data, permissions: { appointments: true, patients: false, clinical: true, financial: false, consents: false, clinicWide: false }, patients: null, financial: null, consents: null };
  const therapist = renderReportsWorkspace({ language: "he", workspace: { status: "ready", data: therapistData, section: "overview" } });
  assert.doesNotMatch(therapist, /data-report-section="financial"|data-report-section="patients"|data-report-section="consents"/);
  assert.match(therapist, /התפעוליים האישיים/);
});

test("reports use current-month defaults and responsive RTL/LTR integration without a chart framework", async () => {
  assert.deepEqual(currentMonthRange(new Date(2035, 8, 10)), { from: "2035-09-01", to: "2035-09-30" });
  const [app, shell, styles, packageJson] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../foundation-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(app, /\/api\/reports\?/);
  assert.match(app, /\/api\/reports\/export\.csv/);
  assert.match(shell, /reception:[\s\S]*canViewReports/);
  assert.match(shell, /therapist:[\s\S]*canViewReports/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.report-filters/);
  assert.match(styles, /@media print[\s\S]*\.report-filters/);
  assert.doesNotMatch(packageJson, /chart\.js|highcharts|echarts/i);
});
