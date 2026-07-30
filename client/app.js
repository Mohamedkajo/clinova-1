import { escapeAttribute, escapeHtml } from "./safe-html.js";
import {
  emptyWorkspaceFilters,
  moveWorkspaceDate,
  renderAppointmentDetails,
  renderAppointmentWorkspace,
} from "./appointment-workspace.js";
import {
  emptyPatientFilters,
  renderPatientProfile,
  renderPatientWorkspace,
} from "./patient-workspace.js";
import { renderBookingWorkflow, selectedServiceDuration } from "./booking-workflow.js";
import { renderClinicalVisit } from "./clinical-visit.js";
import { notificationTarget, renderNotificationCenter } from "./notification-center.js";
import { billingStatus, renderBillingWorkspace } from "./patient-billing.js";
import {
  directionForLanguage,
  hashForRoute,
  localizedAuthError,
  navigationFor,
  navigationIcons,
  pageLabel as foundationPageLabel,
  pageSubtitle as foundationPageSubtitle,
  resolveProtectedRoute,
  translate as foundationText,
} from "./foundation-shell.js";

const state = {
  user: null,
  page: "dashboard",
  data: { users: [], invitations: [], categories: [], services: [], clients: [], crmTasks: [], crmEvents: [], appointments: [], consentTemplates: [], consentSignatures: [], feedbackRequests: [], giftCards: [], messageLogs: [], tenantDomains: [], audits: [], settings: {} },
  filters: { appointments: "", appointmentStatus: "all", clients: "" },
  calendarView: "week",
  calendarDate: new Date().toISOString().slice(0, 10),
  appointmentWorkspace: {
    status: "idle",
    error: "",
    queue: [],
    filters: { ...emptyWorkspaceFilters },
  },
  patientWorkspace: {
    status: "idle",
    error: "",
    data: null,
    filters: { ...emptyPatientFilters },
  },
  billingWorkspace: {
    status: "idle",
    error: "",
    items: [],
  },
  quickSearch: "",
  quickResults: null,
  lang: ["he", "ar", "en"].includes(localStorage.getItem("clinova-lang")) ? localStorage.getItem("clinova-lang") : "he",
  reportTab: "overview",
  mobileNavOpen: false,
  notificationCenter: {
    status: "idle",
    error: "",
    items: [],
    unreadCount: 0,
    open: false,
    actionPending: false,
  },
};

const APP_VERSION = "1.8.0-alpha.1";

let tr;
let pageLabel;
let pageSubtitle;
let yesNo;
let roleLabel;
let languagePicker;
let renderQuickSearchLive;
let topActionI18n;
let renderDashboardHe;
let renderAppointmentsHe;
let renderCalendarHe;
let renderClientsHe;
let renderCategoriesHe;
let renderServicesHe;
let renderTeamUsers;
let renderCrm;
let renderWhatsApp;
let renderConsents;
let renderFeedback;
let renderGifts;
let renderReports;
let renderAudit;
let renderSettingsClean;
let renderBilling;
let formFieldsHe;
let renderApp;
let renderLogin;

const labels = {
  calendar: "التقويم",
  dashboard: "لوحة التحكم",
  appointments: "المواعيد",
  clients: "العملاء",
  categories: "الأقسام",
  services: "الخدمات",
  users: "المستخدمون",
  reports: "التقارير",
  audit: "سجل النشاط",
  settings: "الإعدادات",
};

const navByRole = {
  admin: ["dashboard", "calendar", "appointments", "clients", "crm", "whatsapp", "consents", "feedback", "gifts", "categories", "services", "users", "reports", "audit", "settings"],
  reception: ["calendar", "appointments", "clients", "crm", "consents", "feedback", "gifts", "settings"],
  therapist: ["calendar", "appointments", "clients", "crm", "consents", "settings"],
};

const i18n = {
  ar: {
    clinicSystem: "إدارة العيادة",
    quickSearch: "بحث سريع...",
    language: "اللغة",
    logout: "خروج",
    add: "إضافة",
    edit: "تعديل",
    delete: "حذف",
    close: "إغلاق",
    save: "حفظ",
    receipt: "إيصال",
    newAppointment: "موعد جديد",
    newClient: "عميل جديد",
    noData: "لا توجد بيانات",
    searching: "جاري البحث...",
    noResults: "لا توجد نتائج",
    labels: {
      dashboard: "لوحة التحكم",
      calendar: "التقويم",
      appointments: "المواعيد",
      clients: "العملاء",
      categories: "الأقسام",
      services: "الخدمات",
      users: "المستخدمون",
      reports: "التقارير",
      audit: "سجل النشاط",
      settings: "الإعدادات",
    },
    subtitles: {
      dashboard: "نظرة سريعة على يوم العمل والأداء",
      calendar: "عرض المواعيد حسب الشهر أو الأسبوع أو اليوم",
      appointments: "تنظيم المواعيد ومنع التعارضات",
      clients: "ملفات العملاء وبيانات التواصل",
      categories: "تصنيف الخدمات داخل العيادة",
      services: "الأسعار والمدد والخدمات الفعالة",
      users: "الصلاحيات وحسابات الفريق",
      reports: "ملخصات الإيراد والإنجاز",
      audit: "آخر النشاطات داخل النظام",
      settings: "إعدادات الحساب والعيادة",
    },
    roles: { admin: "مدير", reception: "استقبال", therapist: "معالجة" },
    status: { pending: "قيد الانتظار", done: "تم", cancelled: "ملغي" },
    payment: { unpaid: "غير مدفوع", paid: "مدفوع", deposit: "عربون" },
    searchGroups: { clients: "العملاء", appointments: "المواعيد", services: "الخدمات", file: "ملف", appointment: "موعد" },
    table: { date: "التاريخ", time: "الوقت", client: "العميل", service: "الخدمة", therapist: "المعالجة", price: "السعر", payment: "الدفع", status: "الحالة" },
  },
  he: {
    clinicSystem: "ניהול קליניקה",
    quickSearch: "חיפוש מהיר...",
    language: "שפה",
    logout: "יציאה",
    add: "הוספה",
    edit: "עריכה",
    delete: "מחיקה",
    close: "סגירה",
    save: "שמירה",
    receipt: "קבלה",
    newAppointment: "תור חדש",
    newClient: "לקוח חדש",
    noData: "אין נתונים",
    searching: "מחפש...",
    noResults: "לא נמצאו תוצאות",
    labels: {
      dashboard: "לוח בקרה",
      calendar: "יומן",
      appointments: "תורים",
      clients: "לקוחות",
      categories: "קטגוריות",
      services: "שירותים",
      users: "משתמשים",
      reports: "דוחות",
      audit: "יומן פעילות",
      settings: "הגדרות",
    },
    subtitles: {
      dashboard: "מבט מהיר על יום העבודה והביצועים",
      calendar: "תצוגת תורים לפי חודש, שבוע או יום",
      appointments: "ניהול תורים ומניעת התנגשויות",
      clients: "תיקי לקוחות ופרטי קשר",
      categories: "סיווג השירותים בקליניקה",
      services: "מחירים, משכים ושירותים פעילים",
      users: "הרשאות וחשבונות צוות",
      reports: "סיכומי הכנסות וביצועים",
      audit: "פעילות אחרונה במערכת",
      settings: "הגדרות חשבון וקליניקה",
    },
    roles: { admin: "מנהל", reception: "קבלה", therapist: "מטפלת" },
    status: { pending: "ממתין", done: "בוצע", cancelled: "בוטל" },
    payment: { unpaid: "לא שולם", paid: "שולם", deposit: "מקדמה" },
    searchGroups: { clients: "לקוחות", appointments: "תורים", services: "שירותים", file: "תיק", appointment: "תור" },
    table: { date: "תאריך", time: "שעה", client: "לקוח", service: "שירות", therapist: "מטפלת", price: "מחיר", payment: "תשלום", status: "סטטוס" },
  },
};

tr = function (key) {
  return key.split(".").reduce((obj, part) => obj?.[part], i18n[state.lang]) ?? key;
}

const statusLabel = new Proxy({}, { get: (_, key) => {
  const he = state.lang === "he";
  const map = he
    ? { pending: "ממתין", done: "בוצע", cancelled: "בוטל" }
    : { pending: "قيد الانتظار", done: "تم", cancelled: "ملغي" };
  return map[String(key)] || String(key);
} });
const paymentLabel = new Proxy({}, { get: (_, key) => {
  const he = state.lang === "he";
  const map = he
    ? { unpaid: "לא שולם", paid: "שולם", deposit: "מקדמה" }
    : { unpaid: "غير مدفوع", paid: "مدفوع", deposit: "عربون" };
  return map[String(key)] || String(key);
} });

pageLabel = function (page) {
  if (page === "platform") return state.lang === "he" ? "ניהול המערכת" : "إدارة المنصة";
  if (page === "billing") return state.lang === "he" ? "חשבוניות" : "الفواتير";
  if (page === "whatsapp") return "WhatsApp";
  const extra = state.lang === "he"
    ? { crm: "קשרי לקוחות", consents: "טפסים משפטיים", feedback: "משוב לקוחות", gifts: "מתנות" }
    : { crm: "إدارة العملاء", consents: "الإقرارات القانونية", feedback: "آراء العملاء", gifts: "الهدايا" };
  const label = tr(`labels.${page}`);
  return label === `labels.${page}` ? (extra[page] || page) : label;
}
async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "include",
    headers: isFormData ? (options.headers || {}) : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "حدث خطأ");
    error.status = response.status;
    error.code = data.code || data.error || "";
    error.details = data.details || {};
    error.data = data;
    throw error;
  }
  return data;
}

function html(strings, ...values) {
  return strings.map((part, index) => part + (values[index] ?? "")).join("");
}

const trustedMarkup = Symbol("trustedMarkup");

function rawHtml(value = "") {
  return { [trustedMarkup]: true, value: String(value ?? "") };
}

function renderText(value = "") {
  return value?.[trustedMarkup] ? value.value : escapeHtml(value);
}

function mount(markup) {
  document.getElementById("app").innerHTML = markup;
}

function escapeAttr(value = "") {
  return escapeAttribute(value);
}

function logoSrc() {
  return (state.data.settings && state.data.settings.logoUrl) || "/logo.svg";
}

function currency() {
  return (state.data.settings && state.data.settings.currency) || "₪";
}

function categoryName(id) {
  return (state.data.categories || []).find((item) => Number(item.id) === Number(id))?.name || "-";
}

function therapists() {
  return (state.data.users || [])
    .filter((user) => user.active !== false && (user.role === "therapist" || user.role === "admin"))
    .map((user) => [user.id, user.name || user.username]);
}

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toMinutes(time = "00:00") {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function selectedWorkDays(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

let modalReturnFocus = null;
let modalKeydownCleanup = null;

function beginModalInteraction() {
  const root = document.getElementById("modalRoot");
  if (!modalReturnFocus && !root?.children.length && document.activeElement instanceof HTMLElement) {
    modalReturnFocus = document.activeElement;
  }
}

function bindModalAccessibility({ onClose = closeModal, focusSelector = "" } = {}) {
  const root = document.getElementById("modalRoot");
  const dialog = root?.querySelector('[role="dialog"]');
  modalKeydownCleanup?.();
  modalKeydownCleanup = null;
  if (!dialog) return;

  const focusableSelector = [
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll(focusableSelector)]
      .filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };
  dialog.addEventListener("keydown", onKeydown);
  modalKeydownCleanup = () => dialog.removeEventListener("keydown", onKeydown);

  const focusTarget = focusSelector
    ? dialog.querySelector(focusSelector)
    : dialog.querySelector("[autofocus], input:not([type='hidden']), select, textarea, button");
  queueMicrotask(() => focusTarget?.focus());
}

function closeModal() {
  const root = document.getElementById("modalRoot");
  modalKeydownCleanup?.();
  modalKeydownCleanup = null;
  if (root) root.innerHTML = "";
  const returnTarget = modalReturnFocus;
  modalReturnFocus = null;
  queueMicrotask(() => {
    if (returnTarget?.isConnected) returnTarget.focus();
  });
}

function localizedError(err) {
  if (!err?.message) return state.lang === "he" ? "אירעה שגיאה" : "حدث خطأ";
  return err?.message || (state.lang === "he" ? "אירעה שגיאה" : "حدث خطأ");
}

function showToast(message, tone = "error") {
  document.getElementById("centerToast")?.remove();
  const alert = document.createElement("div");
  alert.id = "centerToast";
  alert.className = `center-toast ${tone === "success" ? "center-success" : "center-error"}`;
  alert.setAttribute("role", tone === "success" ? "status" : "alert");
  alert.setAttribute("aria-live", tone === "success" ? "polite" : "assertive");
  alert.textContent = message;
  document.body.appendChild(alert);
  window.setTimeout(() => alert.remove(), 3200);
}

function showCenterError(message) {
  showToast(message, "error");
}

function showCenterSuccess(message) {
  showToast(message, "success");
}

localizedError = function (err) {
  const fallback = state.lang === "he" ? "אירעה שגיאה. נסו שוב." : "حدث خطأ. حاول مرة أخرى.";
  if (!err?.message) return fallback;
  const common = {
    APPOINTMENT_IN_PAST: {
      ar: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062d\u062c\u0632 \u0645\u0648\u0639\u062f \u0641\u064a \u0648\u0642\u062a \u0645\u0636\u0649",
      he: "\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e7\u05d1\u05d5\u05e2 \u05ea\u05d5\u05e8 \u05d1\u05d6\u05de\u05df \u05e9\u05db\u05d1\u05e8 \u05e2\u05d1\u05e8",
      en: "Appointment cannot be booked in the past",
    },
    APPOINTMENT_OUTSIDE_WORK_HOURS: {
      ar: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u0648\u0639\u062f \u0636\u0645\u0646 \u0633\u0627\u0639\u0627\u062a \u0639\u0645\u0644 \u0627\u0644\u0639\u064a\u0627\u062f\u0629",
      he: "\u05d4\u05ea\u05d5\u05e8 \u05d7\u05d9\u05d9\u05d1 \u05dc\u05d4\u05d9\u05d5\u05ea \u05d1\u05ea\u05d5\u05da \u05e9\u05e2\u05d5\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc \u05d4\u05de\u05e8\u05e4\u05d0\u05d4",
      en: "Appointment must be within clinic working hours",
    },
    appointment_category_conflict: {
      ar: "يوجد موعد متعارض ضمن فئة الخدمة المختارة",
      he: "קיים תור מתנגש בקטגוריית השירות שנבחרה",
      en: "Another appointment conflicts with this service category",
    },
    appointment_therapist_conflict: {
      ar: "المعالج لديه موعد آخر في هذا الوقت",
      he: "למטפל/ת יש תור אחר בזמן זה",
      en: "The therapist already has another appointment at this time",
    },
    CLIENT_DUPLICATE: {
      ar: "يوجد مريض بنفس الهاتف أو البريد الإلكتروني",
      he: "קיים מטופל עם אותו טלפון או אימייל",
      en: "A patient with this phone or email already exists",
    },
    "Appointment date cannot be in the past.": {
      ar: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062d\u062c\u0632 \u0645\u0648\u0639\u062f \u0641\u064a \u0648\u0642\u062a \u0645\u0636\u0649",
      he: "\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e7\u05d1\u05d5\u05e2 \u05ea\u05d5\u05e8 \u05d1\u05d6\u05de\u05df \u05e9\u05db\u05d1\u05e8 \u05e2\u05d1\u05e8",
      en: "Appointment cannot be booked in the past",
    },
    "Appointment cannot be booked in the past": {
      ar: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u062d\u062c\u0632 \u0645\u0648\u0639\u062f \u0641\u064a \u0648\u0642\u062a \u0645\u0636\u0649",
      he: "\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e7\u05d1\u05d5\u05e2 \u05ea\u05d5\u05e8 \u05d1\u05d6\u05de\u05df \u05e9\u05db\u05d1\u05e8 \u05e2\u05d1\u05e8",
      en: "Appointment cannot be booked in the past",
    },
    "Appointment must be within clinic working hours.": {
      ar: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u0648\u0639\u062f \u0636\u0645\u0646 \u0633\u0627\u0639\u0627\u062a \u0639\u0645\u0644 \u0627\u0644\u0639\u064a\u0627\u062f\u0629",
      he: "\u05d4\u05ea\u05d5\u05e8 \u05d7\u05d9\u05d9\u05d1 \u05dc\u05d4\u05d9\u05d5\u05ea \u05d1\u05ea\u05d5\u05da \u05e9\u05e2\u05d5\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc \u05d4\u05de\u05e8\u05e4\u05d0\u05d4",
      en: "Appointment must be within clinic working hours",
    },
    "Appointment must be within clinic working hours": {
      ar: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u0648\u0639\u062f \u0636\u0645\u0646 \u0633\u0627\u0639\u0627\u062a \u0639\u0645\u0644 \u0627\u0644\u0639\u064a\u0627\u062f\u0629",
      he: "\u05d4\u05ea\u05d5\u05e8 \u05d7\u05d9\u05d9\u05d1 \u05dc\u05d4\u05d9\u05d5\u05ea \u05d1\u05ea\u05d5\u05da \u05e9\u05e2\u05d5\u05ea \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05e9\u05dc \u05d4\u05de\u05e8\u05e4\u05d0\u05d4",
      en: "Appointment must be within clinic working hours",
    },
    "Invalid username or password.": {
      ar: "اسم المستخدم أو كلمة المرور غير صحيحة",
      he: "שם המשתמש או הסיסמה שגויים",
    },
    "Clinic identifier is required.": {
      ar: "مطلوب معرّف العيادة",
      he: "נדרש מזהה מרפאה",
    },
    "Clinic identifier not found.": {
      ar: "لم يتم العثور على معرّف العيادة",
      he: "מזהה המרפאה לא נמצא",
    },
    "Permission denied": {
      ar: "لا توجد صلاحية لتنفيذ هذه العملية",
      he: "אין הרשאה לבצע פעולה זו",
    },
    "Not found": {
      ar: "لم يتم العثور على السجل المطلوب",
      he: "הרשומה המבוקשת לא נמצאה",
    },
    "Operation failed": {
      ar: "فشلت العملية. حاول مرة أخرى.",
      he: "הפעולה נכשלה. נסו שוב.",
    },
  };
  return common[err.code]?.[state.lang] || common[err.message]?.[state.lang] || err.message || fallback;
}

function successText(key) {
  const messages = {
    settingsSaved: {
      ar: "تم حفظ الإعدادات بنجاح",
      he: "ההגדרות נשמרו בהצלחה",
    },
  };
  return messages[key]?.[state.lang] || messages[key]?.ar || "";
}

function parseBool(value) {
  return value === true || value === "true";
}

function formPayload(resource, form) {
  const body = { ...form };
  if (resource === "users") {
    body.active = parseBool(body.active);
    body.workdays = [];
    body.serviceIds = [];
    if (!body.password) delete body.password;
  }
  if (resource === "services") {
    body.categoryId = Number(body.categoryId || 0);
    body.duration = Number(body.duration || 0);
    body.price = Number(body.price || 0);
    body.active = parseBool(body.active);
  }
  if (resource === "appointments") {
    body.clientId = Number(body.clientId || 0);
    body.serviceId = Number(body.serviceId || 0);
    body.therapistId = Number(body.therapistId || 0);
    body.paidAmount = Number(body.paidAmount || 0);
  }
  if (resource === "clients") {
    body.therapistId = body.therapistId ? Number(body.therapistId) : null;
  }
  return body;
}

function searchableClientField(value = "") {
  const selected = (state.data.clients || []).find((client) => Number(client.id) === Number(value));
  const label = selected ? `${selected.fname} ${selected.lname}` : "";
  return html`
    <input type="hidden" name="clientId" value="${escapeAttr(value)}">
    <div class="field full">
      <label>${state.lang === "he" ? "לקוח" : "العميل"}</label>
      <input data-client-search value="${escapeAttr(label)}" autocomplete="off" required>
    </div>
  `;
}

function syncClientSearch(form, requireValue = true) {
  const input = form.querySelector("[data-client-search]");
  if (!input) return true;
  const term = input.value.trim().toLowerCase();
  const match = (state.data.clients || []).find((client) => `${client.fname} ${client.lname}`.toLowerCase() === term)
    || (state.data.clients || []).find((client) => `${client.fname} ${client.lname}`.toLowerCase().includes(term));
  const hidden = form.querySelector("[name='clientId']");
  if (match && hidden) hidden.value = match.id;
  return !requireValue || Boolean(hidden?.value);
}

async function refreshAppointmentWorkspace({ renderLoading = true } = {}) {
  if (!state.user || state.user.platformOwner || state.page !== "calendar") return;
  state.appointmentWorkspace.status = "loading";
  state.appointmentWorkspace.error = "";
  if (renderLoading) renderApp();
  try {
    const [appointments, queue] = await Promise.all([
      api("/api/appointments"),
      api(`/api/appointments/queue?date=${encodeURIComponent(state.calendarDate)}`),
    ]);
    state.data.appointments = appointments;
    state.appointmentWorkspace.queue = Array.isArray(queue?.items) ? queue.items : [];
    state.appointmentWorkspace.status = "ready";
  } catch (error) {
    state.appointmentWorkspace.status = "error";
    state.appointmentWorkspace.error = localizedError(error);
  }
  if (state.page === "calendar") renderApp();
}

async function refreshPatientWorkspace({ renderLoading = true } = {}) {
  if (!state.user || state.user.platformOwner || state.page !== "clients") return;
  state.patientWorkspace.status = "loading";
  state.patientWorkspace.error = "";
  if (renderLoading) renderApp();
  const filters = state.patientWorkspace.filters;
  const query = new URLSearchParams({
    q: filters.query,
    status: filters.status,
    therapistId: filters.therapistId,
    upcoming: filters.upcoming,
    recent: filters.recent,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  try {
    state.patientWorkspace.data = await api(`/api/clients/workspace?${query}`);
    state.patientWorkspace.status = "ready";
  } catch (error) {
    state.patientWorkspace.status = "error";
    state.patientWorkspace.error = localizedError(error);
  }
  if (state.page === "clients") renderApp();
}

async function refreshBillingWorkspace({ renderLoading = true } = {}) {
  if (!state.user || state.user.platformOwner || state.user.role === "therapist" || state.page !== "billing") return;
  state.billingWorkspace.status = "loading";
  state.billingWorkspace.error = "";
  if (renderLoading) renderApp();
  try {
    const result = await api("/api/patient-finance/invoices");
    state.billingWorkspace.items = result.items || [];
    state.billingWorkspace.status = "ready";
  } catch (error) {
    state.billingWorkspace.status = "error";
    state.billingWorkspace.error = localizedError(error);
  }
  if (state.page === "billing") renderApp();
}

function closeAppointmentDrawer() {
  closeModal();
}

function bindAppointmentDrawer() {
  document.querySelectorAll("[data-close-appointment-drawer]").forEach((button) => button.addEventListener("click", closeAppointmentDrawer));
  bindModalAccessibility({ onClose: closeAppointmentDrawer, focusSelector: ".appointment-drawer [data-close-appointment-drawer]" });
  const patientButton = document.querySelector("[data-appointment-patient]");
  if (patientButton) patientButton.addEventListener("click", () => openClientProfile(Number(patientButton.dataset.appointmentPatient)));
  const clinicalButton = document.querySelector("[data-open-clinical-visit]");
  if (clinicalButton) clinicalButton.addEventListener("click", () => void openClinicalVisit(Number(clinicalButton.dataset.openClinicalVisit)));
  const statusForm = document.querySelector("[data-appointment-status-form]");
  if (statusForm) statusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (statusForm.getAttribute("aria-busy") === "true") return;
    const appointmentId = Number(statusForm.dataset.appointmentStatusForm);
    const submitButton = statusForm.querySelector("[type='submit']");
    statusForm.setAttribute("aria-busy", "true");
    if (submitButton) submitButton.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(statusForm));
      await api(`/api/appointments/${appointmentId}/status`, { method: "PATCH", body });
      await refreshAppointmentWorkspace({ renderLoading: false });
      await openAppointmentDetails(appointmentId);
      showCenterSuccess(uiText("تم تحديث حالة الموعد.", "סטטוס התור עודכן.", "Appointment status updated."));
    } catch (error) {
      statusForm.removeAttribute("aria-busy");
      if (submitButton) submitButton.disabled = false;
      showCenterError(localizedError(error));
    }
  });
}

async function openAppointmentDetails(id) {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  beginModalInteraction();
  root.innerHTML = renderAppointmentDetails({ language: state.lang, status: "loading" });
  bindAppointmentDrawer();
  try {
    const [appointment, clinical] = await Promise.all([
      api(`/api/appointments/${id}`),
      api(`/api/clinical-visits/appointment/${id}`),
    ]);
    root.innerHTML = renderAppointmentDetails({
      language: state.lang,
      appointment,
      clinicalVisit: clinical.visit,
      canOpenClinicalVisit: Boolean(clinical.capabilities?.sensitive && clinical.capabilities?.write),
      canChangeStatus: true,
    });
  } catch (error) {
    root.innerHTML = renderAppointmentDetails({ language: state.lang, status: "error", error: localizedError(error) });
  }
  bindAppointmentDrawer();
}

let clinicalVisitSession = null;

function clinicalUnsavedMessage() {
  return state.lang === "he"
    ? "יש שינויים שלא נשמרו. לסגור בכל זאת?"
    : state.lang === "ar"
      ? "توجد تغييرات غير محفوظة. هل تريد الإغلاق؟"
      : "You have unsaved changes. Close anyway?";
}

function cleanupClinicalVisitSession() {
  if (clinicalVisitSession?.beforeUnload) {
    window.removeEventListener("beforeunload", clinicalVisitSession.beforeUnload);
  }
  clinicalVisitSession = null;
}

function closeClinicalVisit() {
  const session = clinicalVisitSession;
  if (!session) return;
  if (session.dirty && !window.confirm(clinicalUnsavedMessage())) return;
  const appointmentId = session.appointmentId;
  cleanupClinicalVisitSession();
  void openAppointmentDetails(appointmentId);
}

function clinicalVisitBody(form) {
  const values = Object.fromEntries(new FormData(form));
  return {
    treatmentSummary: String(values.treatmentSummary || ""),
    clinicalObservations: String(values.clinicalObservations || ""),
    recommendations: String(values.recommendations || ""),
    followUpInstructions: String(values.followUpInstructions || ""),
    internalNotes: String(values.internalNotes || ""),
  };
}

async function loadClinicalVisitSession() {
  const session = clinicalVisitSession;
  if (!session) return;
  session.status = "loading";
  renderClinicalVisitSession();
  try {
    session.data = await api(`/api/clinical-visits/appointment/${session.appointmentId}`);
    session.status = "ready";
    session.error = "";
  } catch (error) {
    session.status = "error";
    session.error = localizedError(error);
  }
  renderClinicalVisitSession();
}

async function persistClinicalVisit(form) {
  const session = clinicalVisitSession;
  if (!session || session.saving) return null;
  if (!form.reportValidity()) return null;
  session.saving = true;
  session.message = "";
  renderClinicalVisitSession();
  try {
    const body = clinicalVisitBody(form);
    const visit = session.data?.visit;
    const saved = visit
      ? await api(`/api/clinical-visits/${visit.id}`, { method: "PUT", body })
      : await api("/api/clinical-visits", { method: "POST", body: { appointmentId: session.appointmentId, ...body } });
    session.data.visit = saved;
    session.data.capabilities.complete = saved.status === "draft";
    session.dirty = false;
    showCenterSuccess(state.lang === "he" ? "הרשומה הקלינית נשמרה." : state.lang === "ar" ? "تم حفظ السجل السريري." : "Clinical record saved.");
    return saved;
  } catch (error) {
    session.message = localizedError(error);
    return null;
  } finally {
    if (clinicalVisitSession === session) {
      session.saving = false;
      renderClinicalVisitSession();
    }
  }
}

function renderClinicalVisitSession() {
  const session = clinicalVisitSession;
  const root = document.getElementById("modalRoot");
  if (!session || !root) return;
  root.innerHTML = renderClinicalVisit({
    language: state.lang,
    status: session.status,
    data: session.data,
    error: session.error,
    saving: session.saving,
    message: session.message,
  });
  bindModalAccessibility({ onClose: closeClinicalVisit, focusSelector: session.status === "ready" ? "[name='treatmentSummary']" : "[data-close-clinical-visit]" });
  root.querySelector("[data-close-clinical-visit]")?.addEventListener("click", closeClinicalVisit);
  const form = root.querySelector("[data-clinical-visit-form]");
  if (!form) return;
  form.addEventListener("input", () => {
    if (clinicalVisitSession) clinicalVisitSession.dirty = true;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await persistClinicalVisit(event.currentTarget);
  });
  root.querySelector("[data-complete-clinical-visit]")?.addEventListener("click", async (event) => {
    if (!clinicalVisitSession || clinicalVisitSession.saving) return;
    let visit = clinicalVisitSession.data?.visit;
    if (clinicalVisitSession.dirty) visit = await persistClinicalVisit(form);
    if (!visit || clinicalVisitSession?.saving) return;
    const sessionNow = clinicalVisitSession;
    sessionNow.saving = true;
    renderClinicalVisitSession();
    try {
      sessionNow.data.visit = await api(`/api/clinical-visits/${visit.id}/complete`, { method: "POST" });
      sessionNow.data.capabilities.complete = false;
      sessionNow.dirty = false;
      showCenterSuccess(state.lang === "he" ? "הרשומה הקלינית הושלמה." : state.lang === "ar" ? "تم إكمال السجل السريري." : "Clinical record completed.");
    } catch (error) {
      sessionNow.message = localizedError(error);
    } finally {
      if (clinicalVisitSession === sessionNow) {
        sessionNow.saving = false;
        renderClinicalVisitSession();
      }
    }
  });
}

async function openClinicalVisit(appointmentId) {
  cleanupClinicalVisitSession();
  beginModalInteraction();
  const beforeUnload = (event) => {
    if (!clinicalVisitSession?.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  };
  clinicalVisitSession = {
    appointmentId,
    status: "loading",
    data: null,
    error: "",
    message: "",
    saving: false,
    dirty: false,
    beforeUnload,
  };
  window.addEventListener("beforeunload", beforeUnload);
  await loadClinicalVisitSession();
}

let bookingWorkflowSession = null;

function availableBookingTherapists() {
  const rows = (state.data.users || []).filter((user) => user.active !== false && user.role === "therapist");
  return state.user.role === "therapist" ? rows.filter((user) => Number(user.id) === Number(state.user.id)) : rows;
}

function openBookingWorkflow(defaults = {}) {
  beginModalInteraction();
  const services = (state.data.services || []).filter((service) => service.active !== false);
  const therapists = availableBookingTherapists();
  bookingWorkflowSession = {
    patientResults: [],
    selectedPatient: null,
    searching: false,
    searched: false,
    showCreate: false,
    saving: false,
    error: "",
    success: "",
    values: {
      patientQuery: "",
      serviceId: defaults.serviceId || services[0]?.id || "",
      therapistId: state.user.role === "therapist" ? state.user.id : defaults.therapistId || therapists[0]?.id || "",
      date: defaults.date || state.calendarDate || new Date().toISOString().slice(0, 10),
      time: defaults.time || clinicWorkStart(),
      notes: defaults.notes || "",
    },
  };

  const renderWorkflow = (focusSelector = "") => {
    const session = bookingWorkflowSession;
    const root = document.getElementById("modalRoot");
    if (!session || !root) return;
    root.innerHTML = renderBookingWorkflow({
      language: state.lang,
      ...session,
      services,
      therapists,
      canCreatePatient: ["admin", "reception"].includes(state.user.role),
    });
    bindModalAccessibility({
      onClose: () => {
        bookingWorkflowSession = null;
        closeModal();
      },
      focusSelector,
    });
    root.querySelector("[data-close-booking]")?.addEventListener("click", () => {
      bookingWorkflowSession = null;
      closeModal();
    });
    root.querySelector("[data-booking-search]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = String(new FormData(event.currentTarget).get("q") || "").trim();
      session.values.patientQuery = query;
      session.searching = true;
      session.searched = true;
      session.error = "";
      session.success = "";
      const searchButton = event.currentTarget.querySelector("[type='submit']");
      event.currentTarget.setAttribute("aria-busy", "true");
      if (searchButton) searchButton.disabled = true;
      try {
        const result = await api(`/api/clients/workspace?q=${encodeURIComponent(query)}&page=1&pageSize=10`);
        session.patientResults = result.items || [];
      } catch (error) {
        session.patientResults = [];
        session.error = localizedError(error);
      } finally {
        session.searching = false;
        renderWorkflow("[name='q']");
      }
    });
    root.querySelectorAll("[data-booking-patient]").forEach((button) => button.addEventListener("click", () => {
      session.selectedPatient = session.patientResults.find((patient) => Number(patient.id) === Number(button.dataset.bookingPatient)) || null;
      session.showCreate = false;
      session.error = "";
      session.success = "";
      renderWorkflow("[name='serviceId']");
    }));
    root.querySelector("[data-booking-show-create]")?.addEventListener("click", () => {
      session.showCreate = true;
      session.success = "";
      renderWorkflow("[name='fname']");
    });
    root.querySelector("[data-booking-create-patient]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (event.currentTarget.getAttribute("aria-busy") === "true") return;
      session.error = "";
      session.success = "";
      const createButton = event.currentTarget.querySelector("[type='submit']");
      event.currentTarget.setAttribute("aria-busy", "true");
      if (createButton) createButton.disabled = true;
      try {
        const body = Object.fromEntries(new FormData(event.currentTarget));
        body.therapistId = Number(session.values.therapistId || 0) || null;
        const created = await api("/api/clients", { method: "POST", body });
        session.selectedPatient = {
          id: created.id,
          name: `${body.fname} ${body.lname}`.trim(),
          phone: body.phone,
          email: body.email || "",
        };
        session.patientResults = [session.selectedPatient];
        session.showCreate = false;
        session.success = uiText("تم إنشاء المريض واختياره.", "המטופל נוצר ונבחר.", "Patient created and selected.");
      } catch (error) {
        session.error = localizedError(error);
      }
      renderWorkflow(session.error ? ".booking-error" : "[name='serviceId']");
    });
    const bookingForm = root.querySelector("[data-booking-form]");
    bookingForm?.addEventListener("change", (event) => {
      const values = Object.fromEntries(new FormData(bookingForm));
      session.values = { ...session.values, ...values };
      if (event.target?.name === "serviceId") {
        const duration = selectedServiceDuration(services, values.serviceId);
        const output = bookingForm.querySelector("[data-booking-duration]");
        if (output) output.textContent = `${duration} ${uiText("دقيقة", "דקות", "minutes")}`;
      }
    });
    bookingForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (bookingForm.getAttribute("aria-busy") === "true") return;
      const fields = Object.fromEntries(new FormData(bookingForm));
      session.values = { ...session.values, ...fields };
      session.error = "";
      session.success = "";
      session.saving = true;
      const submitButton = bookingForm.querySelector("[type='submit']");
      bookingForm.setAttribute("aria-busy", "true");
      if (submitButton) submitButton.disabled = true;
      try {
        const body = {
          clientId: Number(session.selectedPatient?.id || 0),
          serviceId: Number(fields.serviceId || 0),
          therapistId: Number(fields.therapistId || 0),
          date: fields.date,
          time: fields.time,
          status: "pending",
          notes: fields.notes || "",
        };
        await api("/api/appointments", { method: "POST", body });
        bookingWorkflowSession = null;
        state.calendarDate = body.date;
        closeModal();
        setProtectedRoute("calendar", { render: false });
        await refreshAppointmentWorkspace();
        showCenterSuccess(uiText("تم حفظ الموعد.", "התור נשמר.", "Appointment saved."));
      } catch (error) {
        session.saving = false;
        session.error = localizedError(error);
        renderWorkflow(".booking-error");
      }
    });
  };

  renderWorkflow("[name='q']");
}

function bindPageActions() {
  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) languageSelect.addEventListener("change", () => {
    state.lang = languageSelect.value;
    localStorage.setItem("clinova-lang", state.lang);
    renderApp();
  });
  document.querySelectorAll("[data-new]").forEach((button) => button.addEventListener("click", () => openForm(button.dataset.new)));
  document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openForm(button.dataset.edit, Number(button.dataset.id))));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm(state.lang === "he" ? "האם למחוק?" : "هل تريد الحذف؟")) return;
    try {
      await api(`/api/${button.dataset.delete}/${button.dataset.id}`, { method: "DELETE" });
      await loadData();
      renderApp();
    } catch (err) {
      showCenterError(localizedError(err));
    }
  }));
  document.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener("input", () => {
    state.filters[input.dataset.filter] = input.value;
    renderApp();
  }));
  const appointmentStatus = document.querySelector("[data-filter='appointmentStatus']");
  if (appointmentStatus) appointmentStatus.addEventListener("change", () => {
    state.filters.appointmentStatus = appointmentStatus.value;
    renderApp();
  });
  document.querySelectorAll("[data-receipt]").forEach((button) => button.addEventListener("click", () => printReceipt(Number(button.dataset.receipt))));
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
    setProtectedRoute(button.dataset.page);
  }));
  document.querySelectorAll("[data-calendar-view]").forEach((button) => button.addEventListener("click", () => {
    state.calendarView = button.dataset.calendarView;
    renderApp();
  }));
  document.querySelectorAll("[data-calendar-move]").forEach((button) => button.addEventListener("click", () => {
    moveCalendarDate(Number(button.dataset.calendarMove || 0));
    renderApp();
  }));
  document.querySelectorAll("[data-calendar-date]").forEach((input) => input.addEventListener("change", () => {
    state.calendarDate = input.value || new Date().toISOString().slice(0, 10);
    renderApp();
  }));
  document.querySelectorAll("[data-calendar-new]").forEach((slot) => slot.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-edit]")) return;
    const defaults = {
      date: slot.dataset.calendarDate,
      time: slot.dataset.calendarTime || clinicWorkStart(),
      therapistId: slot.dataset.therapistId || state.user.id,
      status: "pending",
      paymentStatus: "unpaid",
    };
    try {
      openForm("appointments", null, defaults);
    } catch (err) {
      showCenterError(err.message || "Calendar action failed");
    }
  }));
  document.querySelectorAll("[data-workspace-view]").forEach((button) => button.addEventListener("click", () => {
    state.calendarView = button.dataset.workspaceView;
    renderApp();
  }));
  document.querySelectorAll("[data-workspace-move]").forEach((button) => button.addEventListener("click", () => {
    state.calendarDate = moveWorkspaceDate(state.calendarDate, state.calendarView, Number(button.dataset.workspaceMove || 0));
    void refreshAppointmentWorkspace();
  }));
  const workspaceToday = document.querySelector("[data-workspace-today]");
  if (workspaceToday) workspaceToday.addEventListener("click", () => {
    state.calendarDate = new Date().toISOString().slice(0, 10);
    void refreshAppointmentWorkspace();
  });
  const workspaceDate = document.querySelector("[data-workspace-date]");
  if (workspaceDate) workspaceDate.addEventListener("change", () => {
    state.calendarDate = workspaceDate.value || new Date().toISOString().slice(0, 10);
    void refreshAppointmentWorkspace();
  });
  document.querySelectorAll("[data-workspace-filter]").forEach((input) => input.addEventListener("change", () => {
    state.appointmentWorkspace.filters[input.dataset.workspaceFilter] = input.value;
    renderApp();
  }));
  const workspaceRetry = document.querySelector("[data-workspace-retry]");
  if (workspaceRetry) workspaceRetry.addEventListener("click", () => void refreshAppointmentWorkspace());
  document.querySelectorAll("[data-appointment-details]").forEach((button) => button.addEventListener("click", () => void openAppointmentDetails(Number(button.dataset.appointmentDetails))));
  const patientSearch = document.querySelector("[data-patient-search]");
  if (patientSearch) patientSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(patientSearch));
    state.patientWorkspace.filters = { ...state.patientWorkspace.filters, ...values, page: 1 };
    void refreshPatientWorkspace();
  });
  document.querySelector("[data-patient-clear]")?.addEventListener("click", () => {
    state.patientWorkspace.filters = { ...emptyPatientFilters };
    void refreshPatientWorkspace();
  });
  document.querySelector("[data-patient-retry]")?.addEventListener("click", () => void refreshPatientWorkspace());
  document.querySelectorAll("[data-patient-page]").forEach((button) => button.addEventListener("click", () => {
    state.patientWorkspace.filters.page = Number(button.dataset.patientPage || 1);
    void refreshPatientWorkspace();
  }));
  document.querySelectorAll("[data-platform-tenant-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tenantId = form.dataset.platformTenantForm;
    const result = await api(`/api/platform/tenants/${tenantId}`, { method: "PUT", body: Object.fromEntries(new FormData(form)) });
    state.data.platformTenants = result.tenants;
    renderApp();
  }));
  document.querySelectorAll("[data-platform-tenant-deactivate]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm(uiText("تعطيل هذه العيادة؟", "להשבית את המרפאה?"))) return;
    try {
      const result = await api(`/api/platform/tenants/${button.dataset.platformTenantDeactivate}`, { method: "DELETE" });
      state.data.platformTenants = result.tenants;
      showCenterError(uiText("تم تعطيل العيادة", "המרפאה הושבתה"));
      renderApp();
    } catch (err) {
      showCenterError(localizedError(err));
    }
  }));
  document.querySelectorAll("[data-platform-password-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tenantId = form.dataset.platformPasswordForm;
    const body = Object.fromEntries(new FormData(form));
    const result = await api(`/api/platform/tenants/${tenantId}/reset-password`, { method: "POST", body });
    state.data.platformTenants = result.tenants;
    state.platformPasswordReset = { tenantId: Number(tenantId), owner: result.owner, tenant: result.tenant };
    renderApp();
  }));
  const platformTenantCreateForm = document.getElementById("platformTenantCreateForm");
  if (platformTenantCreateForm) platformTenantCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/api/platform/tenants", { method: "POST", body: Object.fromEntries(new FormData(platformTenantCreateForm)) });
    state.data.platformTenants = result.tenants;
    renderApp();
  });
  document.querySelectorAll("[data-platform-invoice-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tenantId = form.dataset.platformInvoiceForm;
    const result = await api(`/api/platform/tenants/${tenantId}/invoices`, { method: "POST", body: Object.fromEntries(new FormData(form)) });
    state.data.platformTenants = result.tenants;
    renderApp();
  }));
  document.querySelectorAll("[data-platform-invoice-status]").forEach((button) => button.addEventListener("click", async () => {
    const result = await api(`/api/platform/invoices/${button.dataset.platformInvoiceStatus}`, { method: "PUT", body: { status: button.dataset.status } });
    state.data.platformTenants = result.tenants;
    renderApp();
  }));
  const platformAutoBillingForm = document.getElementById("platformAutoBillingForm");
  if (platformAutoBillingForm) platformAutoBillingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/api/platform/billing/auto-run", { method: "POST", body: Object.fromEntries(new FormData(platformAutoBillingForm)) });
    state.data.platformTenants = result.tenants;
    state.platformBillingRun = result.result;
    renderApp();
  });
  const exportPlatformBilling = document.getElementById("exportPlatformBilling");
  if (exportPlatformBilling) exportPlatformBilling.addEventListener("click", exportPlatformBillingCsv);
  document.querySelectorAll("[data-platform-invoice-print]").forEach((button) => button.addEventListener("click", () => printPlatformInvoice(Number(button.dataset.platformInvoicePrint))));
  const createPlatformBackupButton = document.querySelector("[data-platform-backup-create]");
  if (createPlatformBackupButton) createPlatformBackupButton.addEventListener("click", async () => {
    state.platformBackupCreating = true;
    state.platformBackupError = "";
    renderApp();
    try {
      await api("/api/platform/backups", { method: "POST" });
      state.data.platformBackups = await api("/api/platform/backups");
    } catch (error) {
      state.platformBackupError = error.message;
    } finally {
      state.platformBackupCreating = false;
      renderApp();
    }
  });
  bindBillingActions();
  bindRestoredSectionActions();
}

async function boot() {
  const inviteToken = new URLSearchParams(location.search).get("invite");
  if (inviteToken) {
    renderAcceptInvitation(inviteToken);
    return;
  }
  renderFoundationLoading();
  const me = await api("/api/me");
  if (!me.user) {
    setProtectedRoute("login", { replace: true, render: false });
    renderLogin();
    return;
  }
  state.user = me.user;
  applyProtectedRoute({ replace: true, render: false });
  await loadData();
  renderApp();
  if (state.page === "calendar") void refreshAppointmentWorkspace();
  if (state.page === "clients") void refreshPatientWorkspace();
  if (state.page === "billing") void refreshBillingWorkspace();
}

function renderLoginLegacy(error = "") {
  mount(html`
    <main class="login">
      <form class="login-card" id="loginForm">
        <div class="brand">
          <img class="brand-logo" src="${logoSrc()}" alt="Clinova">
          <div>
            <h1>Clinova</h1>
            <div class="muted">نظام إدارة العيادة</div>
          </div>
        </div>
        ${error ? `<div class="alert">${error}</div>` : ""}
        <div class="field"><label>اسم المستخدم</label><input name="username" autocomplete="username" required></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn" style="width:100%">تسجيل الدخول</button>
        <div class="version-badge">v${APP_VERSION}</div>
      </form>
    </main>
  `);
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/login", { method: "POST", body: form });
      state.user = result.user;
      await loadData();
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function loadData() {
  const data = await api("/api/bootstrap");
  state.user = data.user;
  if (data.user?.platformOwner) {
    try {
      data.platformHealth = await api("/api/platform/health");
    } catch (error) {
      data.platformHealth = { error: error.message };
    }
    try {
      data.platformBackups = await api("/api/platform/backups");
    } catch (error) {
      data.platformBackups = { error: error.message, count: 0, latest: null, backups: [] };
    }
  }
  state.data = data;
  await refreshNotifications({ render: false });
}

async function refreshNotifications({ render = true } = {}) {
  if (!state.user || state.user.platformOwner) {
    state.notificationCenter = {
      status: "idle",
      error: "",
      items: [],
      unreadCount: 0,
      open: false,
      actionPending: false,
    };
    return;
  }
  state.notificationCenter.status = "loading";
  state.notificationCenter.error = "";
  if (render) renderApp();
  try {
    const result = await api("/api/notifications");
    state.notificationCenter = {
      ...state.notificationCenter,
      status: "ready",
      error: "",
      items: result.items || [],
      unreadCount: result.unreadCount || 0,
    };
  } catch (error) {
    state.notificationCenter = {
      ...state.notificationCenter,
      status: "error",
      error: localizedError(error),
    };
  }
  if (render) {
    renderApp();
    if (state.notificationCenter.open) {
      focusNotificationControl(".notification-popover button, .notification-popover [tabindex]");
    }
  }
}

function renderAppLegacy() {
  const nav = state.user.platformOwner ? ["platform"] : (navByRole[state.user.role] || []);
  if (!nav.includes(state.page)) state.page = nav[0] || "dashboard";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  mount(html`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-logo" src="${logoSrc()}" alt="Clinova">
          <div><h3>Clinova</h3><div style="opacity:.75;font-size:12px">إدارة العيادة</div></div>
        </div>
        <nav class="nav">
          ${nav.map((page) => `<button data-page="${page}" class="${state.page === page ? "active" : ""}">${pageLabel(page)}</button>`).join("")}
        </nav>
        <div class="user-box">
          <strong>${state.user.name}</strong>
          <span style="opacity:.75">${roleLabel(state.user.role)}</span>
          <button class="btn ghost" id="logoutBtn" style="color:white;border-color:rgba(255,255,255,.35)">خروج</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div>
            <h2>${pageLabel(state.page)}</h2>
            <div class="muted page-subtitle">${pageSubtitle()}</div>
          </div>
          <div class="topbar-actions">
            ${languagePicker()}
            ${renderQuickSearchLive()}
            ${topActionI18n()}
          </div>
        </header>
        <section class="content">${renderPage()}</section>
      </main>
    </div>
    <div id="modalRoot"></div>
  `);
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
    state.page = button.dataset.page;
    renderApp();
  }));
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    renderLogin();
  });
  bindPageActions();
}

pageSubtitle = function () {
  if (state.page === "platform") return state.lang === "he" ? "ניהול כל הקליניקות, המנויים, החשבוניות והדומיינים" : "إدارة كل العيادات والاشتراكات والفواتير والدومينات";
  if (state.page === "billing") return state.lang === "he" ? "ניהול תוכניות, חשבוניות, סטטוס מנוי ומגבלות שימוש" : "إدارة الخطط والفواتير وحالة الاشتراك وحدود الاستخدام";
  if (state.page === "whatsapp") return state.lang === "he" ? "תבניות WhatsApp, מצב שליחה ויומן הודעות" : "قوالب WhatsApp ووضع الإرسال وسجل الرسائل";
  const extra = state.lang === "he"
    ? { consents: "ניהול קבצי PDF וחתימות לקוחות", feedback: "שליחת בקשת משוב לאחר טיפול", gifts: "כרטיסי מתנה ושליחה ב-WhatsApp" }
    : { consents: "رفع ملفات PDF وتوقيع العملاء عليها", feedback: "إرسال طلب تقييم بعد الجلسة", gifts: "كروت هدايا قابلة للإرسال عبر WhatsApp" };
  const subtitle = tr(`subtitles.${state.page}`);
  return subtitle === `subtitles.${state.page}` ? (extra[state.page] || "") : subtitle;
}
function bindPatientProfile(id) {
  const root = document.getElementById("modalRoot");
  root?.querySelectorAll("[data-close-patient-profile]").forEach((button) => button.addEventListener("click", closeModal));
  bindModalAccessibility({ focusSelector: ".patient-profile-panel [data-close-patient-profile]" });
  root?.querySelector("[data-patient-retry]")?.addEventListener("click", () => void openClientProfile(id));
  root?.querySelectorAll("[data-patient-appointment-details]").forEach((button) => button.addEventListener("click", () => void openAppointmentDetails(Number(button.dataset.patientAppointmentDetails))));
  root?.querySelectorAll("[data-patient-invoice]").forEach((button) => button.addEventListener("click", () => void openPatientInvoiceDetails(Number(button.dataset.patientInvoice))));
  const noteForm = root?.querySelector("#clientNoteForm");
  if (noteForm) noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api(`/api/clients/${id}/notes`, { method: "POST", body: Object.fromEntries(new FormData(noteForm)) });
      await openClientProfile(id);
      if (state.page === "clients") void refreshPatientWorkspace({ renderLoading: false });
    } catch (error) {
      showCenterError(localizedError(error));
    }
  });
  const fileForm = root?.querySelector("#clientFileForm");
  if (fileForm) fileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (fileForm.getAttribute("aria-busy") === "true") return;
    const submit = fileForm.querySelector("[type='submit']");
    fileForm.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    try {
      await api(`/api/clients/${id}/files`, { method: "POST", body: new FormData(fileForm) });
      await openClientProfile(id);
    } catch (error) {
      fileForm.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
      showCenterError(localizedError(error));
    }
  });
  root?.querySelectorAll("[data-delete-file]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await api(`/api/client-files/${button.dataset.deleteFile}`, { method: "DELETE" });
      await openClientProfile(Number(button.dataset.client));
    } catch (error) {
      showCenterError(localizedError(error));
    }
  }));
  const consentForm = root?.querySelector("#patientConsentAssignForm");
  if (consentForm) consentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (consentForm.getAttribute("aria-busy") === "true") return;
    const submit = consentForm.querySelector("[type='submit']");
    consentForm.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(consentForm));
      body.templateId = Number(body.templateId);
      await api(`/api/clients/${id}/consents`, { method: "POST", body });
      await openClientProfile(id);
    } catch (error) {
      consentForm.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
      showCenterError(localizedError(error));
    }
  });
  root?.querySelectorAll("[data-patient-consent-status]").forEach((button) => button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await api(`/api/patient-consents/${button.dataset.patientConsentStatus}/status`, {
        method: "PATCH",
        body: { status: button.dataset.status },
      });
      await openClientProfile(id);
    } catch (error) {
      button.disabled = false;
      showCenterError(localizedError(error));
    }
  }));
  root?.querySelectorAll("[data-patient-consent-sign]").forEach((button) => button.addEventListener("click", () => {
    openConsentSignModal(Number(button.dataset.template), {
      assignmentId: Number(button.dataset.patientConsentSign),
      clientId: Number(button.dataset.client),
      signerName: "",
    });
  }));
}

openClientProfile = async function (id) {
  const root = document.getElementById("modalRoot");
  if (!root) return;
  beginModalInteraction();
  root.innerHTML = renderPatientProfile({ language: state.lang, status: "loading" });
  bindPatientProfile(id);
  try {
    const data = await api(`/api/clients/${id}/history`);
    root.innerHTML = renderPatientProfile({ language: state.lang, data });
  } catch (error) {
    root.innerHTML = renderPatientProfile({ language: state.lang, status: "error", error: localizedError(error) });
  }
  bindPatientProfile(id);
}

topActionI18n = function () {
  if (state.page === "appointments") return `<button class="btn" data-new="appointments">${tr("newAppointment")}</button>`;
  if (state.page === "clients" && state.user.role !== "therapist") return `<button class="btn" data-new="clients">${tr("newClient")}</button>`;
  if (state.page === "consents" && state.user.role === "admin") return `<button class="btn" data-new-consent>${state.lang === "he" ? "תבנית חדשה" : "نموذج جديد"}</button>`;
  if (state.page === "feedback") return `<button class="btn" data-new-feedback>${state.lang === "he" ? "שליחת משוב" : "إرسال تقييم"}</button>`;
  if (state.page === "gifts") return `<button class="btn" data-new-gift>${state.lang === "he" ? "כרטיס מתנה" : "كرت هدية"}</button>`;
  if (["users", "categories", "services"].includes(state.page)) return `<button class="btn" data-new="${state.page}">${tr("add")}</button>`;
  return "";
}

languagePicker = function () {
  return `<label class="language-picker"><span>${state.lang === "he" ? "שפה" : "اللغة"}</span><select id="languageSelect"><option value="ar" ${state.lang === "ar" ? "selected" : ""}>العربية</option><option value="he" ${state.lang === "he" ? "selected" : ""}>עברית</option></select></label>`;
}
renderQuickSearchLive = function () {
  return html`
    <div class="quick-search">
      <input id="quickSearch" value="${escapeAttr(state.quickSearch)}" placeholder="${tr("quickSearch")}" autocomplete="off">
      <div id="quickResults" class="quick-results hidden"></div>
    </div>
  `;
}

function appointmentTable(rows, actions) {
  const heads = [tr("table.date"), tr("table.time"), tr("table.client"), tr("table.service"), tr("table.therapist"), tr("table.price"), tr("table.payment"), tr("table.status")];
  const actionLabel = state.lang === "he" ? "פעולות" : "إجراءات";
  return html`
    <div class="table-wrap responsive-table appointment-table">
      <table>
        <thead><tr>${heads.map((head) => `<th>${head}</th>`).join("")}${actions ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${rows.length ? rows.map((a) => html`
            <tr>
              <td data-label="${escapeAttr(heads[0])}">${a.date}</td><td data-label="${escapeAttr(heads[1])}">${a.time}</td><td data-label="${escapeAttr(heads[2])}">${a.clientName}</td><td data-label="${escapeAttr(heads[3])}">${a.serviceName}</td><td data-label="${escapeAttr(heads[4])}">${a.therapistName}</td>
              <td data-label="${escapeAttr(heads[5])}">${currency()}${Number(a.price || 0).toLocaleString()}</td>
              <td data-label="${escapeAttr(heads[6])}"><span class="pill ${a.paymentStatus || "unpaid"}">${paymentLabel[a.paymentStatus || "unpaid"]}</span></td>
              <td data-label="${escapeAttr(heads[7])}"><span class="pill ${a.status}">${statusLabel[a.status]}</span></td>
              ${actions ? `<td class="actions" data-label="${escapeAttr(actionLabel)}"><button class="btn secondary" data-sign-appointment="${a.id}">${state.lang === "he" ? "טופס" : "إقرار"}</button><button class="btn secondary" data-receipt="${a.id}">${tr("receipt")}</button><button class="btn secondary" data-whatsapp="${a.id}">WhatsApp</button><button class="btn secondary" data-edit="appointments" data-id="${a.id}">${tr("edit")}</button>${state.user.role === "admin" ? `<button class="btn danger" data-delete="appointments" data-id="${a.id}">${tr("delete")}</button>` : ""}</td>` : ""}
            </tr>`).join("") : `<tr><td colspan="${actions ? 9 : 8}" class="muted">${tr("noData")}</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function roleLabelLegacyFinal(role) {
  return tr(`roles.${role}`) || role;
}

yesNo = function (value) {
  return value ? (state.lang === "he" ? "כן" : "نعم") : (state.lang === "he" ? "לא" : "لا");
}

function statCard(icon, value, label, tone = "blue") {
  const toneClass = ["blue", "green", "gold", "purple", "red"].includes(tone) ? tone : "blue";
  return html`<div class="card stat-card ${toneClass}">
    <div class="stat-icon">${escapeHtml(icon)}</div>
    <strong>${escapeHtml(value)}</strong>
    <span>${escapeHtml(label)}</span>
  </div>`;
}

function renderPage() {
  if (state.user?.platformOwner) return renderPlatformAdmin();
  if (state.page === "dashboard") return renderDashboardHe();
  if (state.page === "calendar") return renderCalendarHe();
  if (state.page === "appointments") return renderAppointmentsHe();
  if (state.page === "clients") return renderClientsHe();
  if (state.page === "crm") return renderCrm();
  if (state.page === "billing") return renderBilling();
  if (state.page === "whatsapp") return renderWhatsApp();
  if (state.page === "consents") return renderConsents();
  if (state.page === "feedback") return renderFeedback();
  if (state.page === "gifts") return renderGifts();
  if (state.page === "categories") return renderCategoriesHe();
  if (state.page === "services") return renderServicesHe();
  if (state.page === "users") return renderTeamUsers();
  if (state.page === "reports") return renderReports();
  if (state.page === "audit") return renderAudit();
  if (state.page === "settings") return renderSettingsClean();
  return "";
}

renderDashboardHe = function () {
  const { appointments, clients } = state.data;
  const today = new Date().toISOString().slice(0, 10);
  const done = appointments.filter((a) => a.status === "done");
  const revenue = done.reduce((sum, a) => sum + Number(a.price || 0), 0);
  return html`
    <div class="grid stats">
      ${statCard("📅", appointments.filter((a) => a.date === today).length, state.lang === "he" ? "תורים היום" : "مواعيد اليوم", "blue")}
      ${statCard("👥", clients.length, state.lang === "he" ? "סה״כ לקוחות" : "إجمالي العملاء", "green")}
      ${statCard("✅", done.length, state.lang === "he" ? "תורים שהושלמו" : "مواعيد مكتملة", "green")}
      ${statCard("₪", `${currency()}${revenue.toLocaleString()}`, state.lang === "he" ? "הכנסות" : "الإيرادات", "gold")}
    </div>
    <div class="card"><h3>${state.lang === "he" ? "תורים אחרונים" : "آخر المواعيد"}</h3>${appointmentTable(appointments.slice(0, 6), false)}</div>
  `;
}

renderCalendarHe = function () {
  const anchor = parseDate(state.calendarDate);
  const view = state.calendarView;
  const days = view === "day" ? [anchor] : view === "week" ? weekDays(anchor) : monthDays(anchor);
  const names = state.lang === "he" ? { month: "חודש", week: "שבוע", day: "יום", prev: "הקודם", today: "היום", next: "הבא" } : { month: "شهر", week: "أسبوع", day: "يوم", prev: "السابق", today: "اليوم", next: "التالي" };
  return html`
    <div class="calendar-shell">
      <div class="toolbar calendar-toolbar">
        <div class="segmented">${["month", "week", "day"].map((item) => `<button class="${view === item ? "active" : ""}" data-calendar-view="${item}">${names[item]}</button>`).join("")}</div>
        <div class="calendar-nav"><button class="btn secondary" data-calendar-move="-1">${names.prev}</button><button class="btn secondary" data-calendar-today>${names.today}</button><button class="btn secondary" data-calendar-move="1">${names.next}</button></div>
        <strong>${calendarTitle(anchor, view)}</strong>
      </div>
      <div class="calendar-grid ${view}">${days.map((day) => calendarDay(day, view)).join("")}</div>
    </div>
  `;
}

renderAppointmentsHe = function () {
  const search = state.filters.appointments.trim().toLowerCase();
  const status = state.filters.appointmentStatus;
  const rows = state.data.appointments.filter((a) => {
    const text = `${a.clientName} ${a.clientPhone} ${a.serviceName} ${a.therapistName} ${a.date} ${a.time}`.toLowerCase();
    return (!search || text.includes(search)) && (status === "all" || a.status === status);
  });
  return html`
    <div class="toolbar">
      <input data-filter="appointments" placeholder="${state.lang === "he" ? "חיפוש בתורים..." : "بحث في المواعيد..."}" value="${escapeAttr(state.filters.appointments)}">
      <select data-filter="appointmentStatus"><option value="all" ${status === "all" ? "selected" : ""}>${state.lang === "he" ? "כל הסטטוסים" : "كل الحالات"}</option><option value="pending" ${status === "pending" ? "selected" : ""}>${statusLabel.pending}</option><option value="done" ${status === "done" ? "selected" : ""}>${statusLabel.done}</option><option value="cancelled" ${status === "cancelled" ? "selected" : ""}>${statusLabel.cancelled}</option></select>
      <button class="btn secondary" data-export="appointments">CSV</button>
    </div>
    <div class="card">${appointmentTable(rows, true)}</div>
  `;
}

renderClientsHe = function () {
  const canWrite = state.user.role !== "therapist";
  const search = state.filters.clients.trim().toLowerCase();
  const clients = state.data.clients.filter((c) => `${c.fname} ${c.lname} ${c.phone} ${c.email || ""} ${c.notes || ""}`.toLowerCase().includes(search));
  const h = state.lang === "he" ? ["שם", "טלפון", "אימייל", "מטפלת", "הערות"] : ["الاسم", "الهاتف", "البريد", "المعالجة", "ملاحظات"];
  return html`
    <div class="toolbar"><input data-filter="clients" placeholder="${state.lang === "he" ? "חיפוש לקוח..." : "بحث عن عميل..."}" value="${escapeAttr(state.filters.clients)}"><button class="btn secondary" data-export="clients">CSV</button></div>
    <div class="table-wrap"><table><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}<th></th></tr></thead><tbody>
      ${clients.map((c) => `<tr><td>${c.fname} ${c.lname}</td><td>${c.phone}</td><td>${c.email || "-"}</td><td>${userName(c.therapistId)}</td><td>${c.notes || "-"}</td><td class="actions"><button class="btn secondary" data-profile="${c.id}">${tr("searchGroups.file")}</button>${canWrite ? `<button class="btn secondary" data-edit="clients" data-id="${c.id}">${tr("edit")}</button><button class="btn danger" data-delete="clients" data-id="${c.id}">${tr("delete")}</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">${tr("noData")}</td></tr>`}
    </tbody></table></div>
  `;
}

function crmStageLabel(stage) {
  const freshMap = state.lang === "he"
    ? { lead: "ליד", qualified: "מתאים", active: "פעיל", follow_up: "מעקב", vip: "VIP", lost: "אבד", inactive: "לא פעיל" }
    : { lead: "عميل محتمل", qualified: "مؤهل", active: "نشط", follow_up: "متابعة", vip: "VIP", lost: "مفقود", inactive: "غير نشط" };
  if (freshMap[stage]) return freshMap[stage];
  const he = state.lang === "he";
  const map = he
    ? { lead: "ליד", active: "פעיל", follow_up: "מעקב", vip: "VIP", inactive: "לא פעיל" }
    : { lead: "عميل محتمل", active: "نشط", follow_up: "متابعة", vip: "VIP", inactive: "غير نشط" };
  return map[stage] || stage || "-";
}

renderCrm = function () {
  const he = state.lang === "he";
  const tasks = state.data.crmTasks || [];
  const events = state.data.crmEvents || [];
  const open = tasks.filter((task) => task.status === "open");
  const overdue = open.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
  const stageRows = ["lead", "qualified", "active", "vip", "lost"].map((stage) => [stage, state.data.clients.filter((client) => client.stage === stage).length]);
  return html`
    <div class="grid stats">
      ${statCard("◎", open.length, he ? "משימות פתוחות" : "مهام مفتوحة", "blue")}
      ${statCard("!", overdue.length, he ? "באיחור" : "متأخرة", overdue.length ? "red" : "green")}
      ${statCard("◆", state.data.clients.filter((client) => client.stage === "vip").length, "VIP", "gold")}
      ${statCard("✓", tasks.filter((task) => task.status === "done").length, he ? "הושלמו" : "مكتملة", "green")}
    </div>
    <div class="feature-grid">
      <div class="card"><h3>${he ? "משימת מעקב חדשה" : "مهمة متابعة جديدة"}</h3>
        <form id="crmTaskForm" class="inline-form">
          <select name="clientId" required>${state.data.clients.map((client) => `<option value="${client.id}">${client.fname} ${client.lname}</option>`).join("")}</select>
          <input name="title" placeholder="${he ? "כותרת" : "العنوان"}" required>
          <input name="dueDate" type="date">
          <select name="priority"><option value="normal">${he ? "רגיל" : "عادي"}</option><option value="high">${he ? "גבוה" : "مرتفع"}</option><option value="low">${he ? "נמוך" : "منخفض"}</option></select>
          <button class="btn">${he ? "שמירה" : "حفظ"}</button>
        </form>
      </div>
      <div class="card"><h3>${he ? "שלבי לקוחות" : "مراحل العملاء"}</h3>
        <div class="stack-list">${stageRows.map(([stage, count]) => `<div class="feature-row"><div><strong>${crmStageLabel(stage)}</strong><span>${count}</span></div></div>`).join("")}</div>
      </div>
    </div>
    <div class="feature-grid">
      <div class="card"><h3>${he ? "משימות CRM" : "مهام CRM"}</h3>
        <div class="stack-list">${tasks.map((task) => `<div class="feature-row"><div><strong>${task.title}</strong><span>${task.clientName || "-"} · ${task.dueDate || "-"}</span><small>${task.notes || priorityLabel(task.priority)}</small></div><div class="actions"><span class="pill ${task.status === "done" ? "done" : task.status === "cancelled" ? "cancelled" : "pending"}">${crmTaskStatusLabel(task.status)}</span>${task.status === "open" ? `<button class="btn secondary" data-crm-task-done="${task.id}">${he ? "בוצע" : "تم"}</button>` : ""}</div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${he ? "פעילות אחרונה" : "آخر نشاط"}</h3>
        <div class="stack-list">${events.map((event) => `<div class="feature-row"><div><strong>${event.clientName || "-"}</strong><span>${event.type} · ${event.createdAt || ""}</span><small>${event.description || ""}</small></div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderCategoriesHe = function () {
  return simpleTable("categories", [state.lang === "he" ? "שם" : "الاسم"], state.data.categories, (c) => [c.name]);
}

renderServicesHe = function () {
  const h = state.lang === "he" ? ["שם", "קטגוריה", "משך", "מחיר", "פעיל"] : ["الاسم", "القسم", "المدة", "السعر", "فعال"];
  return simpleTable("services", h, state.data.services, (s) => [s.name, categoryName(s.categoryId), `${s.duration} ${state.lang === "he" ? "דקות" : "دقيقة"}`, `${currency()}${s.price}`, yesNo(s.active)]);
}

function renderUsersHe() {
  const h = state.lang === "he" ? ["שם משתמש", "שם", "תפקיד", "פעיל"] : ["اسم المستخدم", "الاسم", "الدور", "فعال"];
  return simpleTable("users", h, state.data.users, (u) => [u.username, u.name, roleLabel(u.role), yesNo(u.active)]);
}

function clientOptions() {
  return state.data.clients.map((c) => [c.id, `${c.fname} ${c.lname}`]);
}

renderConsents = function () {
  const he = state.lang === "he";
  const templates = state.data.consentTemplates || [];
  const signatures = state.data.consentSignatures || [];
  return html`
    <div class="feature-grid">
      <div class="card"><h3>${he ? "טפסי PDF לפי קטגוריה" : "ملفات PDF حسب القسم"}</h3>
        <div class="stack-list">${templates.map((t) => `<div class="feature-row"><div><strong>${t.title}</strong><span>${t.categoryName || "-"}</span></div><div class="actions"><a class="btn secondary" href="${t.url}" target="_blank" rel="noopener">PDF</a>${state.user.role !== "therapist" ? `<button class="btn danger" data-delete-consent="${t.id}">${tr("delete")}</button>` : ""}</div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${he ? "חתימות אחרונות" : "آخر التواقيع"}</h3>
        <div class="stack-list">${signatures.map((s) => `<div class="feature-row"><div><strong>${s.clientName || s.signerName}</strong><span>${s.templateTitle} · ${s.signedAt || ""}</span></div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderFeedback = function () {
  const he = state.lang === "he";
  const rows = state.data.feedbackRequests || [];
  const logs = state.data.messageLogs || [];
  return html`
    <div class="feature-grid">
      <div class="card"><h3>${he ? "בקשות משוב" : "طلبات التقييم"}</h3>
        <div class="stack-list">${rows.map((r) => `<div class="feature-row"><div><strong>${r.clientName || "-"}</strong><span>${r.serviceName || ""} · ${r.date || ""} ${r.time || ""}</span>${r.comment ? `<small>${r.comment}</small>` : ""}</div><div><span class="pill ${r.status === "submitted" ? "done" : "pending"}">${r.status === "submitted" ? (he ? "התקבל" : "تم") : (he ? "נשלח" : "أرسل")}</span> ${r.rating ? `<strong>${r.rating}/5</strong>` : ""}</div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${he ? "יומן WhatsApp" : "سجل WhatsApp"}</h3>
        <div class="stack-list">${logs.map((log) => `<div class="feature-row"><div><strong>${log.recipient}</strong><span>${log.entity} #${log.entityId || "-"} · ${log.createdAt || ""}</span><small>${log.error || log.message}</small></div><span class="pill ${log.status === "sent" || log.status === "dry_run" ? "done" : log.status === "failed" ? "cancelled" : "pending"}">${log.status}</span></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderGifts = function () {
  const he = state.lang === "he";
  const rows = state.data.giftCards || [];
  return html`
    <div class="gift-board">${rows.map((g) => `<div class="gift-card">
      <div class="gift-ribbon">${he ? "מתנה" : "هدية"}</div>
      <h3>${g.serviceName || (he ? "שירות בקליניקה" : "جلسة في العيادة")}</h3>
      <p>${g.toClientName || ""}</p>
      <strong>${g.sessions} ${he ? "מפגשים" : "جلسة"}</strong>
      <code>${g.code}</code>
      <div class="actions"><button class="btn secondary" data-gift-whatsapp="${g.id}">WhatsApp</button><button class="btn secondary" data-gift-print="${g.id}">${he ? "הדפסה" : "طباعة"}</button></div>
    </div>`).join("") || `<div class="card"><p class="muted">${tr("noData")}</p></div>`}</div>
  `;
}

function renderPlatformAdmin() {
  const he = state.lang === "he";
  if (!state.user.platformOwner) return `<div class="card"><p class="muted">${he ? "לבעלי המערכת בלבד" : "لمالك النظام فقط"}</p></div>`;
  const tenants = state.data.platformTenants || [];
  const active = tenants.filter((tenant) => tenant.status === "active").length;
  const totalUsers = tenants.reduce((sum, tenant) => sum + Number(tenant.users || 0), 0);
  const totalClients = tenants.reduce((sum, tenant) => sum + Number(tenant.clients || 0), 0);
  const openBalance = tenants.reduce((sum, tenant) => sum + Number(tenant.openBalance || 0), 0);
  const paidRevenue = tenants.reduce((sum, tenant) => sum + Number(tenant.paidRevenue || 0), 0);
  return html`
    <div class="grid stats">
      ${statCard("□", tenants.length, he ? "קליניקות" : "عيادات", "blue")}
      ${statCard("✓", active, he ? "פעילות" : "نشطة", "green")}
      ${statCard("$", `${openBalance.toLocaleString()} USD`, he ? "יתרה פתוחה" : "رصيد مفتوح", "gold")}
      ${statCard("$", `${paidRevenue.toLocaleString()} USD`, he ? "הכנסות ששולמו" : "إيرادات مدفوعة", "purple")}
      ${statCard("#", totalUsers, he ? "משתמשים" : "مستخدمون", "purple")}
      ${statCard("◇", totalClients, he ? "לקוחות" : "عملاء", "gold")}
    </div>
    ${platformCreateTenantCard(he)}
    <div class="card">
      <h3>${he ? "קליניקות במערכת" : "العيادات داخل النظام"}</h3>
      <div class="stack-list">
        ${tenants.map((tenant) => platformTenantRow(tenant, he)).join("") || `<p class="muted">${tr("noData")}</p>`}
      </div>
    </div>
  `;
}

function platformTenantRow(tenant, he) {
  return html`<div class="feature-row platform-tenant-row">
    <div>
      <strong>${tenant.name}</strong>
      <span>${tenant.slug} · ${tenant.billingEmail || "-"} · ${tenant.domains?.[0]?.domain || "-"}</span>
      <small>${he ? "משתמשים" : "مستخدمون"}: ${tenant.users || 0} · ${he ? "לקוחות" : "عملاء"}: ${tenant.clients || 0} · ${he ? "חשבוניות" : "فواتير"}: ${tenant.invoices || 0} · ${he ? "יתרה פתוחה" : "رصيد مفتوح"}: ${Number(tenant.openBalance || 0).toLocaleString()}</small>
    </div>
    <form class="inline-form" data-platform-tenant-form="${tenant.id}">
      <select name="plan">
        ${["starter", "growth", "scale"].map((plan) => `<option value="${plan}" ${plan === (tenant.subscriptionPlan || tenant.plan) ? "selected" : ""}>${planNameLabel(plan)}</option>`).join("")}
      </select>
      <select name="status">
        ${["trial", "active", "past_due", "suspended", "cancelled"].map((status) => `<option value="${status}" ${status === (tenant.subscriptionStatus || tenant.status) ? "selected" : ""}>${subscriptionStatusLabel(status)}</option>`).join("")}
      </select>
      <button class="btn secondary">${he ? "עדכון" : "تحديث"}</button>
    </form>
    ${platformTenantBillingPanel(tenant, he)}
  </div>`;
}

function platformCreateTenantCard(he) {
  return html`<div class="card">
    <h3>${he ? "הוספת קליניקה חדשה" : "إضافة عيادة جديدة"}</h3>
    <form id="platformTenantCreateForm" class="inline-form">
      <input name="clinicName" placeholder="${he ? "שם הקליניקה" : "اسم العيادة"}" required>
      <input name="slug" placeholder="${he ? "מזהה" : "المعرّف"}" required>
      <input name="ownerName" placeholder="${he ? "שם מנהל הקליניקה" : "اسم مدير العيادة"}" required>
      <input name="email" type="email" placeholder="${he ? "אימייל מנהל" : "بريد المدير"}" required>
      <input name="password" type="password" placeholder="${he ? "סיסמה" : "كلمة المرور"}" minlength="8" required>
      <select name="plan">${["starter", "growth", "scale"].map((plan) => `<option value="${plan}">${planNameLabel(plan)}</option>`).join("")}</select>
      <select name="status">${["trial", "active", "suspended"].map((status) => `<option value="${status}">${subscriptionStatusLabel(status)}</option>`).join("")}</select>
      <button class="btn">${he ? "הוספה" : "إضافة"}</button>
    </form>
  </div>`;
}

function platformTenantBillingPanel(tenant, he) {
  const invoices = (tenant.recentInvoices || []).map((invoice) => Object.fromEntries(
    Object.entries(invoice).map(([key, value]) => [key, escapeHtml(value)]),
  ));
  const tenantId = escapeAttr(tenant.id);
  const plan = tenant.subscriptionPlan || tenant.plan || "starter";
  const defaultAmount = plan === "scale" ? 199 : plan === "growth" ? 99 : 49;
  return html`
    <div class="platform-billing-panel">
      <h4>${he ? "יצירת חיוב" : "إنشاء فاتورة"}</h4>
      <form class="inline-form" data-platform-invoice-form="${tenantId}">
        <input name="amount" type="number" min="0" step="0.01" value="${defaultAmount}" required>
        <select name="currency">
          ${["USD", "ILS", "EUR"].map((currency) => `<option value="${currency}">${currency}</option>`).join("")}
        </select>
        <input name="periodStart" type="date" value="${new Date().toISOString().slice(0, 10)}">
        <input name="periodEnd" type="date" value="${addDaysLocalIso(new Date().toISOString().slice(0, 10), 30)}">
        <input name="dueAt" type="date" value="${addDaysLocalIso(new Date().toISOString().slice(0, 10), 14)}">
        <input name="notes" placeholder="${he ? "הערות לחשבונית" : "ملاحظات الفاتورة"}">
        <button class="btn secondary">${he ? "הוצאת חשבונית" : "إصدار فاتورة"}</button>
      </form>
      <div class="stack-list compact">
        ${invoices.map((invoice) => `<div class="feature-row invoice-row">
          <div>
            <strong>${invoice.number}</strong>
            <span>${invoice.currency} ${Number(invoice.amount || 0).toLocaleString()} · ${invoice.periodStart || "-"} - ${invoice.periodEnd || "-"}</span>
            <small>${invoice.notes || invoice.dueAt || ""}</small>
          </div>
          <div class="actions">
            <span class="pill ${invoiceStatusClass(invoice.status)}">${invoiceStatusLabel(invoice.status)}</span>
            <button class="btn ghost" data-platform-invoice-print="${invoice.id}">${he ? "הדפסה" : "طباعة"}</button>
            ${invoice.status !== "paid" ? `<button class="btn secondary" data-platform-invoice-status="${invoice.id}" data-status="paid">${he ? "סומנה כשולמה" : "تعليم كمدفوعة"}</button>` : ""}
            ${invoice.status !== "void" ? `<button class="btn danger" data-platform-invoice-status="${invoice.id}" data-status="void">${he ? "ביטול" : "إلغاء"}</button>` : ""}
          </div>
        </div>`).join("") || `<p class="muted">${he ? "אין חשבוניות עדיין" : "لا توجد فواتير بعد"}</p>`}
      </div>
    </div>
  `;
}

function addDaysLocalIso(date, days) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function invoiceStatusClass(status) {
  if (status === "paid") return "done";
  if (status === "void" || status === "uncollectible") return "cancelled";
  return "pending";
}

function moneyLabel(amount, currency = "USD") {
  return `${String(currency || "USD").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;
}

function allPlatformInvoices() {
  return (state.data.platformTenants || []).flatMap((tenant) => (tenant.recentInvoices || []).map((invoice) => ({
    ...invoice,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    billingEmail: tenant.billingEmail || "",
    subscriptionPlan: tenant.subscriptionPlan || tenant.plan || "starter",
    subscriptionStatus: tenant.subscriptionStatus || tenant.status || "trial",
  })));
}

function filteredPlatformInvoices() {
  const search = String(state.filters.platformBillingSearch || "").trim().toLowerCase();
  const status = state.filters.platformBillingStatus || "all";
  const plan = state.filters.platformBillingPlan || "all";
  return allPlatformInvoices().filter((invoice) => {
    const haystack = `${invoice.number || ""} ${invoice.tenantName || ""} ${invoice.billingEmail || ""} ${invoice.notes || ""}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (status === "all" || invoice.status === status)
      && (plan === "all" || invoice.subscriptionPlan === plan);
  });
}

function platformBillingToolbar(he) {
  return html`<div class="toolbar">
    <input data-filter="platformBillingSearch" value="${escapeAttr(state.filters.platformBillingSearch || "")}" placeholder="${he ? "חיפוש חשבונית או קליניקה..." : "بحث عن فاتورة أو عيادة..."}">
    <select data-filter="platformBillingStatus">
      ${["all", "draft", "open", "paid", "void", "uncollectible"].map((status) => `<option value="${status}" ${status === (state.filters.platformBillingStatus || "all") ? "selected" : ""}>${status === "all" ? (he ? "כל הסטטוסים" : "كل الحالات") : invoiceStatusLabel(status)}</option>`).join("")}
    </select>
    <select data-filter="platformBillingPlan">
      ${["all", "starter", "growth", "scale"].map((plan) => `<option value="${plan}" ${plan === (state.filters.platformBillingPlan || "all") ? "selected" : ""}>${plan === "all" ? (he ? "כל התוכניות" : "كل الخطط") : planNameLabel(plan)}</option>`).join("")}
    </select>
    <button type="button" class="btn secondary" id="exportPlatformBilling">${he ? "CSV ייצוא" : "تصدير CSV"}</button>
  </div>`;
}

function renderPlatformInvoiceTable(invoices, he) {
  const heads = he
    ? ["מספר", "קליניקה", "סטטוס", "סכום", "תקופה", "לתשלום עד", "הערות"]
    : ["الرقم", "العيادة", "الحالة", "المبلغ", "الفترة", "تاريخ الاستحقاق", "ملاحظات"];
  return cleanTable(heads, invoices, (invoice) => [
    invoice.number || "-",
    invoice.tenantName || "-",
    rawHtml(`<span class="pill ${invoiceStatusClass(invoice.status)}">${escapeHtml(invoiceStatusLabel(invoice.status))}</span>`),
    moneyLabel(invoice.amount, invoice.currency),
    `${invoice.periodStart || "-"} - ${invoice.periodEnd || "-"}`,
    invoice.dueAt || "-",
    invoice.notes || "-",
  ], (invoice) => `<td class="actions">
    <button class="btn ghost" data-platform-invoice-print="${invoice.id}">${he ? "הדפסה" : "طباعة"}</button>
    ${invoice.status !== "paid" ? `<button class="btn secondary" data-platform-invoice-status="${invoice.id}" data-status="paid">${he ? "שולמה" : "مدفوعة"}</button>` : ""}
    ${invoice.status !== "void" ? `<button class="btn danger" data-platform-invoice-status="${invoice.id}" data-status="void">${he ? "ביטול" : "إلغاء"}</button>` : ""}
  </td>`);
}

function exportPlatformBillingCsv() {
  const rows = filteredPlatformInvoices();
  const headers = ["number", "tenant", "billingEmail", "status", "currency", "amount", "periodStart", "periodEnd", "dueAt", "notes"];
  const csv = [headers.join(","), ...rows.map((invoice) => headers.map((key) => {
    const value = key === "tenant" ? invoice.tenantName : invoice[key];
    return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  }).join(","))].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinova-platform-billing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printPlatformInvoice(invoiceId) {
  const rawInvoice = allPlatformInvoices().find((item) => Number(item.id) === Number(invoiceId));
  if (!rawInvoice) return;
  const invoice = Object.fromEntries(Object.entries(rawInvoice).map(([key, value]) => [key, escapeHtml(value)]));
  const he = state.lang === "he";
  const win = window.open("", "_blank", "width=760,height=840");
  win.document.write(`<!doctype html><html lang="${state.lang}" dir="rtl"><head><meta charset="utf-8"><title>${invoice.number}</title><style>body{font-family:Arial,sans-serif;padding:34px;color:#102220}.invoice{max-width:620px;margin:auto;border:1px solid #d8e6e1;border-radius:12px;padding:28px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #eef3f1;padding:11px 0}.total{font-size:20px;font-weight:700}h1{margin:0 0 8px}</style></head><body><div class="invoice"><h1>Clinova</h1><h2>${he ? "חשבונית מערכת" : "فاتورة النظام"}</h2><div class="row"><span>${he ? "מספר" : "الرقم"}</span><strong>${invoice.number}</strong></div><div class="row"><span>${he ? "קליניקה" : "العيادة"}</span><strong>${invoice.tenantName}</strong></div><div class="row"><span>${he ? "סטטוס" : "الحالة"}</span><strong>${invoiceStatusLabel(invoice.status)}</strong></div><div class="row"><span>${he ? "תקופה" : "الفترة"}</span><strong>${invoice.periodStart || "-"} - ${invoice.periodEnd || "-"}</strong></div><div class="row"><span>${he ? "לתשלום עד" : "تاريخ الاستحقاق"}</span><strong>${invoice.dueAt || "-"}</strong></div><div class="row total"><span>${he ? "סכום" : "المبلغ"}</span><strong>${moneyLabel(invoice.amount, invoice.currency)}</strong></div><p>${invoice.notes || ""}</p></div><script>print();</script></body></html>`);
  win.document.close();
}

function planNameLabel(plan) {
  const he = state.lang === "he";
  const map = he
    ? { starter: "בסיסית", growth: "צמיחה", scale: "עסקית" }
    : { starter: "أساسية", growth: "نمو", scale: "أعمال" };
  return map[plan] || plan || "-";
}

function subscriptionStatusLabel(status) {
  const he = state.lang === "he";
  const map = he
    ? { trial: "ניסיון", active: "פעיל", past_due: "תשלום באיחור", suspended: "מושהה", cancelled: "מבוטל" }
    : { trial: "تجريبي", active: "نشط", past_due: "متأخر الدفع", suspended: "معلق", cancelled: "ملغي" };
  return map[status] || status || "-";
}

function invoiceStatusLabel(status) {
  const he = state.lang === "he";
  const map = he
    ? { draft: "טיוטה", open: "פתוחה", paid: "שולמה", void: "מבוטלת", uncollectible: "לא ניתנת לגבייה" }
    : { draft: "مسودة", open: "مفتوحة", paid: "مدفوعة", void: "ملغاة", uncollectible: "غير قابلة للتحصيل" };
  return map[status] || status || "-";
}
function crmTaskStatusLabel(status) {
  const he = state.lang === "he";
  const map = he
    ? { open: "פתוחה", done: "בוצעה", cancelled: "בוטלה" }
    : { open: "مفتوحة", done: "مكتملة", cancelled: "ملغاة" };
  return map[status] || status || "-";
}

function priorityLabel(priority) {
  const he = state.lang === "he";
  const map = he
    ? { low: "נמוכה", normal: "רגילה", high: "גבוהה" }
    : { low: "منخفضة", normal: "عادية", high: "مرتفعة" };
  return map[priority] || priority || "-";
}

function messageStatusLabel(status) {
  const he = state.lang === "he";
  const map = he
    ? { sent: "נשלחה", fallback: "קישור", failed: "נכשלה", dry_run: "בדיקה" }
    : { sent: "مرسلة", fallback: "رابط", failed: "فشلت", dry_run: "تجربة" };
  return map[status] || status || "-";
}

function domainStatusLabel(status) {
  const he = state.lang === "he";
  const map = he
    ? { pending: "בהמתנה", active: "פעיל", failed: "נכשל", disabled: "כבוי" }
    : { pending: "قيد الانتظار", active: "نشط", failed: "فشل", disabled: "معطل" };
  return map[status] || status || "-";
}

function restoreCard() {
  const he = state.lang === "he";
  return html`<div class="card"><h3>${he ? "שחזור גיבוי" : "استرجاع نسخة احتياطية"}</h3>
    <p class="muted">${he ? "לפני השחזור המערכת יוצרת גיבוי בטיחותי." : "قبل الاسترجاع ينشئ النظام نسخة أمان تلقائيا."}</p>
    <form id="restoreForm" class="inline-form upload-form"><input name="backup" type="file" accept=".sqlite,.db,.dump" required><button class="btn danger">${he ? "שחזור" : "استرجاع"}</button></form>
    <div class="muted upload-hint">${he ? "מומלץ לבצע בשעה שאין משתמשים במערכת." : "يفضل التنفيذ في وقت لا يوجد فيه مستخدمون داخل النظام."}</div>
  </div>`;
}

function billingCardLocalized() {
  const he = state.lang === "he";
  const billing = state.data.billing || {};
  const catalog = billing.catalog || {};
  const plan = billing.plan || "starter";
  const usage = billing.usage || {};
  const limits = billing.limits || {};
  const invoices = billing.invoices || [];
  const plans = Object.entries(catalog);
  const maxUsers = limits.maxUsers ?? "∞";
  const maxClients = limits.maxClients ?? "∞";
  return html`<div class="card">
    <h3>${he ? "מנוי ותוכנית" : "الاشتراك والخطة"}</h3>
    <div class="grid stats">
      ${statCard("₪", catalog[plan]?.monthlyPrice ? `${catalog[plan].monthlyPrice}/mo` : "-", he ? "מחיר חודשי" : "السعر الشهري", "gold")}
      ${statCard("👥", `${usage.users || 0}/${maxUsers}`, he ? "משתמשים" : "المستخدمون", "blue")}
      ${statCard("◎", `${usage.clients || 0}/${maxClients}`, he ? "לקוחות" : "العملاء", "green")}
      ${statCard("✓", billing.status || "trial", he ? "סטטוס" : "الحالة", "purple")}
    </div>
    <form id="billingForm" class="inline-form">
      <select name="plan" required>
        ${plans.map(([id, item]) => `<option value="${id}" ${id === plan ? "selected" : ""}>${item.name} - ₪${item.monthlyPrice}/mo</option>`).join("")}
      </select>
      <select name="status" required>
        ${["trial", "active", "past_due", "suspended", "cancelled"].map((status) => `<option value="${status}" ${status === billing.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <input name="currentPeriodEnd" type="datetime-local" value="">
      <input type="hidden" name="billingPanelMarker" value="1">
      <button class="btn">${he ? "עדכון מנוי" : "تحديث الاشتراك"}</button>
    </form>
    <p class="muted">${he ? "עדכון ידני זמני עד חיבור ספק תשלומים." : "تحديث يدوي مؤقت إلى أن يتم ربط بوابة الدفع."}</p>
  </div>`;
}

function billingInvoicesPanelLocalized() {
  const he = state.lang === "he";
  const billing = state.data.billing || {};
  const catalog = billing.catalog || {};
  const plan = billing.plan || "starter";
  const invoices = billing.invoices || [];
  return html`
    <form id="invoiceForm" class="inline-form">
      <input name="amount" type="number" min="0" step="0.01" value="${catalog[plan]?.monthlyPrice || 0}" required>
      <select name="currency">
        ${["USD", "ILS", "EUR"].map((currency) => `<option value="${currency}">${currency}</option>`).join("")}
      </select>
      <input name="periodStart" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <input name="notes" placeholder="${he ? "Invoice notes" : "ملاحظات الفاتورة"}">
      <button class="btn secondary">${he ? "Create invoice" : "إصدار فاتورة"}</button>
    </form>
    <div class="stack-list">
      ${invoices.map((invoice) => `<div class="feature-row">
        <div><strong>${invoice.number}</strong><span>${invoice.currency} ${Number(invoice.amount || 0).toLocaleString()} · ${invoice.periodStart || "-"} - ${invoice.periodEnd || "-"}</span><small>${invoice.notes || invoice.dueAt || ""}</small></div>
        <div class="actions"><span class="pill ${invoice.status === "paid" ? "done" : invoice.status === "void" ? "cancelled" : "pending"}">${invoice.status}</span>${invoice.status === "open" ? `<button class="btn secondary" data-invoice-paid="${invoice.id}">${he ? "Paid" : "مدفوعة"}</button><button class="btn danger" data-invoice-void="${invoice.id}">${he ? "Void" : "إلغاء"}</button>` : ""}</div>
      </div>`).join("") || `<p class="muted">${he ? "No invoices yet" : "لا توجد فواتير بعد"}</p>`}
    </div>
  `;
}

function renderBillingLocalized() {
  if (state.user.role !== "admin") return `<div class="card"><p class="muted">Admin only</p></div>`;
  return html`
    <div class="settings-grid">
      ${billingCardLocalized()}
      <div class="card">
        <h3>${state.lang === "he" ? "Invoices" : "الفواتير"}</h3>
        ${billingInvoicesPanelLocalized()}
      </div>
    </div>
  `;
}

function renderWhatsAppLocalized() {
  if (state.user.role !== "admin") return `<div class="card"><p class="muted">Admin only</p></div>`;
  const s = state.data.settings || {};
  const he = state.lang === "he";
  const logs = state.data.messageLogs || [];
  return html`
    <div class="settings-grid">
      <div class="card">
        <h3>${he ? "WhatsApp" : "WhatsApp"}</h3>
        <form id="clinicSettingsForm">
          ${field("whatsappTemplate", he ? "Appointment template" : "رسالة تذكير الموعد", s.whatsappTemplate || "", "textarea", false, "full")}
          ${select("whatsappEnabled", he ? "WhatsApp enabled" : "تفعيل WhatsApp", [["false", he ? "Link only" : "رابط فقط"], ["true", he ? "API enabled" : "مفعل عبر API"]], s.whatsappEnabled || "false")}
          ${select("whatsappMode", he ? "Sending mode" : "وضع الإرسال", [["fallback", he ? "WhatsApp link" : "رابط WhatsApp"], ["cloud", "Meta Cloud API"]], s.whatsappMode || "fallback")}
          ${field("whatsappBusinessPhone", he ? "Business phone" : "رقم WhatsApp Business", s.whatsappBusinessPhone || "", "text", false)}
          ${field("whatsappFeedbackTemplate", he ? "Feedback template" : "قالب التقييم", s.whatsappFeedbackTemplate || "", "textarea", false, "full")}
          ${field("whatsappGiftTemplate", he ? "Gift template" : "قالب الهدية", s.whatsappGiftTemplate || "", "textarea", false, "full")}
          <button class="btn">${tr("save")}</button>
        </form>
      </div>
      <div class="card">
        <h3>${he ? "Message log" : "سجل رسائل WhatsApp"}</h3>
        <div class="stack-list">
          ${logs.map((log) => `<div class="feature-row">
            <div><strong>${log.recipient || "-"}</strong><span>${log.entity || ""} #${log.entityId || ""} · ${log.createdAt || ""}</span><small>${log.error || log.message || ""}</small></div>
            <span class="pill ${log.status === "sent" || log.status === "dry_run" ? "done" : log.status === "failed" ? "cancelled" : "pending"}">${log.status}</span>
          </div>`).join("") || `<p class="muted">${he ? "No messages yet" : "لا توجد رسائل بعد"}</p>`}
        </div>
      </div>
    </div>
  `;
}

renderSettingsClean = function (message = "") {
  const tenantCardHtml = "";
  const s = state.data.settings || {};
  const he = state.lang === "he";
  return html`
    <div class="settings-grid">
      ${tenantCardHtml}
      ${state.user.role === "admin" ? `<div class="card"><h3>${he ? "Clinic settings" : "إعدادات العيادة"}</h3><form id="clinicSettingsForm">
        ${field("clinicName", he ? "Clinic name" : "اسم العيادة", s.clinicName || "Clinova")}
        <div class="field"><label>${he ? "System logo" : "لوغو النظام"}</label><div class="logo-upload"><img id="logoPreview" src="${logoSrc()}" alt="Clinova"><input name="logoFile" id="logoFile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"><input name="logoUrl" id="logoUrlInput" type="hidden" value="${escapeAttr(s.logoUrl || "/logo.svg")}"></div></div>
        ${field("currency", he ? "Currency" : "العملة", s.currency || "₪")}
        ${field("workStart", he ? "Workday starts" : "بداية الدوام", s.workStart || "09:00", "time")}
        ${field("workEnd", he ? "Workday ends" : "نهاية الدوام", s.workEnd || "18:00", "time")}
        <div class="field full"><label>${he ? "Work days" : "أيام العمل"}</label>${workDaysPicker(s.workDays)}</div>
        <button class="btn">${tr("save")}</button>
      </form>
      <div class="backup-panel"><h3>${he ? "System backup" : "نسخة خارجية من النظام"}</h3><p class="muted">${he ? "Download a database backup to this computer." : "تحميل نسخة قاعدة البيانات على جهاز الكمبيوتر."}</p><a class="btn secondary" href="/api/system/export" download>${he ? "Download backup" : "تحميل النسخة"}</a></div></div>` : ""}
      ${state.user.role === "admin" ? restoreCard() : ""}
      <div class="card"><h3>${he ? "Change password" : "تغيير كلمة المرور"}</h3>${message ? `<div class="alert">${message}</div>` : ""}<form id="passwordForm"><div class="field"><label>${he ? "Current password" : "كلمة المرور الحالية"}</label><input name="currentPassword" type="password" required></div><div class="field"><label>${he ? "New password" : "كلمة المرور الجديدة"}</label><input name="newPassword" type="password" minlength="8" required></div><button class="btn">${he ? "Change password" : "تغيير كلمة المرور"}</button></form></div>
    </div>
  `;
}

function tenantProfileCard() {
  const he = state.lang === "he";
  const tenant = state.data.tenant || state.data.billing?.tenant || {};
  const domains = state.data.tenantDomains || [];
  const status = subscriptionStatusLabel(state.data.billing?.status || tenant.status || "trial");
  const plan = planNameLabel(state.data.billing?.plan || tenant.plan || "starter");
  return html`
    <div class="card">
      <h3>${he ? "פרטי העסק" : "بيانات العيادة التجارية"}</h3>
      <form id="tenantProfileForm">
        ${field("name", he ? "שם רשמי" : "الاسم الرسمي", tenant.name || "Clinova Clinic")}
        ${field("billingEmail", he ? "אימייל לחיוב" : "بريد الفوترة", tenant.billingEmail || "", "email", false)}
        <div class="field"><label>${he ? "מזהה מרחב" : "معرّف العيادة"}</label><input value="${escapeAttr(tenant.slug || "demo")}" disabled></div>
        <div class="grid stats">
          ${statCard("✓", status, he ? "סטטוס" : "الحالة", "purple")}
          ${statCard("▣", plan, he ? "תוכנית" : "الخطة", "blue")}
        </div>
        <button class="btn">${tr("save")}</button>
      </form>
      <form id="tenantDomainForm" class="inline-form">
        <input name="domain" placeholder="${he ? "דומיין לדוגמה clinic.com" : "دومين مثل clinic.com"}" required>
        <label class="check-inline"><input name="isPrimary" type="checkbox"> <span>${he ? "ראשי" : "أساسي"}</span></label>
        <button class="btn secondary">${he ? "הוספת דומיין" : "إضافة دومين"}</button>
      </form>
      <div class="stack-list">
        ${domains.map((item) => `<div class="feature-row">
          <div><strong>${item.domain}</strong><span>${domainStatusLabel(item.status)}${item.isPrimary ? ` · ${he ? "ראשי" : "أساسي"}` : ""}</span><small>${item.verifiedAt || item.createdAt || ""}</small></div>
          <div class="actions">
            ${item.status !== "active" ? `<button class="btn secondary" data-domain-status="active" data-id="${item.id}">${he ? "סימון כפעיל" : "تفعيل"}</button>` : ""}
            ${!item.isPrimary ? `<button class="btn secondary" data-domain-primary="${item.id}">${he ? "ראשי" : "أساسي"}</button>` : ""}
            <button class="btn danger" data-domain-delete="${item.id}">${tr("delete")}</button>
          </div>
        </div>`).join("") || `<p class="muted">${he ? "אין דומיינים עדיין" : "لا توجد دومينات بعد"}</p>`}
      </div>
    </div>
  `;
}

function billingCard() {
  const he = state.lang === "he";
  const billing = state.data.billing || {};
  const catalog = billing.catalog || {};
  const plan = billing.plan || "starter";
  const usage = billing.usage || {};
  const limits = billing.limits || {};
  const plans = Object.entries(catalog);
  const maxUsers = limits.maxUsers ?? "∞";
  const maxClients = limits.maxClients ?? "∞";
  return html`<div class="card">
    <h3>${he ? "מנוי ותוכנית" : "الاشتراك والخطة"}</h3>
    <div class="grid stats">
      ${statCard("₪", catalog[plan]?.monthlyPrice ? `${catalog[plan].monthlyPrice}/${he ? "חודש" : "شهر"}` : "-", he ? "מחיר חודשי" : "السعر الشهري", "gold")}
      ${statCard("👥", `${usage.users || 0}/${maxUsers}`, he ? "משתמשים" : "المستخدمون", "blue")}
      ${statCard("▣", `${usage.clients || 0}/${maxClients}`, he ? "לקוחות" : "العملاء", "green")}
      ${statCard("✓", subscriptionStatusLabel(billing.status || "trial"), he ? "סטטוס" : "الحالة", "purple")}
    </div>
    <form id="billingForm" class="inline-form">
      <select name="plan" required>
        ${plans.map(([id, item]) => `<option value="${id}" ${id === plan ? "selected" : ""}>${planNameLabel(id)} - ${item.monthlyPrice}/${he ? "חודש" : "شهر"}</option>`).join("")}
      </select>
      <select name="status" required>
        ${["trial", "active", "past_due", "suspended", "cancelled"].map((status) => `<option value="${status}" ${status === billing.status ? "selected" : ""}>${subscriptionStatusLabel(status)}</option>`).join("")}
      </select>
      <input name="currentPeriodEnd" type="datetime-local" value="">
      <input type="hidden" name="billingPanelMarker" value="1">
      <button class="btn">${he ? "עדכון מנוי" : "تحديث الاشتراك"}</button>
    </form>
    <p class="muted">${he ? "עדכון ידני זמני עד חיבור ספק תשלומים." : "تحديث يدوي مؤقت إلى أن يتم ربط بوابة الدفع."}</p>
  </div>`;
}

function billingInvoicesPanel() {
  const he = state.lang === "he";
  const billing = state.data.billing || {};
  const catalog = billing.catalog || {};
  const plan = billing.plan || "starter";
  const invoices = billing.invoices || [];
  return html`
    <form id="invoiceForm" class="inline-form">
      <input name="amount" type="number" min="0" step="0.01" value="${catalog[plan]?.monthlyPrice || 0}" required>
      <select name="currency">
        ${["USD", "ILS", "EUR"].map((currency) => `<option value="${currency}">${currency}</option>`).join("")}
      </select>
      <input name="periodStart" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <input name="notes" placeholder="${he ? "הערות לחשבונית" : "ملاحظات الفاتورة"}">
      <button class="btn secondary">${he ? "הוצאת חשבונית" : "إصدار فاتورة"}</button>
    </form>
    <div class="stack-list">
      ${invoices.map((invoice) => `<div class="feature-row">
        <div><strong>${invoice.number}</strong><span>${invoice.currency} ${Number(invoice.amount || 0).toLocaleString()} · ${invoice.periodStart || "-"} - ${invoice.periodEnd || "-"}</span><small>${invoice.notes || invoice.dueAt || ""}</small></div>
        <div class="actions"><span class="pill ${invoice.status === "paid" ? "done" : invoice.status === "void" ? "cancelled" : "pending"}">${invoiceStatusLabel(invoice.status)}</span>${invoice.status === "open" ? `<button class="btn secondary" data-invoice-paid="${invoice.id}">${he ? "שולמה" : "مدفوعة"}</button><button class="btn danger" data-invoice-void="${invoice.id}">${he ? "ביטול" : "إلغاء"}</button>` : ""}</div>
      </div>`).join("") || `<p class="muted">${he ? "אין חשבוניות עדיין" : "لا توجد فواتير بعد"}</p>`}
    </div>
  `;
}

renderBilling = function () {
  if (state.user.role !== "admin") return `<div class="card"><p class="muted">${state.lang === "he" ? "למנהלים בלבד" : "للمدير فقط"}</p></div>`;
  return html`
    <div class="settings-grid">
      ${billingCard()}
      <div class="card">
        <h3>${state.lang === "he" ? "חשבוניות" : "الفواتير"}</h3>
        ${billingInvoicesPanel()}
      </div>
    </div>
  `;
}

renderWhatsApp = function () {
  if (state.user.role !== "admin") return `<div class="card"><p class="muted">${state.lang === "he" ? "למנהלים בלבד" : "للمدير فقط"}</p></div>`;
  const s = state.data.settings || {};
  const he = state.lang === "he";
  const logs = state.data.messageLogs || [];
  return html`
    <div class="settings-grid">
      <div class="card">
        <h3>WhatsApp</h3>
        <form id="clinicSettingsForm">
          ${field("whatsappTemplate", he ? "תבנית תזכורת לתור" : "رسالة تذكير الموعد", s.whatsappTemplate || "", "textarea", false, "full")}
          ${select("whatsappEnabled", he ? "הפעלת WhatsApp" : "تفعيل WhatsApp", [["false", he ? "קישור בלבד" : "رابط فقط"], ["true", he ? "פעיל דרך API" : "مفعل عبر API"]], s.whatsappEnabled || "false")}
          ${select("whatsappMode", he ? "מצב שליחה" : "وضع الإرسال", [["fallback", he ? "קישור WhatsApp" : "رابط WhatsApp"], ["cloud", he ? "واجهة Meta السحابية" : "واجهة Meta السحابية"]], s.whatsappMode || "fallback")}
          ${field("whatsappBusinessPhone", he ? "מספר עסקי" : "رقم العمل", s.whatsappBusinessPhone || "", "text", false)}
          ${field("whatsappFeedbackTemplate", he ? "תבנית משוב" : "قالب التقييم", s.whatsappFeedbackTemplate || "", "textarea", false, "full")}
          ${field("whatsappGiftTemplate", he ? "תבנית מתנה" : "قالب الهدية", s.whatsappGiftTemplate || "", "textarea", false, "full")}
          <button class="btn">${tr("save")}</button>
        </form>
      </div>
      <div class="card">
        <h3>${he ? "יומן הודעות" : "سجل الرسائل"}</h3>
        <div class="stack-list">
          ${logs.map((log) => `<div class="feature-row">
            <div><strong>${log.recipient || "-"}</strong><span>${log.entity || ""} #${log.entityId || ""} · ${log.createdAt || ""}</span><small>${log.error || log.message || ""}</small></div>
            <span class="pill ${log.status === "sent" || log.status === "dry_run" ? "done" : log.status === "failed" ? "cancelled" : "pending"}">${messageStatusLabel(log.status)}</span>
          </div>`).join("") || `<p class="muted">${he ? "אין הודעות עדיין" : "لا توجد رسائل بعد"}</p>`}
        </div>
      </div>
    </div>
  `;
}

function renderSettingsHe(message = "") {
  const s = state.data.settings || {};
  const he = state.lang === "he";
  return html`
    <div class="settings-grid">
      ${state.user.role === "admin" ? `<div class="card"><h3>${he ? "הגדרות קליניקה" : "إعدادات العيادة"}</h3><form id="clinicSettingsForm">
        ${field("clinicName", he ? "שם הקליניקה" : "اسم العيادة", s.clinicName || "Clinova")}
        <div class="field"><label>${he ? "לוגו המערכת" : "لوغو النظام"}</label><div class="logo-upload"><img id="logoPreview" src="${logoSrc()}" alt="Clinova"><input name="logoFile" id="logoFile" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"><input name="logoUrl" id="logoUrlInput" type="hidden" value="${escapeAttr(s.logoUrl || "/logo.svg")}"></div></div>
        ${field("currency", he ? "מטבע" : "العملة", s.currency || "₪")}
        ${field("workStart", he ? "תחילת יום עבודה" : "بداية الدوام", s.workStart || "09:00", "time")}
        ${field("workEnd", he ? "סיום יום עבודה" : "نهاية الدوام", s.workEnd || "18:00", "time")}
        <div class="field full"><label>${he ? "ימי עבודה" : "أيام العمل"}</label>${workDaysPicker(s.workDays)}</div>
        ${field("whatsappTemplate", he ? "הודעת WhatsApp" : "رسالة WhatsApp", s.whatsappTemplate || "", "textarea", false, "full")}
        ${select("whatsappEnabled", he ? "WhatsApp פעיל" : "تفعيل WhatsApp", [["false", he ? "מצב رابط בלבד" : "رابط فقط"], ["true", he ? "פעיל דרך API" : "مفعل عبر API"]], s.whatsappEnabled || "false")}
        ${select("whatsappMode", he ? "מצב שליחה" : "وضع الإرسال", [["fallback", he ? "קישור WhatsApp" : "رابط WhatsApp"], ["cloud", he ? "Meta Cloud API" : "Meta Cloud API"]], s.whatsappMode || "fallback")}
        ${field("whatsappBusinessPhone", he ? "מספר WhatsApp Business" : "رقم WhatsApp Business", s.whatsappBusinessPhone || "", "text", false)}
        ${field("whatsappFeedbackTemplate", he ? "תבנית משוב" : "قالب التقييم", s.whatsappFeedbackTemplate || "", "textarea", false, "full")}
        ${field("whatsappGiftTemplate", he ? "תבנית מתנה" : "قالب الهدية", s.whatsappGiftTemplate || "", "textarea", false, "full")}
        <button class="btn">${tr("save")}</button></form>
        <div class="backup-panel"><h3>${he ? "עותק חיצוני של המערכת" : "نسخة خارجية من النظام"}</h3><p class="muted">${he ? "הורדת עותק של בסיס הנתונים למחשב." : "تحميل نسخة قاعدة البيانات على جهاز الكمبيوتر."}</p><a class="btn secondary" href="/api/system/export" download>${he ? "הורדת עותק" : "تحميل النسخة"}</a></div></div>` : ""}
      ${state.user.role === "admin" ? billingCard() : ""}
      ${state.user.role === "admin" ? restoreCard() : ""}
      <div class="card"><h3>${he ? "שינוי סיסמה" : "تغيير كلمة المرور"}</h3>${message ? `<div class="alert">${message}</div>` : ""}<form id="passwordForm"><div class="field"><label>${he ? "סיסמה נוכחית" : "كلمة المرور الحالية"}</label><input name="currentPassword" type="password" required></div><div class="field"><label>${he ? "סיסמה חדשה" : "كلمة المرور الجديدة"}</label><input name="newPassword" type="password" minlength="8" required></div><button class="btn">${he ? "שינוי סיסמה" : "تغيير كلمة المرور"}</button></form></div>
    </div>
  `;
}

renderTeamUsers = function () {
  const he = state.lang === "he";
  const h = he ? ["שם משתמש", "אימייל", "שם", "תפקיד", "פעיל"] : ["اسم المستخدم", "البريد", "الاسم", "الدور", "فعال"];
  const pending = (state.data.invitations || []).filter((invite) => !invite.acceptedAt && Number(invite.expiresAt || 0) > Date.now());
  return html`
    <div class="feature-grid">
      <div class="card">
        <h3>${he ? "הזמנת איש צוות" : "دعوة عضو فريق"}</h3>
        <form id="inviteUserForm" class="inline-form">
          <input name="name" placeholder="${he ? "שם" : "الاسم"}" required>
          <input name="email" type="email" placeholder="${he ? "אימייל" : "البريد"}" required>
          <select name="role" required>
            <option value="therapist">${roleLabel("therapist")}</option>
            <option value="reception">${roleLabel("reception")}</option>
            <option value="admin">${roleLabel("admin")}</option>
          </select>
          <button class="btn">${he ? "יצירת הזמנה" : "إنشاء دعوة"}</button>
        </form>
      </div>
      <div class="card">
        <h3>${he ? "הזמנות פתוחות" : "الدعوات المفتوحة"}</h3>
        <div class="stack-list">
          ${pending.map((invite) => `<div class="feature-row"><div><strong>${invite.name}</strong><span>${invite.email} - ${roleLabel(invite.role)}</span><small>${new Date(Number(invite.expiresAt)).toLocaleDateString()}</small></div><div class="actions"><button class="btn secondary" data-copy-invite="${escapeAttr(invite.inviteUrl)}">${he ? "העתקה" : "نسخ"}</button><button class="btn danger" data-revoke-invite="${invite.id}">${he ? "ביטול" : "إلغاء"}</button></div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}
        </div>
      </div>
    </div>
    ${simpleTable("users", h, state.data.users, (u) => [u.username, u.email || "-", u.name, roleLabel(u.role), yesNo(u.active)])}
  `;
}

formFieldsHe = function (resource, row) {
  const he = state.lang === "he";
  if (resource === "clients") {
    const tagsValue = Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags || "");
    return html`
      ${field("fname", he ? "שם פרטי" : "الاسم الأول", row.fname)}
      ${field("lname", he ? "שם משפחה" : "اسم العائلة", row.lname)}
      ${field("phone", he ? "טלפון" : "الهاتف", row.phone)}
      ${field("email", he ? "אימייל" : "البريد", row.email, "email", false)}
      ${select("therapistId", he ? "מטפלת" : "المعالجة", therapists(), row.therapistId, false)}
      ${select("stage", he ? "שלב CRM" : "مرحلة CRM", [["lead", crmStageLabel("lead")], ["contacted", crmStageLabel("contacted")], ["qualified", crmStageLabel("qualified")], ["active", crmStageLabel("active")], ["follow_up", crmStageLabel("follow_up")], ["vip", "VIP"], ["inactive", crmStageLabel("inactive")], ["lost", crmStageLabel("lost")]], row.stage || "lead")}
      ${field("source", he ? "מקור" : "المصدر", row.source || "", "text", false)}
      ${field("tags", he ? "תגיות" : "الوسوم", tagsValue, "text", false)}
      ${field("notes", he ? "הערות" : "ملاحظات", row.notes, "textarea", false, "full")}
    `;
  }
  if (resource === "clients") return html`${field("fname", he ? "שם פרטי" : "الاسم الأول", row.fname)}${field("lname", he ? "שם משפחה" : "اسم العائلة", row.lname)}${field("phone", he ? "טלפון" : "الهاتف", row.phone)}${field("email", he ? "אימייל" : "البريد", row.email, "email", false)}${select("therapistId", he ? "מטפלת" : "المعالجة", therapists(), row.therapistId, false)}${field("notes", he ? "הערות" : "ملاحظات", row.notes, "textarea", false, "full")}`;
  if (resource === "appointments") {
    const isCalendarNew = row.fromCalendar && !row.id;
    const therapistValue = isCalendarNew ? "" : row.therapistId || state.user.id;
    const therapistRequired = isCalendarNew ? true : state.user.role !== "therapist";
    return html`${searchableClientField(row.clientId || "")}${select("serviceId", he ? "שירות" : "الخدمة", state.data.services.filter((s) => s.active).map((s) => [s.id, s.name]), row.serviceId || "", true)}${select("therapistId", he ? "מטפלת" : "المعالجة", therapists(), therapistValue, therapistRequired)}${field("date", he ? "תאריך" : "التاريخ", row.date || new Date().toISOString().slice(0, 10), "date")}${field("time", he ? "שעה" : "الوقت", row.time || "09:00", "time")}${select("status", he ? "סטטוס" : "الحالة", [["pending", statusLabel.pending], ["done", statusLabel.done], ["cancelled", statusLabel.cancelled]], row.status || "pending")}${select("paymentStatus", he ? "מצב תשלום" : "حالة الدفع", [["unpaid", paymentLabel.unpaid], ["paid", paymentLabel.paid], ["deposit", paymentLabel.deposit]], row.paymentStatus || "unpaid")}${field("paidAmount", he ? "סכום ששולם" : "المبلغ المدفوع", row.paidAmount || 0, "number", false)}${field("notes", he ? "הערות" : "ملاحظات", row.notes, "textarea", false, "full")}`;
  }
  if (resource === "categories") return field("name", he ? "שם קטגוריה" : "اسم القسم", row.name);
  if (resource === "services") return html`${field("name", he ? "שם שירות" : "اسم الخدمة", row.name)}${select("categoryId", he ? "קטגוריה" : "القسم", state.data.categories.map((c) => [c.id, c.name]), row.categoryId)}${field("duration", he ? "משך בדקות" : "المدة بالدقائق", row.duration || 60, "number")}${field("price", he ? "מחיר" : "السعر", row.price || 0, "number")}${select("active", he ? "פעיל" : "فعال", [["true", yesNo(true)], ["false", yesNo(false)]], String(row.active !== false))}`;
  if (resource === "users") return html`${field("username", he ? "שם משתמש" : "اسم المستخدم", row.username)}${field("password", row.id ? (he ? "סיסמה חדשה אופציונלית" : "كلمة مرور جديدة اختيارية") : (he ? "סיסמה" : "كلمة المرور"), "", "password", !row.id)}${field("name", he ? "שם" : "الاسم", row.name)}${field("title", he ? "תיאור תפקיד" : "الوصف الوظيفي", row.title, "text", false)}${select("role", he ? "תפקיד" : "الدور", [["admin", roleLabel("admin")], ["reception", roleLabel("reception")], ["therapist", roleLabel("therapist")]], row.role || "therapist")}${select("active", he ? "פעיל" : "فعال", [["true", yesNo(true)], ["false", yesNo(false)]], String(row.active !== false))}`;
  return "";
}

renderApp = function () {
  const nav = state.user.platformOwner ? ["platform"] : (navByRole[state.user.role] || []);
  if (!nav.includes(state.page)) state.page = nav[0] || "dashboard";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  mount(html`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-logo" src="${logoSrc()}" alt="Clinova">
          <div><h3>Clinova</h3><div style="opacity:.75;font-size:12px">${state.user.platformOwner ? (state.lang === "he" ? "ניהול המערכת" : "إدارة المنصة") : (state.lang === "he" ? "ניהול קליניקה" : "إدارة العيادة")}</div><div class="app-version">v${APP_VERSION}</div></div>
        </div>
        <nav class="nav">${nav.map((page) => `<button data-page="${page}" class="${state.page === page ? "active" : ""}">${pageLabel(page)}</button>`).join("")}</nav>
        <div class="user-box">
          <strong>${state.user.name}</strong>
          <span style="opacity:.75">${roleLabel(state.user.role)}</span>
          <button class="btn ghost" id="logoutBtn" style="color:white;border-color:rgba(255,255,255,.35)">${state.lang === "he" ? "יציאה" : "خروج"}</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><h2>${pageLabel(state.page)}</h2><div class="muted page-subtitle">${pageSubtitle()}</div></div>
          <div class="topbar-actions">${languagePicker()}${renderQuickSearchLive()}${topActionI18n()}</div>
        </header>
        <section class="content">${renderPage()}</section>
      </main>
    </div>
    <div id="modalRoot"></div>
  `);
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
    state.page = button.dataset.page;
    renderApp();
  }));
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    renderLogin();
  });
  bindPageActions();
}

function calendarDay(day, view) {
  const date = toDateInput(day);
  const rows = state.data.appointments.filter((a) => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
  return html`
    <section class="calendar-day ${date === new Date().toISOString().slice(0, 10) ? "today" : ""}" data-calendar-date="${date}">
      <header><strong>${day.getDate()}</strong><span>${date}</span></header>
      <div class="calendar-events">
        ${rows.map((a) => `<button data-open-appointment="${a.id}" class="calendar-event ${a.status}"><span>${a.time}</span><strong>${a.clientName}</strong><em>${a.serviceName}</em></button>`).join("") || `<div class="calendar-empty">${view === "month" ? "" : "אין תורים"}</div>`}
      </div>
    </section>
  `;
}

function simpleTable(resource, heads, rows, mapRow) {
  const actionLabel = state.lang === "he" ? "פעולות" : "إجراءات";
  return html`
    <div class="table-wrap responsive-table resource-${resource}">
      <table>
        <thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}<th></th></tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${mapRow(row).map((cell, index) => `<td data-label="${escapeAttr(heads[index] || "")}">${cell}</td>`).join("")}<td class="actions" data-label="${escapeAttr(actionLabel)}"><button class="btn secondary" data-edit="${resource}" data-id="${row.id}">עריכה</button><button class="btn danger" data-delete="${resource}" data-id="${row.id}">מחיקה</button></td></tr>`).join("") || `<tr><td colspan="${heads.length + 1}" class="muted">אין נתונים</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

renderAudit = function () {
  const actions = { login: "כניסה", create: "יצירה", update: "עדכון", delete: "מחיקה", archive: "ארכוב", deactivate: "השבתה", change_password: "שינוי סיסמה", export: "ייצוא" };
  const entities = { users: "משתמשים", clients: "לקוחות", appointments: "תורים", services: "שירותים", categories: "קטגוריות", settings: "הגדרות", session: "כניסה", system: "מערכת", client_files: "קבצי לקוח" };
  return html`
    <div class="table-wrap">
      <table>
        <thead><tr><th>זמן</th><th>משתמש</th><th>פעולה</th><th>סוג</th><th>מספר</th></tr></thead>
        <tbody>${(state.data.audits || []).map((row) => `<tr><td>${row.createdAt}</td><td>${row.userName || "-"}</td><td>${actions[row.action] || row.action}</td><td>${entities[row.entity] || row.entity}</td><td>${row.entityId || "-"}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">אין נתונים</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function rankList(rows) {
  if (!rows.length) return `<p class="muted">אין נתונים</p>`;
  return rows.map(([name, value]) => `<div class="rank-row"><span>${name}</span><strong>${currency()}${Number(value || 0).toLocaleString()}</strong></div>`).join("");
}

function reportTabButton(tab, label) {
  return `<button class="rtab ${state.reportTab === tab ? "active" : ""}" data-report-tab="${tab}">${label}</button>`;
}

renderReports = function () {
  const done = state.data.appointments.filter((a) => a.status === "done");
  const revenue = done.reduce((sum, a) => sum + Number(a.price || 0), 0);
  const byTherapist = groupRevenue(done, "therapistName");
  const byService = groupRevenue(done, "serviceName");
  const conflicts = findReportConflicts();
  return html`
    <div class="reports-shell">
      <div class="reports-tabs">
        ${reportTabButton("overview", "סקירה")}
        ${reportTabButton("revenue", "הכנסות")}
        ${reportTabButton("appointments", "תורים")}
        ${reportTabButton("clients", "לקוחות")}
        ${reportTabButton("therapists", "מטפלות")}
        ${reportTabButton("conflicts", "התנגשויות")}
      </div>
      <div class="filter-row">
        <div class="report-alert ${conflicts.length ? "warning" : "success"}">${conflicts.length ? `יש ${conflicts.length} התנגשויות לבדיקה` : "אין התנגשויות בתורים הנוכחיים"}</div>
        <div class="export-btns"><button class="btn secondary" data-export="appointments">ייצוא תורים CSV</button><button class="btn secondary" data-export="clients">ייצוא לקוחות CSV</button></div>
      </div>
      <div class="report-content">${renderReportTab(done, revenue, byTherapist, byService, conflicts)}</div>
    </div>
  `;
}

function renderReportTab(done, revenue, byTherapist, byService, conflicts) {
  const appointments = state.data.appointments;
  if (state.reportTab === "revenue") return html`<div class="grid stats">${statCard("₪", `${currency()}${revenue.toLocaleString()}`, "סה״כ הכנסות", "gold")}${statCard("↗", `${currency()}${done.length ? Math.round(revenue / done.length).toLocaleString() : 0}`, "ממוצע לתור", "green")}${statCard("✓", done.length, "תורים שבוצעו", "blue")}${statCard("▣", byService.length, "שירותים עם הכנסה", "purple")}</div><div class="report-grid-2"><div class="card"><h3>הכנסות לפי שירות</h3>${rankList(byService)}</div><div class="card"><h3>הכנסות לפי מטפלת</h3>${rankList(byTherapist)}</div></div>`;
  if (state.reportTab === "appointments") return html`<div class="grid stats">${statCard("📅", appointments.length, "סה״כ תורים", "blue")}${statCard("✓", done.length, "בוצעו", "green")}${statCard("…", appointments.filter((a) => a.status === "pending").length, "ממתינים", "gold")}${statCard("×", appointments.filter((a) => a.status === "cancelled").length, "בוטלו", "red")}</div>${appointmentTable(appointments, false)}`;
  if (state.reportTab === "clients") {
    const activeClientIds = new Set(appointments.map((a) => a.clientId));
    const topClients = [...activeClientIds].map((id) => {
      const rows = appointments.filter((a) => a.clientId === id && a.status === "done");
      const client = state.data.clients.find((c) => c.id === id);
      return [client ? `${client.fname} ${client.lname}` : "-", rows.reduce((sum, a) => sum + Number(a.price || 0), 0)];
    }).sort((a, b) => b[1] - a[1]);
    return html`<div class="grid stats">${statCard("👥", state.data.clients.length, "סה״כ לקוחות", "green")}${statCard("⚡", activeClientIds.size, "לקוחות עם תורים", "blue")}${statCard("◼", state.data.clients.filter((c) => c.email || c.phone).length, "תיקים עם פרטי קשר", "gold")}${statCard("◆", topClients.length ? topClients[0][0] : "-", "לקוח מוביל", "purple")}</div><div class="card"><h3>לקוחות מובילים לפי הכנסה</h3>${rankList(topClients)}</div>`;
  }
  if (state.reportTab === "therapists") {
    const rows = therapists().map(([id, name]) => {
      const all = appointments.filter((a) => a.therapistId === Number(id));
      const completed = all.filter((a) => a.status === "done");
      const rev = completed.reduce((sum, a) => sum + Number(a.price || 0), 0);
      return { name, all: all.length, completed: completed.length, cancelled: all.filter((a) => a.status === "cancelled").length, rev };
    });
    return html`<div class="table-wrap"><table><thead><tr><th>מטפלת</th><th>כל התורים</th><th>בוצעו</th><th>בוטלו</th><th>אחוז ביצוע</th><th>הכנסה</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.name}</td><td>${r.all}</td><td>${r.completed}</td><td>${r.cancelled}</td><td>${r.all ? Math.round(r.completed / r.all * 100) : 0}%</td><td>${currency()}${r.rev.toLocaleString()}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">אין נתונים</td></tr>`}</tbody></table></div>`;
  }
  if (state.reportTab === "conflicts") return html`<div class="grid stats">${statCard("!", conflicts.length, "סה״כ התנגשויות", conflicts.length ? "red" : "green")}${statCard("👤", conflicts.filter((c) => c.reason === "אותה מטפלת").length, "אותה מטפלת", "gold")}${statCard("⏱", conflicts.filter((c) => c.reason === "חפיפת זמן").length, "חפיפת זמן", "blue")}${statCard("✓", conflicts.length ? "בדיקה" : "תקין", "מצב היומן", "green")}</div><div class="table-wrap"><table><thead><tr><th>תאריך</th><th>שעה</th><th>תור ראשון</th><th>תור שני</th><th>סיבה</th></tr></thead><tbody>${conflicts.map((c) => `<tr><td>${c.a.date}</td><td>${c.a.time} / ${c.b.time}</td><td>${c.a.clientName} - ${c.a.serviceName}</td><td>${c.b.clientName} - ${c.b.serviceName}</td><td><span class="pill cancelled">${c.reason}</span></td></tr>`).join("") || `<tr><td colspan="5" class="muted">אין התנגשויות</td></tr>`}</tbody></table></div>`;
  return html`<div class="grid stats">${statCard("📅", appointments.length, "סה״כ תורים", "blue")}${statCard("✓", done.length, "בוצעו", "green")}${statCard("₪", `${currency()}${revenue.toLocaleString()}`, "סה״כ הכנסות", "gold")}${statCard("!", conflicts.length, "התנגשויות", conflicts.length ? "red" : "green")}</div><div class="report-grid-2"><div class="card"><h3>הכנסות לפי שירות</h3>${rankList(byService)}</div><div class="card"><h3>הכנסות לפי מטפלת</h3>${rankList(byTherapist)}</div></div>`;
}

function findReportConflicts() {
  const rows = state.data.appointments.filter((a) => a.status !== "cancelled").sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const conflicts = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.date !== b.date) break;
      const aStart = toMinutes(a.time);
      const aEnd = aStart + Number(a.duration || 0);
      const bStart = toMinutes(b.time);
      const bEnd = bStart + Number(b.duration || 0);
      const overlaps = !(aEnd <= bStart || aStart >= bEnd);
      if (overlaps && a.therapistId === b.therapistId) conflicts.push({ a, b, reason: "אותה מטפלת" });
      else if (overlaps) conflicts.push({ a, b, reason: "חפיפת זמן" });
    }
  }
  return conflicts;
}

function openForm(resource, id = null, defaults = {}) {
  const row = id ? state.data[resource].find((item) => item.id === id) : defaults;
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="entityForm">
      <div class="modal-head"><h3>${id ? "עריכת" : "הוספת"} ${pageLabel(resource) || ""}</h3><button type="button" class="btn ghost" id="closeModal">סגירה</button></div>
      <div class="modal-body">${formFieldsHe(resource, row || {})}</div>
      <div class="modal-foot"><button class="btn">שמירה</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  const clientSearch = document.querySelector("[data-client-search]");
  if (clientSearch) clientSearch.addEventListener("input", () => syncClientSearch(document.getElementById("entityForm"), false));
  document.getElementById("entityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (!syncClientSearch(event.currentTarget)) return;
      const body = formPayload(resource, Object.fromEntries(new FormData(event.currentTarget)));
      delete body.clientSearch;
      await api(`/api/${resource}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body });
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
      const message = localizedError(err);
      document.getElementById("formError").textContent = message;
      showCenterError(message);
    }
  });
}

roleLabel = function (role) {
  const he = state.lang === "he";
  const map = he
    ? { admin: "מנהל", reception: "קבלה", therapist: "מטפל" }
    : { admin: "مدير", reception: "استقبال", therapist: "معالج" };
  return map[role] || role;
}

function platformPageLabel(page) {
  const he = state.lang === "he";
  const labels = he
    ? { platform: "קליניקות", platformBilling: "חיוב", platformReports: "דוחות מערכת", platformHealth: "מצב מערכת" }
    : { platform: "العيادات", platformBilling: "الفوترة", platformReports: "تقارير النظام", platformHealth: "حالة النظام" };
  return labels[page] || pageLabel(page);
}

function platformPageSubtitle(page) {
  const he = state.lang === "he";
  const labels = he
    ? {
      platform: "ניהול הקליניקות, מנהלי הקליניקות, התוכניות והסטטוס",
      platformBilling: "הוצאת חשבוניות ומעקב גבייה לכל קליניקה",
      platformReports: "מדדי SaaS, שימוש, הכנסות וסטטוס מנויים",
      platformHealth: "מצב API, מסד נתונים, אחסון ומשאבי השרת",
    }
    : {
      platform: "إدارة العيادات ومديري العيادات والخطط والحالة",
      platformBilling: "إصدار الفواتير ومتابعة التحصيل لكل عيادة",
      platformReports: "مؤشرات SaaS والاستخدام والإيرادات وحالة الاشتراكات",
      platformHealth: "حالة API وقاعدة البيانات والتخزين وموارد الخادم",
    };
  return labels[page] || pageSubtitle();
}

function platformMetrics() {
  const tenants = state.data.platformTenants || [];
  const active = tenants.filter((tenant) => (tenant.subscriptionStatus || tenant.status) === "active").length;
  const trial = tenants.filter((tenant) => (tenant.subscriptionStatus || tenant.status) === "trial").length;
  const suspended = tenants.filter((tenant) => ["suspended", "cancelled", "past_due"].includes(tenant.subscriptionStatus || tenant.status)).length;
  return {
    tenants,
    active,
    trial,
    suspended,
    users: tenants.reduce((sum, tenant) => sum + Number(tenant.users || 0), 0),
    clients: tenants.reduce((sum, tenant) => sum + Number(tenant.clients || 0), 0),
    invoices: tenants.reduce((sum, tenant) => sum + Number(tenant.invoices || 0), 0),
    openBalance: tenants.reduce((sum, tenant) => sum + Number(tenant.openBalance || 0), 0),
    paidRevenue: tenants.reduce((sum, tenant) => sum + Number(tenant.paidRevenue || 0), 0),
  };
}

function formatHealthBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes < 1) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderPlatformHealth() {
  const health = state.data.platformHealth;
  const backups = state.data.platformBackups || { count: 0, latest: null, backups: [] };
  const he = state.lang === "he";
  if (!health || health.error) {
    return `<div class="card"><h3>${he ? "מצב מערכת" : "حالة النظام"}</h3><p class="alert">${escapeAttr(health?.error || (he ? "לא ניתן לטעון את מצב המערכת" : "تعذر تحميل حالة النظام"))}</p></div>`;
  }

  const good = (value) => value ? (he ? "תקין" : "سليم") : (he ? "דורש בדיקה" : "يحتاج فحص");
  const runtime = `${health.runtime.nodeVersion} · ${Math.floor(Number(health.runtime.uptimeSeconds || 0) / 60)} ${he ? "דקות" : "دقيقة"}`;
  const memory = `${formatHealthBytes(health.memory.heapUsedBytes)} / ${formatHealthBytes(health.memory.heapTotalBytes)}`;
  const latestBackup = backups.latest;
  const recentBackups = Array.isArray(backups.backups) ? backups.backups : [];
  const backupDate = latestBackup?.createdAt
    ? new Date(latestBackup.createdAt).toLocaleString(he ? "he-IL" : "ar")
    : (he ? "אין גיבויים" : "لا توجد نسخ");

  return html`
    <div class="grid stats">
      ${statCard("API", good(health.api.ok), `${health.app.name} v${health.app.version}`, health.api.ok ? "green" : "red")}
      ${statCard("DB", good(health.database.connectionOk), health.database.engine, health.database.connectionOk ? "green" : "red")}
      ${statCard("UP", good(health.storage.uploads.exists && health.storage.uploads.writable), he ? "העלאות" : "الملفات المرفوعة", health.storage.uploads.exists && health.storage.uploads.writable ? "green" : "red")}
      ${statCard("BK", good(health.storage.backups.exists && health.storage.backups.writable), he ? "גיבויים" : "النسخ الاحتياطية", health.storage.backups.exists && health.storage.backups.writable ? "green" : "red")}
      ${statCard("RT", runtime, health.app.environment, "blue")}
      ${statCard("MB", memory, `RSS ${formatHealthBytes(health.memory.rssBytes)}`, "purple")}
    </div>
    <div class="card">
      <h3>${he ? "פרטי בדיקה" : "تفاصيل الفحص"}</h3>
      <div class="stack-list">
        <div class="feature-row"><div><strong>${he ? "זמן שרת" : "وقت الخادم"}</strong><span>${escapeAttr(health.runtime.serverTime)}</span></div></div>
        <div class="feature-row"><div><strong>${he ? "סביבת הרצה" : "بيئة التشغيل"}</strong><span>${escapeAttr(health.app.environment)}</span></div></div>
        <div class="feature-row"><div><strong>${he ? "גרסת Node.js" : "إصدار Node.js"}</strong><span>${escapeAttr(health.runtime.nodeVersion)}</span></div></div>
      </div>
    </div>
    <div class="card">
      <div class="panel-head">
        <div>
          <h3>${he ? "מרכז גיבויים" : "مركز النسخ الاحتياطي"}</h3>
          <p>${he ? "יצירת גיבויי SQLite ידניים מאובטחים" : "إنشاء نسخ SQLite يدوية آمنة"}</p>
        </div>
        <button class="btn" data-platform-backup-create ${state.platformBackupCreating ? "disabled" : ""}>
          ${state.platformBackupCreating
            ? (he ? "יוצר גיבוי..." : "جار إنشاء النسخة...")
            : (he ? "יצירת גיבוי עכשיו" : "إنشاء نسخة الآن")}
        </button>
      </div>
      ${backups.error || state.platformBackupError ? `<div class="alert">${escapeAttr(state.platformBackupError || backups.error)}</div>` : ""}
      <div class="grid stats">
        ${statCard("BK", Number(backups.count || 0), he ? "מספר גיבויים" : "عدد النسخ", "blue")}
        ${statCard("LT", backupDate, he ? "גיבוי אחרון" : "آخر نسخة", latestBackup ? "green" : "gold")}
        ${statCard("MB", formatHealthBytes(latestBackup?.size), he ? "גודל גיבוי אחרון" : "حجم آخر نسخة", "purple")}
      </div>
      <div class="stack-list">
        ${recentBackups.length
          ? recentBackups.map((backup) => `<div class="feature-row"><div><strong>${escapeAttr(backup.filename)}</strong><span>${escapeAttr(new Date(backup.createdAt).toLocaleString(he ? "he-IL" : "ar"))}</span><small>${formatHealthBytes(backup.size)}</small></div></div>`).join("")
          : `<p class="muted">${he ? "לא נמצאו גיבויים" : "لم يتم العثور على نسخ احتياطية"}</p>`}
      </div>
    </div>
  `;
}

function renderPlatformClinics() {
  const he = state.lang === "he";
  const { tenants, active, users, clients } = platformMetrics();
  return html`
    <div class="grid stats">
      ${statCard("#", tenants.length, he ? "קליניקות" : "عيادات", "blue")}
      ${statCard("✓", active, he ? "פעילות" : "نشطة", "green")}
      ${statCard("#", users, he ? "משתמשים" : "مستخدمون", "purple")}
      ${statCard("#", clients, he ? "לקוחות" : "عملاء", "gold")}
    </div>
    ${platformCreateTenantCard(he)}
    <div class="card">
      <h3>${he ? "קליניקות" : "العيادات"}</h3>
      <div class="stack-list">
        ${tenants.map((tenant) => platformClinicRow(tenant, he)).join("") || `<p class="muted">${clean("noData")}</p>`}
      </div>
    </div>
  `;
}

function platformClinicRow(tenant, he) {
  const reset = state.platformPasswordReset?.tenantId === Number(tenant.id) ? state.platformPasswordReset : null;
  return html`<div class="feature-row platform-tenant-row">
    <div>
      <strong>${escapeHtml(tenant.name)}</strong>
      <span>${escapeHtml(tenant.slug)} · ${escapeHtml(tenant.billingEmail || "-")} · ${escapeHtml(tenant.domains?.[0]?.domain || "-")}</span>
      <small>${he ? "משתמשים" : "مستخدمون"}: ${escapeHtml(tenant.users || 0)} · ${he ? "לקוחות" : "عملاء"}: ${escapeHtml(tenant.clients || 0)} · ${he ? "תוכנית" : "الخطة"}: ${escapeHtml(planNameLabel(tenant.subscriptionPlan || tenant.plan))}</small>
    </div>
    <form class="inline-form" data-platform-tenant-form="${tenant.id}">
      <select name="plan">
        ${["starter", "growth", "scale"].map((plan) => `<option value="${plan}" ${plan === (tenant.subscriptionPlan || tenant.plan) ? "selected" : ""}>${planNameLabel(plan)}</option>`).join("")}
      </select>
      <select name="status">
        ${["trial", "active", "past_due", "suspended", "cancelled"].map((status) => `<option value="${status}" ${status === (tenant.subscriptionStatus || tenant.status) ? "selected" : ""}>${subscriptionStatusLabel(status)}</option>`).join("")}
      </select>
      <label class="inline-check"><span>${he ? "יום חיוב" : "يوم الفوترة"}</span><input name="billingDay" type="number" min="1" max="31" value="${tenant.billingDay || 1}" title="${he ? "יום חיוב חודשי" : "يوم الفوترة الشهري"}"></label>
      <label class="inline-check"><input type="checkbox" name="autoBillingEnabled" value="true" ${Number(tenant.autoBillingEnabled || 0) ? "checked" : ""}> <span>${he ? "חיוב חודשי אוטומטי" : "فوترة شهرية تلقائية"}</span></label>
      <button class="btn secondary">${he ? "עדכון" : "تحديث"}</button>
    </form>
    <form class="inline-form platform-password-form" data-platform-password-form="${tenant.id}">
      <strong>${he ? "איפוס סיסמת מנהל" : "تصفير كلمة مرور المدير"}</strong>
      <input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="${he ? "סיסמה חדשה" : "كلمة مرور جديدة"}" required>
      <button class="btn danger">${he ? "איפוס" : "تصفير"}</button>
      ${reset ? `<span class="pill done">${he ? "עודכן" : "تم التحديث"}: ${escapeHtml(reset.owner?.username || reset.owner?.email || "")}</span>` : ""}
    </form>
    <div class="actions">
      <button class="btn danger" data-platform-tenant-deactivate="${escapeAttr(tenant.id)}" ${Number(tenant.id) === 1 ? "disabled" : ""}>${he ? "השבתת מרפאה" : "تعطيل العيادة"}</button>
    </div>
  </div>`;
}

function renderPlatformBilling() {
  const he = state.lang === "he";
  const { tenants, invoices, openBalance, paidRevenue } = platformMetrics();
  const invoiceRows = filteredPlatformInvoices();
  const overdue = allPlatformInvoices().filter((invoice) => ["draft", "open", "uncollectible"].includes(invoice.status) && invoice.dueAt && invoice.dueAt < new Date().toISOString().slice(0, 10)).length;
  return html`
    <div class="grid stats">
      ${statCard("#", invoices, he ? "חשבוניות" : "فواتير", "blue")}
      ${statCard("$", `${openBalance.toLocaleString()} USD`, he ? "יתרה פתוחה" : "رصيد مفتوح", "gold")}
      ${statCard("$", `${paidRevenue.toLocaleString()} USD`, he ? "הכנסות ששולמו" : "إيرادات مدفوعة", "green")}
      ${statCard("!", overdue, he ? "חשבוניות באיחור" : "فواتير متأخرة", overdue ? "red" : "green")}
    </div>
    ${platformBillingToolbar(he)}
    ${platformAutoBillingPanel(he)}
    <div class="card">
      <h3>${he ? "כל החשבוניות" : "كل الفواتير"}</h3>
      ${renderPlatformInvoiceTable(invoiceRows, he)}
    </div>
    <div class="card">
      <h3>${he ? "חיוב לפי קליניקה" : "الفوترة حسب العيادة"}</h3>
      <div class="stack-list">
        ${tenants.map((tenant) => html`<div class="feature-row platform-tenant-row">
          <div>
            <strong>${escapeHtml(tenant.name)}</strong>
            <span>${escapeHtml(tenant.billingEmail || "-")} · ${he ? "חשבוניות" : "فواتير"}: ${escapeHtml(tenant.invoices || 0)}</span>
            <small>${he ? "יתרה פתוחה" : "رصيد مفتوح"}: ${Number(tenant.openBalance || 0).toLocaleString()} · ${he ? "שולם" : "مدفوع"}: ${Number(tenant.paidRevenue || 0).toLocaleString()}</small>
          </div>
          ${platformTenantBillingPanel(tenant, he)}
        </div>`).join("") || `<p class="muted">${clean("noData")}</p>`}
      </div>
    </div>
  `;
}

function platformAutoBillingPanel(he) {
  const result = state.platformBillingRun;
  return html`<div class="card">
    <h3>${he ? "חיוב חודשי אוטומטי" : "الفوترة الشهرية التلقائية"}</h3>
    <form id="platformAutoBillingForm" class="inline-form">
      <input name="runDate" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <button class="btn">${he ? "הפעלת חיוב עכשיו" : "تشغيل الفوترة الآن"}</button>
    </form>
    <p class="muted">${he ? "המערכת יוצרת חשבונית פעם בחודש לפי יום החיוב שמוגדר בכל קליניקה פעילה." : "ينشئ النظام فاتورة مرة كل شهر حسب يوم الفوترة المحدد لكل عيادة نشطة."}</p>
    ${result ? `<div class="alert success">${he ? "נוצרו" : "تم إنشاء"} ${result.created.length} ${he ? "חשבוניות" : "فواتير"} · ${he ? "דולגו" : "تم تخطي"} ${result.skipped.length}</div>` : ""}
  </div>`;
}

function renderPlatformReports() {
  const he = state.lang === "he";
  const metrics = platformMetrics();
  const planCounts = metrics.tenants.reduce((acc, tenant) => {
    const plan = tenant.subscriptionPlan || tenant.plan || "starter";
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {});
  const heads = he ? ["קליניקה", "סטטוס", "תוכנית", "משתמשים", "לקוחות", "חשבוניות", "יתרה פתוחה"] : ["العيادة", "الحالة", "الخطة", "مستخدمون", "عملاء", "فواتير", "رصيد مفتوح"];
  return html`
    <div class="grid stats">
      ${statCard("#", metrics.tenants.length, he ? "סה״כ קליניקות" : "إجمالي العيادات", "blue")}
      ${statCard("✓", metrics.active, he ? "מנויים פעילים" : "اشتراكات نشطة", "green")}
      ${statCard("!", metrics.suspended, he ? "דורשות טיפול" : "تحتاج متابعة", metrics.suspended ? "red" : "green")}
      ${statCard("$", `${metrics.paidRevenue.toLocaleString()} USD`, he ? "הכנסות" : "الإيرادات", "gold")}
    </div>
    <div class="feature-grid">
      <div class="card">
        <h3>${he ? "חלוקה לפי תוכנית" : "التوزيع حسب الخطة"}</h3>
        <div class="stack-list">
          ${["starter", "growth", "scale"].map((plan) => `<div class="feature-row"><div><strong>${planNameLabel(plan)}</strong><span>${planCounts[plan] || 0}</span></div></div>`).join("")}
        </div>
      </div>
      <div class="card">
        <h3>${he ? "סטטוס מנויים" : "حالة الاشتراكات"}</h3>
        <div class="stack-list">
          <div class="feature-row"><div><strong>${subscriptionStatusLabel("active")}</strong><span>${metrics.active}</span></div></div>
          <div class="feature-row"><div><strong>${subscriptionStatusLabel("trial")}</strong><span>${metrics.trial}</span></div></div>
          <div class="feature-row"><div><strong>${he ? "דורשות טיפול" : "تحتاج متابعة"}</strong><span>${metrics.suspended}</span></div></div>
        </div>
      </div>
    </div>
    ${cleanTable(heads, metrics.tenants, (tenant) => [
      tenant.name,
      subscriptionStatusLabel(tenant.subscriptionStatus || tenant.status),
      planNameLabel(tenant.subscriptionPlan || tenant.plan),
      tenant.users || 0,
      tenant.clients || 0,
      tenant.invoices || 0,
      Number(tenant.openBalance || 0).toLocaleString(),
    ])}
  `;
}

renderPage = function () {
  if (state.user?.platformOwner) {
    if (state.page === "platformBilling") return renderPlatformBilling();
    if (state.page === "platformReports") return renderPlatformReports();
    return renderPlatformClinics();
  }
  if (state.page === "dashboard") return renderDashboardHe();
  if (state.page === "calendar") return renderCalendarHe();
  if (state.page === "appointments") return renderAppointmentsHe();
  if (state.page === "clients") return renderClientsHe();
  if (state.page === "crm") return renderCrm();
  if (state.page === "billing") return renderBilling();
  if (state.page === "whatsapp") return renderWhatsApp();
  if (state.page === "consents") return renderConsents();
  if (state.page === "feedback") return renderFeedback();
  if (state.page === "gifts") return renderGifts();
  if (state.page === "categories") return renderCategoriesHe();
  if (state.page === "services") return renderServicesHe();
  if (state.page === "users") return renderTeamUsers();
  if (state.page === "reports") return renderReports();
  if (state.page === "audit") return renderAudit();
  if (state.page === "settings") return renderSettingsClean();
  return "";
}

pageLabel = function (page) {
  if (state.user?.platformOwner && ["platform", "platformBilling", "platformReports"].includes(page)) return platformPageLabel(page);
  return clean(`labels.${page}`) === `labels.${page}` ? page : clean(`labels.${page}`);
}

pageSubtitle = function () {
  if (state.user?.platformOwner && ["platform", "platformBilling", "platformReports"].includes(state.page)) return platformPageSubtitle(state.page);
  const value = clean(`subtitles.${state.page}`);
  return value === `subtitles.${state.page}` ? "" : value;
}

renderApp = function () {
  const nav = state.user.platformOwner ? ["platform", "platformBilling", "platformReports"] : (navByRole[state.user.role] || []);
  if (!nav.includes(state.page)) state.page = nav[0] || "dashboard";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  mount(html`<div class="shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="${logoSrc()}" alt="Clinova"><div><h3>Clinova</h3><div style="opacity:.75;font-size:12px">${state.user.platformOwner ? clean("platformSystem") : clean("system")}</div><div class="app-version">v${APP_VERSION}</div></div></div><nav class="nav">${nav.map((page) => `<button data-page="${page}" class="${state.page === page ? "active" : ""}">${pageLabel(page)}</button>`).join("")}</nav><div class="user-box"><strong>${state.user.name}</strong><span style="opacity:.75">${roleLabel(state.user.role)}</span><button class="btn ghost" id="logoutBtn" style="color:white;border-color:rgba(255,255,255,.35)">${clean("logout")}</button></div></aside><main class="main"><header class="topbar"><div><h2>${pageLabel(state.page)}</h2><div class="muted page-subtitle">${pageSubtitle()}</div></div><div class="topbar-actions">${languagePicker()}${renderQuickSearchLive()}${topActionI18n()}</div></header><section class="content">${renderPage()}</section></main></div><div id="modalRoot"></div>`);
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    renderLogin();
  });
  bindPageActions();
}

renderLogin = function (error = "") {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  const he = state.lang === "he";
  mount(html`
    <main class="login">
      <form class="login-card" id="loginForm">
        <div class="brand">
          <img class="brand-logo" src="${logoSrc()}" alt="Clinova">
          <div><h1>Clinova</h1><div class="muted">${he ? "מערכת ניהול קליניקה" : "نظام إدارة العيادة"}</div></div>
        </div>
        ${error ? `<div class="alert">${error}</div>` : ""}
        <div class="field"><label>${he ? "שם משתמש" : "اسم المستخدم"}</label><input name="username" autocomplete="username" required></div>
        <div class="field"><label>${he ? "סיסמה" : "كلمة المرور"}</label><input name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn" style="width:100%">${he ? "כניסה" : "دخول"}</button>
        <div class="version-badge">v${APP_VERSION}</div>
      </form>
    </main>
  `);
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/login", { method: "POST", body: form });
      state.user = result.user;
      await loadData();
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function renderAcceptInvitation(token, error = "") {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  let invitation = null;
  try {
    invitation = (await api(`/api/invitations/${encodeURIComponent(token)}`)).invitation;
  } catch (err) {
    mount(html`
      <main class="login">
        <div class="login-card">
          <div class="brand"><img class="brand-logo" src="/logo.svg" alt="Clinova"><div><h1>Clinova</h1><div class="muted">Invitation</div></div></div>
          <div class="alert">${escapeHtml(err.message)}</div>
          <button class="btn" type="button" id="backToLogin">Back to login</button>
        </div>
      </main>
    `);
    document.getElementById("backToLogin").addEventListener("click", () => {
      history.replaceState({}, "", location.pathname);
      renderLogin();
    });
    return;
  }
  mount(html`
    <main class="login">
      <form class="login-card" id="acceptInviteForm">
        <div class="brand">
          <img class="brand-logo" src="/logo.svg" alt="Clinova">
          <div><h1>Clinova</h1><div class="muted">${escapeHtml(invitation.clinicName || "")}</div></div>
        </div>
        ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}
        <div class="invite-summary">
          <strong>${escapeHtml(invitation.name)}</strong>
          <span>${escapeHtml(invitation.email)}</span>
          <span>${escapeHtml(roleLabel(invitation.role))}</span>
        </div>
        <div class="field"><label>סיסמה חדשה</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div>
        <button class="btn" style="width:100%">הפעלת החשבון</button>
      </form>
    </main>
  `);
  document.getElementById("acceptInviteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: form });
      state.user = result.user;
      history.replaceState({}, "", location.pathname);
      await loadData();
      renderApp();
    } catch (err) {
      renderAcceptInvitation(token, err.message);
    }
  });
}

async function openClientProfile(id) {
  const data = await api(`/api/clients/${id}/history`);
  const canWrite = state.user.role !== "therapist";
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal">
      <div class="modal-card wide">
        <div class="modal-head"><h3>תיק לקוח - ${data.client ? `${data.client.fname} ${data.client.lname}` : ""}</h3><button type="button" class="btn ghost" id="closeModal">סגירה</button></div>
        <div class="modal-body client-profile">
          <div class="card mini"><strong>טלפון</strong><span>${data.client?.phone || "-"}</span></div>
          <div class="card mini"><strong>אימייל</strong><span>${data.client?.email || "-"}</span></div>
          <div class="card mini"><strong>הערות</strong><span>${data.client?.notes || "-"}</span></div>
          <div class="profile-section"><h4>היסטוריית ביקורים</h4>${appointmentTable(data.appointments || [], false)}</div>
          <div class="profile-section">
            <h4>קבצים ותמונות לקוח</h4>
            ${(data.files || []).map((file) => `<div class="file-row"><a href="${file.url}" target="_blank" rel="noopener">${file.name}</a><span>${file.notes || file.originalName || ""}</span><small>${file.size ? `${Math.round(file.size / 1024)}KB` : ""}</small>${canWrite ? `<button class="btn danger" data-delete-file="${file.id}" data-client="${id}">מחיקה</button>` : ""}</div>`).join("") || `<p class="muted">אין קבצים</p>`}
            ${canWrite ? `<form id="clientFileForm" class="inline-form upload-form"><input name="name" placeholder="שם הקובץ"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><input name="notes" placeholder="הערה"><button class="btn">העלאה</button></form><div class="muted upload-hint">JPG, PNG, WEBP, PDF · עד 10MB</div>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  const fileForm = document.getElementById("clientFileForm");
  if (fileForm) fileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api(`/api/clients/${id}/files`, { method: "POST", body: new FormData(fileForm) });
    openClientProfile(id);
  });
  document.querySelectorAll("[data-delete-file]").forEach((button) => button.addEventListener("click", async () => {
    await api(`/api/client-files/${button.dataset.deleteFile}`, { method: "DELETE" });
    openClientProfile(Number(button.dataset.client));
  }));
}

function printReceipt(id) {
  const rawAppointment = state.data.appointments.find((item) => item.id === id);
  if (!rawAppointment) return;
  const a = Object.fromEntries(Object.entries(rawAppointment).map(([key, value]) => [key, escapeHtml(value)]));
  const settings = Object.fromEntries(Object.entries(state.data.settings || {}).map(([key, value]) => [key, escapeAttribute(value)]));
  const paid = Number(a.paidAmount || 0);
  const total = Number(a.price || 0);
  const win = window.open("", "_blank", "width=720,height=820");
  win.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>קבלה</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#102220}.receipt{max-width:560px;margin:auto;border:1px solid #d8e6e1;border-radius:12px;padding:28px}img{width:70px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #eef3f1;padding:10px 0}.total{font-size:20px;font-weight:700}</style></head><body><div class="receipt"><img src="${settings.logoUrl || "/logo.svg"}"><h1>${settings.clinicName || "Clinova"}</h1><h2>חשבונית / קבלה</h2><div class="row"><span>לקוח</span><strong>${a.clientName}</strong></div><div class="row"><span>שירות</span><strong>${a.serviceName}</strong></div><div class="row"><span>תאריך</span><strong>${a.date} ${a.time}</strong></div><div class="row"><span>מצב תשלום</span><strong>${paymentLabel[a.paymentStatus || "unpaid"]}</strong></div><div class="row total"><span>סה״כ</span><strong>${currency()}${total.toLocaleString()}</strong></div><div class="row"><span>שולם</span><strong>${currency()}${paid.toLocaleString()}</strong></div><div class="row"><span>יתרה</span><strong>${currency()}${Math.max(total - paid, 0).toLocaleString()}</strong></div></div><script>print();</script></body></html>`);
  win.document.close();
}

function printGift(id) {
  const rawGift = (state.data.giftCards || []).find((item) => item.id === id);
  if (!rawGift) return;
  const gift = Object.fromEntries(Object.entries(rawGift).map(([key, value]) => [key, escapeHtml(value)]));
  const settings = Object.fromEntries(Object.entries(state.data.settings || {}).map(([key, value]) => [key, escapeAttribute(value)]));
  const win = window.open("", "_blank", "width=720,height=820");
  win.document.write(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Gift</title><style>body{font-family:Arial,sans-serif;background:#f6faf8;padding:30px}.gift{max-width:520px;margin:auto;border:1px solid #d8e6e1;border-radius:18px;background:white;padding:34px;text-align:center;box-shadow:0 18px 50px rgba(45,106,79,.18)}h1{color:#2d6a4f}.code{font-size:22px;letter-spacing:2px;border:1px dashed #2d6a4f;border-radius:12px;padding:14px;margin:18px 0}</style></head><body><div class="gift"><img src="${settings.logoUrl || "/logo.svg"}" width="76"><h1>${settings.clinicName || "Clinova"}</h1><h2>כרטיס מתנה</h2><p>${gift.toClientName || ""}</p><h3>${gift.serviceName || ""}</h3><strong>${gift.sessions || 1} מפגשים</strong><div class="code">${gift.code}</div><p>${gift.message || ""}</p></div><script>print();</script></body></html>`);
  win.document.close();
}

function workDaysPicker(value) {
  const selected = new Set(selectedWorkDays(value || "[0,1,2,3,4,5]"));
  const days = state.lang === "he"
    ? [["0", "ראשון"], ["1", "שני"], ["2", "שלישי"], ["3", "רביעי"], ["4", "חמישי"], ["5", "שישי"], ["6", "שבת"]]
    : [["0", "الأحد"], ["1", "الإثنين"], ["2", "الثلاثاء"], ["3", "الأربعاء"], ["4", "الخميس"], ["5", "الجمعة"], ["6", "السبت"]];
  return `<div class="work-days">${days.map(([id, label]) => `<label><input type="checkbox" name="workDay" value="${id}" ${selected.has(Number(id)) ? "checked" : ""}> <span>${label}</span></label>`).join("")}</div>`;
}

const cleanI18n = {
  ar: {
    system: "إدارة العيادة",
    platformSystem: "إدارة المنصة",
    language: "اللغة",
    logout: "خروج",
    add: "إضافة",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ",
    close: "إغلاق",
    noData: "لا توجد بيانات",
    quickSearch: "بحث سريع...",
    actions: "إجراءات",
    yes: "نعم",
    no: "لا",
    labels: {
      platform: "العيادات",
      platformBilling: "الفوترة",
      platformReports: "تقارير النظام",
      platformHealth: "حالة النظام",
      dashboard: "لوحة التحكم",
      calendar: "اليوم",
      appointments: "المواعيد",
      clients: "العملاء",
      crm: "إدارة العملاء",
      whatsapp: "WhatsApp",
      consents: "الإقرارات القانونية",
      feedback: "آراء العملاء",
      gifts: "الهدايا",
      categories: "الأقسام",
      services: "الخدمات",
      users: "المستخدمون",
      reports: "التقارير",
      audit: "سجل النشاط",
      settings: "الإعدادات",
      billing: "الفواتير",
    },
    subtitles: {
      platform: "إدارة العيادات ومديري العيادات والخطط والحالة",
      platformBilling: "إصدار الفواتير ومتابعة التحصيل لكل عيادة",
      platformReports: "مؤشرات SaaS والاستخدام والإيرادات وحالة الاشتراكات",
      platformHealth: "حالة API وقاعدة البيانات والتخزين وموارد الخادم",
      dashboard: "نظرة سريعة على نشاط العيادة اليوم",
      calendar: "عرض المواعيد حسب اليوم",
      appointments: "إدارة المواعيد والحضور والدفع",
      clients: "ملفات العملاء وبيانات التواصل",
      crm: "متابعة العملاء والمهام",
      whatsapp: "قوالب WhatsApp وسجل الرسائل",
      users: "فريق العمل والصلاحيات",
      reports: "تقارير الأداء والإيرادات",
      audit: "آخر النشاطات داخل النظام",
      settings: "إعدادات العيادة والحساب",
    },
    roles: { admin: "مدير", reception: "استقبال", therapist: "معالج" },
    status: { pending: "قيد الانتظار", done: "تم", cancelled: "ملغي", open: "مفتوح", paid: "مدفوعة", void: "ملغاة" },
    payment: { unpaid: "غير مدفوع", paid: "مدفوع", deposit: "عربون" },
    table: { date: "التاريخ", time: "الوقت", client: "العميل", service: "الخدمة", therapist: "المعالج", price: "السعر", payment: "الدفع", status: "الحالة" },
  },
  he: {
    system: "ניהול קליניקה",
    platformSystem: "ניהול המערכת",
    language: "שפה",
    logout: "יציאה",
    add: "הוספה",
    edit: "עריכה",
    delete: "מחיקה",
    save: "שמירה",
    close: "סגירה",
    noData: "אין נתונים",
    quickSearch: "חיפוש מהיר...",
    actions: "פעולות",
    yes: "כן",
    no: "לא",
    labels: {
      platform: "קליניקות",
      platformBilling: "חיוב",
      platformReports: "דוחות מערכת",
      platformHealth: "מצב מערכת",
      dashboard: "לוח בקרה",
      calendar: "יומן",
      appointments: "תורים",
      clients: "לקוחות",
      crm: "קשרי לקוחות",
      whatsapp: "WhatsApp",
      consents: "טפסים משפטיים",
      feedback: "משוב לקוחות",
      gifts: "מתנות",
      categories: "קטגוריות",
      services: "שירותים",
      users: "משתמשים",
      reports: "דוחות",
      audit: "יומן פעילות",
      settings: "הגדרות",
      billing: "חשבוניות",
    },
    subtitles: {
      platform: "ניהול הקליניקות, מנהלי הקליניקות, התוכניות והסטטוס",
      platformBilling: "הוצאת חשבוניות ומעקב גבייה לכל קליניקה",
      platformReports: "מדדי SaaS, שימוש, הכנסות וסטטוס מנויים",
      platformHealth: "מצב API, מסד נתונים, אחסון ומשאבי השרת",
      dashboard: "מבט מהיר על פעילות הקליניקה היום",
      calendar: "תצוגת תורים לפי יום",
      appointments: "ניהול תורים, סטטוס ותשלום",
      clients: "תיקי לקוחות ופרטי קשר",
      crm: "מעקב לקוחות ומשימות",
      whatsapp: "תבניות WhatsApp ויומן הודעות",
      users: "צוות והרשאות",
      reports: "דוחות ביצועים והכנסות",
      audit: "פעולות אחרונות במערכת",
      settings: "הגדרות קליניקה וחשבון",
    },
    roles: { admin: "מנהל", reception: "קבלה", therapist: "מטפל" },
    status: { pending: "ממתין", done: "בוצע", cancelled: "בוטל", open: "פתוחה", paid: "שולמה", void: "מבוטלת" },
    payment: { unpaid: "לא שולם", paid: "שולם", deposit: "מקדמה" },
    table: { date: "תאריך", time: "שעה", client: "לקוח", service: "שירות", therapist: "מטפל", price: "מחיר", payment: "תשלום", status: "סטטוס" },
  },
  en: {
    system: "Clinic management",
    platformSystem: "Platform administration",
    language: "Language",
    logout: "Sign out",
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    close: "Close",
    noData: "No data",
    quickSearch: "Quick search...",
    actions: "Actions",
    yes: "Yes",
    no: "No",
    labels: {
      platform: "Clinics",
      platformBilling: "Billing",
      platformReports: "Platform reports",
      platformHealth: "System health",
      dashboard: "Dashboard",
      calendar: "Calendar",
      appointments: "Appointments",
      clients: "Patients",
      crm: "Patient relations",
      whatsapp: "WhatsApp",
      consents: "Legal forms",
      feedback: "Feedback",
      gifts: "Gifts",
      categories: "Categories",
      services: "Treatments",
      users: "Team",
      reports: "Reports",
      audit: "Activity log",
      settings: "Settings",
      billing: "Finances",
    },
    subtitles: {
      dashboard: "A quick view of today's clinic activity",
      calendar: "Appointments by day",
      appointments: "Appointments, attendance, and payment",
      clients: "Patient records and contact details",
      crm: "Patient follow-up and tasks",
      whatsapp: "WhatsApp templates and message log",
      users: "Team and permissions",
      reports: "Performance and revenue reports",
      audit: "Recent system activity",
      settings: "Clinic and account settings",
    },
    roles: { admin: "Administrator", reception: "Reception", therapist: "Therapist" },
    status: { pending: "Pending", done: "Completed", cancelled: "Cancelled", open: "Open", paid: "Paid", void: "Void" },
    payment: { unpaid: "Unpaid", paid: "Paid", deposit: "Deposit" },
    table: { date: "Date", time: "Time", client: "Patient", service: "Treatment", therapist: "Therapist", price: "Price", payment: "Payment", status: "Status" },
  },
};

function clean(key) {
  return key.split(".").reduce((obj, part) => obj?.[part], cleanI18n[state.lang]) ?? key;
}

tr = function (key) {
  return clean(key);
}

pageLabel = function (page) {
  return clean(`labels.${page}`) === `labels.${page}` ? page : clean(`labels.${page}`);
}

pageSubtitle = function () {
  const value = clean(`subtitles.${state.page}`);
  return value === `subtitles.${state.page}` ? "" : value;
}

yesNo = function (value) {
  return value ? clean("yes") : clean("no");
}

roleLabel = function (role) {
  return clean(`roles.${role}`) === `roles.${role}` ? role : clean(`roles.${role}`);
}

function cleanStatusLabel(status) {
  return clean(`status.${status}`) === `status.${status}` ? status : clean(`status.${status}`);
}

function cleanPaymentLabel(status) {
  return clean(`payment.${status}`) === `payment.${status}` ? status : clean(`payment.${status}`);
}

languagePicker = function () {
  return `<label class="language-picker"><span>${clean("language")}</span><select id="languageSelect"><option value="ar" ${state.lang === "ar" ? "selected" : ""}>العربية</option><option value="he" ${state.lang === "he" ? "selected" : ""}>עברית</option></select></label>`;
}

renderQuickSearchLive = function () {
  return html`<div class="quick-search"><input id="quickSearch" value="${escapeAttr(state.quickSearch)}" placeholder="${clean("quickSearch")}" autocomplete="off"><div id="quickResults" class="quick-results hidden"></div></div>`;
}

topActionI18n = function () {
  if (state.user?.platformOwner) return "";
  if (state.page === "appointments") return `<button class="btn" data-new="appointments">${state.lang === "he" ? "תור חדש" : "موعد جديد"}</button>`;
  if (state.page === "clients" && state.user.role !== "therapist") return `<button class="btn" data-new="clients">${state.lang === "he" ? "לקוח חדש" : "عميل جديد"}</button>`;
  if (["users", "categories", "services"].includes(state.page)) return `<button class="btn" data-new="${state.page}">${clean("add")}</button>`;
  return "";
}

function cleanTable(heads, rows, mapRow, actions = "") {
  return html`<div class="table-wrap responsive-table"><table><thead><tr>${heads.map((head) => `<th>${escapeHtml(head)}</th>`).join("")}${actions ? `<th>${escapeHtml(clean("actions"))}</th>` : ""}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${mapRow(row).map((cell, index) => `<td data-label="${escapeAttr(heads[index] || "")}">${renderText(cell)}</td>`).join("")}${actions ? actions(row) : ""}</tr>`).join("") : `<tr><td colspan="${heads.length + (actions ? 1 : 0)}" class="muted">${escapeHtml(clean("noData"))}</td></tr>`}</tbody></table></div>`;
}

renderDashboardHe = function () {
  const today = new Date().toISOString().slice(0, 10);
  const appointments = state.data.appointments || [];
  const clients = state.data.clients || [];
  const todayRows = appointments.filter((item) => item.date === today);
  const doneRows = appointments.filter((item) => item.status === "done");
  const revenue = doneRows.reduce((sum, item) => sum + Number(item.price || 0), 0);
  return html`<div class="grid stats">
    ${statCard("#", todayRows.length, state.lang === "he" ? "תורים היום" : "مواعيد اليوم", "blue")}
    ${statCard("#", clients.length, state.lang === "he" ? "לקוחות" : "عملاء", "green")}
    ${statCard("✓", doneRows.length, state.lang === "he" ? "הושלמו" : "مكتملة", "purple")}
    ${statCard("$", `${currency()}${revenue.toLocaleString()}`, state.lang === "he" ? "הכנסות" : "الإيرادات", "gold")}
  </div><div class="card"><h3>${state.lang === "he" ? "התורים הקרובים" : "المواعيد القريبة"}</h3>${appointmentTableClean(todayRows.slice(0, 8), true)}</div>`;
}

function appointmentTableClean(rows, actions = true) {
  const heads = [clean("table.date"), clean("table.time"), clean("table.client"), clean("table.service"), clean("table.therapist"), clean("table.payment"), clean("table.status")];
  return cleanTable(heads, rows, (a) => [a.date, a.time, a.clientName, a.serviceName, a.therapistName, cleanPaymentLabel(a.paymentStatus || "unpaid"), cleanStatusLabel(a.status)], actions ? (a) => `<td class="actions"><button class="btn secondary" data-edit="appointments" data-id="${a.id}">${clean("edit")}</button>${state.user.role === "admin" ? `<button class="btn danger" data-delete="appointments" data-id="${a.id}">${clean("delete")}</button>` : ""}</td>` : "");
}

function calendarDateObj(dateText = state.calendarDate) {
  return new Date(`${dateText || new Date().toISOString().slice(0, 10)}T00:00:00`);
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function moveCalendarDate(direction) {
  const date = calendarDateObj();
  if (state.calendarView === "month") date.setMonth(date.getMonth() + direction);
  else if (state.calendarView === "week") date.setDate(date.getDate() + direction * 7);
  else date.setDate(date.getDate() + direction);
  state.calendarDate = isoDate(date);
}

function calendarRangeTitle() {
  const he = state.lang === "he";
  const base = calendarDateObj();
  if (state.calendarView === "day") return base.toLocaleDateString(he ? "he-IL" : "ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  if (state.calendarView === "week") {
    const start = weekStart(base);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString(he ? "he-IL" : "ar")} - ${end.toLocaleDateString(he ? "he-IL" : "ar")}`;
  }
  return base.toLocaleDateString(he ? "he-IL" : "ar", { year: "numeric", month: "long" });
}

function weekStart(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function calendarDays() {
  const base = calendarDateObj();
  if (state.calendarView === "day") return [base];
  if (state.calendarView === "week") {
    const start = weekStart(base);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function calendarTherapists() {
  const users = (state.data.users || []).filter((user) => user.active !== false && ["admin", "therapist"].includes(user.role));
  return users.length ? users : [state.user];
}

function appointmentsFor(dateText, therapistId = "") {
  return (state.data.appointments || [])
    .filter((appointment) => appointment.date === dateText && (!therapistId || Number(appointment.therapistId) === Number(therapistId)))
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

function clinicWorkStart() {
  return (state.data.settings?.workStart || "09:00").slice(0, 5);
}

function clinicWorkEnd() {
  return (state.data.settings?.workEnd || "18:00").slice(0, 5);
}

function calendarHours() {
  const start = toMinutes(clinicWorkStart());
  const end = Math.max(start + 60, toMinutes(clinicWorkEnd()));
  const hours = [];
  for (let minutes = start; minutes < end; minutes += 60) {
    hours.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return hours;
}

function calendarAppointmentChip(appointment) {
  const statusClass = ["pending", "done", "cancelled"].includes(appointment.status) ? appointment.status : "pending";
  return `<button type="button" class="calendar-event ${statusClass}" data-edit="appointments" data-id="${escapeAttr(appointment.id)}">
    <strong>${escapeHtml(appointment.time || "")} ${escapeHtml(appointment.clientName || "-")}</strong>
    <span>${escapeHtml(appointment.serviceName || "")}</span>
  </button>`;
}

function renderMonthCalendar(days, he) {
  const base = calendarDateObj();
  const weekDays = he ? ["א", "ב", "ג", "ד", "ה", "ו", "ש"] : ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return html`<div class="calendar-month">
    ${weekDays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
    ${days.map((date) => {
      const dateText = isoDate(date);
      const rows = appointmentsFor(dateText);
      return `<div class="calendar-day ${date.getMonth() !== base.getMonth() ? "outside" : ""}" data-calendar-new data-calendar-date="${dateText}">
        <div class="calendar-day-head"><strong>${date.getDate()}</strong><span>${rows.length || ""}</span></div>
        <div class="calendar-events">${rows.slice(0, 4).map(calendarAppointmentChip).join("")}${rows.length > 4 ? `<small>+${rows.length - 4}</small>` : ""}</div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderWeekCalendar(days, therapists, he) {
  return html`<div class="calendar-week">
    <div class="calendar-corner">${he ? "צוות" : "الفريق"}</div>
    ${days.map((date) => `<div class="calendar-weekday strong">${date.toLocaleDateString(he ? "he-IL" : "ar", { weekday: "short", day: "numeric" })}</div>`).join("")}
    ${therapists.map((user) => `<div class="calendar-resource"><strong>${escapeHtml(user.name || user.username)}</strong><span>${escapeHtml(roleLabel(user.role))}</span></div>
      ${days.map((date) => {
        const dateText = isoDate(date);
        const rows = appointmentsFor(dateText, user.id);
        return `<div class="calendar-slot" data-calendar-new data-calendar-date="${dateText}" data-therapist-id="${user.id}">
          ${rows.map(calendarAppointmentChip).join("") || `<span class="muted">${he ? "פנוי" : "متاح"}</span>`}
        </div>`;
      }).join("")}`).join("")}
  </div>`;
}

function renderDayCalendar(days, therapists, he) {
  const dateText = isoDate(days[0]);
  const hours = calendarHours();
  return html`<div class="calendar-day-board">
    <div class="calendar-corner">${he ? "שעה" : "الوقت"}</div>
    ${therapists.map((user) => `<div class="calendar-resource header"><strong>${escapeHtml(user.name || user.username)}</strong><span>${escapeHtml(roleLabel(user.role))}</span></div>`).join("")}
    ${hours.map((time) => `<div class="calendar-hour">${time}</div>
      ${therapists.map((user) => {
        const rows = appointmentsFor(dateText, user.id).filter((appointment) => String(appointment.time || "").slice(0, 2) === time.slice(0, 2));
        return `<div class="calendar-slot" data-calendar-new data-calendar-date="${dateText}" data-calendar-time="${time}" data-therapist-id="${user.id}">
          ${rows.map(calendarAppointmentChip).join("") || `<span class="muted">${he ? "לחץ להוספה" : "اضغط للإضافة"}</span>`}
        </div>`;
      }).join("")}`).join("")}
  </div>`;
}

renderAppointmentsHe = function () {
  const term = String(state.filters.appointments || "").toLowerCase();
  const status = state.filters.appointmentStatus || "all";
  const rows = (state.data.appointments || []).filter((a) => {
    const haystack = `${a.clientName || ""} ${a.serviceName || ""} ${a.therapistName || ""} ${a.date || ""}`.toLowerCase();
    return (!term || haystack.includes(term)) && (status === "all" || a.status === status);
  });
  return html`<div class="toolbar"><input data-filter="appointments" value="${escapeAttr(state.filters.appointments)}" placeholder="${state.lang === "he" ? "חיפוש בתורים..." : "بحث في المواعيد..."}"><select data-filter="appointmentStatus"><option value="all" ${status === "all" ? "selected" : ""}>${state.lang === "he" ? "כל הסטטוסים" : "كل الحالات"}</option><option value="pending" ${status === "pending" ? "selected" : ""}>${cleanStatusLabel("pending")}</option><option value="done" ${status === "done" ? "selected" : ""}>${cleanStatusLabel("done")}</option><option value="cancelled" ${status === "cancelled" ? "selected" : ""}>${cleanStatusLabel("cancelled")}</option></select></div>${appointmentTableClean(rows)}`;
}

renderCalendarHe = function () {
  state.calendarView = ["day", "week"].includes(state.calendarView) ? state.calendarView : "week";
  state.calendarDate = state.calendarDate || new Date().toISOString().slice(0, 10);
  return renderAppointmentWorkspace({
    language: state.lang,
    date: state.calendarDate,
    view: state.calendarView,
    appointments: state.data.appointments || [],
    queue: state.appointmentWorkspace.queue || [],
    users: state.data.users || [],
    services: state.data.services || [],
    filters: state.appointmentWorkspace.filters,
    settings: state.data.settings || {},
    status: state.appointmentWorkspace.status,
    error: state.appointmentWorkspace.error,
  });
}

renderClientsHe = function () {
  const term = String(state.filters.clients || "").toLowerCase();
  const rows = (state.data.clients || []).filter((client) => `${client.fname || ""} ${client.lname || ""} ${client.phone || ""} ${client.email || ""}`.toLowerCase().includes(term));
  const heads = [state.lang === "he" ? "שם" : "الاسم", state.lang === "he" ? "טלפון" : "الهاتف", state.lang === "he" ? "אימייל" : "البريد", state.lang === "he" ? "שלב" : "المرحلة"];
  return html`<div class="toolbar"><input data-filter="clients" value="${escapeAttr(state.filters.clients)}" placeholder="${state.lang === "he" ? "חיפוש לקוח..." : "بحث عن عميل..."}"></div>${cleanTable(heads, rows, (c) => [`${c.fname || ""} ${c.lname || ""}`, c.phone || "", c.email || "", c.stage || "-"], state.user.role !== "therapist" ? (c) => `<td class="actions"><button class="btn secondary" data-edit="clients" data-id="${c.id}">${clean("edit")}</button><button class="btn danger" data-delete="clients" data-id="${c.id}">${clean("delete")}</button></td>` : "")}`;
}

renderCategoriesHe = function () {
  return cleanTable([state.lang === "he" ? "שם קטגוריה" : "اسم القسم"], state.data.categories || [], (c) => [c.name], (c) => `<td class="actions"><button class="btn secondary" data-edit="categories" data-id="${c.id}">${clean("edit")}</button><button class="btn danger" data-delete="categories" data-id="${c.id}">${clean("delete")}</button></td>`);
}

renderServicesHe = function () {
  const heads = [state.lang === "he" ? "שם שירות" : "اسم الخدمة", state.lang === "he" ? "קטגוריה" : "القسم", state.lang === "he" ? "משך" : "المدة", state.lang === "he" ? "מחיר" : "السعر", state.lang === "he" ? "פעיל" : "فعال"];
  return cleanTable(heads, state.data.services || [], (s) => [s.name, categoryName(s.categoryId), s.duration, `${currency()}${s.price}`, yesNo(s.active)], (s) => `<td class="actions"><button class="btn secondary" data-edit="services" data-id="${s.id}">${clean("edit")}</button><button class="btn danger" data-delete="services" data-id="${s.id}">${clean("delete")}</button></td>`);
}

renderTeamUsers = function () {
  const heads = [state.lang === "he" ? "שם משתמש" : "اسم المستخدم", state.lang === "he" ? "אימייל" : "البريد", state.lang === "he" ? "שם" : "الاسم", state.lang === "he" ? "תפקיד" : "الدور", state.lang === "he" ? "פעיל" : "فعال"];
  return cleanTable(heads, state.data.users || [], (u) => [u.username, u.email || "-", u.name, roleLabel(u.role), yesNo(u.active)], (u) => `<td class="actions"><button class="btn secondary" data-edit="users" data-id="${u.id}">${clean("edit")}</button><button class="btn danger" data-delete="users" data-id="${u.id}">${clean("delete")}</button></td>`);
}

renderCrm = function () {
  const tasks = state.data.crmTasks || [];
  return html`<div class="card"><h3>${pageLabel("crm")}</h3><div class="stack-list">${tasks.map((task) => `<div class="feature-row"><div><strong>${task.title}</strong><span>${task.clientName || "-"} · ${task.dueDate || "-"}</span><small>${task.notes || ""}</small></div><span class="pill">${cleanStatusLabel(task.status || "open")}</span></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`;
}

renderWhatsApp = function () {
  const logs = state.data.messageLogs || [];
  return html`<div class="card"><h3>WhatsApp</h3><div class="stack-list">${logs.map((log) => `<div class="feature-row"><div><strong>${log.recipient || "-"}</strong><span>${log.entity || ""} #${log.entityId || ""}</span><small>${log.message || log.error || ""}</small></div><span class="pill">${log.status || "-"}</span></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`;
}

renderConsents = function () {
  return html`<div class="card"><h3>${pageLabel("consents")}</h3><div class="stack-list">${(state.data.consentTemplates || []).map((item) => `<div class="feature-row"><div><strong>${item.title}</strong><span>${item.categoryName || "-"}</span></div><a class="btn secondary" href="${item.url}" target="_blank">PDF</a></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`;
}

renderFeedback = function () {
  return html`<div class="card"><h3>${pageLabel("feedback")}</h3><div class="stack-list">${(state.data.feedbackRequests || []).map((item) => `<div class="feature-row"><div><strong>${item.clientName || "-"}</strong><span>${item.serviceName || ""}</span><small>${item.comment || ""}</small></div><span class="pill">${item.rating || "-"}</span></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`;
}

renderGifts = function () {
  return html`<div class="card"><h3>${pageLabel("gifts")}</h3><div class="stack-list">${(state.data.giftCards || []).map((item) => `<div class="feature-row"><div><strong>${item.code}</strong><span>${item.serviceName || ""}</span></div><span class="pill">${item.status || ""}</span></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`;
}

renderReports = function () {
  const done = (state.data.appointments || []).filter((a) => a.status === "done");
  const revenue = done.reduce((sum, item) => sum + Number(item.price || 0), 0);
  return html`<div class="grid stats">${statCard("#", (state.data.appointments || []).length, pageLabel("appointments"), "blue")}${statCard("#", (state.data.clients || []).length, pageLabel("clients"), "green")}${statCard("$", `${currency()}${revenue.toLocaleString()}`, state.lang === "he" ? "הכנסות" : "الإيرادات", "gold")}</div>`;
}

renderAudit = function () {
  const heads = [state.lang === "he" ? "זמן" : "الوقت", state.lang === "he" ? "משתמש" : "المستخدم", state.lang === "he" ? "פעולה" : "الإجراء", state.lang === "he" ? "نوع" : "النوع"];
  return cleanTable(heads, state.data.audits || [], (row) => [row.createdAt, row.userName || "-", row.action, row.entity]);
}

renderSettingsClean = function (message = "") {
  const s = state.data.settings || {};
  return html`<div class="settings-grid"><div class="card"><h3>${pageLabel("settings")}</h3>${message ? `<div class="alert">${message}</div>` : ""}<form id="clinicSettingsForm">${field("clinicName", state.lang === "he" ? "שם הקליניקה" : "اسم العيادة", s.clinicName || "Clinova")}${field("currency", state.lang === "he" ? "מטבע" : "العملة", s.currency || "₪")}${field("workStart", state.lang === "he" ? "תחילת יום" : "بداية الدوام", s.workStart || "09:00", "time")}${field("workEnd", state.lang === "he" ? "סיום יום" : "نهاية الدوام", s.workEnd || "18:00", "time")}<button class="btn">${clean("save")}</button></form></div></div>`;
}

function invoiceLineFields(item = {}, index = 0) {
  const services = (state.data.services || []).filter((service) => service.active !== false);
  return `<fieldset class="invoice-item-row"><legend>${uiText(`بند ${index + 1}`, `שורה ${index + 1}`, `Item ${index + 1}`)}</legend>
    <select name="serviceId${index}" ${index === 0 ? "required" : ""}><option value=""></option>${services.map((service) => `<option value="${escapeAttr(service.id)}" ${Number(item.serviceId) === Number(service.id) ? "selected" : ""}>${escapeHtml(service.name)}</option>`).join("")}</select>
    <input name="description${index}" value="${escapeAttr(item.description || "")}" placeholder="${uiText("الوصف", "תיאור", "Description")}" ${index === 0 ? "required" : ""}>
    <input name="quantity${index}" value="${escapeAttr(item.quantity || 1)}" type="number" min="1" step="1" aria-label="${uiText("الكمية", "כמות", "Quantity")}">
    <input name="unitPrice${index}" value="${escapeAttr(item.unitPrice || "")}" type="number" min="0" step="0.01" placeholder="${uiText("السعر", "מחיר", "Price")}" ${index === 0 ? "required" : ""}>
    <input name="itemDiscount${index}" value="${escapeAttr(item.discount || "0")}" type="number" min="0" step="0.01" placeholder="${uiText("خصم", "הנחה", "Discount")}">
    <input name="itemTax${index}" value="${escapeAttr(item.tax || "0")}" type="number" min="0" step="0.01" placeholder="${uiText("ضريبة", "מס", "Tax")}">
  </fieldset>`;
}

async function openPatientInvoiceForm(invoice = null, defaults = {}) {
  beginModalInteraction();
  const patients = state.data.clients || [];
  const appointments = (state.data.appointments || []).filter((appointment) => appointment.status !== "cancelled");
  const patientId = invoice?.patientId || defaults.patientId || "";
  const appointmentId = invoice?.appointmentId || defaults.appointmentId || "";
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal"><form class="modal-card wide" id="patientInvoiceForm" role="dialog" aria-modal="true" aria-labelledby="patientInvoiceTitle">
    <div class="modal-head"><h3 id="patientInvoiceTitle">${invoice ? uiText("تعديل مسودة", "עריכת טיוטה", "Edit draft") : uiText("فاتورة مريض جديدة", "חשבונית מטופל חדשה", "New patient invoice")}</h3><button class="btn ghost" type="button" id="closeModal">${clean("close")}</button></div>
    <div class="modal-body">
      ${select("patientId", uiText("المريض", "מטופל", "Patient"), patients.map((patient) => [patient.id, `${patient.fname} ${patient.lname}`]), patientId)}
      ${select("appointmentId", uiText("الموعد", "תור", "Appointment"), [["", "—"], ...appointments.map((appointment) => [appointment.id, `${appointment.date} ${appointment.time} · ${appointment.clientName} · ${appointment.serviceName}`])], appointmentId, false)}
      <div class="invoice-items full">${[0, 1, 2].map((index) => invoiceLineFields(invoice?.items?.[index] || {}, index)).join("")}</div>
      ${field("discount", uiText("خصم الفاتورة", "הנחת חשבונית", "Invoice discount"), invoice?.discount || "0", "number", false)}
      ${field("tax", uiText("ضريبة الفاتورة", "מס חשבונית", "Invoice tax"), invoice?.tax || "0", "number", false)}
      ${field("currency", uiText("العملة", "מטבע", "Currency"), invoice?.currency || "ILS")}
    </div><div class="modal-foot"><button class="btn" type="submit">${clean("save")}</button><div id="formError" class="form-message" role="alert" tabindex="-1"></div></div>
  </form></div>`;
  root.querySelector("#closeModal").addEventListener("click", closeModal);
  bindModalAccessibility({ focusSelector: "[name='patientId']" });
  root.querySelectorAll(".invoice-item-row select").forEach((serviceSelect) => serviceSelect.addEventListener("change", () => {
    const index = serviceSelect.name.replace("serviceId", "");
    const service = (state.data.services || []).find((item) => Number(item.id) === Number(serviceSelect.value));
    if (!service) return;
    const description = root.querySelector(`[name='description${index}']`);
    const price = root.querySelector(`[name='unitPrice${index}']`);
    if (!description.value) description.value = service.name;
    if (!price.value) price.value = service.price || 0;
  }));
  root.querySelector("#patientInvoiceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.getAttribute("aria-busy") === "true") return;
    const values = Object.fromEntries(new FormData(form));
    const items = [0, 1, 2].map((index) => ({
      serviceId: values[`serviceId${index}`] ? Number(values[`serviceId${index}`]) : null,
      description: values[`description${index}`],
      quantity: Number(values[`quantity${index}`] || 1),
      unitPrice: values[`unitPrice${index}`],
      discount: values[`itemDiscount${index}`] || "0",
      tax: values[`itemTax${index}`] || "0",
    })).filter((item) => item.description || item.unitPrice);
    const body = { patientId: Number(values.patientId), appointmentId: values.appointmentId ? Number(values.appointmentId) : null, items, discount: values.discount || "0", tax: values.tax || "0", currency: values.currency };
    form.setAttribute("aria-busy", "true");
    form.querySelector("[type='submit']").disabled = true;
    try {
      const result = await api(invoice ? `/api/patient-finance/invoices/${invoice.id}` : "/api/patient-finance/invoices", { method: invoice ? "PUT" : "POST", body });
      closeModal();
      await refreshBillingWorkspace({ renderLoading: false });
      await openPatientInvoiceDetails(result.invoice.id);
    } catch (error) {
      form.removeAttribute("aria-busy");
      form.querySelector("[type='submit']").disabled = false;
      const errorBox = root.querySelector("#formError");
      errorBox.textContent = localizedError(error);
      errorBox.focus();
    }
  });
}

async function invoiceMutation(endpoint, invoiceId) {
  try {
    await api(endpoint, { method: "POST" });
    await refreshBillingWorkspace({ renderLoading: false });
    await openPatientInvoiceDetails(invoiceId);
  } catch (error) {
    showCenterError(localizedError(error));
  }
}

async function openPatientInvoiceDetails(id) {
  beginModalInteraction();
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal"><div class="modal-card"><div class="billing-boundary">${uiText("جارٍ التحميل…", "טוען…", "Loading…")}</div></div></div>`;
  try {
    const { invoice } = await api(`/api/patient-finance/invoices/${id}`);
    const admin = state.user.role === "admin";
    const payable = ["issued", "partially_paid"].includes(invoice.status);
    root.innerHTML = `<div class="modal"><section class="modal-card wide invoice-details" role="dialog" aria-modal="true" aria-labelledby="invoiceDetailsTitle">
      <div class="modal-head"><div><span>${escapeHtml(billingStatus(invoice.status, state.lang))}</span><h3 id="invoiceDetailsTitle">${escapeHtml(invoice.invoiceNumber)}</h3></div><button class="btn ghost" type="button" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body"><div class="invoice-totals full">
        <div><span>${uiText("المريض", "מטופל", "Patient")}</span><strong>${escapeHtml(invoice.patientName)}</strong></div>
        <div><span>${uiText("الإجمالي", "סה״כ", "Total")}</span><strong>${escapeHtml(invoice.total)} ${escapeHtml(invoice.currency)}</strong></div>
        <div><span>${uiText("المدفوع", "שולם", "Paid")}</span><strong>${escapeHtml(invoice.paid)} ${escapeHtml(invoice.currency)}</strong></div>
        <div><span>${uiText("المتبقي", "יתרה", "Outstanding")}</span><strong>${escapeHtml(invoice.outstanding)} ${escapeHtml(invoice.currency)}</strong></div>
      </div><div class="billing-table-wrap full"><table class="billing-table"><thead><tr><th>${uiText("الوصف", "תיאור", "Description")}</th><th>${uiText("الكمية", "כמות", "Qty")}</th><th>${uiText("السعر", "מחיר", "Price")}</th><th>${uiText("الإجمالي", "סה״כ", "Total")}</th></tr></thead><tbody>${invoice.items.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unitPrice)}</td><td>${escapeHtml(item.lineTotal)}</td></tr>`).join("")}</tbody></table></div>
      ${payable ? `<form id="patientPaymentForm" class="invoice-payment-form full"><h4>${uiText("تسجيل دفعة", "רישום תשלום", "Record payment")}</h4><input type="number" min="0.01" step="0.01" max="${escapeAttr(invoice.outstanding)}" name="amount" required><select name="paymentMethod"><option value="cash">${uiText("نقداً", "מזומן", "Cash")}</option><option value="card">${uiText("بطاقة", "כרטיס", "Card")}</option><option value="bank_transfer">${uiText("تحويل بنكي", "העברה בנקאית", "Bank transfer")}</option><option value="check">${uiText("شيك", "המחאה", "Check")}</option><option value="other">${uiText("أخرى", "אחר", "Other")}</option></select><input name="reference" placeholder="${uiText("مرجع اختياري", "אסמכתא אופציונלית", "Optional reference")}"><button class="btn" type="submit">${uiText("تسجيل", "רישום", "Record")}</button><div id="paymentError" role="alert"></div></form>` : ""}
      <section class="full"><h4>${uiText("الدفعات", "תשלומים", "Payments")}</h4><div class="stack-list">${invoice.payments.map((payment) => `<div class="feature-row"><div><strong>${escapeHtml(payment.amount)} ${escapeHtml(invoice.currency)}</strong><span>${escapeHtml(payment.paymentMethod)} · ${escapeHtml(payment.paymentDate)} · ${escapeHtml(payment.status)}</span></div>${admin && payment.status === "posted" ? `<button class="btn danger" type="button" data-reverse-payment="${escapeAttr(payment.id)}">${uiText("عكس", "ביטול", "Reverse")}</button>` : ""}</div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></section></div>
      <div class="modal-foot">${invoice.status === "draft" ? `<button class="btn secondary" type="button" data-edit-invoice>${clean("edit")}</button><button class="btn" type="button" data-issue-invoice>${uiText("إصدار", "הפקה", "Issue")}</button>` : ""}${admin && invoice.status !== "cancelled" ? `<button class="btn danger" type="button" data-cancel-invoice>${uiText("إلغاء الفاتورة", "ביטול חשבונית", "Cancel invoice")}</button>` : ""}</div>
    </section></div>`;
    root.querySelector("#closeModal").addEventListener("click", closeModal);
    bindModalAccessibility({ focusSelector: "#closeModal" });
    root.querySelector("[data-edit-invoice]")?.addEventListener("click", () => void openPatientInvoiceForm(invoice));
    root.querySelector("[data-issue-invoice]")?.addEventListener("click", () => void invoiceMutation(`/api/patient-finance/invoices/${id}/issue`, id));
    root.querySelector("[data-cancel-invoice]")?.addEventListener("click", () => confirm(uiText("إلغاء الفاتورة بحركة عكسية؟", "לבטל את החשבונית בתנועת ביטול?", "Cancel this invoice with a reversal?")) && void invoiceMutation(`/api/patient-finance/invoices/${id}/cancel`, id));
    root.querySelectorAll("[data-reverse-payment]").forEach((button) => button.addEventListener("click", () => confirm(uiText("عكس الدفعة؟", "לבטל את התשלום?", "Reverse this payment?")) && void invoiceMutation(`/api/patient-finance/payments/${button.dataset.reversePayment}/reverse`, id)));
    root.querySelector("#patientPaymentForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.getAttribute("aria-busy") === "true") return;
      form.setAttribute("aria-busy", "true");
      form.querySelector("button").disabled = true;
      try {
        await api("/api/patient-finance/payments", { method: "POST", body: { ...Object.fromEntries(new FormData(form)), patientId: invoice.patientId, invoiceId: invoice.id } });
        await refreshBillingWorkspace({ renderLoading: false });
        await openPatientInvoiceDetails(id);
      } catch (error) {
        form.removeAttribute("aria-busy");
        form.querySelector("button").disabled = false;
        root.querySelector("#paymentError").textContent = localizedError(error);
      }
    });
  } catch (error) {
    root.innerHTML = `<div class="modal"><div class="modal-card"><div class="billing-boundary" role="alert">${escapeHtml(localizedError(error))}<button class="btn secondary" type="button" id="closeModal">${clean("close")}</button></div></div></div>`;
    root.querySelector("#closeModal").addEventListener("click", closeModal);
  }
}

function bindBillingActions() {
  document.querySelectorAll("[data-new-invoice]").forEach((button) => button.addEventListener("click", () => void openPatientInvoiceForm()));
  document.querySelectorAll("[data-invoice-details]").forEach((button) => button.addEventListener("click", () => void openPatientInvoiceDetails(Number(button.dataset.invoiceDetails))));
  document.querySelector("[data-billing-retry]")?.addEventListener("click", () => void refreshBillingWorkspace());
}

renderBilling = function () {
  return renderBillingWorkspace({ language: state.lang, workspace: state.billingWorkspace });
}

function field(name, label, value = "", type = "text", required = true, extraClass = "") {
  const id = `field-${name}`;
  const labelMarkup = `${escapeHtml(label)}${required ? ' <span class="required-marker" aria-hidden="true">*</span>' : ""}`;
  const safeValue = escapeAttr(value ?? "");
  if (type === "textarea") {
    return `<div class="field ${escapeAttr(extraClass)}"><label for="${escapeAttr(id)}">${labelMarkup}</label><textarea id="${escapeAttr(id)}" name="${escapeAttr(name)}" ${required ? 'required aria-required="true"' : ""}>${escapeHtml(value ?? "")}</textarea></div>`;
  }
  return `<div class="field ${escapeAttr(extraClass)}"><label for="${escapeAttr(id)}">${labelMarkup}</label><input id="${escapeAttr(id)}" name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${safeValue}" ${required ? 'required aria-required="true"' : ""}></div>`;
}

function select(name, label, options = [], value = "", required = true) {
  const id = `field-${name}`;
  const current = String(value ?? "");
  return `<div class="field"><label for="${escapeAttr(id)}">${escapeHtml(label)}${required ? ' <span class="required-marker" aria-hidden="true">*</span>' : ""}</label><select id="${escapeAttr(id)}" name="${escapeAttr(name)}" ${required ? 'required aria-required="true"' : ""}>${options.map(([optionId, text]) => `<option value="${escapeAttr(optionId)}" ${String(optionId) === current ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></div>`;
}

openForm = function (resource, id = null, defaults = {}) {
  if (resource === "appointments" && !id) return openBookingWorkflow(defaults);
  beginModalInteraction();
  const row = id ? (state.data[resource] || []).find((item) => Number(item.id) === Number(id)) : defaults;
  const clientTitle = id
    ? uiText("تعديل المريض", "עריכת מטופל", "Edit patient")
    : uiText("مريض جديد", "מטופל חדש", "New patient");
  const genericTitle = `${id ? uiText("تعديل", "עריכה", "Edit") : uiText("إضافة", "הוספה", "Add")} ${pageLabel(resource) || ""}`;
  const title = resource === "clients" ? clientTitle : genericTitle;
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="entityForm" role="dialog" aria-modal="true" aria-labelledby="entityFormTitle">
      <div class="modal-head"><h3 id="entityFormTitle">${escapeHtml(title)}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">${formFieldsHe(resource, row || {})}</div>
      <div class="modal-foot"><button class="btn" type="submit">${clean("save")}</button><div id="formError" class="form-message" role="alert" aria-live="assertive" tabindex="-1"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  bindModalAccessibility({ focusSelector: "[required]" });
  document.getElementById("entityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.getAttribute("aria-busy") === "true") return;
    const submitButton = form.querySelector("[type='submit']");
    form.setAttribute("aria-busy", "true");
    if (submitButton) submitButton.disabled = true;
    try {
      const body = formPayload(resource, Object.fromEntries(new FormData(form)));
      delete body.clientSearch;
      const result = await api(`/api/${resource}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body });
      if (resource === "clients") {
        const nextClient = { ...(row || {}), ...body, id: id || result.id, active: true };
        state.data.clients = id
          ? (state.data.clients || []).map((client) => Number(client.id) === Number(id) ? nextClient : client)
          : [nextClient, ...(state.data.clients || [])];
      }
      closeModal();
      if (resource === "clients" && state.page === "clients") {
        await refreshPatientWorkspace({ renderLoading: false });
      } else {
        await loadData();
        renderApp();
      }
      showCenterSuccess(resource === "clients"
        ? uiText("تم حفظ المريض.", "המטופל נשמר.", "Patient saved.")
        : uiText("تم الحفظ.", "נשמר בהצלחה.", "Saved successfully."));
    } catch (err) {
      const message = localizedError(err);
      form.removeAttribute("aria-busy");
      if (submitButton) submitButton.disabled = false;
      const errorBox = document.getElementById("formError");
      errorBox.textContent = message;
      errorBox.focus();
    }
  });
}

formFieldsHe = function (resource, row = {}) {
  if (resource === "clients") return html`${field("fname", uiText("الاسم الأول", "שם פרטי", "First name"), row.fname || "")}${field("lname", uiText("اسم العائلة", "שם משפחה", "Last name"), row.lname || "")}${field("phone", uiText("الهاتف", "טלפון", "Phone"), row.phone || "")}${field("email", uiText("البريد الإلكتروني", "אימייל", "Email"), row.email || "", "email", false)}${state.user?.role === "admin" ? field("notes", uiText("ملاحظات سريرية", "הערות קליניות", "Clinical notes"), row.notes || "", "textarea", false, "full") : ""}`;
  if (resource === "appointments") return html`${select("clientId", pageLabel("clients"), (state.data.clients || []).map((c) => [c.id, `${c.fname} ${c.lname}`]), row.clientId || "")}${select("serviceId", pageLabel("services"), (state.data.services || []).map((s) => [s.id, s.name]), row.serviceId || "")}${select("therapistId", clean("table.therapist"), therapists(), row.therapistId || state.user.id)}${field("date", clean("table.date"), row.date || new Date().toISOString().slice(0, 10), "date")}${field("time", clean("table.time"), row.time || clinicWorkStart(), "time")}${select("status", clean("table.status"), [["pending", cleanStatusLabel("pending")], ["done", cleanStatusLabel("done")], ["cancelled", cleanStatusLabel("cancelled")]], row.status || "pending")}${select("paymentStatus", clean("table.payment"), [["unpaid", cleanPaymentLabel("unpaid")], ["paid", cleanPaymentLabel("paid")], ["deposit", cleanPaymentLabel("deposit")]], row.paymentStatus || "unpaid")}${field("paidAmount", state.lang === "he" ? "סכום ששולם" : "المبلغ المدفوع", row.paidAmount || 0, "number", false)}${field("notes", state.lang === "he" ? "הערות" : "ملاحظات", row.notes || "", "textarea", false, "full")}`;
  if (resource === "categories") return field("name", state.lang === "he" ? "שם קטגוריה" : "اسم القسم", row.name || "");
  if (resource === "services") return html`${field("name", state.lang === "he" ? "שם שירות" : "اسم الخدمة", row.name || "")}${select("categoryId", pageLabel("categories"), (state.data.categories || []).map((c) => [c.id, c.name]), row.categoryId || "")}${field("duration", state.lang === "he" ? "משך בדקות" : "المدة بالدقائق", row.duration || 60, "number")}${field("price", clean("table.price"), row.price || 0, "number")}${select("active", state.lang === "he" ? "פעיל" : "فعال", [["true", clean("yes")], ["false", clean("no")]], String(row.active !== false))}`;
  if (resource === "users") return html`${field("username", state.lang === "he" ? "שם משתמש" : "اسم المستخدم", row.username || "")}${field("password", state.lang === "he" ? "סיסמה חדשה" : "كلمة مرور جديدة", "", "password", !row.id)}${field("name", state.lang === "he" ? "שם" : "الاسم", row.name || "")}${field("email", state.lang === "he" ? "אימייל" : "البريد", row.email || "", "email", false)}${select("role", state.lang === "he" ? "תפקיד" : "الدور", [["admin", roleLabel("admin")], ["reception", roleLabel("reception")], ["therapist", roleLabel("therapist")]], row.role || "therapist")}${select("active", state.lang === "he" ? "פעיל" : "فعال", [["true", clean("yes")], ["false", clean("no")]], String(row.active !== false))}`;
  return "";
}

function setDocumentLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = directionForLanguage(state.lang);
}

function routeUrl(page) {
  return `${location.pathname}${location.search}${hashForRoute(page)}`;
}

function setProtectedRoute(page, options = {}) {
  const { replace = false, render = true } = options;
  const target = resolveProtectedRoute(hashForRoute(page), state.user);
  const enteringCalendar = target.page === "calendar" && state.page !== "calendar";
  const enteringPatients = target.page === "clients" && state.page !== "clients";
  const enteringBilling = target.page === "billing" && state.page !== "billing";
  state.page = target.page;
  if (enteringCalendar) state.appointmentWorkspace.status = "idle";
  if (enteringPatients) state.patientWorkspace.status = "idle";
  if (enteringBilling) state.billingWorkspace.status = "idle";
  state.mobileNavOpen = false;
  history[replace ? "replaceState" : "pushState"]({}, "", routeUrl(target.page));
  if (render) {
    if (target.page === "login") renderLogin();
    else {
      renderApp();
      if (target.page === "calendar") void refreshAppointmentWorkspace();
      if (target.page === "clients") void refreshPatientWorkspace();
      if (target.page === "billing") void refreshBillingWorkspace();
    }
  }
}

function applyProtectedRoute(options = {}) {
  const { replace = false, render = true } = options;
  const target = resolveProtectedRoute(location.hash, state.user);
  const enteringCalendar = target.page === "calendar" && state.page !== "calendar";
  const enteringPatients = target.page === "clients" && state.page !== "clients";
  const enteringBilling = target.page === "billing" && state.page !== "billing";
  state.page = target.page;
  if (enteringCalendar) state.appointmentWorkspace.status = "idle";
  if (enteringPatients) state.patientWorkspace.status = "idle";
  if (enteringBilling) state.billingWorkspace.status = "idle";
  state.mobileNavOpen = false;
  if (target.redirect) history.replaceState({}, "", routeUrl(target.page));
  else if (replace) history.replaceState({}, "", routeUrl(target.page));
  if (render) {
    if (target.page === "login") renderLogin();
    else {
      renderApp();
      if (target.page === "calendar") void refreshAppointmentWorkspace();
      if (target.page === "clients") void refreshPatientWorkspace();
      if (target.page === "billing") void refreshBillingWorkspace();
    }
  }
}

function iconMarkup(name) {
  return `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${navigationIcons[name] || navigationIcons.home}</svg>`;
}

function renderNavigationItems(items) {
  return items.map((item) => `<button type="button" data-page="${escapeAttr(item.page)}" class="${state.page === item.page ? "active" : ""}" ${state.page === item.page ? 'aria-current="page"' : ""}>${iconMarkup(item.icon)}<span>${escapeHtml(foundationPageLabel(state.lang, item.page))}</span></button>`).join("");
}

function renderFoundationLanguagePicker() {
  const labels = { he: "עברית", ar: "العربية", en: "English" };
  return `<label class="language-picker foundation-language"><span class="sr-only">${escapeHtml(foundationText(state.lang, "shell.language"))}</span><select id="languageSelect" aria-label="${escapeAttr(foundationText(state.lang, "shell.language"))}">${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${state.lang === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
}

function activeClinicName() {
  return state.data?.tenant?.name || state.data?.settings?.clinicName || foundationText(state.lang, "app.name");
}

function roleName() {
  return foundationText(state.lang, `roles.${state.user?.role || "admin"}`);
}

function renderFoundationShell() {
  const navigation = navigationFor(state.user);
  const pageTitle = foundationPageLabel(state.lang, state.page);
  const subtitle = foundationPageSubtitle(state.lang, state.page) || pageSubtitle();
  const clinicName = state.user.platformOwner ? foundationText(state.lang, "nav.platform") : activeClinicName();
  const safeUserName = escapeHtml(state.user.name || state.user.username || "");
  setDocumentLanguage();
  mount(html`
    <div class="shell foundation-shell ${state.mobileNavOpen ? "nav-open" : ""}">
      <button class="sidebar-scrim" type="button" id="closeMobileNav" aria-label="${escapeAttr(foundationText(state.lang, "shell.closeMenu"))}"></button>
      <aside class="sidebar foundation-sidebar" id="appSidebar" aria-label="${escapeAttr(foundationText(state.lang, "shell.primaryNavigation"))}">
        <div class="brand foundation-brand">
          <img class="brand-logo" src="${escapeAttr(logoSrc())}" alt="">
          <div><h3>Clinova</h3><div class="clinic-context">${escapeHtml(clinicName)}</div></div>
          <button class="sidebar-close" type="button" id="sidebarCloseButton" aria-label="${escapeAttr(foundationText(state.lang, "shell.closeMenu"))}">×</button>
        </div>
        <div class="sidebar-scroll">
          <div class="nav-section-label">${escapeHtml(foundationText(state.lang, "shell.primaryNavigation"))}</div>
          <nav class="nav foundation-nav">${renderNavigationItems(navigation.primary)}</nav>
          ${navigation.tools.length ? `<div class="nav-section-label tools-label">${escapeHtml(foundationText(state.lang, "shell.moreTools"))}</div><nav class="nav foundation-nav secondary-nav">${renderNavigationItems(navigation.tools)}</nav>` : ""}
        </div>
        <div class="user-box foundation-user-box">
          <div class="user-avatar" aria-hidden="true">${escapeHtml((state.user.name || state.user.username || "C").trim().slice(0, 1).toUpperCase())}</div>
          <div class="user-identity"><strong>${safeUserName}</strong><span>${escapeHtml(roleName())}</span></div>
          <button class="icon-button logout-icon" type="button" data-logout aria-label="${escapeAttr(foundationText(state.lang, "shell.logout"))}">${iconMarkup("logout")}</button>
        </div>
      </aside>
      <main class="main foundation-main">
        <header class="topbar foundation-topbar">
          <div class="topbar-heading">
            <button class="mobile-menu-button" type="button" id="mobileMenuButton" aria-controls="appSidebar" aria-expanded="${state.mobileNavOpen}" aria-label="${escapeAttr(foundationText(state.lang, "shell.openMenu"))}"><span></span><span></span><span></span></button>
            <div>
              <div class="breadcrumb"><span>${escapeHtml(foundationText(state.lang, "shell.breadcrumbHome"))}</span><span aria-hidden="true">/</span><strong>${escapeHtml(pageTitle)}</strong></div>
              <h1>${escapeHtml(pageTitle)}</h1>
              ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
            </div>
          </div>
          <div class="topbar-actions foundation-actions">
            ${topActionI18n()}
            ${state.user.platformOwner ? "" : renderNotificationCenter({
              language: state.lang,
              state: state.notificationCenter,
            })}
            ${renderFoundationLanguagePicker()}
            <details class="user-menu">
              <summary aria-label="${escapeAttr(foundationText(state.lang, "shell.userMenu"))}"><span class="user-avatar">${escapeHtml((state.user.name || state.user.username || "C").trim().slice(0, 1).toUpperCase())}</span><span class="user-menu-name">${safeUserName}</span></summary>
              <div class="user-menu-popover"><strong>${safeUserName}</strong><span>${escapeHtml(roleName())}</span><button type="button" data-logout>${escapeHtml(foundationText(state.lang, "shell.logout"))}</button></div>
            </details>
          </div>
        </header>
        <section class="content foundation-content" id="mainContent" tabindex="-1">${renderPage()}</section>
      </main>
    </div>
    <div id="modalRoot"></div>
  `);
}

async function logoutFromFoundation() {
  document.querySelectorAll("[data-logout]").forEach((button) => { button.disabled = true; });
  try {
    await api("/api/logout", { method: "POST" });
  } finally {
    state.user = null;
    state.data = {};
    state.appointmentWorkspace = { status: "idle", error: "", queue: [], filters: { therapistId: "", status: "", serviceId: "" } };
    state.patientWorkspace = { status: "idle", error: "", data: null, filters: { ...emptyPatientFilters } };
    state.notificationCenter = { status: "idle", error: "", items: [], unreadCount: 0, open: false, actionPending: false };
    setProtectedRoute("login", { replace: true });
  }
}

function focusNotificationControl(selector) {
  requestAnimationFrame(() => document.querySelector(selector)?.focus());
}

function closeNotificationCenter({ restoreFocus = false } = {}) {
  state.notificationCenter.open = false;
  renderApp();
  if (restoreFocus) focusNotificationControl("[data-notification-toggle]");
}

async function activateNotification(id) {
  if (state.notificationCenter.actionPending) return;
  const item = state.notificationCenter.items.find((entry) => Number(entry.id) === Number(id));
  if (!item) return;
  state.notificationCenter.actionPending = true;
  renderApp();
  try {
    if (item.status === "unread") {
      const result = await api(`/api/notifications/${id}/read`, { method: "PATCH" });
      item.status = "read";
      item.readAt = new Date().toISOString();
      state.notificationCenter.unreadCount = result.unreadCount || 0;
    }
    state.notificationCenter.actionPending = false;
    state.notificationCenter.open = false;
    const target = notificationTarget(item);
    renderApp();
    if (target?.page === "appointments") await openAppointmentDetails(target.id);
    if (target?.page === "clients") await openClientProfile(target.id);
  } catch (error) {
    state.notificationCenter.actionPending = false;
    renderApp();
    showCenterError(localizedError(error));
  }
}

function bindNotificationCenterActions() {
  document.querySelector("[data-notification-toggle]")?.addEventListener("click", () => {
    const opening = !state.notificationCenter.open;
    state.notificationCenter.open = opening;
    renderApp();
    if (opening) {
      void refreshNotifications();
      return;
    }
  });
  document.querySelector("[data-notification-retry]")?.addEventListener("click", () => void refreshNotifications());
  document.querySelector("[data-notification-read-all]")?.addEventListener("click", async () => {
    if (state.notificationCenter.actionPending) return;
    state.notificationCenter.actionPending = true;
    renderApp();
    try {
      await api("/api/notifications/read-all", { method: "POST" });
      state.notificationCenter.items.forEach((item) => {
        item.status = "read";
        item.readAt ||= new Date().toISOString();
      });
      state.notificationCenter.unreadCount = 0;
      state.notificationCenter.actionPending = false;
      renderApp();
      focusNotificationControl("[data-notification-toggle]");
    } catch (error) {
      state.notificationCenter.actionPending = false;
      renderApp();
      showCenterError(localizedError(error));
    }
  });
  document.querySelectorAll("[data-notification-id]").forEach((button) => {
    button.addEventListener("click", () => void activateNotification(Number(button.dataset.notificationId)));
  });
  document.querySelector(".notification-popover")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotificationCenter({ restoreFocus: true });
  });
}

renderApp = function () {
  if (!state.user) {
    setProtectedRoute("login", { replace: true });
    return;
  }
  const target = resolveProtectedRoute(hashForRoute(state.page), state.user);
  if (target.page !== state.page) {
    setProtectedRoute(target.page, { replace: true });
    return;
  }
  renderFoundationShell();
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", logoutFromFoundation));
  const toggleNavigation = (open) => {
    state.mobileNavOpen = open;
    renderApp();
  };
  document.getElementById("mobileMenuButton")?.addEventListener("click", () => toggleNavigation(true));
  document.getElementById("closeMobileNav")?.addEventListener("click", () => toggleNavigation(false));
  document.getElementById("sidebarCloseButton")?.addEventListener("click", () => toggleNavigation(false));
  bindPageActions();
  bindNotificationCenterActions();
}

renderLogin = function (error = "", values = {}) {
  state.user = null;
  setDocumentLanguage();
  const errorMessage = error ? localizedAuthError(state.lang, error) : "";
  mount(html`
    <main class="login foundation-login">
      <section class="login-intro" aria-hidden="true">
        <img src="/logo.svg" alt="">
        <div><span>Clinova</span><p>${escapeHtml(foundationText(state.lang, "app.subtitle"))}</p></div>
      </section>
      <form class="login-card foundation-login-card" id="loginForm" novalidate>
        <div class="login-brand"><img class="brand-logo" src="/logo.svg" alt=""><span>Clinova</span></div>
        <div class="login-heading"><h1>${escapeHtml(foundationText(state.lang, "auth.title"))}</h1><p>${escapeHtml(foundationText(state.lang, "auth.subtitle"))}</p></div>
        <div class="alert login-error ${errorMessage ? "" : "is-hidden"}" id="loginError" role="alert" aria-live="polite">${escapeHtml(errorMessage)}</div>
        <div class="field"><label for="loginIdentifier">${escapeHtml(foundationText(state.lang, "auth.identifier"))}</label><input id="loginIdentifier" name="identifier" value="${escapeAttr(values.identifier || "")}" autocomplete="username" required autofocus></div>
        <div class="field"><label for="clinicIdentifier">${escapeHtml(foundationText(state.lang, "auth.clinic"))}</label><input id="clinicIdentifier" name="clinicIdentifier" value="${escapeAttr(values.clinicIdentifier || "")}" autocomplete="organization" aria-describedby="clinicHint"><small id="clinicHint">${escapeHtml(foundationText(state.lang, "auth.clinicHint"))}</small></div>
        <div class="field"><label for="loginPassword">${escapeHtml(foundationText(state.lang, "auth.password"))}</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn login-submit" type="submit"><span>${escapeHtml(foundationText(state.lang, "auth.submit"))}</span><span class="button-spinner" aria-hidden="true"></span></button>
        <div class="login-footer">v${escapeHtml(APP_VERSION)} · ${renderFoundationLanguagePicker()}</div>
      </form>
    </main>
  `);
  document.getElementById("languageSelect")?.addEventListener("change", (event) => {
    state.lang = event.currentTarget.value;
    localStorage.setItem("clinova-lang", state.lang);
    renderLogin("", values);
  });
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type='submit']");
    const errorBox = document.getElementById("loginError");
    if (!body.identifier?.trim() || !body.password) {
      errorBox.textContent = foundationText(state.lang, "auth.required");
      errorBox.classList.remove("is-hidden");
      return;
    }
    button.disabled = true;
    button.classList.add("is-loading");
    button.querySelector("span:first-child").textContent = foundationText(state.lang, "auth.submitting");
    form.setAttribute("aria-busy", "true");
    errorBox.classList.add("is-hidden");
    try {
      const result = await api("/api/login", { method: "POST", body });
      state.user = result.user;
      applyProtectedRoute({ replace: true, render: false });
      await loadData();
      state.appointmentWorkspace = { ...state.appointmentWorkspace, status: "idle", error: "", queue: [] };
      state.patientWorkspace = { ...state.patientWorkspace, status: "idle", error: "", data: null };
      renderApp();
      if (state.page === "calendar") void refreshAppointmentWorkspace();
  if (state.page === "clients") void refreshPatientWorkspace();
  if (state.page === "billing") void refreshBillingWorkspace();
    } catch (err) {
      renderLogin(err, { identifier: body.identifier, clinicIdentifier: body.clinicIdentifier });
    }
  });
}

function uiText(ar, he, en = ar) {
  if (state.lang === "he") return he;
  if (state.lang === "en") return en;
  return ar;
}

function optionList(rows, valueKey, labelFn, selected = "") {
  return rows.map((row) => `<option value="${escapeAttr(row[valueKey])}" ${String(row[valueKey]) === String(selected) ? "selected" : ""}>${escapeHtml(labelFn(row))}</option>`).join("");
}

function reloadAfter(action) {
  return action().then(loadData).then(renderApp).catch((err) => showCenterError(localizedError(err)));
}

function bindRestoredSectionActions() {
  const settingsForm = document.getElementById("clinicSettingsForm");
  if (settingsForm) settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(settingsForm);
    const body = Object.fromEntries(data);
    if (data.getAll("workDays").length) body.workDays = JSON.stringify(data.getAll("workDays").map(Number));
    api("/api/settings", { method: "PUT", body })
      .then(loadData)
      .then(() => {
        showCenterError(successText("settingsSaved"));
        renderApp();
      })
      .catch((err) => showCenterError(localizedError(err)));
  });

  const passwordForm = document.getElementById("passwordForm");
  if (passwordForm) passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/account/password", { method: "POST", body: Object.fromEntries(new FormData(passwordForm)) });
      showCenterError(uiText("تم تغيير كلمة المرور، يرجى تسجيل الدخول من جديد", "הסיסמה שונתה, יש להתחבר מחדש"));
      state.user = null;
      renderLogin();
    } catch (err) {
      showCenterError(localizedError(err));
    }
  });

  const inviteForm = document.getElementById("inviteUserForm");
  if (inviteForm) inviteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    reloadAfter(() => api("/api/invitations", { method: "POST", body: Object.fromEntries(new FormData(inviteForm)) }));
  });

  document.querySelectorAll("[data-copy-invite]").forEach((button) => button.addEventListener("click", async () => {
    const link = button.dataset.copyInvite || "";
    try {
      await navigator.clipboard.writeText(link);
      showCenterError(uiText("تم نسخ رابط الدعوة", "קישור ההזמנה הועתק"));
    } catch {
      prompt(uiText("انسخ الرابط", "העתקת קישור"), link);
    }
  }));

  document.querySelectorAll("[data-revoke-invite]").forEach((button) => button.addEventListener("click", () => {
    reloadAfter(() => api(`/api/invitations/${button.dataset.revokeInvite}`, { method: "DELETE" }));
  }));

  const crmTaskForm = document.getElementById("crmTaskForm");
  if (crmTaskForm) crmTaskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(crmTaskForm));
    body.clientId = Number(body.clientId || 0);
    body.assignedTo = Number(body.assignedTo || state.user.id);
    reloadAfter(() => api("/api/crm-tasks", { method: "POST", body }));
  });

  document.querySelectorAll("[data-crm-task-done]").forEach((button) => button.addEventListener("click", () => {
    const task = (state.data.crmTasks || []).find((item) => Number(item.id) === Number(button.dataset.crmTaskDone));
    if (!task) return;
    reloadAfter(() => api(`/api/crm-tasks/${task.id}`, { method: "PUT", body: { ...task, assignedTo: task.assignedTo || state.user.id, status: "done" } }));
  }));

  document.querySelectorAll("[data-whatsapp]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await api(`/api/appointments/${button.dataset.whatsapp}/whatsapp`, { method: "POST" });
      if (result.fallbackUrl) window.open(result.fallbackUrl, "_blank", "noopener");
      await loadData();
      renderApp();
    } catch (err) {
      showCenterError(localizedError(err));
    }
  }));

  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => openClientProfile(Number(button.dataset.profile))));
  document.querySelectorAll("[data-sign-consent]").forEach((button) => button.addEventListener("click", () => openConsentSignModal(Number(button.dataset.signConsent))));
  document.querySelectorAll("[data-sign-appointment]").forEach((button) => button.addEventListener("click", () => openAppointmentConsentModal(Number(button.dataset.signAppointment))));

  document.querySelectorAll("[data-new-consent]").forEach((button) => button.addEventListener("click", openConsentUploadModal));
  document.querySelectorAll("[data-edit-consent]").forEach((button) => button.addEventListener("click", () => openConsentUploadModal(Number(button.dataset.editConsent))));
  document.querySelectorAll("[data-delete-consent]").forEach((button) => button.addEventListener("click", () => {
    reloadAfter(() => api(`/api/consents/${button.dataset.deleteConsent}`, { method: "DELETE" }));
  }));

  document.querySelectorAll("[data-new-feedback]").forEach((button) => button.addEventListener("click", openFeedbackModal));
  document.querySelectorAll("[data-new-gift]").forEach((button) => button.addEventListener("click", openGiftModal));
  document.querySelectorAll("[data-gift-whatsapp]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await api(`/api/gifts/${button.dataset.giftWhatsapp}/whatsapp`, { method: "POST" });
      if (result.fallbackUrl) window.open(result.fallbackUrl, "_blank", "noopener");
      await loadData();
      renderApp();
    } catch (err) {
      showCenterError(localizedError(err));
    }
  }));
  document.querySelectorAll("[data-gift-status]").forEach((button) => button.addEventListener("click", () => {
    reloadAfter(() => api(`/api/gifts/${button.dataset.giftStatus}`, { method: "PUT", body: { status: button.dataset.status || "redeemed" } }));
  }));
  document.querySelectorAll("[data-gift-print]").forEach((button) => button.addEventListener("click", () => printGiftCard(Number(button.dataset.giftPrint))));

  document.querySelectorAll("[data-report-tab]").forEach((button) => button.addEventListener("click", () => {
    state.reportTab = button.dataset.reportTab;
    renderApp();
  }));

  document.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => exportClinicCsv(button.dataset.export)));
  document.querySelectorAll("[data-calendar-today]").forEach((button) => button.addEventListener("click", () => {
    state.calendarDate = new Date().toISOString().slice(0, 10);
    renderApp();
  }));

  const quickSearch = document.getElementById("quickSearch");
  if (quickSearch) quickSearch.addEventListener("input", handleQuickSearch);
  if (quickSearch) document.addEventListener("click", closeQuickSearchOnOutsideClick, { once: true });
  document.querySelectorAll("[data-quick-profile]").forEach((button) => button.addEventListener("click", () => openClientProfile(Number(button.dataset.quickProfile))));
  document.querySelectorAll("[data-quick-appointment]").forEach((button) => button.addEventListener("click", () => openForm("appointments", Number(button.dataset.quickAppointment))));
}

function openConsentUploadModal(templateId = null) {
  const template = (state.data.consentTemplates || []).find((item) => Number(item.id) === Number(templateId)) || {};
  const editing = Boolean(template.id);
  beginModalInteraction();
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="consentUploadForm" role="dialog" aria-modal="true" aria-labelledby="consentTemplateTitle">
      <div class="modal-head"><h3 id="consentTemplateTitle">${editing ? uiText("تعديل نموذج موافقة", "עריכת תבנית הסכמה", "Edit consent template") : uiText("نموذج موافقة جديد", "תבנית הסכמה חדשה", "New consent template")}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">
        ${field("title", uiText("عنوان النموذج", "שם הטופס", "Title"), template.title || "", "text")}
        ${field("description", uiText("الوصف", "תיאור", "Description"), template.description || "", "textarea", false, "full")}
        ${field("consentText", uiText("نص الموافقة", "טקסט ההסכמה", "Consent text"), template.consentText || "", "textarea", true, "full")}
        ${select("language", uiText("اللغة", "שפה", "Language"), [["he", "עברית"], ["ar", "العربية"], ["en", "English"]], template.language || state.lang)}
        ${select("serviceId", pageLabel("services"), (state.data.services || []).map((service) => [service.id, service.name]), template.serviceId || "", false)}
        ${field("expirationDays", uiText("مدة الصلاحية بالأيام", "תוקף בימים", "Expiration days"), template.expirationDays || "", "number", false)}
      </div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  bindModalAccessibility({ focusSelector: "input[name='title']" });
  document.getElementById("consentUploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.currentTarget.getAttribute("aria-busy") === "true") return;
    const submit = event.currentTarget.querySelector("[type='submit']");
    event.currentTarget.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      body.serviceId = body.serviceId ? Number(body.serviceId) : null;
      body.expirationDays = body.expirationDays ? Number(body.expirationDays) : null;
      await api(editing ? `/api/consent-templates/${template.id}` : "/api/consent-templates", {
        method: editing ? "PUT" : "POST",
        body,
      });
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
      event.currentTarget.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
      document.getElementById("formError").textContent = localizedError(err);
    }
  });
}

function openFeedbackModal() {
  const appointments = (state.data.appointments || []).filter((item) => item.clientId && item.clientPhone);
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="feedbackForm">
      <div class="modal-head"><h3>${uiText("إرسال طلب تقييم", "שליחת בקשת משוב")}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">${select("appointmentId", pageLabel("appointments"), appointments.map((a) => [a.id, `${a.date} ${a.time} - ${a.clientName} - ${a.serviceName}`]), "")}</div>
      <div class="modal-foot"><button class="btn">${uiText("إرسال", "שליחה")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("feedbackForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/feedback", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
      if (result.fallbackUrl) window.open(result.fallbackUrl, "_blank", "noopener");
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
      document.getElementById("formError").textContent = localizedError(err);
    }
  });
}

function openGiftModal() {
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="giftForm">
      <div class="modal-head"><h3>${uiText("كرت هدية جديد", "כרטיס מתנה חדש")}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">
        ${select("fromClientId", uiText("من العميل", "מלקוח"), (state.data.clients || []).map((c) => [c.id, `${c.fname} ${c.lname}`]), "", false)}
        ${select("toClientId", uiText("إلى العميل", "ללקוח"), (state.data.clients || []).map((c) => [c.id, `${c.fname} ${c.lname}`]), "")}
        ${select("serviceId", pageLabel("services"), (state.data.services || []).map((s) => [s.id, s.name]), "", false)}
        ${field("sessions", uiText("عدد الجلسات", "מספר מפגשים"), "1", "number")}
        ${field("message", uiText("رسالة", "הודעה"), "", "textarea", false, "full")}
      </div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("giftForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.fromClientId = body.fromClientId ? Number(body.fromClientId) : null;
    body.toClientId = body.toClientId ? Number(body.toClientId) : null;
    body.serviceId = body.serviceId ? Number(body.serviceId) : null;
    body.sessions = Number(body.sessions || 1);
    try {
      await api("/api/gifts", { method: "POST", body });
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
      document.getElementById("formError").textContent = localizedError(err);
    }
  });
}

function printGiftCard(id) {
  const rawGift = (state.data.giftCards || []).find((item) => Number(item.id) === Number(id));
  if (!rawGift) return;
  const gift = Object.fromEntries(Object.entries(rawGift).map(([key, value]) => [key, escapeHtml(value)]));
  const win = window.open("", "_blank");
  win.document.write(`<html dir="rtl"><head><title>${gift.code}</title><style>body{font-family:Arial;padding:40px}.card{border:2px solid #111;padding:32px;border-radius:12px;text-align:center}code{font-size:24px}</style></head><body><div class="card"><h1>Clinova</h1><h2>${uiText("كرت هدية", "כרטיס מתנה")}</h2><p>${gift.serviceName || ""}</p><p>${gift.sessions || 1}</p><code>${gift.code}</code></div><script>print()</script></body></html>`);
  win.document.close();
}

function downloadTextFile(name, content) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function closeQuickSearchOnOutsideClick(event) {
  const wrapper = document.querySelector(".quick-search");
  const panel = document.getElementById("quickResults");
  if (wrapper && !wrapper.contains(event.target)) {
    panel?.classList.add("hidden");
  } else if (document.getElementById("quickSearch")) {
    document.addEventListener("click", closeQuickSearchOnOutsideClick, { once: true });
  }
}

function exportClinicCsv(kind) {
  const rowsByKind = {
    appointments: state.data.appointments || [],
    clients: state.data.clients || [],
    reports: state.data.appointments || [],
  };
  const rows = rowsByKind[kind] || [];
  const csv = rows.map((row) => Object.values(row).map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const heads = rows[0] ? `${Object.keys(rows[0]).join(",")}\n` : "";
  downloadTextFile(`clinova-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, heads + csv);
}

async function handleQuickSearch(event) {
  const input = event.currentTarget;
  const panel = document.getElementById("quickResults");
  const term = input.value.trim();
  state.quickSearch = input.value;
  if (!panel) return;
  if (term.length < 2) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }
  try {
    const result = await api(`/api/search?q=${encodeURIComponent(term)}`);
    const clients = result.clients || [];
    const appointments = result.appointments || [];
    const services = result.services || [];
    panel.innerHTML = html`
      ${clients.length ? `<strong>${escapeHtml(pageLabel("clients"))}</strong>${clients.map((client) => `<button type="button" data-quick-profile="${escapeAttr(client.id)}">${escapeHtml(client.fname || "")} ${escapeHtml(client.lname || "")}<small>${escapeHtml(client.phone || "")}</small></button>`).join("")}` : ""}
      ${appointments.length ? `<strong>${escapeHtml(pageLabel("appointments"))}</strong>${appointments.map((item) => `<button type="button" data-quick-appointment="${escapeAttr(item.id)}">${escapeHtml(item.clientName || "")}<small>${escapeHtml(item.date || "")} ${escapeHtml(item.time || "")}</small></button>`).join("")}` : ""}
      ${services.length ? `<strong>${escapeHtml(pageLabel("services"))}</strong>${services.map((service) => `<button type="button" data-page="services">${escapeHtml(service.name || "")}<small>${escapeHtml(currency())}${escapeHtml(service.price || 0)}</small></button>`).join("")}` : ""}
      ${!clients.length && !appointments.length && !services.length ? `<span class="muted">${clean("noData")}</span>` : ""}
    `;
    panel.classList.remove("hidden");
    panel.querySelectorAll("[data-quick-profile]").forEach((button) => button.addEventListener("click", () => openClientProfile(Number(button.dataset.quickProfile))));
    panel.querySelectorAll("[data-quick-appointment]").forEach((button) => button.addEventListener("click", () => openForm("appointments", Number(button.dataset.quickAppointment))));
    panel.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
      state.page = button.dataset.page;
      renderApp();
    }));
  } catch (err) {
    panel.replaceChildren();
    const message = document.createElement("span");
    message.className = "muted";
    message.textContent = localizedError(err);
    panel.append(message);
    panel.classList.remove("hidden");
  }
}

function appointmentTableFull(rows, actions = true) {
  const heads = [clean("table.date"), clean("table.time"), clean("table.client"), clean("table.service"), clean("table.therapist"), clean("table.price"), clean("table.payment"), clean("table.status")];
  return cleanTable(heads, rows, (a) => [
    a.date,
    a.time,
    a.clientName || "-",
    a.serviceName || "-",
    a.therapistName || "-",
    `${currency()}${Number(a.price || 0).toLocaleString()}`,
    cleanPaymentLabel(a.paymentStatus || "unpaid"),
    cleanStatusLabel(a.status || "pending"),
  ], actions ? (a) => `<td class="actions"><button class="btn secondary" data-appointment-details="${a.id}">${uiText("التفاصيل", "פרטים", "Details")}</button><button class="btn secondary" data-sign-appointment="${a.id}">${uiText("إقرار", "חתימה", "Consent")}</button><button class="btn secondary" data-receipt="${a.id}">${uiText("إيصال", "קבלה", "Receipt")}</button><button class="btn secondary" data-whatsapp="${a.id}">WhatsApp</button><button class="btn secondary" data-edit="appointments" data-id="${a.id}">${clean("edit")}</button>${state.user.role === "admin" ? `<button class="btn danger" data-delete="appointments" data-id="${a.id}">${clean("delete")}</button>` : ""}</td>` : "");
}

function openAppointmentConsentModal(appointmentId) {
  const appointment = (state.data.appointments || []).find((item) => Number(item.id) === Number(appointmentId));
  const templates = state.data.consentTemplates || [];
  const service = (state.data.services || []).find((item) => Number(item.id) === Number(appointment?.serviceId));
  const matchingTemplates = templates.filter((item) => Number(item.categoryId) === Number(service?.categoryId));
  if (!appointment) return showCenterError(uiText("لم يتم العثور على الموعد", "התור לא נמצא"));
  if (!templates.length) return showCenterError(uiText("لا توجد نماذج إقرار مرفوعة", "אין טפסים משפטיים שהועלו"));
  if (!matchingTemplates.length) return showCenterError(uiText("لا يوجد مستند إقرار صالح لهذه الخدمة", "אין טופס משפטי תקף לשירות הזה"));
  openConsentSignModal(Number(matchingTemplates[0].id), { appointmentId, clientId: appointment.clientId, signerName: appointment.clientName || "", lockedAppointment: true });
}

function openConsentSignModal(templateId, defaults = {}) {
  const templates = state.data.consentTemplates || [];
  const selectedTemplate = templates.find((item) => Number(item.id) === Number(templateId)) || templates[0];
  const clients = state.data.clients || [];
  const appointments = state.data.appointments || [];
  const lockedAppointment = Boolean(defaults.lockedAppointment);
  const lockedClient = clients.find((client) => Number(client.id) === Number(defaults.clientId));
  const lockedVisit = appointments.find((item) => Number(item.id) === Number(defaults.appointmentId));
  if (!selectedTemplate) return showCenterError(uiText("لا توجد نماذج إقرار", "אין טפסים משפטיים"));
  beginModalInteraction();
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card wide" id="consentSignForm" role="dialog" aria-modal="true" aria-labelledby="consentSignTitle">
      <div class="modal-head"><h3 id="consentSignTitle">${uiText("توقيع إقرار", "חתימת טופס")} - ${escapeHtml(selectedTemplate.title)}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">
        ${select("templateId", uiText("النموذج", "טופס"), templates.map((item) => [item.id, item.title]), selectedTemplate.id)}
        ${lockedAppointment ? `
          <input type="hidden" name="clientId" value="${escapeAttr(defaults.clientId || "")}">
          <input type="hidden" name="appointmentId" value="${escapeAttr(defaults.appointmentId || "")}">
          <div class="field"><label>${pageLabel("clients")}</label><input value="${escapeAttr(lockedClient ? `${lockedClient.fname} ${lockedClient.lname}` : defaults.signerName || "")}" disabled></div>
          <div class="field"><label>${pageLabel("appointments")}</label><input value="${escapeAttr(lockedVisit ? `${lockedVisit.date} ${lockedVisit.time} - ${lockedVisit.serviceName || ""}` : defaults.appointmentId || "")}" disabled></div>
        ` : `
          ${select("clientId", pageLabel("clients"), clients.map((client) => [client.id, `${client.fname} ${client.lname}`]), defaults.clientId || "", false)}
          ${select("appointmentId", pageLabel("appointments"), appointments.map((item) => [item.id, `${item.date} ${item.time} - ${item.clientName}`]), defaults.appointmentId || "", false)}
        `}
        ${field("signerName", uiText("اسم الموقّع", "שם החותם"), defaults.signerName || "", "text", true)}
        ${defaults.assignmentId ? `<label class="field full"><span>${uiText("شاهد من الطاقم", "עד צוות", "Staff witness")}</span><input type="checkbox" name="witness" value="true"></label>` : ""}
        <div class="field full"><label>${uiText("التوقيع", "חתימה")}</label><canvas id="signatureCanvas" width="720" height="220" style="width:100%;height:220px;border:1px solid #d9e2ec;border-radius:8px;background:white;touch-action:none"></canvas><button type="button" class="btn secondary" id="clearSignature">${uiText("مسح التوقيع", "ניקוי חתימה")}</button></div>
      </div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  bindModalAccessibility({ focusSelector: "input[name='signerName']" });
  const canvas = document.getElementById("signatureCanvas");
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasInk = false;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    hasInk = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const p = point(event);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  canvas.addEventListener("pointerup", () => { drawing = false; });
  canvas.addEventListener("pointerleave", () => { drawing = false; });
  document.getElementById("clearSignature").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
  });
  document.getElementById("consentSignForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.currentTarget.getAttribute("aria-busy") === "true") return;
    if (!hasInk) {
      document.getElementById("formError").textContent = uiText("يرجى إضافة التوقيع", "יש להוסיף חתימה");
      return;
    }
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const id = Number(body.templateId || selectedTemplate.id);
    body.clientId = body.clientId ? Number(body.clientId) : null;
    body.appointmentId = body.appointmentId ? Number(body.appointmentId) : null;
    body.signatureData = canvas.toDataURL("image/png");
    body.lang = state.lang;
    body.witness = body.witness === "true";
    delete body.templateId;
    const submit = event.currentTarget.querySelector("[type='submit']");
    event.currentTarget.setAttribute("aria-busy", "true");
    if (submit) submit.disabled = true;
    try {
      const endpoint = defaults.assignmentId
        ? `/api/patient-consents/${defaults.assignmentId}/sign`
        : `/api/consents/${id}/sign`;
      await api(endpoint, { method: "POST", body });
      if (defaults.assignmentId && defaults.clientId) {
        await openClientProfile(Number(defaults.clientId));
      } else {
        closeModal();
        await loadData();
        renderApp();
      }
    } catch (err) {
      event.currentTarget.removeAttribute("aria-busy");
      if (submit) submit.disabled = false;
      document.getElementById("formError").textContent = localizedError(err);
    }
  });
}

function cleanWorkDaysPicker(value) {
  const selected = new Set(selectedWorkDays(value));
  const days = state.lang === "he"
    ? [["0", "ראשון"], ["1", "שני"], ["2", "שלישי"], ["3", "רביעי"], ["4", "חמישי"], ["5", "שישי"], ["6", "שבת"]]
    : [["0", "الأحد"], ["1", "الإثنين"], ["2", "الثلاثاء"], ["3", "الأربعاء"], ["4", "الخميس"], ["5", "الجمعة"], ["6", "السبت"]];
  return `<div class="work-days">${days.map(([id, label]) => `<label><input type="checkbox" name="workDays" value="${id}" ${selected.has(Number(id)) ? "checked" : ""}> <span>${label}</span></label>`).join("")}</div>`;
}

function stageLabel(stage) {
  const labels = state.lang === "he"
    ? { lead: "ליד", qualified: "מתאים", active: "פעיל", follow_up: "מעקב", vip: "VIP", lost: "אבד", inactive: "לא פעיל" }
    : { lead: "عميل محتمل", qualified: "مؤهل", active: "نشط", follow_up: "متابعة", vip: "VIP", lost: "مفقود", inactive: "غير نشط" };
  return labels[stage] || stage || "-";
}

function statusPill(status) {
  return `<span class="pill ${status === "done" || status === "submitted" || status === "active" || status === "sent" || status === "dry_run" ? "done" : status === "cancelled" || status === "failed" || status === "redeemed" ? "cancelled" : "pending"}">${escapeHtml(cleanStatusLabel(status) === status ? status : cleanStatusLabel(status))}</span>`;
}

renderTeamUsers = function () {
  const pending = (state.data.invitations || []).filter((invite) => !invite.acceptedAt && Number(invite.expiresAt || 0) > Date.now());
  const userHeads = [uiText("اسم المستخدم", "שם משתמש"), uiText("البريد", "אימייל"), uiText("الاسم", "שם"), uiText("الدور", "תפקיד"), uiText("فعال", "פעיל")];
  return html`
    <div class="feature-grid">
      <div class="card">
        <h3>${uiText("دعوة عضو فريق", "הזמנת איש צוות")}</h3>
        <form id="inviteUserForm" class="inline-form">
          <input name="name" placeholder="${uiText("الاسم", "שם")}" required>
          <input name="email" type="email" placeholder="${uiText("البريد", "אימייל")}" required>
          <select name="role" required>
            <option value="therapist">${roleLabel("therapist")}</option>
            <option value="reception">${roleLabel("reception")}</option>
            <option value="admin">${roleLabel("admin")}</option>
          </select>
          <button class="btn">${uiText("إنشاء الدعوة", "יצירת הזמנה")}</button>
        </form>
      </div>
      <div class="card">
        <h3>${uiText("الدعوات المفتوحة", "הזמנות פתוחות")}</h3>
        <div class="stack-list">
          ${pending.map((invite) => `<div class="feature-row"><div><strong>${escapeHtml(invite.name)}</strong><span>${escapeHtml(invite.email)} · ${escapeHtml(roleLabel(invite.role))}</span><small>${escapeHtml(invite.inviteUrl || "")}</small></div><div class="actions"><button class="btn secondary" data-copy-invite="${escapeAttr(invite.inviteUrl || "")}">${uiText("نسخ", "העתקה")}</button><button class="btn danger" data-revoke-invite="${escapeAttr(invite.id)}">${uiText("إلغاء", "ביטול")}</button></div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}
        </div>
      </div>
    </div>
    <div class="card"><h3>${uiText("المستخدمون", "משתמשים")}</h3>${cleanTable(userHeads, state.data.users || [], (u) => [u.username, u.email || "-", u.name, roleLabel(u.role), yesNo(u.active)], (u) => `<td class="actions"><button class="btn secondary" data-edit="users" data-id="${u.id}">${clean("edit")}</button><button class="btn danger" data-delete="users" data-id="${u.id}">${clean("delete")}</button></td>`)}</div>
  `;
}

renderCrm = function () {
  const clients = state.data.clients || [];
  const tasks = state.data.crmTasks || [];
  const events = state.data.crmEvents || [];
  const stages = ["lead", "qualified", "active", "follow_up", "vip", "inactive", "lost"];
  return html`
    <div class="grid stats">
      ${statCard("#", clients.length, uiText("كل العملاء", "כל הלקוחות"), "blue")}
      ${statCard("#", clients.filter((c) => c.stage === "lead").length, stageLabel("lead"), "gold")}
      ${statCard("#", tasks.filter((t) => (t.status || "open") === "open").length, uiText("مهام مفتوحة", "משימות פתוחות"), "purple")}
      ${statCard("✓", tasks.filter((t) => t.status === "done").length, uiText("مهام مكتملة", "משימות שהושלמו"), "green")}
    </div>
    <div class="feature-grid">
      <div class="card">
        <h3>${uiText("إنشاء مهمة متابعة", "יצירת משימת מעקב")}</h3>
        <form id="crmTaskForm" class="inline-form">
          <select name="clientId" required>${optionList(clients, "id", (c) => `${c.fname} ${c.lname}`)}</select>
          <input name="title" placeholder="${uiText("عنوان المهمة", "כותרת משימה")}" required>
          <input name="dueDate" type="date">
          <select name="assignedTo">${optionList(state.data.users || [], "id", (u) => u.name, state.user.id)}</select>
          <select name="priority"><option value="normal">${uiText("عادي", "רגיל")}</option><option value="high">${uiText("مهم", "גבוה")}</option><option value="low">${uiText("منخفض", "נמוך")}</option></select>
          <input name="notes" placeholder="${uiText("ملاحظات", "הערות")}">
          <button class="btn">${clean("add")}</button>
        </form>
      </div>
      <div class="card">
        <h3>${uiText("آخر أحداث CRM", "אירועי CRM אחרונים")}</h3>
        <div class="stack-list">${events.slice(0, 8).map((event) => `<div class="feature-row"><div><strong>${escapeHtml(event.clientName || "-")}</strong><span>${escapeHtml(event.type || "")} · ${escapeHtml(event.createdAt || "")}</span><small>${escapeHtml(event.description || "")}</small></div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
    </div>
    <div class="kanban-grid">
      ${stages.map((stage) => `<div class="card"><h3>${escapeHtml(stageLabel(stage))}</h3><div class="stack-list">${clients.filter((c) => (c.stage || "lead") === stage).map((client) => `<div class="feature-row"><div><strong>${escapeHtml(client.fname)} ${escapeHtml(client.lname)}</strong><span>${escapeHtml(client.phone || "")}</span><small>${escapeHtml(client.notes || "")}</small></div><button class="btn secondary" data-profile="${escapeAttr(client.id)}">${uiText("ملف", "תיק")}</button></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>`).join("")}
    </div>
    <div class="card"><h3>${uiText("مهام المتابعة", "משימות מעקב")}</h3><div class="stack-list">${tasks.map((task) => `<div class="feature-row"><div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.clientName || "-")} · ${escapeHtml(task.dueDate || "-")}</span><small>${escapeHtml(task.notes || "")}</small></div><div class="actions">${statusPill(task.status || "open")}${(task.status || "open") !== "done" ? `<button class="btn secondary" data-crm-task-done="${escapeAttr(task.id)}">✓</button>` : ""}</div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>
  `;
}

renderWhatsApp = function () {
  const s = state.data.settings || {};
  const logs = state.data.messageLogs || [];
  return html`
    <div class="settings-grid">
      <div class="card">
        <h3>WhatsApp</h3>
        <form id="clinicSettingsForm">
          ${select("whatsappEnabled", uiText("تفعيل WhatsApp", "הפעלת WhatsApp"), [["false", uiText("رابط فقط", "קישור בלבד")], ["true", uiText("API مفعل", "API פעיל")]], s.whatsappEnabled || "false")}
          ${select("whatsappMode", uiText("وضع الإرسال", "מצב שליחה"), [["fallback", uiText("رابط WhatsApp", "קישור WhatsApp")], ["cloud", "Meta Cloud API"]], s.whatsappMode || "fallback")}
          ${field("whatsappBusinessPhone", uiText("رقم WhatsApp Business", "מספר WhatsApp Business"), s.whatsappBusinessPhone || "", "text", false)}
          ${field("whatsappTemplate", uiText("قالب تذكير الموعد", "תבנית תזכורת לתור"), s.whatsappTemplate || "", "textarea", false, "full")}
          ${field("whatsappFeedbackTemplate", uiText("قالب التقييم", "תבנית משוב"), s.whatsappFeedbackTemplate || "", "textarea", false, "full")}
          ${field("whatsappGiftTemplate", uiText("قالب الهدية", "תבנית מתנה"), s.whatsappGiftTemplate || "", "textarea", false, "full")}
          <button class="btn">${clean("save")}</button>
        </form>
      </div>
      <div class="card">
        <h3>${uiText("سجل رسائل WhatsApp", "יומן הודעות WhatsApp")}</h3>
        <div class="stack-list">${logs.map((log) => `<div class="feature-row"><div><strong>${escapeHtml(log.recipient || "-")}</strong><span>${escapeHtml(log.entity || "")} #${escapeHtml(log.entityId || "")} · ${escapeHtml(log.createdAt || "")}</span><small>${escapeHtml(log.error || log.message || "")}</small></div>${statusPill(log.status || "open")}</div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderConsents = function () {
  const templates = state.data.consentTemplates || [];
  const signatures = state.data.consentSignatures || [];
  return html`
    <div class="feature-grid">
      <div class="card"><h3>${uiText("نماذج PDF حسب القسم", "טפסי PDF לפי קטגוריה")}</h3>
        <div class="stack-list">${templates.map((t) => `<div class="feature-row"><div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.categoryName || "-")}</span><small>${escapeHtml(t.originalName || "")}</small></div><div class="actions"><a class="btn secondary" href="${escapeAttr(t.url)}" target="_blank" rel="noopener">PDF</a>${state.user.role !== "therapist" ? `<button class="btn danger" data-delete-consent="${escapeAttr(t.id)}">${clean("delete")}</button>` : ""}</div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${uiText("آخر التواقيع", "חתימות אחרונות")}</h3>
        <div class="stack-list">${signatures.map((s) => `<div class="feature-row"><div><strong>${escapeHtml(s.clientName || s.signerName || "-")}</strong><span>${escapeHtml(s.templateTitle || "")} · ${escapeHtml(s.signedAt || "")}</span></div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderFeedback = function () {
  const rows = state.data.feedbackRequests || [];
  const logs = (state.data.messageLogs || []).filter((log) => log.entity === "feedback_requests");
  return html`
    <div class="feature-grid">
      <div class="card"><h3>${uiText("طلبات التقييم", "בקשות משוב")}</h3>
        <div class="stack-list">${rows.map((r) => `<div class="feature-row"><div><strong>${escapeHtml(r.clientName || "-")}</strong><span>${escapeHtml(r.serviceName || "")} · ${escapeHtml(r.date || "")} ${escapeHtml(r.time || "")}</span>${r.comment ? `<small>${escapeHtml(r.comment)}</small>` : ""}</div><div>${statusPill(r.status || "sent")} ${r.rating ? `<strong>${escapeHtml(r.rating)}/5</strong>` : ""}</div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${uiText("رسائل التقييم", "הודעות משוב")}</h3><div class="stack-list">${logs.map((log) => `<div class="feature-row"><div><strong>${escapeHtml(log.recipient || "-")}</strong><span>${escapeHtml(log.createdAt || "")}</span><small>${escapeHtml(log.error || log.message || "")}</small></div>${statusPill(log.status || "open")}</div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div></div>
    </div>
  `;
}

renderGifts = function () {
  const rows = state.data.giftCards || [];
  return html`
    <div class="gift-board">${rows.map((g) => `<div class="gift-card">
      <div class="gift-ribbon">${uiText("هدية", "מתנה")}</div>
      <h3>${escapeHtml(g.serviceName || uiText("جلسة في العيادة", "שירות בקליניקה"))}</h3>
      <p>${escapeHtml(g.toClientName || "")}</p>
      <strong>${g.sessions || 1} ${uiText("جلسة", "מפגשים")}</strong>
      <code>${escapeHtml(g.code)}</code>
      <div class="actions"><span class="pill">${escapeHtml(g.status || "active")}</span><button class="btn secondary" data-gift-whatsapp="${escapeAttr(g.id)}">WhatsApp</button><button class="btn secondary" data-gift-print="${escapeAttr(g.id)}">${uiText("طباعة", "הדפסה")}</button>${g.status !== "redeemed" ? `<button class="btn secondary" data-gift-status="${escapeAttr(g.id)}" data-status="redeemed">${uiText("استخدام", "מימוש")}</button>` : ""}</div>
    </div>`).join("") || `<div class="card"><p class="muted">${clean("noData")}</p></div>`}</div>
  `;
}

renderReports = function () {
  const appointments = state.data.appointments || [];
  const clients = state.data.clients || [];
  const done = appointments.filter((a) => a.status === "done");
  const revenue = done.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const byTherapist = Object.entries(done.reduce((acc, item) => {
    acc[item.therapistName || "-"] = (acc[item.therapistName || "-"] || 0) + Number(item.price || 0);
    return acc;
  }, {})).map(([name, amount]) => ({ name, amount }));
  const tabs = [
    ["overview", uiText("نظرة عامة", "סקירה")],
    ["revenue", uiText("الإيرادات", "הכנסות")],
    ["appointments", pageLabel("appointments")],
    ["clients", pageLabel("clients")],
    ["therapists", uiText("المعالجون", "מטפלים")],
  ];
  const active = state.reportTab || "overview";
  const tabContent = active === "revenue"
    ? cleanTable([uiText("المعالج", "מטפל"), uiText("الإيراد", "הכנסה")], byTherapist, (row) => [row.name, `${currency()}${row.amount.toLocaleString()}`])
    : active === "appointments"
      ? appointmentTableClean(appointments, false)
      : active === "clients"
        ? cleanTable([uiText("الاسم", "שם"), uiText("الهاتف", "טלפון"), uiText("المرحلة", "שלב")], clients, (c) => [`${c.fname} ${c.lname}`, c.phone || "-", stageLabel(c.stage)])
        : active === "therapists"
          ? cleanTable([uiText("المعالج", "מטפל"), uiText("مواعيد مكتملة", "תורים שהושלמו"), uiText("الإيراد", "הכנסה")], byTherapist, (row) => [row.name, done.filter((a) => (a.therapistName || "-") === row.name).length, `${currency()}${row.amount.toLocaleString()}`])
          : `<div class="grid stats">${statCard("#", appointments.length, pageLabel("appointments"), "blue")}${statCard("#", clients.length, pageLabel("clients"), "green")}${statCard("✓", done.length, uiText("مكتملة", "הושלמו"), "purple")}${statCard("$", `${currency()}${revenue.toLocaleString()}`, uiText("الإيرادات", "הכנסות"), "gold")}</div>`;
  return html`<div class="toolbar"><div class="segmented">${tabs.map(([id, label]) => `<button data-report-tab="${id}" class="${active === id ? "active" : ""}">${label}</button>`).join("")}</div><button class="btn secondary" data-export="reports">CSV</button></div><div class="card">${tabContent}</div>`;
}

renderSettingsClean = function (message = "") {
  const s = state.data.settings || {};
  return html`
    <div class="settings-grid">
      ${state.user.role === "admin" ? `<div class="card"><h3>${uiText("إعدادات العيادة", "הגדרות קליניקה")}</h3>${message ? `<div class="alert">${escapeHtml(message)}</div>` : ""}<form id="clinicSettingsForm">
        ${field("clinicName", uiText("اسم العيادة", "שם הקליניקה"), s.clinicName || "Clinova")}
        ${field("currency", uiText("العملة", "מטבע"), s.currency || "₪")}
        ${field("workStart", uiText("بداية الدوام", "תחילת יום עבודה"), s.workStart || "09:00", "time")}
        ${field("workEnd", uiText("نهاية الدوام", "סיום יום עבודה"), s.workEnd || "18:00", "time")}
        <div class="field full"><label>${uiText("أيام العمل", "ימי עבודה")}</label>${cleanWorkDaysPicker(s.workDays)}</div>
        <fieldset class="reminder-settings">
          <legend>${uiText("تذكيرات المواعيد", "תזכורות לתורים", "Appointment reminders")}</legend>
          <div class="field">
            <label for="appointmentRemindersEnabled">${uiText("تفعيل التذكيرات", "הפעלת תזכורות", "Enable reminders")}</label>
            <select id="appointmentRemindersEnabled" name="appointmentRemindersEnabled">
              <option value="true" ${String(s.appointmentRemindersEnabled) !== "false" ? "selected" : ""}>${uiText("مفعّلة", "פעיל", "Enabled")}</option>
              <option value="false" ${String(s.appointmentRemindersEnabled) === "false" ? "selected" : ""}>${uiText("متوقفة", "כבוי", "Disabled")}</option>
            </select>
          </div>
          ${field("reminderTimingHours", uiText("قبل الموعد بساعات", "שעות לפני התור", "Hours before appointment"), s.reminderTimingHours || "24", "number")}
          <div class="field">
            <label for="sameDayReminderEnabled">${uiText("تذكير في نفس اليوم", "תזכורת ביום התור", "Same-day reminder")}</label>
            <select id="sameDayReminderEnabled" name="sameDayReminderEnabled">
              <option value="false" ${String(s.sameDayReminderEnabled) !== "true" ? "selected" : ""}>${uiText("متوقف", "כבוי", "Disabled")}</option>
              <option value="true" ${String(s.sameDayReminderEnabled) === "true" ? "selected" : ""}>${uiText("مفعّل", "פעיל", "Enabled")}</option>
            </select>
          </div>
          ${field("sameDayReminderTime", uiText("وقت تذكير نفس اليوم", "שעת תזכורת ביום התור", "Same-day reminder time"), s.sameDayReminderTime || "08:00", "time")}
          <div class="field">
            <label for="reminderChannel">${uiText("القناة المفضلة", "ערוץ מועדף", "Preferred channel")}</label>
            <select id="reminderChannel" name="reminderChannel">
              <option value="whatsapp" ${s.reminderChannel !== "email" ? "selected" : ""}>WhatsApp</option>
              <option value="email" ${s.reminderChannel === "email" ? "selected" : ""}>Email</option>
            </select>
          </div>
          <p class="muted full">${uiText("لا تُرسل رسائل خارجية في هذه المرحلة؛ يتم تجهيز السجلات والمحاكاة محلياً فقط.", "בשלב זה לא נשלחות הודעות חיצוניות; הרשומות מוכנות ומדומות מקומית בלבד.", "No external messages are sent in this sprint; records are prepared and simulated locally only.")}</p>
        </fieldset>
        <button class="btn">${clean("save")}</button>
      </form><div class="backup-panel"><h3>${uiText("نسخة احتياطية", "גיבוי מערכת")}</h3><p class="muted">${uiText("تحميل نسخة من قاعدة البيانات إلى هذا الجهاز.", "הורדת גיבוי של בסיס הנתונים למחשב זה.")}</p><a class="btn secondary" href="/api/system/export" download>${uiText("تحميل النسخة", "הורדת גיבוי")}</a></div></div>` : ""}
      <div class="card"><h3>${uiText("تغيير كلمة المرور", "שינוי סיסמה")}</h3><form id="passwordForm">${field("currentPassword", uiText("كلمة المرور الحالية", "סיסמה נוכחית"), "", "password")}${field("newPassword", uiText("كلمة مرور جديدة", "סיסמה חדשה"), "", "password")}<button class="btn">${uiText("تغيير", "שינוי")}</button></form></div>
    </div>
  `;
}

renderBilling = function () {
  return `<div class="card"><p class="muted">${uiText("الفوترة التجارية تدار من صفحة مالك النظام.", "החיוב המסחרי מנוהל מעמוד בעל המערכת.")}</p></div>`;
}

// Final clinic billing renderer overrides the legacy platform-subscription placeholder above.
renderBilling = function () {
  return renderBillingWorkspace({ language: state.lang, workspace: state.billingWorkspace });
}

appointmentTableClean = function (rows, actions = true) {
  return appointmentTableFull(rows, actions);
}

renderAppointmentsHe = function () {
  const search = String(state.filters.appointments || "").trim().toLowerCase();
  const status = state.filters.appointmentStatus || "all";
  const rows = (state.data.appointments || []).filter((item) => {
    const text = `${item.clientName || ""} ${item.clientPhone || ""} ${item.serviceName || ""} ${item.therapistName || ""} ${item.date || ""} ${item.time || ""}`.toLowerCase();
    return (!search || text.includes(search)) && (status === "all" || item.status === status);
  });
  return html`
    <div class="toolbar">
      <input data-filter="appointments" value="${escapeAttr(state.filters.appointments)}" placeholder="${uiText("بحث في المواعيد...", "חיפוש בתורים...", "Search appointments...")}">
      <select data-filter="appointmentStatus">
        <option value="all" ${status === "all" ? "selected" : ""}>${uiText("كل الحالات", "כל הסטטוסים", "All statuses")}</option>
        <option value="pending" ${status === "pending" ? "selected" : ""}>${cleanStatusLabel("pending")}</option>
        <option value="done" ${status === "done" ? "selected" : ""}>${cleanStatusLabel("done")}</option>
        <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>${cleanStatusLabel("cancelled")}</option>
      </select>
      <button class="btn secondary" data-export="appointments">CSV</button>
    </div>
    ${appointmentTableFull(rows, true)}
  `;
}

renderConsents = function () {
  const templates = state.data.consentTemplates || [];
  const signatures = state.data.consentSignatures || [];
  return html`
    <div class="feature-grid">
      <div class="card"><h3>${uiText("نماذج PDF حسب القسم", "טפסי PDF לפי קטגוריה")}</h3>
        <div class="stack-list">${templates.map((t) => `<div class="feature-row"><div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.categoryName || "-")}</span><small>${escapeHtml(t.originalName || "")}</small></div><div class="actions"><a class="btn secondary" href="${escapeAttr(t.url)}" target="_blank" rel="noopener">PDF</a>${state.user.role !== "therapist" ? `<button class="btn danger" data-delete-consent="${escapeAttr(t.id)}">${clean("delete")}</button>` : ""}</div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
      <div class="card"><h3>${uiText("آخر التواقيع", "חתימות אחרונות")}</h3>
        <div class="stack-list">${signatures.map((s) => `<div class="feature-row"><div><strong>${escapeHtml(s.clientName || s.signerName || "-")}</strong><span>${escapeHtml(s.templateTitle || "")} · ${escapeHtml(s.signedAt || "")}</span></div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </div>
    </div>
  `;
}

renderClientsHe = function () {
  const term = String(state.filters.clients || "").toLowerCase();
  const rows = (state.data.clients || []).filter((client) => `${client.fname || ""} ${client.lname || ""} ${client.phone || ""} ${client.email || ""} ${client.stage || ""}`.toLowerCase().includes(term));
  const heads = [uiText("الاسم", "שם"), uiText("الهاتف", "טלפון"), uiText("البريد", "אימייל"), uiText("المرحلة", "שלב")];
  return html`
    <div class="toolbar">
      <input data-filter="clients" value="${escapeAttr(state.filters.clients)}" placeholder="${uiText("بحث عن عميل...", "חיפוש לקוח...")}">
      <button class="btn secondary" data-export="clients">CSV</button>
    </div>
    ${cleanTable(heads, rows, (c) => [`${c.fname || ""} ${c.lname || ""}`, c.phone || "", c.email || "", stageLabel(c.stage)], (c) => `<td class="actions"><button class="btn secondary" data-profile="${c.id}">${uiText("ملف", "תיק")}</button>${state.user.role !== "therapist" ? `<button class="btn secondary" data-edit="clients" data-id="${c.id}">${clean("edit")}</button><button class="btn danger" data-delete="clients" data-id="${c.id}">${clean("delete")}</button>` : ""}</td>`)}
  `;
}

renderClientsHe = function () {
  return renderPatientWorkspace({
    language: state.lang,
    workspace: state.patientWorkspace,
    canManage: state.user.role !== "therapist",
  });
}

const openClientProfileLegacy = async function (id) {
  try {
    const data = await api(`/api/clients/${id}/history`);
    const canWrite = state.user.role !== "therapist";
    const client = data.client || {};
    const crmEvents = data.crmEvents || [];
    const visibleCrmEvents = crmEvents.slice(0, 3);
    const hiddenCrmEvents = crmEvents.slice(3);
    const renderCrmEvent = (event) => `<div class="feature-row"><div><strong>${escapeHtml(event.type || "-")}</strong><span>${escapeHtml(event.createdAt || "")}${event.userName ? ` · ${escapeHtml(event.userName)}` : ""}</span><small>${escapeHtml(event.description || "")}</small></div></div>`;
    document.getElementById("modalRoot").innerHTML = html`
      <div class="modal">
        <div class="modal-card wide">
          <div class="modal-head">
            <h3>${uiText("ملف العميل", "תיק לקוח")} - ${escapeHtml(client.fname || "")} ${escapeHtml(client.lname || "")}</h3>
            <button type="button" class="btn ghost" id="closeModal">${clean("close")}</button>
          </div>
          <div class="modal-body client-profile">
            <div class="card mini"><strong>${uiText("الهاتف", "טלפון")}</strong><span>${escapeHtml(client.phone || "-")}</span></div>
            <div class="card mini"><strong>${uiText("البريد", "אימייל")}</strong><span>${escapeHtml(client.email || "-")}</span></div>
            <div class="card mini"><strong>${uiText("المرحلة", "שלב")}</strong><span>${escapeHtml(stageLabel(client.stage))}</span></div>
            <div class="card mini"><strong>${uiText("ملاحظات", "הערות")}</strong><span class="pre-wrap">${escapeHtml(client.notes || "-")}</span></div>
            <div class="profile-section full">
              <h4>${uiText("\u0633\u062c\u0644 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f", "\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05ea\u05d5\u05e8\u05d9\u05dd")}</h4>
              ${appointmentTableClean(data.appointments || [], false)}
            </div>
            <div class="profile-section full">
              <h4>${uiText("\u0623\u062d\u062f\u0627\u062b CRM \u0627\u0644\u0623\u062e\u064a\u0631\u0629", "\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9 CRM \u05d0\u05d7\u05e8\u05d5\u05e0\u05d9\u05dd")}</h4>
              <div class="stack-list">
                ${visibleCrmEvents.map(renderCrmEvent).join("") || `<p class="muted">${clean("noData")}</p>`}
                ${hiddenCrmEvents.length ? `<details><summary>${uiText("\u0639\u0631\u0636 \u0627\u0644\u0645\u0632\u064a\u062f", "\u05d4\u05e6\u05d2 \u05e2\u05d5\u05d3")}</summary>${hiddenCrmEvents.map(renderCrmEvent).join("")}</details>` : ""}
              </div>
              ${canWrite ? `<form id="clientNoteForm" class="inline-form"><input name="note" placeholder="${uiText("\u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0627\u062d\u0638\u0629", "\u05d4\u05d5\u05e1\u05e3 \u05d4\u05e2\u05e8\u05d4")}" required><button class="btn secondary">${uiText("\u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0627\u062d\u0638\u0629", "\u05d4\u05d5\u05e1\u05e3 \u05d4\u05e2\u05e8\u05d4")}</button></form>` : ""}
            </div>
            <div class="profile-section full">
              <h4>${uiText("ملفات ومستندات العميل", "קבצים ומסמכי לקוח")}</h4>
              <div class="stack-list">
                ${(data.files || []).map((file) => `<div class="feature-row"><div><strong><a href="${escapeAttr(file.url)}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a></strong><span>${escapeHtml(file.notes || file.originalName || "")}</span><small>${file.size ? `${Math.round(file.size / 1024)}KB` : ""}</small></div>${canWrite ? `<button class="btn danger" data-delete-file="${escapeAttr(file.id)}" data-client="${escapeAttr(id)}">${clean("delete")}</button>` : ""}</div>`).join("") || `<p class="muted">${clean("noData")}</p>`}
              </div>
              ${canWrite ? `<form id="clientFileForm" class="inline-form upload-form"><input name="name" placeholder="${uiText("اسم الملف", "שם הקובץ")}"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required><input name="notes" placeholder="${uiText("ملاحظات", "הערות")}"><button class="btn">${uiText("رفع ملف", "העלאת קובץ")}</button></form><div class="muted upload-hint">JPG, PNG, WEBP, PDF · 10MB</div>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById("closeModal").addEventListener("click", closeModal);
    const noteForm = document.getElementById("clientNoteForm");
    if (noteForm) noteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/api/clients/${id}/notes`, { method: "POST", body: Object.fromEntries(new FormData(noteForm)) });
      await loadData();
      openClientProfile(id);
    });
    const fileForm = document.getElementById("clientFileForm");
    if (fileForm) fileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/api/clients/${id}/files`, { method: "POST", body: new FormData(fileForm) });
      openClientProfile(id);
    });
    document.querySelectorAll("[data-delete-file]").forEach((button) => button.addEventListener("click", async () => {
      await api(`/api/client-files/${button.dataset.deleteFile}`, { method: "DELETE" });
      openClientProfile(Number(button.dataset.client));
    }));
  } catch (err) {
    showCenterError(localizedError(err));
  }
}

topActionI18n = function () {
  if (state.user?.platformOwner) return "";
  if (state.page === "appointments") return `<button class="btn" data-new="appointments">${uiText("موعد جديد", "תור חדש", "New appointment")}</button>`;
  if (state.page === "clients" && state.user.role !== "therapist") return `<button class="btn" data-new="clients">${uiText("مريض جديد", "מטופל חדש", "New patient")}</button>`;
  if (state.page === "billing") return `<button class="btn" data-new-invoice>${uiText("فاتورة جديدة", "חשבונית חדשה", "New invoice")}</button>`;
  if (state.page === "consents" && state.user.role === "admin") return `<button class="btn" data-new-consent>${uiText("نموذج جديد", "תבנית חדשה", "New template")}</button>`;
  if (state.page === "feedback") return `<button class="btn" data-new-feedback>${uiText("إرسال تقييم", "שליחת משוב")}</button>`;
  if (state.page === "gifts") return `<button class="btn" data-new-gift>${uiText("كرت هدية", "כרטיס מתנה")}</button>`;
  if (["users", "categories", "services"].includes(state.page)) return `<button class="btn" data-new="${state.page}">${clean("add")}</button>`;
  return "";
}

renderPage = function () {
  if (state.user?.platformOwner) {
    if (state.page === "platformBilling") return renderPlatformBilling();
    if (state.page === "platformReports") return renderPlatformReports();
    if (state.page === "platformHealth") return renderPlatformHealth();
    return renderPlatformClinics();
  }
  if (state.page === "dashboard") return renderDashboardHe();
  if (state.page === "calendar") return renderCalendarHe();
  if (state.page === "appointments") return renderAppointmentsHe();
  if (state.page === "clients") return renderClientsHe();
  if (state.page === "crm") return renderCrm();
  if (state.page === "billing") return renderBilling();
  if (state.page === "whatsapp") return renderWhatsApp();
  if (state.page === "consents") return renderConsents();
  if (state.page === "feedback") return renderFeedback();
  if (state.page === "gifts") return renderGifts();
  if (state.page === "categories") return renderCategoriesHe();
  if (state.page === "services") return renderServicesHe();
  if (state.page === "users") return renderTeamUsers();
  if (state.page === "reports") return renderReports();
  if (state.page === "audit") return renderAudit();
  if (state.page === "settings") return renderSettingsClean();
  return "";
}

renderDashboardHe = function () {
  const appointments = state.data.appointments || [];
  const clients = state.data.clients || [];
  const tasks = state.data.crmTasks || [];
  const messages = state.data.messageLogs || [];
  const settings = state.data.settings || {};
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const todayRows = appointments.filter((item) => item.date === today).sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  const upcomingRows = appointments.filter((item) => item.date >= today && item.status !== "cancelled").sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 6);
  const doneToday = todayRows.filter((item) => item.status === "done");
  const pendingToday = todayRows.filter((item) => item.status === "pending");
  const monthDone = appointments.filter((item) => item.status === "done" && String(item.date || "").startsWith(monthPrefix));
  const monthRevenue = monthDone.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const allDone = appointments.filter((item) => item.status === "done");
  const totalRevenue = allDone.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const openTasks = tasks.filter((item) => (item.status || "open") === "open");
  const activeClients = clients.filter((item) => !["inactive", "lost"].includes(item.stage || ""));
  const completion = todayRows.length ? Math.round(doneToday.length / todayRows.length * 100) : 0;
  const whatsappOk = messages.filter((item) => ["sent", "dry_run"].includes(item.status)).length;
  const clinicName = settings.clinicName || "Clinova";
  const locale = state.lang === "he" ? "he-IL" : "ar";
  const workload = (state.data.users || []).filter((user) => ["therapist", "admin"].includes(user.role)).map((user) => {
    const rows = todayRows.filter((item) => Number(item.therapistId) === Number(user.id));
    return { name: user.name || user.username, rows, done: rows.filter((item) => item.status === "done").length };
  }).filter((item) => item.rows.length).slice(0, 5);
  return html`
    <div class="dashboard-pro">
      <section class="dashboard-hero">
        <div>
          <span class="dashboard-kicker">${uiText("واجهة التشغيل اليومية", "מרכז השליטה היומי")}</span>
          <h2>${escapeHtml(clinicName)}</h2>
          <p>${new Date().toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · ${uiText("الدوام", "שעות פעילות")} ${clinicWorkStart()} - ${clinicWorkEnd()}</p>
        </div>
        <div class="dashboard-hero-actions">
          <button class="btn" data-new="appointments">${uiText("موعد جديد", "תור חדש")}</button>
          <button class="btn secondary" data-new="clients">${uiText("عميل جديد", "לקוח חדש")}</button>
          <button class="btn secondary" data-page="calendar">${pageLabel("calendar")}</button>
        </div>
      </section>

      <section class="dashboard-metrics">
        <div class="metric-tile primary"><span>${uiText("مواعيد اليوم", "תורים היום")}</span><strong>${todayRows.length}</strong><small>${pendingToday.length} ${uiText("بانتظار التنفيذ", "ממתינים")}</small></div>
        <div class="metric-tile success"><span>${uiText("إنجاز اليوم", "השלמה היום")}</span><strong>${completion}%</strong><small>${doneToday.length}/${todayRows.length || 0}</small></div>
        <div class="metric-tile gold"><span>${uiText("إيراد الشهر", "הכנסות החודש")}</span><strong>${currency()}${monthRevenue.toLocaleString()}</strong><small>${monthDone.length} ${uiText("جلسة مكتملة", "תורים שהושלמו")}</small></div>
        <div class="metric-tile purple"><span>${uiText("عملاء نشطون", "לקוחות פעילים")}</span><strong>${activeClients.length}</strong><small>${clients.length} ${uiText("إجمالي العملاء", "לקוחות סך הכל")}</small></div>
      </section>

      <section class="dashboard-main-grid">
        <div class="dashboard-panel command-panel">
          <div class="panel-head">
            <div><h3>${uiText("مؤشر تشغيل اليوم", "מדד תפעול יומי")}</h3><p>${uiText("قراءة سريعة للأداء الحالي داخل العيادة", "תמונת מצב מהירה של פעילות הקליניקה")}</p></div>
            <div class="progress-ring" style="--value:${completion}"><strong>${completion}%</strong></div>
          </div>
          <div class="signal-grid">
            <div><span>${uiText("مكتملة", "הושלמו")}</span><strong>${doneToday.length}</strong></div>
            <div><span>${uiText("قيد الانتظار", "ממתינים")}</span><strong>${pendingToday.length}</strong></div>
            <div><span>${uiText("مهام CRM", "משימות CRM")}</span><strong>${openTasks.length}</strong></div>
            <div><span>WhatsApp</span><strong>${whatsappOk}</strong></div>
          </div>
        </div>

        <div class="dashboard-panel">
          <div class="panel-head"><div><h3>${uiText("المواعيد القادمة", "התורים הקרובים")}</h3><p>${uiText("أقرب مواعيد تحتاج متابعة", "התורים הבאים שדורשים מעקב")}</p></div><button class="btn ghost" data-page="appointments">${uiText("عرض الكل", "הצגת הכל")}</button></div>
          <div class="premium-list">
            ${upcomingRows.map((item) => `<button type="button" class="premium-row" data-edit="appointments" data-id="${escapeAttr(item.id)}"><strong>${escapeHtml(item.time || "-")} · ${escapeHtml(item.clientName || "-")}</strong><span>${escapeHtml(item.date)} · ${escapeHtml(item.serviceName || "-")} · ${escapeHtml(item.therapistName || "-")}</span><small>${escapeHtml(cleanStatusLabel(item.status || "pending"))} · ${escapeHtml(cleanPaymentLabel(item.paymentStatus || "unpaid"))}</small></button>`).join("") || `<p class="muted">${clean("noData")}</p>`}
          </div>
        </div>

        <div class="dashboard-panel">
          <div class="panel-head"><div><h3>${uiText("توزيع الفريق", "חלוקת צוות")}</h3><p>${uiText("ضغط العمل على المعالجين اليوم", "עומס העבודה של המטפלים היום")}</p></div></div>
          <div class="premium-list compact">
            ${workload.map((item) => `<div class="workload-row"><div><strong>${escapeHtml(item.name)}</strong><span>${item.done}/${item.rows.length} ${uiText("مكتمل", "הושלם")}</span></div><div class="workload-bar"><i style="width:${item.rows.length ? Math.round(item.done / item.rows.length * 100) : 0}%"></i></div></div>`).join("") || `<p class="muted">${uiText("لا يوجد ضغط عمل اليوم", "אין עומס עבודה היום")}</p>`}
          </div>
        </div>

        <div class="dashboard-panel">
          <div class="panel-head"><div><h3>${uiText("نبض العمل", "דופק העסק")}</h3><p>${uiText("أرقام مختصرة تساعدك على اتخاذ قرار سريع", "מספרים קצרים להחלטות מהירות")}</p></div></div>
          <div class="business-pulse">
            <div><span>${uiText("إيراد كلي", "הכנסה כוללת")}</span><strong>${currency()}${totalRevenue.toLocaleString()}</strong></div>
            <div><span>${uiText("طلبات تقييم", "בקשות משוב")}</span><strong>${(state.data.feedbackRequests || []).length}</strong></div>
            <div><span>${uiText("إقرارات", "חתימות")}</span><strong>${(state.data.consentSignatures || []).length}</strong></div>
            <div><span>${uiText("هدايا", "מתנות")}</span><strong>${(state.data.giftCards || []).length}</strong></div>
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-wide">
        <div class="panel-head"><div><h3>${uiText("جدول اليوم", "לוח היום")}</h3><p>${uiText("تحكم سريع بالمواعيد من واجهة البرنامج", "ניהול מהיר של התורים מהמסך הראשי")}</p></div></div>
        ${appointmentTableFull(todayRows.slice(0, 10), true)}
      </section>
    </div>
  `;
}

function renderDashboardPanel(titleKey, rows, renderRow, emptyKey, targetPage = "") {
  const title = foundationText(state.lang, titleKey);
  return html`
    <article class="foundation-panel">
      <div class="foundation-panel-head">
        <div><h2>${escapeHtml(title)}</h2><span>${escapeHtml(foundationText(state.lang, rows.length ? "dashboard.realData" : "dashboard.emptyState"))}</span></div>
        ${targetPage && rows.length ? `<button type="button" class="text-action" data-page="${escapeAttr(targetPage)}">${escapeHtml(foundationText(state.lang, "dashboard.viewAll"))}</button>` : ""}
      </div>
      ${rows.length
        ? `<div class="foundation-panel-list">${rows.slice(0, 4).map(renderRow).join("")}</div>`
        : `<div class="foundation-empty"><span class="empty-icon" aria-hidden="true">${iconMarkup(titleKey === "dashboard.todayAppointments" ? "calendar" : titleKey === "dashboard.recentPatients" ? "users" : titleKey === "dashboard.pendingActions" ? "audit" : "clock")}</span><p>${escapeHtml(foundationText(state.lang, emptyKey))}</p></div>`}
    </article>
  `;
}

renderDashboardHe = function () {
  const today = new Date().toISOString().slice(0, 10);
  const locale = state.lang === "he" ? "he-IL" : state.lang === "ar" ? "ar-IL" : "en-GB";
  const appointments = (state.data.appointments || [])
    .filter((item) => item.date === today && item.status !== "cancelled")
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  const waitingQueue = Array.isArray(state.data.waitingQueue) ? state.data.waitingQueue : [];
  const patients = (state.data.clients || []).slice(0, 4);
  const actions = (state.data.crmTasks || []).filter((item) => (item.status || "open") === "open");
  const clinicName = activeClinicName();
  const userName = state.user.name || state.user.username || "";
  const quickLinks = navigationFor(state.user).primary.filter((item) => item.page !== "dashboard").slice(0, 6);
  const dateLabel = new Date().toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const row = (primary, secondary, icon) => `<div class="foundation-data-row"><span class="data-row-icon">${iconMarkup(icon)}</span><div><strong>${escapeHtml(primary || "—")}</strong><span>${escapeHtml(secondary || "")}</span></div></div>`;

  return html`
    <div class="foundation-dashboard">
      <section class="welcome-card">
        <div>
          <span class="welcome-date">${escapeHtml(dateLabel)}</span>
          <h2>${escapeHtml(foundationText(state.lang, "dashboard.welcome", { name: userName }))}</h2>
          <p>${escapeHtml(foundationText(state.lang, "dashboard.welcomeBody", { clinic: clinicName }))}</p>
          <span class="signed-in-note">${escapeHtml(foundationText(state.lang, "dashboard.signedInAs", { name: userName }))}</span>
        </div>
        <div class="welcome-clinic" aria-label="${escapeAttr(foundationText(state.lang, "shell.currentClinic"))}"><span>${escapeHtml(foundationText(state.lang, "shell.currentClinic"))}</span><strong>${escapeHtml(clinicName)}</strong></div>
      </section>

      <section class="quick-navigation" aria-labelledby="quickNavigationTitle">
        <div class="section-heading"><h2 id="quickNavigationTitle">${escapeHtml(foundationText(state.lang, "dashboard.quickNavigation"))}</h2></div>
        <div class="quick-navigation-grid">
          ${quickLinks.map((item) => `<button type="button" data-page="${escapeAttr(item.page)}"><span class="quick-icon">${iconMarkup(item.icon)}</span><strong>${escapeHtml(foundationPageLabel(state.lang, item.page))}</strong><span class="quick-arrow" aria-hidden="true">←</span></button>`).join("")}
        </div>
      </section>

      <section class="foundation-dashboard-grid">
        ${renderDashboardPanel(
          "dashboard.todayAppointments",
          appointments,
          (item) => row(`${item.time || "—"} · ${item.clientName || ""}`, `${item.serviceName || ""}${item.therapistName ? ` · ${item.therapistName}` : ""}`, "calendar"),
          "dashboard.noAppointments",
          "appointments",
        )}
        ${renderDashboardPanel(
          "dashboard.waitingQueue",
          waitingQueue,
          (item) => row(item.clientName || item.name, item.status || "", "clock"),
          "dashboard.noQueue",
        )}
        ${renderDashboardPanel(
          "dashboard.recentPatients",
          patients,
          (item) => row(`${item.fname || ""} ${item.lname || ""}`.trim(), item.phone || item.email || "", "users"),
          "dashboard.noPatients",
          "clients",
        )}
        ${renderDashboardPanel(
          "dashboard.pendingActions",
          actions,
          (item) => row(item.title || item.description || "", item.dueDate || item.clientName || "", "audit"),
          "dashboard.noActions",
          "crm",
        )}
      </section>
    </div>
  `;
}

renderConsents = function () {
  const templates = state.data.consentTemplates || [];
  const signatures = state.data.consentSignatures || [];
  const isAdmin = state.user?.role === "admin";
  return html`
    <div class="feature-grid consent-management">
      <section class="card"><h3>${uiText("نماذج الموافقة", "תבניות הסכמה", "Consent templates")}</h3>
        <div class="stack-list">${templates.map((template) => `<article class="feature-row"><div><strong>${escapeHtml(template.title)}</strong><span>${escapeHtml(template.serviceName || template.categoryName || uiText("كل الخدمات", "כל השירותים", "All services"))} · ${escapeHtml(String(template.language || "he").toUpperCase())}</span><small>${escapeHtml(template.description || "")}${template.expirationDays ? ` · ${escapeHtml(template.expirationDays)} ${escapeHtml(uiText("يوم", "ימים", "days"))}` : ""}</small></div><div class="actions">${template.url ? `<a class="btn secondary" href="${escapeAttr(template.url)}" target="_blank" rel="noopener">PDF</a>` : ""}${isAdmin ? `<button class="btn secondary" type="button" data-edit-consent="${escapeAttr(template.id)}">${clean("edit")}</button><button class="btn danger" type="button" data-delete-consent="${escapeAttr(template.id)}">${uiText("تعطيل", "השבתה", "Deactivate")}</button>` : ""}</div></article>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </section>
      <section class="card"><h3>${uiText("آخر التوقيعات", "חתימות אחרונות", "Recent signatures")}</h3>
        <div class="stack-list">${signatures.map((signature) => `<article class="feature-row"><div><strong>${escapeHtml(signature.clientName || signature.signerName || "-")}</strong><span>${escapeHtml(signature.templateTitle || "")} · ${escapeHtml(signature.signedAt || "")}</span></div></article>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
      </section>
    </div>`;
}

function renderFoundationLoading() {
  setDocumentLanguage();
  mount(`<main class="foundation-boundary" aria-busy="true"><img src="/logo.svg" alt=""><div class="boundary-spinner" aria-hidden="true"></div><p>${escapeHtml(foundationText(state.lang, "shell.loading"))}</p></main>`);
}

function renderFoundationError(error) {
  setDocumentLanguage();
  mount(`<main class="foundation-boundary"><img src="/logo.svg" alt=""><h1>${escapeHtml(foundationText(state.lang, "shell.loadError"))}</h1><p>${escapeHtml(error?.message || "")}</p><button class="btn" id="retryBoot" type="button">${escapeHtml(foundationText(state.lang, "shell.retry"))}</button></main>`);
  document.getElementById("retryBoot")?.addEventListener("click", () => boot().catch(renderFoundationError));
}

window.addEventListener("hashchange", () => applyProtectedRoute());
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector(".appointment-drawer")) {
    closeAppointmentDrawer();
    return;
  }
  if (event.key === "Escape" && state.mobileNavOpen) {
    state.mobileNavOpen = false;
    renderApp();
  }
});

boot().catch((err) => {
  if (err?.status === 401) {
    state.user = null;
    setProtectedRoute("login", { replace: true });
    return;
  }
  renderFoundationError(err);
});






