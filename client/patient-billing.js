import { escapeAttribute, escapeHtml } from "./safe-html.js";

const words = {
  en: {
    title: "Patient billing", newInvoice: "New invoice", invoice: "Invoice", patient: "Patient",
    appointment: "Appointment", status: "Status", total: "Total", paid: "Paid", due: "Outstanding",
    date: "Issue date", actions: "Actions", details: "Details", empty: "No patient invoices yet.",
    loading: "Loading invoices…", error: "Billing could not be loaded.", retry: "Try again",
    ledger: "Patient ledger", balance: "Current balance", debit: "Debit", credit: "Credit",
    reference: "Reference", noLedger: "No posted ledger entries.", invoices: "Invoices",
  },
  he: {
    title: "חיובי מטופלים", newInvoice: "חשבונית חדשה", invoice: "חשבונית", patient: "מטופל",
    appointment: "תור", status: "סטטוס", total: "סה״כ", paid: "שולם", due: "יתרה",
    date: "תאריך הפקה", actions: "פעולות", details: "פרטים", empty: "אין עדיין חשבוניות למטופלים.",
    loading: "טוען חשבוניות…", error: "לא ניתן לטעון את החיובים.", retry: "ניסיון חוזר",
    ledger: "כרטסת מטופל", balance: "יתרה נוכחית", debit: "חובה", credit: "זכות",
    reference: "אסמכתא", noLedger: "אין תנועות מאושרות.", invoices: "חשבוניות",
  },
  ar: {
    title: "فواتير المرضى", newInvoice: "فاتورة جديدة", invoice: "الفاتورة", patient: "المريض",
    appointment: "الموعد", status: "الحالة", total: "الإجمالي", paid: "المدفوع", due: "المتبقي",
    date: "تاريخ الإصدار", actions: "الإجراءات", details: "التفاصيل", empty: "لا توجد فواتير مرضى بعد.",
    loading: "جارٍ تحميل الفواتير…", error: "تعذر تحميل الفوترة.", retry: "إعادة المحاولة",
    ledger: "دفتر حساب المريض", balance: "الرصيد الحالي", debit: "مدين", credit: "دائن",
    reference: "المرجع", noLedger: "لا توجد حركات مُرحّلة.", invoices: "الفواتير",
  },
};

const text = (language, key) => words[language]?.[key] || words.en[key] || key;
const safe = (value) => escapeHtml(value ?? "");
const attr = (value) => escapeAttribute(value ?? "");

export function billingStatus(status, language) {
  const labels = {
    en: { draft: "Draft", issued: "Issued", partially_paid: "Partially paid", paid: "Paid", cancelled: "Cancelled" },
    he: { draft: "טיוטה", issued: "הופקה", partially_paid: "שולמה חלקית", paid: "שולמה", cancelled: "בוטלה" },
    ar: { draft: "مسودة", issued: "صادرة", partially_paid: "مدفوعة جزئياً", paid: "مدفوعة", cancelled: "ملغاة" },
  };
  return labels[language]?.[status] || labels.en[status] || status;
}

function boundary(status, language, error = "") {
  if (status === "loading" || status === "idle") return `<div class="billing-boundary" role="status">${safe(text(language, "loading"))}</div>`;
  return `<div class="billing-boundary" role="alert"><p>${safe(error || text(language, "error"))}</p><button class="btn secondary" type="button" data-billing-retry>${safe(text(language, "retry"))}</button></div>`;
}

export function renderBillingWorkspace({ language = "en", workspace = {} }) {
  if (workspace.status !== "ready") return boundary(workspace.status, language, workspace.error);
  const invoices = workspace.items || [];
  if (!invoices.length) return `<div class="card billing-empty"><p class="muted">${safe(text(language, "empty"))}</p><button class="btn" type="button" data-new-invoice>${safe(text(language, "newInvoice"))}</button></div>`;
  return `<section class="billing-workspace">
    <div class="billing-summary card"><div><span>${safe(text(language, "invoices"))}</span><strong>${safe(invoices.length)}</strong></div><button class="btn" type="button" data-new-invoice>${safe(text(language, "newInvoice"))}</button></div>
    <div class="card billing-table-wrap"><table class="billing-table"><thead><tr><th>${safe(text(language, "invoice"))}</th><th>${safe(text(language, "patient"))}</th><th>${safe(text(language, "date"))}</th><th>${safe(text(language, "status"))}</th><th>${safe(text(language, "total"))}</th><th>${safe(text(language, "paid"))}</th><th>${safe(text(language, "due"))}</th><th>${safe(text(language, "actions"))}</th></tr></thead><tbody>${invoices.map((invoice) => `<tr><td><strong>${safe(invoice.invoiceNumber)}</strong>${invoice.appointmentId ? `<small>#${safe(invoice.appointmentId)}</small>` : ""}</td><td>${safe(invoice.patientName)}</td><td>${safe(invoice.issueDate || "—")}</td><td><span class="pill ${attr(invoice.status)}">${safe(billingStatus(invoice.status, language))}</span></td><td>${safe(invoice.total)} ${safe(invoice.currency)}</td><td>${safe(invoice.paid)} ${safe(invoice.currency)}</td><td>${safe(invoice.outstanding)} ${safe(invoice.currency)}</td><td><button class="btn secondary" type="button" data-invoice-details="${attr(invoice.id)}">${safe(text(language, "details"))}</button></td></tr>`).join("")}</tbody></table></div>
    <div class="billing-mobile-list">${invoices.map((invoice) => `<article class="card"><header><strong>${safe(invoice.invoiceNumber)}</strong><span class="pill ${attr(invoice.status)}">${safe(billingStatus(invoice.status, language))}</span></header><p>${safe(invoice.patientName)}</p><dl><div><dt>${safe(text(language, "total"))}</dt><dd>${safe(invoice.total)} ${safe(invoice.currency)}</dd></div><div><dt>${safe(text(language, "due"))}</dt><dd>${safe(invoice.outstanding)} ${safe(invoice.currency)}</dd></div></dl><button class="btn secondary" type="button" data-invoice-details="${attr(invoice.id)}">${safe(text(language, "details"))}</button></article>`).join("")}</div>
  </section>`;
}

export function renderPatientFinancialSection(data, language = "en") {
  if (!data?.capabilities?.financial || !data.financial) return "";
  const finance = data.financial;
  return `<section class="patient-profile-section patient-financial-section"><header><h3>${safe(text(language, "ledger"))}</h3><div class="patient-balance"><span>${safe(text(language, "balance"))}</span><strong>${safe(finance.balance)} ILS</strong></div></header>
    <div class="patient-finance-invoices">${(finance.invoices || []).map((invoice) => `<button type="button" data-patient-invoice="${attr(invoice.id)}"><strong>${safe(invoice.invoiceNumber)}</strong><span>${safe(billingStatus(invoice.status, language))} · ${safe(invoice.total)} ${safe(invoice.currency)}</span></button>`).join("") || `<p class="muted">${safe(text(language, "empty"))}</p>`}</div>
    <div class="billing-table-wrap"><table class="billing-table"><thead><tr><th>${safe(text(language, "date"))}</th><th>${safe(text(language, "reference"))}</th><th>${safe(text(language, "debit"))}</th><th>${safe(text(language, "credit"))}</th><th>${safe(text(language, "balance"))}</th></tr></thead><tbody>${(finance.ledgerEntries || []).map((entry) => `<tr><td>${safe(entry.postedAt)}</td><td>${safe(entry.reference)}</td><td>${safe(entry.debit)}</td><td>${safe(entry.credit)}</td><td>${safe(entry.balance)}</td></tr>`).join("") || `<tr><td colspan="5">${safe(text(language, "noLedger"))}</td></tr>`}</tbody></table></div>
  </section>`;
}
