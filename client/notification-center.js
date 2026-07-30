import { escapeAttribute, escapeHtml } from "./safe-html.js";

const copy = {
  ar: {
    title: "الإشعارات",
    bell: "فتح مركز الإشعارات",
    unread: "إشعار غير مقروء",
    unreadMany: "إشعارات غير مقروءة",
    markAll: "تحديد الكل كمقروء",
    empty: "لا توجد إشعارات حالياً.",
    loading: "جارٍ تحميل الإشعارات…",
    retry: "إعادة المحاولة",
    error: "تعذر تحميل الإشعارات.",
    open: "فتح السجل المرتبط",
  },
  he: {
    title: "התראות",
    bell: "פתיחת מרכז ההתראות",
    unread: "התראה שלא נקראה",
    unreadMany: "התראות שלא נקראו",
    markAll: "סימון הכל כנקרא",
    empty: "אין התראות כרגע.",
    loading: "ההתראות נטענות…",
    retry: "ניסיון חוזר",
    error: "לא ניתן לטעון את ההתראות.",
    open: "פתיחת הרשומה המקושרת",
  },
  en: {
    title: "Notifications",
    bell: "Open notification center",
    unread: "unread notification",
    unreadMany: "unread notifications",
    markAll: "Mark all as read",
    empty: "No notifications yet.",
    loading: "Loading notifications…",
    retry: "Retry",
    error: "Notifications could not be loaded.",
    open: "Open related record",
  },
};

function text(language, key) {
  return (copy[language] || copy.en)[key];
}

function formattedDate(value, language) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return String(value);
  const locale = language === "he" ? "he-IL" : language === "ar" ? "ar" : "en";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function notificationIcon(type) {
  if (String(type).includes("consent")) return "✓";
  if (String(type).includes("clinical") || String(type).includes("follow_up")) return "+";
  return "◷";
}

function renderItem(item, language) {
  const unread = item.status === "unread";
  const related = item.relatedEntityType && item.relatedEntityId;
  return `
    <article class="notification-item ${unread ? "is-unread" : ""}">
      <span class="notification-type-icon" aria-hidden="true">${notificationIcon(item.type)}</span>
      <button type="button" class="notification-item-action" data-notification-id="${escapeAttribute(item.id)}"
        data-related-type="${escapeAttribute(item.relatedEntityType || "")}"
        data-related-id="${escapeAttribute(item.relatedEntityId || "")}"
        aria-label="${escapeAttribute(related ? text(language, "open") : item.title)}">
        <span class="notification-item-heading">
          <strong>${escapeHtml(item.title)}</strong>
          ${unread ? '<span class="notification-unread-dot" aria-hidden="true"></span>' : ""}
        </span>
        <span>${escapeHtml(item.message)}</span>
        <time datetime="${escapeAttribute(item.createdAt || "")}">${escapeHtml(formattedDate(item.createdAt, language))}</time>
      </button>
    </article>`;
}

export function renderNotificationCenter({
  language = "en",
  state = {},
  disabled = false,
} = {}) {
  const items = Array.isArray(state.items) ? state.items : [];
  const unreadCount = Math.max(0, Number(state.unreadCount) || 0);
  const status = state.status || "idle";
  const open = Boolean(state.open);
  const actionPending = Boolean(state.actionPending);
  const countLabel = `${unreadCount} ${text(language, unreadCount === 1 ? "unread" : "unreadMany")}`;
  let body = "";

  if (status === "loading" || status === "idle") {
    body = `<div class="notification-boundary" role="status"><span class="notification-spinner" aria-hidden="true"></span>${escapeHtml(text(language, "loading"))}</div>`;
  } else if (status === "error") {
    body = `<div class="notification-boundary notification-error" role="alert"><span>${escapeHtml(state.error || text(language, "error"))}</span><button type="button" class="btn secondary" data-notification-retry>${escapeHtml(text(language, "retry"))}</button></div>`;
  } else if (!items.length) {
    body = `<div class="notification-boundary notification-empty">${escapeHtml(text(language, "empty"))}</div>`;
  } else {
    body = `<div class="notification-list">${items.map((item) => renderItem(item, language)).join("")}</div>`;
  }

  return `
    <div class="notification-center ${open ? "is-open" : ""}">
      <button type="button" class="icon-button notification-bell" data-notification-toggle
        aria-label="${escapeAttribute(`${text(language, "bell")}. ${countLabel}`)}"
        aria-haspopup="dialog" aria-expanded="${open}" ${disabled ? "disabled" : ""}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        ${unreadCount ? `<span class="notification-badge" aria-hidden="true">${unreadCount > 99 ? "99+" : unreadCount}</span>` : ""}
      </button>
      ${open ? `
        <section class="notification-popover" role="dialog" aria-modal="false" aria-label="${escapeAttribute(text(language, "title"))}">
          <header>
            <div><h2>${escapeHtml(text(language, "title"))}</h2><span aria-live="polite">${escapeHtml(countLabel)}</span></div>
            ${unreadCount ? `<button type="button" class="notification-mark-all" data-notification-read-all ${actionPending ? "disabled" : ""}>${escapeHtml(text(language, "markAll"))}</button>` : ""}
          </header>
          ${body}
        </section>` : ""}
    </div>`;
}

export function notificationTarget(item = {}) {
  const id = Number(item.relatedEntityId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (item.relatedEntityType === "appointment") return { page: "appointments", id };
  if (item.relatedEntityType === "patient" || item.relatedEntityType === "client") return { page: "clients", id };
  return null;
}
