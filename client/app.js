import { escapeAttribute, escapeHtml } from "./safe-html.js";

const state = {
  user: null,
  page: "dashboard",
  data: { users: [], invitations: [], categories: [], services: [], clients: [], crmTasks: [], crmEvents: [], appointments: [], consentTemplates: [], consentSignatures: [], feedbackRequests: [], giftCards: [], messageLogs: [], tenantDomains: [], audits: [], settings: {} },
  filters: { appointments: "", appointmentStatus: "all", clients: "" },
  calendarView: "week",
  calendarDate: new Date().toISOString().slice(0, 10),
  quickSearch: "",
  quickResults: null,
  lang: ["he", "ar"].includes(localStorage.getItem("clinova-lang")) ? localStorage.getItem("clinova-lang") : "he",
  reportTab: "overview",
};

const APP_VERSION = "1.6.2";

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
  reception: ["dashboard", "calendar", "appointments", "clients", "crm", "consents", "feedback", "gifts", "settings"],
  therapist: ["dashboard", "calendar", "appointments", "clients", "crm", "consents", "settings"],
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
    error.code = data.error || "";
    error.details = data.details || {};
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

function closeModal() {
  const root = document.getElementById("modalRoot");
  if (root) root.innerHTML = "";
}

function localizedError(err) {
  return err?.message || (state.lang === "he" ? "אירעה שגיאה" : "حدث خطأ");
}

function showCenterError(message) {
  let alert = document.getElementById("centerError");
  if (!alert) {
    alert = document.createElement("div");
    alert.id = "centerError";
    alert.className = "center-error";
    document.body.appendChild(alert);
  }
  alert.textContent = message;
  window.setTimeout(() => alert.remove(), 3000);
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
    await api(`/api/${button.dataset.delete}/${button.dataset.id}`, { method: "DELETE" });
    await loadData();
    renderApp();
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
    state.page = button.dataset.page;
    renderApp();
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
  document.querySelectorAll("[data-platform-tenant-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tenantId = form.dataset.platformTenantForm;
    const result = await api(`/api/platform/tenants/${tenantId}`, { method: "PUT", body: Object.fromEntries(new FormData(form)) });
    state.data.platformTenants = result.tenants;
    renderApp();
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
  bindRestoredSectionActions();
}

async function boot() {
  const inviteToken = new URLSearchParams(location.search).get("invite");
  if (inviteToken) {
    renderAcceptInvitation(inviteToken);
    return;
  }
  const me = await api("/api/me");
  if (!me.user) {
    renderLogin();
    return;
  }
  state.user = me.user;
  await loadData();
  renderApp();
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
topActionI18n = function () {
  if (state.page === "appointments") return `<button class="btn" data-new="appointments">${tr("newAppointment")}</button>`;
  if (state.page === "clients" && state.user.role !== "therapist") return `<button class="btn" data-new="clients">${tr("newClient")}</button>`;
  if (state.page === "consents" && state.user.role !== "therapist") return `<button class="btn" data-new-consent>${state.lang === "he" ? "העלאת PDF" : "رفع PDF"}</button>`;
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
        <div class="stack-list">${templates.map((t) => `<div class="feature-row"><div><strong>${t.title}</strong><span>${t.categoryName || "-"}</span></div><div class="actions"><a class="btn secondary" href="${t.url}" target="_blank" rel="noopener">PDF</a><button class="btn secondary" data-sign-consent="${t.id}">${he ? "חתימה" : "توقيع"}</button>${state.user.role !== "therapist" ? `<button class="btn danger" data-delete-consent="${t.id}">${tr("delete")}</button>` : ""}</div></div>`).join("") || `<p class="muted">${tr("noData")}</p>`}</div>
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
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
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
      ${select("stage", he ? "שלב CRM" : "مرحلة CRM", [["lead", crmStageLabel("lead")], ["qualified", crmStageLabel("qualified")], ["active", crmStageLabel("active")], ["vip", "VIP"], ["lost", crmStageLabel("lost")]], row.stage || "lead")}
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
  const he = state.lang === "he";
  state.calendarView = state.calendarView || "week";
  state.calendarDate = state.calendarDate || new Date().toISOString().slice(0, 10);
  const days = calendarDays();
  const therapists = calendarTherapists();
  return html`
    <div class="calendar-toolbar toolbar">
      <div class="segmented">
        ${["month", "week", "day"].map((view) => `<button type="button" class="${state.calendarView === view ? "active" : ""}" data-calendar-view="${view}">${he ? ({ month: "חודש", week: "שבוע", day: "יום" }[view]) : ({ month: "شهر", week: "أسبوع", day: "يوم" }[view])}</button>`).join("")}
      </div>
      <button type="button" class="btn secondary" data-calendar-move="-1">${he ? "הקודם" : "السابق"}</button>
      <input type="date" data-calendar-date value="${state.calendarDate}">
      <button type="button" class="btn secondary" data-calendar-move="1">${he ? "הבא" : "التالي"}</button>
      <strong>${calendarRangeTitle()}</strong>
    </div>
    <div class="calendar-legend">
      ${therapists.map((user) => `<span><strong>${escapeHtml(user.name || user.username)}</strong> ${escapeHtml(roleLabel(user.role))}</span>`).join("")}
    </div>
    <div class="card calendar-card">
      ${state.calendarView === "month" ? renderMonthCalendar(days, he) : state.calendarView === "day" ? renderDayCalendar(days, therapists, he) : renderWeekCalendar(days, therapists, he)}
    </div>
  `;
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

renderBilling = function () {
  return renderPlatformAdmin();
}

function field(name, label, value = "", type = "text", required = true, extraClass = "") {
  const safeValue = escapeAttr(value ?? "");
  if (type === "textarea") {
    return `<div class="field ${escapeAttr(extraClass)}"><label>${escapeHtml(label)}</label><textarea name="${escapeAttr(name)}" ${required ? "required" : ""}>${safeValue}</textarea></div>`;
  }
  return `<div class="field ${escapeAttr(extraClass)}"><label>${escapeHtml(label)}</label><input name="${escapeAttr(name)}" type="${escapeAttr(type)}" value="${safeValue}" ${required ? "required" : ""}></div>`;
}

function select(name, label, options = [], value = "", required = true) {
  const current = String(value ?? "");
  return `<div class="field"><label>${escapeHtml(label)}</label><select name="${escapeAttr(name)}" ${required ? "required" : ""}>${options.map(([id, text]) => `<option value="${escapeAttr(id)}" ${String(id) === current ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></div>`;
}

openForm = function (resource, id = null, defaults = {}) {
  const row = id ? (state.data[resource] || []).find((item) => Number(item.id) === Number(id)) : defaults;
  const he = state.lang === "he";
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="entityForm">
      <div class="modal-head"><h3>${id ? (he ? "עריכה" : "تعديل") : (he ? "הוספה" : "إضافة")} ${pageLabel(resource) || ""}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">${formFieldsHe(resource, row || {})}</div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("entityForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
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

formFieldsHe = function (resource, row = {}) {
  if (resource === "clients") return html`${field("fname", state.lang === "he" ? "שם פרטי" : "الاسم الأول", row.fname || "")}${field("lname", state.lang === "he" ? "שם משפחה" : "اسم العائلة", row.lname || "")}${field("phone", state.lang === "he" ? "טלפון" : "الهاتف", row.phone || "")}${field("email", state.lang === "he" ? "אימייל" : "البريد", row.email || "", "email", false)}${field("notes", state.lang === "he" ? "הערות" : "ملاحظات", row.notes || "", "textarea", false, "full")}`;
  if (resource === "appointments") return html`${select("clientId", pageLabel("clients"), (state.data.clients || []).map((c) => [c.id, `${c.fname} ${c.lname}`]), row.clientId || "")}${select("serviceId", pageLabel("services"), (state.data.services || []).map((s) => [s.id, s.name]), row.serviceId || "")}${select("therapistId", clean("table.therapist"), therapists(), row.therapistId || state.user.id)}${field("date", clean("table.date"), row.date || new Date().toISOString().slice(0, 10), "date")}${field("time", clean("table.time"), row.time || clinicWorkStart(), "time")}${select("status", clean("table.status"), [["pending", cleanStatusLabel("pending")], ["done", cleanStatusLabel("done")], ["cancelled", cleanStatusLabel("cancelled")]], row.status || "pending")}${select("paymentStatus", clean("table.payment"), [["unpaid", cleanPaymentLabel("unpaid")], ["paid", cleanPaymentLabel("paid")], ["deposit", cleanPaymentLabel("deposit")]], row.paymentStatus || "unpaid")}${field("paidAmount", state.lang === "he" ? "סכום ששולם" : "المبلغ المدفوع", row.paidAmount || 0, "number", false)}${field("notes", state.lang === "he" ? "הערות" : "ملاحظات", row.notes || "", "textarea", false, "full")}`;
  if (resource === "categories") return field("name", state.lang === "he" ? "שם קטגוריה" : "اسم القسم", row.name || "");
  if (resource === "services") return html`${field("name", state.lang === "he" ? "שם שירות" : "اسم الخدمة", row.name || "")}${select("categoryId", pageLabel("categories"), (state.data.categories || []).map((c) => [c.id, c.name]), row.categoryId || "")}${field("duration", state.lang === "he" ? "משך בדקות" : "المدة بالدقائق", row.duration || 60, "number")}${field("price", clean("table.price"), row.price || 0, "number")}${select("active", state.lang === "he" ? "פעיל" : "فعال", [["true", clean("yes")], ["false", clean("no")]], String(row.active !== false))}`;
  if (resource === "users") return html`${field("username", state.lang === "he" ? "שם משתמש" : "اسم المستخدم", row.username || "")}${field("password", state.lang === "he" ? "סיסמה חדשה" : "كلمة مرور جديدة", "", "password", !row.id)}${field("name", state.lang === "he" ? "שם" : "الاسم", row.name || "")}${field("email", state.lang === "he" ? "אימייל" : "البريد", row.email || "", "email", false)}${select("role", state.lang === "he" ? "תפקיד" : "الدور", [["admin", roleLabel("admin")], ["reception", roleLabel("reception")], ["therapist", roleLabel("therapist")]], row.role || "therapist")}${select("active", state.lang === "he" ? "פעיל" : "فعال", [["true", clean("yes")], ["false", clean("no")]], String(row.active !== false))}`;
  return "";
}

renderApp = function () {
  const nav = state.user.platformOwner ? ["platform", "platformBilling", "platformReports", "platformHealth"] : (navByRole[state.user.role] || []);
  if (!nav.includes(state.page)) state.page = nav[0] || "dashboard";
  const safeUserName = escapeHtml(state.user.name);
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  mount(html`<div class="shell"><aside class="sidebar"><div class="brand"><img class="brand-logo" src="${escapeAttr(logoSrc())}" alt="Clinova"><div><h3>Clinova</h3><div style="opacity:.75;font-size:12px">${state.user.platformOwner ? clean("platformSystem") : clean("system")}</div><div class="app-version">v${escapeHtml(APP_VERSION)}</div></div></div><nav class="nav">${nav.map((page) => `<button data-page="${escapeAttr(page)}" class="${state.page === page ? "active" : ""}">${escapeHtml(pageLabel(page))}</button>`).join("")}</nav><div class="user-box"><strong>${safeUserName}</strong><span style="opacity:.75">${escapeHtml(roleLabel(state.user.role))}</span><button class="btn ghost" id="logoutBtn" style="color:white;border-color:rgba(255,255,255,.35)">${clean("logout")}</button></div></aside><main class="main"><header class="topbar"><div><h2>${escapeHtml(pageLabel(state.page))}</h2><div class="muted page-subtitle">${escapeHtml(pageSubtitle())}</div></div><div class="topbar-actions">${languagePicker()}${renderQuickSearchLive()}${topActionI18n()}</div></header><section class="content">${renderPage()}</section></main></div><div id="modalRoot"></div>`);
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    state.user = null;
    renderLogin();
  });
  bindPageActions();
}

renderLogin = function (error = "") {
  const he = state.lang === "he";
  document.documentElement.lang = state.lang;
  document.documentElement.dir = "rtl";
  mount(html`<main class="login"><form class="login-card" id="loginForm"><div class="brand"><img class="brand-logo" src="/logo.svg" alt="Clinova"><div><h1>Clinova</h1><div class="muted">${he ? "מערכת ניהול קליניקה" : "نظام إدارة العيادة"}</div></div></div>${error ? `<div class="alert">${escapeHtml(error)}</div>` : ""}<div class="field"><label>${he ? "שם משתמש" : "اسم المستخدم"}</label><input name="username" autocomplete="username" required></div><div class="field"><label>${he ? "סיסמה" : "كلمة المرور"}</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn" style="width:100%">${he ? "כניסה" : "دخول"}</button><div class="version-badge">v${escapeHtml(APP_VERSION)}</div></form></main>`);
  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api("/api/login", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
      state.user = result.user;
      await loadData();
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function uiText(ar, he) {
  return state.lang === "he" ? he : ar;
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
    reloadAfter(() => api("/api/settings", { method: "PUT", body }));
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
  document.querySelectorAll("[data-quick-profile]").forEach((button) => button.addEventListener("click", () => openClientProfile(Number(button.dataset.quickProfile))));
  document.querySelectorAll("[data-quick-appointment]").forEach((button) => button.addEventListener("click", () => openForm("appointments", Number(button.dataset.quickAppointment))));
}

function openConsentUploadModal() {
  const he = state.lang === "he";
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card" id="consentUploadForm">
      <div class="modal-head"><h3>${he ? "העלאת טופס PDF" : "رفع نموذج PDF"}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
      <div class="modal-body">
        ${field("title", uiText("عنوان النموذج", "שם הטופס"), "", "text")}
        ${select("categoryId", pageLabel("categories"), (state.data.categories || []).map((c) => [c.id, c.name]), "", false)}
        <div class="field full"><label>PDF</label><input name="file" type="file" accept="application/pdf" required></div>
      </div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("consentUploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/consents", { method: "POST", body: new FormData(event.currentTarget) });
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
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
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
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
  ], actions ? (a) => `<td class="actions"><button class="btn secondary" data-sign-appointment="${a.id}">${uiText("إقرار", "חתימה")}</button><button class="btn secondary" data-receipt="${a.id}">${uiText("إيصال", "קבלה")}</button><button class="btn secondary" data-whatsapp="${a.id}">WhatsApp</button><button class="btn secondary" data-edit="appointments" data-id="${a.id}">${clean("edit")}</button>${state.user.role === "admin" ? `<button class="btn danger" data-delete="appointments" data-id="${a.id}">${clean("delete")}</button>` : ""}</td>` : "");
}

function openAppointmentConsentModal(appointmentId) {
  const appointment = (state.data.appointments || []).find((item) => Number(item.id) === Number(appointmentId));
  const templates = state.data.consentTemplates || [];
  if (!appointment) return showCenterError(uiText("لم يتم العثور على الموعد", "התור לא נמצא"));
  if (!templates.length) return showCenterError(uiText("لا توجد نماذج إقرار مرفوعة", "אין טפסים משפטיים שהועלו"));
  openConsentSignModal(Number(templates[0].id), { appointmentId, clientId: appointment.clientId, signerName: appointment.clientName || "", lockedAppointment: true });
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
  document.getElementById("modalRoot").innerHTML = html`
    <div class="modal"><form class="modal-card wide" id="consentSignForm">
      <div class="modal-head"><h3>${uiText("توقيع إقرار", "חתימת טופס")} - ${escapeHtml(selectedTemplate.title)}</h3><button type="button" class="btn ghost" id="closeModal">${clean("close")}</button></div>
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
        <div class="field full"><label>${uiText("التوقيع", "חתימה")}</label><canvas id="signatureCanvas" width="720" height="220" style="width:100%;height:220px;border:1px solid #d9e2ec;border-radius:8px;background:white;touch-action:none"></canvas><button type="button" class="btn secondary" id="clearSignature">${uiText("مسح التوقيع", "ניקוי חתימה")}</button></div>
      </div>
      <div class="modal-foot"><button class="btn">${clean("save")}</button><div id="formError" class="muted"></div></div>
    </form></div>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
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
    delete body.templateId;
    try {
      await api(`/api/consents/${id}/sign`, { method: "POST", body });
      closeModal();
      await loadData();
      renderApp();
    } catch (err) {
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
        <button class="btn">${clean("save")}</button>
      </form><div class="backup-panel"><h3>${uiText("نسخة احتياطية", "גיבוי מערכת")}</h3><p class="muted">${uiText("تحميل نسخة من قاعدة البيانات إلى هذا الجهاز.", "הורדת גיבוי של בסיס הנתונים למחשב זה.")}</p><a class="btn secondary" href="/api/system/export" download>${uiText("تحميل النسخة", "הורדת גיבוי")}</a></div></div>` : ""}
      <div class="card"><h3>${uiText("تغيير كلمة المرور", "שינוי סיסמה")}</h3><form id="passwordForm">${field("currentPassword", uiText("كلمة المرور الحالية", "סיסמה נוכחית"), "", "password")}${field("newPassword", uiText("كلمة مرور جديدة", "סיסמה חדשה"), "", "password")}<button class="btn">${uiText("تغيير", "שינוי")}</button></form></div>
    </div>
  `;
}

renderBilling = function () {
  return `<div class="card"><p class="muted">${uiText("الفوترة التجارية تدار من صفحة مالك النظام.", "החיוב המסחרי מנוהל מעמוד בעל המערכת.")}</p></div>`;
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
      <input data-filter="appointments" value="${escapeAttr(state.filters.appointments)}" placeholder="${uiText("بحث في المواعيد...", "חיפוש בתורים...")}">
      <select data-filter="appointmentStatus">
        <option value="all" ${status === "all" ? "selected" : ""}>${uiText("كل الحالات", "כל הסטטוסים")}</option>
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
        <div class="stack-list">${templates.map((t) => `<div class="feature-row"><div><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.categoryName || "-")}</span><small>${escapeHtml(t.originalName || "")}</small></div><div class="actions"><a class="btn secondary" href="${escapeAttr(t.url)}" target="_blank" rel="noopener">PDF</a><button class="btn secondary" data-sign-consent="${escapeAttr(t.id)}">${uiText("توقيع", "חתימה")}</button>${state.user.role !== "therapist" ? `<button class="btn danger" data-delete-consent="${escapeAttr(t.id)}">${clean("delete")}</button>` : ""}</div></div>`).join("") || `<p class="muted">${clean("noData")}</p>`}</div>
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

openClientProfile = async function (id) {
  try {
    const data = await api(`/api/clients/${id}/history`);
    const canWrite = state.user.role !== "therapist";
    const client = data.client || {};
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
              <h4>${uiText("سجل المواعيد", "היסטוריית תורים")}</h4>
              ${appointmentTableClean(data.appointments || [], false)}
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
  if (state.page === "appointments") return `<button class="btn" data-new="appointments">${uiText("موعد جديد", "תור חדש")}</button>`;
  if (state.page === "clients" && state.user.role !== "therapist") return `<button class="btn" data-new="clients">${uiText("عميل جديد", "לקוח חדש")}</button>`;
  if (state.page === "consents" && state.user.role !== "therapist") return `<button class="btn" data-new-consent>${uiText("رفع PDF", "העלאת PDF")}</button>`;
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

boot().catch((err) => renderLogin(err.message));






