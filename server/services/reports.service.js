import {
  appointmentReport,
  auditReportExport,
  clinicalReport,
  consentReport,
  financialReport,
  patientReport,
  reportFilterOptions,
} from "../repositories/reports.repository.js";
import { isValidIsoDate } from "../shared/validation/date-time.js";

const appointmentStatuses = new Set(["pending", "done", "cancelled"]);
const paymentStatuses = new Set(["unpaid", "deposit", "paid"]);
const maxRangeDays = 366;

function localToday() {
  const configured = String(process.env.CLINOVA_TEST_NOW || "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (configured) return configured[1];
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultRange() {
  const today = localToday();
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: `${year}-${String(month).padStart(2, "0")}-${lastDay}` };
}

function validDate(value) {
  if (!isValidIsoDate(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function positiveId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

export function parseReportFilters(query = {}) {
  const defaults = defaultRange();
  const filters = {
    from: String(query.from || defaults.from),
    to: String(query.to || defaults.to),
    therapistId: positiveId(query.therapistId),
    serviceId: positiveId(query.serviceId),
    appointmentStatus: String(query.appointmentStatus || ""),
    paymentStatus: String(query.paymentStatus || ""),
    today: localToday(),
  };
  if (!validDate(filters.from) || !validDate(filters.to) || filters.from > filters.to) {
    return { error: "A valid date range is required." };
  }
  const days = Math.floor((Date.parse(`${filters.to}T00:00:00Z`) - Date.parse(`${filters.from}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > maxRangeDays) return { error: `Report date range cannot exceed ${maxRangeDays} days.` };
  if (Number.isNaN(filters.therapistId) || Number.isNaN(filters.serviceId)) return { error: "Valid report filters are required." };
  if (filters.appointmentStatus && !appointmentStatuses.has(filters.appointmentStatus)) return { error: "Valid appointment status is required." };
  if (filters.paymentStatus && !paymentStatuses.has(filters.paymentStatus)) return { error: "Valid payment status is required." };
  return { filters };
}

function money(minor) {
  return (Number(minor || 0) / 100).toFixed(2);
}

function formatFinancial(report) {
  if (!report) return null;
  const summary = report.summary;
  return {
    ...report,
    summary: {
      issuedInvoices: Number(summary.issuedInvoices || 0),
      grossInvoiced: money(summary.grossInvoicedMinor),
      paymentsReceived: money(summary.paymentsReceivedMinor),
      outstandingBalance: money(summary.outstandingMinor),
      cancelledInvoices: Number(summary.cancelledInvoices || 0),
      reversedPayments: Number(summary.reversedPayments || 0),
    },
    byService: report.byService.map((row) => ({ ...row, revenue: money(row.revenueMinor) })),
    byTherapist: report.byTherapist.map((row) => ({ ...row, revenue: money(row.revenueMinor) })),
    dailyTrend: report.dailyTrend.map((row) => ({ ...row, invoiced: money(row.invoicedMinor), payments: money(row.paymentsMinor) })),
    monthlyTrend: report.monthlyTrend.map((row) => ({ ...row, invoiced: money(row.invoicedMinor), payments: money(row.paymentsMinor) })),
  };
}

export async function getReports(user, query = {}) {
  const parsed = parseReportFilters(query);
  if (parsed.error) return { status: 400, body: { error: parsed.error, code: "INVALID_REPORT_FILTERS" } };
  const filters = parsed.filters;
  const options = await reportFilterOptions(user.tenantId, user);
  if (filters.therapistId && !options.therapists.some((item) => Number(item.id) === filters.therapistId)) {
    return { status: user.role === "therapist" ? 403 : 400, body: { error: "Therapist is not available for this report." } };
  }
  if (filters.serviceId && !options.services.some((item) => Number(item.id) === filters.serviceId)) {
    return { status: 400, body: { error: "Service is not available for this report." } };
  }

  const canViewPatients = user.role !== "therapist";
  const canViewClinical = user.role === "admin" || user.role === "therapist";
  const canViewFinancial = user.role === "admin" || user.role === "reception";
  const canViewConsents = user.role === "admin" || user.role === "reception";
  const [appointments, patients, clinical, financial, consents] = await Promise.all([
    appointmentReport(user.tenantId, filters, user),
    canViewPatients ? patientReport(user.tenantId, filters) : null,
    canViewClinical ? clinicalReport(user.tenantId, filters, user) : null,
    canViewFinancial ? financialReport(user.tenantId, filters) : null,
    canViewConsents ? consentReport(user.tenantId, filters) : null,
  ]);
  return {
    status: 200,
    body: {
      filters: { ...filters, today: undefined, maxRangeDays },
      permissions: {
        appointments: true,
        patients: canViewPatients,
        clinical: canViewClinical,
        clinicalScope: user.role === "therapist" ? "own" : user.role === "admin" ? "clinic" : "none",
        financial: canViewFinancial,
        consents: canViewConsents,
        clinicWide: user.role !== "therapist",
      },
      options: {
        ...options,
        appointmentStatuses: [...appointmentStatuses],
        paymentStatuses: [...paymentStatuses],
      },
      appointments,
      patients,
      clinical,
      financial: formatFinancial(financial),
      consents,
    },
  };
}

export function protectSpreadsheetCell(value) {
  const text = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  return `"${protectSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

function flattenReport(report) {
  const rows = [["section", "metric", "label", "value"]];
  const addSummary = (section, summary) => {
    for (const [metric, value] of Object.entries(summary || {})) rows.push([section, metric, "", value]);
  };
  addSummary("appointments", report.appointments?.summary);
  addSummary("patients", report.patients?.summary);
  addSummary("clinical", report.clinical?.summary);
  addSummary("financial", report.financial?.summary);
  addSummary("consents", report.consents?.summary);
  for (const [section, groups] of [
    ["appointments_by_therapist", report.appointments?.byTherapist],
    ["appointments_by_service", report.appointments?.byService],
    ["patients_by_therapist", report.patients?.byAssignedTherapist],
    ["clinical_by_therapist", report.clinical?.byTherapist],
    ["clinical_by_service", report.clinical?.byService],
    ["revenue_by_service", report.financial?.byService],
    ["revenue_by_therapist", report.financial?.byTherapist],
  ]) {
    for (const row of groups || []) rows.push([section, "aggregate", row.name || "", row.revenue ?? row.total ?? row.completed ?? 0]);
  }
  return rows;
}

export async function exportReportsCsv(user, query = {}) {
  const result = await getReports(user, query);
  if (result.status !== 200) return result;
  const csv = `\uFEFF${flattenReport(result.body).map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  await auditReportExport(user, result.body.filters, "csv");
  return { status: 200, body: csv, filename: `clinova-reports-${result.body.filters.from}-${result.body.filters.to}.csv` };
}
