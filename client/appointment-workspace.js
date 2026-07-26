import { escapeAttribute, escapeHtml } from "./safe-html.js";

const copy = {
  he: {
    day: "יום",
    week: "שבוע",
    previous: "הקודם",
    next: "הבא",
    today: "היום",
    staff: "איש צוות",
    allStaff: "כל הצוות",
    status: "סטטוס",
    allStatuses: "כל הסטטוסים",
    treatment: "טיפול",
    allTreatments: "כל הטיפולים",
    pending: "ממתין",
    done: "הושלם",
    cancelled: "בוטל",
    loading: "טוען את סביבת התורים…",
    loadError: "לא הצלחנו לטעון את סביבת התורים.",
    retry: "ניסיון חוזר",
    noAppointments: "אין תורים בטווח ובמסננים שנבחרו.",
    queue: "תור הקליניקה",
    queueHint: "תורים מתוכננים שמצבם ממתין",
    queueEmpty: "אין תורים ממתינים בתאריך זה.",
    scheduled: "שעה מתוכננת",
    agenda: "סדר היום",
    appointmentDetails: "פרטי התור",
    close: "סגירה",
    patient: "מטופל/ת",
    date: "תאריך",
    time: "שעה",
    duration: "משך",
    minutes: "דקות",
    assignedStaff: "איש צוות",
    notes: "סיכום הערות",
    noNotes: "לא נשמרו הערות לתור זה.",
    openPatient: "פתיחת תיק המטופל",
    detailsLoading: "טוען את פרטי התור…",
    detailsError: "לא הצלחנו לטעון את פרטי התור.",
    currentTime: "השעה הנוכחית",
    changeStatus: "שינוי סטטוס",
    saveStatus: "שמירת סטטוס",
  },
  ar: {
    day: "يوم",
    week: "أسبوع",
    previous: "السابق",
    next: "التالي",
    today: "اليوم",
    staff: "عضو الفريق",
    allStaff: "كل الفريق",
    status: "الحالة",
    allStatuses: "كل الحالات",
    treatment: "العلاج",
    allTreatments: "كل العلاجات",
    pending: "قيد الانتظار",
    done: "مكتمل",
    cancelled: "ملغي",
    loading: "جارٍ تحميل مساحة المواعيد…",
    loadError: "تعذر تحميل مساحة المواعيد.",
    retry: "إعادة المحاولة",
    noAppointments: "لا توجد مواعيد ضمن النطاق والفلاتر المحددة.",
    queue: "قائمة العيادة",
    queueHint: "المواعيد المجدولة بحالة قيد الانتظار",
    queueEmpty: "لا توجد مواعيد معلقة في هذا التاريخ.",
    scheduled: "الوقت المجدول",
    agenda: "جدول اليوم",
    appointmentDetails: "تفاصيل الموعد",
    close: "إغلاق",
    patient: "المريض",
    date: "التاريخ",
    time: "الوقت",
    duration: "المدة",
    minutes: "دقيقة",
    assignedStaff: "عضو الفريق",
    notes: "ملخص الملاحظات",
    noNotes: "لا توجد ملاحظات محفوظة لهذا الموعد.",
    openPatient: "فتح ملف المريض",
    detailsLoading: "جارٍ تحميل تفاصيل الموعد…",
    detailsError: "تعذر تحميل تفاصيل الموعد.",
    currentTime: "الوقت الحالي",
    changeStatus: "تغيير الحالة",
    saveStatus: "حفظ الحالة",
  },
  en: {
    day: "Day",
    week: "Week",
    previous: "Previous",
    next: "Next",
    today: "Today",
    staff: "Staff member",
    allStaff: "All staff",
    status: "Status",
    allStatuses: "All statuses",
    treatment: "Treatment",
    allTreatments: "All treatments",
    pending: "Pending",
    done: "Completed",
    cancelled: "Cancelled",
    loading: "Loading the appointment workspace…",
    loadError: "The appointment workspace could not be loaded.",
    retry: "Try again",
    noAppointments: "There are no appointments in the selected range and filters.",
    queue: "Clinic queue",
    queueHint: "Scheduled appointments with pending status",
    queueEmpty: "There are no pending appointments on this date.",
    scheduled: "Scheduled time",
    agenda: "Agenda",
    appointmentDetails: "Appointment details",
    close: "Close",
    patient: "Patient",
    date: "Date",
    time: "Time",
    duration: "Duration",
    minutes: "minutes",
    assignedStaff: "Assigned staff",
    notes: "Notes summary",
    noNotes: "No notes are stored for this appointment.",
    openPatient: "Open patient profile",
    detailsLoading: "Loading appointment details…",
    detailsError: "The appointment details could not be loaded.",
    currentTime: "Current time",
    changeStatus: "Change status",
    saveStatus: "Save status",
  },
};

export const emptyWorkspaceFilters = Object.freeze({ staff: "all", status: "all", service: "all" });

export function workspaceText(language, key) {
  return copy[language]?.[key] ?? copy.he[key] ?? key;
}

function localeFor(language) {
  return language === "he" ? "he-IL" : language === "ar" ? "ar-IL" : "en-GB";
}

function parseDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function isoCalendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function calendarDates(dateValue, view = "week") {
  const date = parseDate(dateValue);
  if (view === "day") return [date];
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function moveWorkspaceDate(dateValue, view, direction) {
  const date = parseDate(dateValue);
  date.setDate(date.getDate() + Number(direction || 0) * (view === "week" ? 7 : 1));
  return isoCalendarDate(date);
}

export function workspaceRangeTitle(language, dateValue, view) {
  const dates = calendarDates(dateValue, view);
  const locale = localeFor(language);
  if (view === "day") {
    return dates[0].toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  return `${dates[0].toLocaleDateString(locale)} – ${dates[dates.length - 1].toLocaleDateString(locale)}`;
}

export function filterWorkspaceAppointments(appointments = [], filters = emptyWorkspaceFilters, dateValue = "", view = "week") {
  const allowedDates = new Set(calendarDates(dateValue, view).map(isoCalendarDate));
  return appointments
    .filter((item) => allowedDates.has(item.date))
    .filter((item) => filters.staff === "all" || Number(item.therapistId) === Number(filters.staff))
    .filter((item) => filters.status === "all" || item.status === filters.status)
    .filter((item) => filters.service === "all" || Number(item.serviceId) === Number(filters.service))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function scheduledQueue(appointments = [], dateValue = "") {
  return appointments
    .filter((item) => item.date === dateValue && item.status === "pending")
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
}

function statusLabel(language, status) {
  return workspaceText(language, ["pending", "done", "cancelled"].includes(status) ? status : "pending");
}

function toMinutes(value = "00:00") {
  const [hours, minutes] = String(value).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function hourLabels(start, end) {
  const values = [];
  for (let minute = start; minute <= end; minute += 60) {
    values.push({ minute, label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:00` });
  }
  return values;
}

function appointmentButton(language, appointment, extraClass = "", style = "") {
  const status = ["pending", "done", "cancelled"].includes(appointment.status) ? appointment.status : "pending";
  const label = `${appointment.time || ""} ${appointment.clientName || ""}, ${appointment.serviceName || ""}, ${statusLabel(language, status)}`;
  return `<button type="button" class="workspace-appointment ${status} ${extraClass}" data-appointment-details="${escapeAttribute(appointment.id)}" aria-label="${escapeAttribute(label)}"${style ? ` style="${style}"` : ""}>
    <span class="appointment-time">${escapeHtml(appointment.time || "")}</span>
    <strong>${escapeHtml(appointment.clientName || "—")}</strong>
    <span>${escapeHtml(appointment.serviceName || "")}</span>
    <small>${escapeHtml(appointment.therapistName || "")} · ${escapeHtml(statusLabel(language, status))}</small>
  </button>`;
}

function relevantOptions(appointments, users, services) {
  const staffIds = new Set(appointments.map((item) => Number(item.therapistId)));
  const serviceIds = new Set(appointments.map((item) => Number(item.serviceId)));
  return {
    staff: users.filter((item) => staffIds.has(Number(item.id))),
    services: services.filter((item) => serviceIds.has(Number(item.id))),
  };
}

function filterSelect(label, attribute, value, options, allLabel) {
  return `<label class="workspace-filter"><span>${escapeHtml(label)}</span><select ${attribute}><option value="all">${escapeHtml(allLabel)}</option>${options.map((item) => `<option value="${escapeAttribute(item.value)}" ${String(value) === String(item.value) ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>`;
}

function renderFilters(language, appointments, users, services, filters) {
  const options = relevantOptions(appointments, users, services);
  return `<div class="workspace-filters" aria-label="${escapeAttribute(workspaceText(language, "agenda"))}">
    ${filterSelect(workspaceText(language, "staff"), "data-workspace-filter=\"staff\"", filters.staff, options.staff.map((item) => ({ value: item.id, label: item.name || item.username })), workspaceText(language, "allStaff"))}
    ${filterSelect(workspaceText(language, "status"), "data-workspace-filter=\"status\"", filters.status, ["pending", "done", "cancelled"].map((status) => ({ value: status, label: statusLabel(language, status) })), workspaceText(language, "allStatuses"))}
    ${filterSelect(workspaceText(language, "treatment"), "data-workspace-filter=\"service\"", filters.service, options.services.map((item) => ({ value: item.id, label: item.name })), workspaceText(language, "allTreatments"))}
  </div>`;
}

function renderDayTimeline(language, dateValue, appointments, users, workStart, workEnd, now) {
  const start = toMinutes(workStart);
  const end = Math.max(start + 60, toMinutes(workEnd));
  const pixelsPerMinute = 1.05;
  const laneHeight = Math.round((end - start) * pixelsPerMinute);
  const staffIds = [...new Set(appointments.map((item) => Number(item.therapistId)))];
  const staff = users.filter((item) => staffIds.includes(Number(item.id)));
  const visibleStaff = staff.length ? staff : users.slice(0, 1);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = isoCalendarDate(now);
  const showNow = dateValue === today && nowMinutes >= start && nowMinutes <= end;
  const nowTop = Math.round((nowMinutes - start) * pixelsPerMinute);

  return `<div class="workspace-day-timeline">
    <aside class="workspace-time-axis" style="height:${laneHeight}px">${hourLabels(start, end).map((item) => `<span style="top:${Math.round((item.minute - start) * pixelsPerMinute)}px">${item.label}</span>`).join("")}</aside>
    <div class="workspace-day-columns" style="grid-template-columns:repeat(${Math.max(visibleStaff.length, 1)}, minmax(190px,1fr))">
      ${visibleStaff.map((user) => {
        const rows = appointments.filter((item) => Number(item.therapistId) === Number(user.id));
        return `<section class="workspace-staff-column"><header><strong>${escapeHtml(user.name || user.username || "")}</strong></header><div class="workspace-time-lane" style="height:${laneHeight}px">
          ${hourLabels(start, end).map((item) => `<i class="workspace-hour-line" style="top:${Math.round((item.minute - start) * pixelsPerMinute)}px"></i>`).join("")}
          ${showNow ? `<i class="workspace-now-line" style="top:${nowTop}px" aria-label="${escapeAttribute(workspaceText(language, "currentTime"))}"></i>` : ""}
          ${rows.map((item) => {
            const top = Math.max(0, Math.round((toMinutes(item.time) - start) * pixelsPerMinute));
            const height = Math.max(48, Math.round(Number(item.duration || 30) * pixelsPerMinute));
            return appointmentButton(language, item, "timeline-appointment", `top:${top}px;height:${height}px`);
          }).join("")}
        </div></section>`;
      }).join("")}
    </div>
  </div>`;
}

function renderWeekBoard(language, dates, appointments) {
  const locale = localeFor(language);
  return `<div class="workspace-week-board">${dates.map((date) => {
    const dateValue = isoCalendarDate(date);
    const rows = appointments.filter((item) => item.date === dateValue);
    return `<section class="workspace-week-day"><header><span>${escapeHtml(date.toLocaleDateString(locale, { weekday: "short" }))}</span><strong>${escapeHtml(date.toLocaleDateString(locale, { day: "numeric", month: "numeric" }))}</strong></header><div>${rows.map((item) => appointmentButton(language, item)).join("") || `<p class="workspace-day-empty">${escapeHtml(workspaceText(language, "noAppointments"))}</p>`}</div></section>`;
  }).join("")}</div>`;
}

function renderMobileAgenda(language, dates, appointments) {
  const locale = localeFor(language);
  return `<div class="workspace-mobile-agenda"><h2>${escapeHtml(workspaceText(language, "agenda"))}</h2>${dates.map((date) => {
    const dateValue = isoCalendarDate(date);
    const rows = appointments.filter((item) => item.date === dateValue);
    if (!rows.length) return "";
    return `<section><h3>${escapeHtml(date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }))}</h3>${rows.map((item) => appointmentButton(language, item, "agenda-appointment")).join("")}</section>`;
  }).join("") || `<div class="workspace-empty">${escapeHtml(workspaceText(language, "noAppointments"))}</div>`}</div>`;
}

function renderQueue(language, queue) {
  return `<aside class="workspace-queue" aria-labelledby="queueTitle"><header><div><h2 id="queueTitle">${escapeHtml(workspaceText(language, "queue"))}</h2><p>${escapeHtml(workspaceText(language, "queueHint"))}</p></div><strong>${queue.length}</strong></header><div class="workspace-queue-list">${queue.map((item) => `<button type="button" data-appointment-details="${escapeAttribute(item.id)}"><span class="queue-time">${escapeHtml(item.time || "")}</span><div><strong>${escapeHtml(item.clientName || "—")}</strong><span>${escapeHtml(item.serviceName || "")}</span><small>${escapeHtml(item.therapistName || "")} · ${escapeHtml(workspaceText(language, "scheduled"))}</small></div><span class="pill pending">${escapeHtml(statusLabel(language, "pending"))}</span></button>`).join("") || `<div class="workspace-queue-empty"><p>${escapeHtml(workspaceText(language, "queueEmpty"))}</p></div>`}</div></aside>`;
}

export function renderAppointmentWorkspace({
  language = "he",
  date,
  view = "week",
  appointments = [],
  queue = [],
  users = [],
  services = [],
  filters = emptyWorkspaceFilters,
  settings = {},
  status = "ready",
  error = "",
  now = new Date(),
} = {}) {
  if (status === "loading" || status === "idle") {
    return `<section class="workspace-boundary" aria-busy="true"><span class="boundary-spinner" aria-hidden="true"></span><p>${escapeHtml(workspaceText(language, "loading"))}</p></section>`;
  }
  if (status === "error") {
    return `<section class="workspace-boundary" role="alert"><h2>${escapeHtml(workspaceText(language, "loadError"))}</h2><p>${escapeHtml(error)}</p><button type="button" class="btn" data-workspace-retry>${escapeHtml(workspaceText(language, "retry"))}</button></section>`;
  }

  const normalizedView = view === "day" ? "day" : "week";
  const dates = calendarDates(date, normalizedView);
  const filtered = filterWorkspaceAppointments(appointments, filters, date, normalizedView);
  const filteredQueue = queue
    .filter((item) => filters.staff === "all" || Number(item.therapistId) === Number(filters.staff))
    .filter((item) => filters.status === "all" || item.status === filters.status)
    .filter((item) => filters.service === "all" || Number(item.serviceId) === Number(filters.service));
  const staffIds = new Set(filtered.map((item) => Number(item.therapistId)));
  const visibleUsers = users.filter((item) => staffIds.has(Number(item.id)));

  return `<div class="appointment-workspace">
    <section class="workspace-toolbar card">
      <div class="workspace-view-toggle" aria-label="${escapeAttribute(workspaceText(language, "agenda"))}">${["day", "week"].map((item) => `<button type="button" data-workspace-view="${item}" class="${normalizedView === item ? "active" : ""}">${escapeHtml(workspaceText(language, item))}</button>`).join("")}</div>
      <div class="workspace-date-navigation"><button type="button" class="btn secondary" data-workspace-move="-1">${escapeHtml(workspaceText(language, "previous"))}</button><button type="button" class="btn secondary" data-workspace-today>${escapeHtml(workspaceText(language, "today"))}</button><input type="date" data-workspace-date value="${escapeAttribute(date)}" aria-label="${escapeAttribute(workspaceText(language, "date"))}"><button type="button" class="btn secondary" data-workspace-move="1">${escapeHtml(workspaceText(language, "next"))}</button></div>
      <strong class="workspace-range-title">${escapeHtml(workspaceRangeTitle(language, date, normalizedView))}</strong>
      ${renderFilters(language, appointments, users, services, filters)}
    </section>
    <div class="workspace-layout">
      <section class="workspace-calendar card" aria-label="${escapeAttribute(workspaceText(language, "agenda"))}">
        ${filtered.length ? "" : `<div class="workspace-empty-banner">${escapeHtml(workspaceText(language, "noAppointments"))}</div>`}
        <div class="workspace-desktop-calendar">${normalizedView === "day" ? renderDayTimeline(language, date, filtered, visibleUsers.length ? visibleUsers : users.slice(0, 1), settings.workStart || "09:00", settings.workEnd || "18:00", now) : renderWeekBoard(language, dates, filtered)}</div>
        ${renderMobileAgenda(language, dates, filtered)}
      </section>
      ${renderQueue(language, filteredQueue)}
    </div>
  </div>`;
}

export function renderAppointmentDetails({ language = "he", status = "ready", appointment = null, error = "", canChangeStatus = false } = {}) {
  let content = "";
  if (status === "loading") {
    content = `<div class="appointment-detail-boundary" aria-busy="true"><span class="boundary-spinner" aria-hidden="true"></span><p>${escapeHtml(workspaceText(language, "detailsLoading"))}</p></div>`;
  } else if (status === "error" || !appointment) {
    content = `<div class="appointment-detail-boundary" role="alert"><p>${escapeHtml(error || workspaceText(language, "detailsError"))}</p></div>`;
  } else {
    content = `<div class="appointment-detail-content">
      <div class="appointment-detail-patient"><span>${escapeHtml(workspaceText(language, "patient"))}</span><strong>${escapeHtml(appointment.clientName || "—")}</strong><small>${escapeHtml(appointment.serviceName || "")}</small></div>
      <dl>
        <div><dt>${escapeHtml(workspaceText(language, "date"))}</dt><dd>${escapeHtml(appointment.date || "—")}</dd></div>
        <div><dt>${escapeHtml(workspaceText(language, "time"))}</dt><dd>${escapeHtml(appointment.time || "—")}</dd></div>
        <div><dt>${escapeHtml(workspaceText(language, "duration"))}</dt><dd>${escapeHtml(String(appointment.duration || "—"))} ${escapeHtml(workspaceText(language, "minutes"))}</dd></div>
        <div><dt>${escapeHtml(workspaceText(language, "status"))}</dt><dd><span class="pill ${escapeAttribute(appointment.status || "pending")}">${escapeHtml(statusLabel(language, appointment.status))}</span></dd></div>
        <div><dt>${escapeHtml(workspaceText(language, "treatment"))}</dt><dd>${escapeHtml(appointment.serviceName || "—")}</dd></div>
        <div><dt>${escapeHtml(workspaceText(language, "assignedStaff"))}</dt><dd>${escapeHtml(appointment.therapistName || "—")}</dd></div>
      </dl>
      <section class="appointment-detail-notes"><h3>${escapeHtml(workspaceText(language, "notes"))}</h3><p>${escapeHtml(appointment.notes || workspaceText(language, "noNotes"))}</p></section>
      ${canChangeStatus ? `<form class="appointment-status-form" data-appointment-status-form="${escapeAttribute(appointment.id)}"><label>${escapeHtml(workspaceText(language, "changeStatus"))}<select name="status">${["pending", "done", "cancelled"].map((value) => `<option value="${value}" ${appointment.status === value ? "selected" : ""}>${escapeHtml(statusLabel(language, value))}</option>`).join("")}</select></label><button class="btn" type="submit">${escapeHtml(workspaceText(language, "saveStatus"))}</button></form>` : ""}
      ${appointment.clientId ? `<button type="button" class="btn secondary" data-appointment-patient="${escapeAttribute(appointment.clientId)}">${escapeHtml(workspaceText(language, "openPatient"))}</button>` : ""}
    </div>`;
  }

  return `<div class="appointment-drawer-layer"><button type="button" class="appointment-drawer-scrim" data-close-appointment-drawer aria-label="${escapeAttribute(workspaceText(language, "close"))}"></button><aside class="appointment-drawer" role="dialog" aria-modal="true" aria-labelledby="appointmentDrawerTitle"><header><h2 id="appointmentDrawerTitle">${escapeHtml(workspaceText(language, "appointmentDetails"))}</h2><button type="button" class="icon-button" data-close-appointment-drawer aria-label="${escapeAttribute(workspaceText(language, "close"))}">×</button></header>${content}</aside></div>`;
}
