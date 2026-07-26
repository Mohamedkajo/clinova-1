import { escapeAttribute, escapeHtml } from "./safe-html.js";

const copy = {
  en: {
    title: "New appointment", close: "Close", patientStep: "1. Find the patient", search: "Search by name, phone, or email", searchAction: "Search", searching: "Searching…", noResults: "No matching patient was found.", select: "Select", selected: "Selected patient", createAction: "Create a new patient", createTitle: "Create patient", firstName: "First name", lastName: "Last name", phone: "Phone", email: "Email", createPatient: "Create patient", bookingStep: "2. Appointment details", service: "Service", therapist: "Therapist", date: "Date", time: "Time", duration: "Duration", minutes: "minutes", notes: "Notes", save: "Save appointment", saving: "Saving…", patientRequired: "Select or create a patient before saving.", noServices: "No active services are available.", noTherapists: "No therapists are available.",
  },
  he: {
    title: "תור חדש", close: "סגירה", patientStep: "1. איתור המטופל", search: "חיפוש לפי שם, טלפון או אימייל", searchAction: "חיפוש", searching: "מחפש…", noResults: "לא נמצא מטופל מתאים.", select: "בחירה", selected: "מטופל שנבחר", createAction: "יצירת מטופל חדש", createTitle: "יצירת מטופל", firstName: "שם פרטי", lastName: "שם משפחה", phone: "טלפון", email: "אימייל", createPatient: "יצירת מטופל", bookingStep: "2. פרטי התור", service: "שירות", therapist: "מטפל/ת", date: "תאריך", time: "שעה", duration: "משך", minutes: "דקות", notes: "הערות", save: "שמירת התור", saving: "שומר…", patientRequired: "יש לבחור או ליצור מטופל לפני השמירה.", noServices: "אין שירותים פעילים זמינים.", noTherapists: "אין מטפלים זמינים.",
  },
  ar: {
    title: "موعد جديد", close: "إغلاق", patientStep: "1. البحث عن المريض", search: "البحث بالاسم أو الهاتف أو البريد", searchAction: "بحث", searching: "جارٍ البحث…", noResults: "لم يتم العثور على مريض مطابق.", select: "اختيار", selected: "المريض المختار", createAction: "إنشاء مريض جديد", createTitle: "إنشاء مريض", firstName: "الاسم الأول", lastName: "اسم العائلة", phone: "الهاتف", email: "البريد الإلكتروني", createPatient: "إنشاء المريض", bookingStep: "2. تفاصيل الموعد", service: "الخدمة", therapist: "المعالج", date: "التاريخ", time: "الوقت", duration: "المدة", minutes: "دقيقة", notes: "ملاحظات", save: "حفظ الموعد", saving: "جارٍ الحفظ…", patientRequired: "اختر مريضاً أو أنشئه قبل الحفظ.", noServices: "لا توجد خدمات فعالة متاحة.", noTherapists: "لا يوجد معالجون متاحون.",
  },
};

const text = (language, key) => copy[language]?.[key] || copy.en[key] || key;
const safe = (value) => escapeHtml(value ?? "");
const attr = (value) => escapeAttribute(value ?? "");

export function selectedServiceDuration(services, serviceId) {
  return Number(services.find((item) => Number(item.id) === Number(serviceId))?.duration || 0);
}

function optionRows(items, value, label) {
  return items.map((item) => `<option value="${attr(item.id)}" ${Number(item.id) === Number(value) ? "selected" : ""}>${safe(label(item))}</option>`).join("");
}

export function renderBookingWorkflow({
  language = "en",
  patientResults = [],
  selectedPatient = null,
  services = [],
  therapists = [],
  values = {},
  searching = false,
  searched = false,
  showCreate = false,
  canCreatePatient = false,
  saving = false,
  error = "",
} = {}) {
  const duration = selectedServiceDuration(services, values.serviceId);
  const patientResultsMarkup = patientResults.map((patient) => `<button type="button" class="booking-patient-result" data-booking-patient="${attr(patient.id)}"><span><strong>${safe(patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim())}</strong><small>${safe(patient.phone || "")}${patient.email ? ` · ${safe(patient.email)}` : ""}</small></span><b>${safe(text(language, "select"))}</b></button>`).join("");
  const createPanel = showCreate && canCreatePatient ? `<form class="booking-create-patient" data-booking-create-patient><h4>${safe(text(language, "createTitle"))}</h4><div class="booking-form-grid"><label>${safe(text(language, "firstName"))}<input name="fname" required></label><label>${safe(text(language, "lastName"))}<input name="lname" required></label><label>${safe(text(language, "phone"))}<input name="phone" required></label><label>${safe(text(language, "email"))}<input name="email" type="email"></label></div><button class="btn secondary" type="submit">${safe(text(language, "createPatient"))}</button></form>` : "";
  const unavailable = !services.length ? text(language, "noServices") : !therapists.length ? text(language, "noTherapists") : "";

  return `<div class="modal booking-modal"><section class="modal-card booking-card" role="dialog" aria-modal="true" aria-labelledby="bookingTitle">
    <header class="modal-head"><h3 id="bookingTitle">${safe(text(language, "title"))}</h3><button type="button" class="btn ghost" data-close-booking>${safe(text(language, "close"))}</button></header>
    <div class="modal-body booking-body">
      <section class="booking-section"><h4>${safe(text(language, "patientStep"))}</h4>
        <form class="booking-patient-search" data-booking-search><input name="q" value="${attr(values.patientQuery || "")}" placeholder="${attr(text(language, "search"))}" autocomplete="off" required><button class="btn secondary" type="submit">${safe(searching ? text(language, "searching") : text(language, "searchAction"))}</button></form>
        ${selectedPatient ? `<div class="booking-selected-patient"><span>${safe(text(language, "selected"))}</span><strong>${safe(selectedPatient.name)}</strong><small>${safe(selectedPatient.phone || "")}${selectedPatient.email ? ` · ${safe(selectedPatient.email)}` : ""}</small></div>` : ""}
        <div class="booking-patient-results">${searching ? `<p class="muted">${safe(text(language, "searching"))}</p>` : patientResultsMarkup || (searched ? `<p class="muted">${safe(text(language, "noResults"))}</p>` : "")}</div>
        ${canCreatePatient && searched && !patientResults.length ? `<button class="btn ghost" type="button" data-booking-show-create>${safe(text(language, "createAction"))}</button>` : ""}
        ${createPanel}
      </section>
      <section class="booking-section"><h4>${safe(text(language, "bookingStep"))}</h4>
        <form data-booking-form>
          <input type="hidden" name="clientId" value="${attr(selectedPatient?.id || "")}">
          <div class="booking-form-grid">
            <label>${safe(text(language, "service"))}<select name="serviceId" required>${optionRows(services, values.serviceId, (item) => item.name)}</select></label>
            <label>${safe(text(language, "therapist"))}<select name="therapistId" required>${optionRows(therapists, values.therapistId, (item) => item.name || item.username)}</select></label>
            <label>${safe(text(language, "date"))}<input name="date" type="date" value="${attr(values.date || "")}" required></label>
            <label>${safe(text(language, "time"))}<input name="time" type="time" value="${attr(values.time || "")}" required></label>
            <label>${safe(text(language, "duration"))}<output data-booking-duration>${safe(duration)} ${safe(text(language, "minutes"))}</output></label>
            <label class="full">${safe(text(language, "notes"))}<textarea name="notes">${safe(values.notes || "")}</textarea></label>
          </div>
          ${error || unavailable ? `<p class="booking-error" role="alert">${safe(error || unavailable)}</p>` : ""}
          <button class="btn" type="submit" ${saving || !selectedPatient || Boolean(unavailable) ? "disabled" : ""}>${safe(saving ? text(language, "saving") : text(language, "save"))}</button>
          ${!selectedPatient ? `<small class="muted">${safe(text(language, "patientRequired"))}</small>` : ""}
        </form>
      </section>
    </div>
  </section></div>`;
}
