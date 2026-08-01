import { escapeAttribute, escapeHtml } from "./safe-html.js";

const copy = {
  ar: {
    title: "التقارير التشغيلية", apply: "تطبيق الفلاتر", reset: "هذا الشهر", from: "من", to: "إلى",
    therapist: "المعالج", service: "الخدمة", appointmentStatus: "حالة الموعد", paymentStatus: "حالة الدفع",
    all: "الكل", loading: "جارٍ تحميل التقارير…", error: "تعذر تحميل التقارير.", retry: "إعادة المحاولة",
    export: "تصدير CSV", print: "طباعة", overview: "نظرة عامة", appointments: "المواعيد", patients: "المرضى",
    clinical: "الزيارات السريرية", financial: "المالية", consents: "الموافقات", total: "إجمالي المواعيد",
    completed: "مكتملة", done: "مكتمل", pending: "قيد الانتظار", cancelled: "ملغاة", completionRate: "نسبة الإكمال",
    cancellationRate: "نسبة الإلغاء", newPatients: "مرضى جدد", returningPatients: "مرضى عائدون",
    activePatients: "مرضى نشطون", followUp: "يتطلبون متابعة", pendingConsent: "موافقة معلّقة",
    visitsStarted: "زيارات بدأت", draftVisits: "زيارات مسودة", issuedInvoices: "فواتير صادرة",
    grossInvoiced: "صافي الفوترة", paymentsReceived: "مدفوعات مستلمة", outstanding: "الرصيد المستحق",
    reversedPayments: "دفعات معكوسة", signed: "موقعة", declined: "مرفوضة", expired: "منتهية",
    missingConsent: "مواعيد ينقصها موافقة", byTherapist: "حسب المعالج", byService: "حسب الخدمة",
    trends: "الاتجاه اليومي", name: "الاسم", count: "العدد", revenue: "الإيراد", period: "الفترة",
    noData: "لا توجد بيانات ضمن الفلاتر المحددة.", ownScope: "تظهر بياناتك التشغيلية الشخصية فقط.",
    activeRule: "النشط: لديه موعد فعّال وغير ملغى ضمن النطاق.", unpaid: "غير مدفوع", deposit: "جزئي", paid: "مدفوع",
  },
  he: {
    title: "דוחות תפעוליים", apply: "החלת מסננים", reset: "החודש", from: "מתאריך", to: "עד תאריך",
    therapist: "מטפל/ת", service: "שירות", appointmentStatus: "סטטוס תור", paymentStatus: "סטטוס תשלום",
    all: "הכול", loading: "הדוחות נטענים…", error: "לא ניתן לטעון את הדוחות.", retry: "ניסיון נוסף",
    export: "ייצוא CSV", print: "הדפסה", overview: "סקירה", appointments: "תורים", patients: "מטופלים",
    clinical: "ביקורים קליניים", financial: "כספים", consents: "הסכמות", total: "סך התורים",
    completed: "הושלמו", done: "הושלם", pending: "ממתינים", cancelled: "בוטלו", completionRate: "שיעור השלמה",
    cancellationRate: "שיעור ביטול", newPatients: "מטופלים חדשים", returningPatients: "מטופלים חוזרים",
    activePatients: "מטופלים פעילים", followUp: "נדרש מעקב", pendingConsent: "הסכמה ממתינה",
    visitsStarted: "ביקורים שנפתחו", draftVisits: "טיוטות ביקור", issuedInvoices: "חשבוניות שהופקו",
    grossInvoiced: "חיוב נטו", paymentsReceived: "תשלומים שהתקבלו", outstanding: "יתרה פתוחה",
    reversedPayments: "תשלומים שבוטלו", signed: "נחתמו", declined: "נדחו", expired: "פג תוקף",
    missingConsent: "תורים ללא הסכמה נדרשת", byTherapist: "לפי מטפל/ת", byService: "לפי שירות",
    trends: "מגמה יומית", name: "שם", count: "כמות", revenue: "הכנסה", period: "תקופה",
    noData: "אין נתונים למסננים שנבחרו.", ownScope: "מוצגים רק המדדים התפעוליים האישיים שלך.",
    activeRule: "פעיל: מטופל עם תור פעיל ולא מבוטל בטווח שנבחר.", unpaid: "לא שולם", deposit: "חלקי", paid: "שולם",
  },
  en: {
    title: "Operational reports", apply: "Apply filters", reset: "This month", from: "From", to: "To",
    therapist: "Therapist", service: "Service", appointmentStatus: "Appointment status", paymentStatus: "Payment status",
    all: "All", loading: "Loading reports…", error: "Reports could not be loaded.", retry: "Try again",
    export: "Export CSV", print: "Print", overview: "Overview", appointments: "Appointments", patients: "Patients",
    clinical: "Clinical visits", financial: "Financial", consents: "Consents", total: "Total appointments",
    completed: "Completed", done: "Completed", pending: "Pending", cancelled: "Cancelled", completionRate: "Completion rate",
    cancellationRate: "Cancellation rate", newPatients: "New patients", returningPatients: "Returning patients",
    activePatients: "Active patients", followUp: "Follow-up required", pendingConsent: "Pending consent",
    visitsStarted: "Visits started", draftVisits: "Draft visits", issuedInvoices: "Issued invoices",
    grossInvoiced: "Net invoiced", paymentsReceived: "Payments received", outstanding: "Outstanding balance",
    reversedPayments: "Reversed payments", signed: "Signed", declined: "Declined", expired: "Expired",
    missingConsent: "Appointments missing consent", byTherapist: "By therapist", byService: "By service",
    trends: "Daily trend", name: "Name", count: "Count", revenue: "Revenue", period: "Period",
    noData: "No data matches the selected filters.", ownScope: "Only your personal operational metrics are shown.",
    activeRule: "Active: at least one active, non-cancelled appointment in the selected range.", unpaid: "Unpaid", deposit: "Partial", paid: "Paid",
  },
};

function t(language, key) {
  return copy[language]?.[key] || copy.en[key] || key;
}

export function currentMonthRange(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const last = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, "0");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${last}` };
}

function optionRows(rows, selected) {
  return (rows || []).map((row) => `<option value="${escapeAttribute(row.id)}" ${String(row.id) === String(selected) ? "selected" : ""}>${escapeHtml(row.name)}</option>`).join("");
}

function kpis(items) {
  return `<div class="report-kpis">${items.map(([label, value, tone = "blue"]) => `<article class="report-kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? 0)}</strong></article>`).join("")}</div>`;
}

function table(language, rows, valueKey = "total", valueLabel = "count", money = false) {
  if (!rows?.length) return `<p class="report-empty">${escapeHtml(t(language, "noData"))}</p>`;
  return `<div class="report-table-wrap"><table class="report-table"><thead><tr><th>${escapeHtml(t(language, "name"))}</th><th>${escapeHtml(t(language, valueLabel))}</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.name || row.period || "-")}</td><td>${money ? `<bdi>${escapeHtml(row[valueKey] || "0.00")} ILS</bdi>` : escapeHtml(row[valueKey] ?? 0)}</td></tr>`).join("")}</tbody></table></div>`;
}

function trend(language, rows, valueKey = "total", money = false) {
  if (!rows?.length) return `<p class="report-empty">${escapeHtml(t(language, "noData"))}</p>`;
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  return `<div class="report-trend" role="img" aria-label="${escapeAttribute(t(language, "trends"))}">${rows.slice(-31).map((row) => {
    const value = Number(row[valueKey] || 0);
    return `<div class="trend-row"><time>${escapeHtml(row.period)}</time><span><i style="width:${Math.max(2, Math.round((value / max) * 100))}%"></i></span><strong>${money ? `${escapeHtml(row[valueKey] || "0.00")} ILS` : escapeHtml(value)}</strong></div>`;
  }).join("")}</div>`;
}

function sectionCard(title, content) {
  return `<section class="card report-panel"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function overview(language, data) {
  const a = data.appointments?.summary || {};
  const items = [
    [t(language, "total"), a.total, "blue"],
    [t(language, "completed"), a.completed, "green"],
    [t(language, "pending"), a.pending, "gold"],
    [t(language, "cancelled"), a.cancelled, "red"],
  ];
  if (data.permissions.financial) items.push([t(language, "paymentsReceived"), `${data.financial?.summary?.paymentsReceived || "0.00"} ILS`, "purple"]);
  if (data.permissions.patients) items.push([t(language, "activePatients"), data.patients?.summary?.activePatients || 0, "green"]);
  return `${data.permissions.clinicWide ? "" : `<p class="report-scope">${escapeHtml(t(language, "ownScope"))}</p>`}${kpis(items)}${sectionCard(t(language, "trends"), trend(language, data.appointments?.dailyTrend))}`;
}

function appointmentSection(language, report) {
  const s = report.summary || {};
  return `${kpis([[t(language, "total"), s.total], [t(language, "completed"), s.completed, "green"], [t(language, "completionRate"), `${s.completionRate || 0}%`, "purple"], [t(language, "cancellationRate"), `${s.cancellationRate || 0}%`, "red"]])}<div class="report-two-columns">${sectionCard(t(language, "byTherapist"), table(language, report.byTherapist))}${sectionCard(t(language, "byService"), table(language, report.byService))}</div>${sectionCard(t(language, "trends"), trend(language, report.dailyTrend))}`;
}

function patientSection(language, report) {
  const s = report.summary || {};
  return `${kpis([[t(language, "newPatients"), s.newPatients], [t(language, "returningPatients"), s.returningPatients, "purple"], [t(language, "activePatients"), s.activePatients, "green"], [t(language, "followUp"), s.followUpRequired, "gold"], [t(language, "pendingConsent"), s.pendingConsent, "red"]])}<p class="report-rule">${escapeHtml(t(language, "activeRule"))}</p>${sectionCard(t(language, "byTherapist"), table(language, report.byAssignedTherapist))}`;
}

function clinicalSection(language, report) {
  const s = report.summary || {};
  return `${kpis([[t(language, "visitsStarted"), s.started], [t(language, "completed"), s.completed, "green"], [t(language, "draftVisits"), s.draft, "gold"], [t(language, "followUp"), s.followUpRequired, "red"]])}<div class="report-two-columns">${sectionCard(t(language, "byTherapist"), table(language, report.byTherapist))}${sectionCard(t(language, "byService"), table(language, report.byService))}</div>`;
}

function financialSection(language, report) {
  const s = report.summary || {};
  return `${kpis([[t(language, "issuedInvoices"), s.issuedInvoices], [t(language, "grossInvoiced"), `${s.grossInvoiced || "0.00"} ILS`, "blue"], [t(language, "paymentsReceived"), `${s.paymentsReceived || "0.00"} ILS`, "green"], [t(language, "outstanding"), `${s.outstandingBalance || "0.00"} ILS`, "gold"], [t(language, "cancelled"), s.cancelledInvoices, "red"], [t(language, "reversedPayments"), s.reversedPayments, "red"]])}<div class="report-two-columns">${sectionCard(t(language, "byService"), table(language, report.byService, "revenue", "revenue", true))}${sectionCard(t(language, "byTherapist"), table(language, report.byTherapist, "revenue", "revenue", true))}</div>${sectionCard(t(language, "trends"), trend(language, report.dailyTrend, "payments", true))}`;
}

function consentSection(language, report) {
  const s = report.summary || {};
  return kpis([[t(language, "pending"), s.pending, "gold"], [t(language, "signed"), s.signed, "green"], [t(language, "declined"), s.declined, "red"], [t(language, "expired"), s.expired, "red"], [t(language, "missingConsent"), s.upcomingMissingRequired, "purple"]]);
}

export function renderReportsWorkspace({ language = "en", workspace = {} }) {
  if (["idle", "loading"].includes(workspace.status)) return `<div class="report-boundary" aria-busy="true"><span class="report-spinner"></span><p>${escapeHtml(t(language, "loading"))}</p></div>`;
  if (workspace.status === "error") return `<div class="report-boundary" role="alert"><strong>${escapeHtml(t(language, "error"))}</strong><span>${escapeHtml(workspace.error || "")}</span><button class="btn secondary" type="button" data-report-retry>${escapeHtml(t(language, "retry"))}</button></div>`;
  const data = workspace.data || {};
  const filters = data.filters || workspace.filters || {};
  const options = data.options || {};
  const permissions = data.permissions || {};
  const sections = [
    ["overview", t(language, "overview"), true],
    ["appointments", t(language, "appointments"), permissions.appointments],
    ["patients", t(language, "patients"), permissions.patients],
    ["clinical", t(language, "clinical"), permissions.clinical],
    ["financial", t(language, "financial"), permissions.financial],
    ["consents", t(language, "consents"), permissions.consents],
  ].filter((row) => row[2]);
  const active = sections.some((row) => row[0] === workspace.section) ? workspace.section : "overview";
  const content = active === "appointments" ? appointmentSection(language, data.appointments)
    : active === "patients" ? patientSection(language, data.patients)
      : active === "clinical" ? clinicalSection(language, data.clinical)
        : active === "financial" ? financialSection(language, data.financial)
          : active === "consents" ? consentSection(language, data.consents)
            : overview(language, data);
  return `<div class="reports-workspace">
    <form class="card report-filters" data-report-filters>
      <label><span>${escapeHtml(t(language, "from"))}</span><input type="date" name="from" value="${escapeAttribute(filters.from || "")}" required></label>
      <label><span>${escapeHtml(t(language, "to"))}</span><input type="date" name="to" value="${escapeAttribute(filters.to || "")}" required></label>
      <label><span>${escapeHtml(t(language, "therapist"))}</span><select name="therapistId"><option value="">${escapeHtml(t(language, "all"))}</option>${optionRows(options.therapists, filters.therapistId)}</select></label>
      <label><span>${escapeHtml(t(language, "service"))}</span><select name="serviceId"><option value="">${escapeHtml(t(language, "all"))}</option>${optionRows(options.services, filters.serviceId)}</select></label>
      <label><span>${escapeHtml(t(language, "appointmentStatus"))}</span><select name="appointmentStatus"><option value="">${escapeHtml(t(language, "all"))}</option>${(options.appointmentStatuses || []).map((value) => `<option value="${escapeAttribute(value)}" ${value === filters.appointmentStatus ? "selected" : ""}>${escapeHtml(t(language, value))}</option>`).join("")}</select></label>
      <label><span>${escapeHtml(t(language, "paymentStatus"))}</span><select name="paymentStatus"><option value="">${escapeHtml(t(language, "all"))}</option>${(options.paymentStatuses || []).map((value) => `<option value="${escapeAttribute(value)}" ${value === filters.paymentStatus ? "selected" : ""}>${escapeHtml(t(language, value))}</option>`).join("")}</select></label>
      <div class="report-filter-actions"><button class="btn" type="submit">${escapeHtml(t(language, "apply"))}</button><button class="btn secondary" type="button" data-report-reset>${escapeHtml(t(language, "reset"))}</button></div>
    </form>
    <div class="report-toolbar"><div class="report-tabs" role="tablist">${sections.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === active}" class="${id === active ? "active" : ""}" data-report-section="${id}">${escapeHtml(label)}</button>`).join("")}</div><div class="actions"><button class="btn secondary" type="button" data-report-export>${escapeHtml(t(language, "export"))}</button><button class="btn secondary" type="button" data-report-print>${escapeHtml(t(language, "print"))}</button></div></div>
    <div class="report-content">${content}</div>
  </div>`;
}
