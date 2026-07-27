import { escapeAttribute, escapeHtml } from "./safe-html.js";

const copy = {
  en: {
    title: "Clinical visit", loading: "Loading clinical visit…", error: "The clinical visit could not be loaded.",
    close: "Close", patient: "Patient", appointment: "Appointment", therapist: "Therapist", service: "Service",
    status: "Record status", draft: "Draft", completed: "Completed", treatmentSummary: "Treatment summary",
    clinicalObservations: "Clinical observations", recommendations: "Recommendations",
    followUpInstructions: "Follow-up instructions", internalNotes: "Internal clinical notes",
    save: "Save draft", update: "Save changes", complete: "Complete clinical record",
    required: "Required", restricted: "Clinical contents are restricted for your role.",
    metadata: "A clinical visit record exists for this appointment.", newRecord: "No clinical visit has been recorded yet.",
    completionHint: "Completing this record does not implicitly change the appointment status.",
  },
  he: {
    title: "ביקור קליני", loading: "טוען ביקור קליני…", error: "לא ניתן לטעון את הביקור הקליני.",
    close: "סגירה", patient: "מטופל/ת", appointment: "תור", therapist: "מטפל/ת", service: "שירות",
    status: "סטטוס הרשומה", draft: "טיוטה", completed: "הושלם", treatmentSummary: "סיכום הטיפול",
    clinicalObservations: "תצפיות קליניות", recommendations: "המלצות",
    followUpInstructions: "הנחיות מעקב", internalNotes: "הערות קליניות פנימיות",
    save: "שמירת טיוטה", update: "שמירת שינויים", complete: "השלמת הרשומה הקלינית",
    required: "חובה", restricted: "התוכן הקליני מוגבל לתפקידך.",
    metadata: "קיימת רשומת ביקור קליני לתור זה.", newRecord: "טרם נשמר ביקור קליני.",
    completionHint: "השלמת הרשומה אינה משנה אוטומטית את סטטוס התור.",
  },
  ar: {
    title: "الزيارة السريرية", loading: "جارٍ تحميل الزيارة السريرية…", error: "تعذر تحميل الزيارة السريرية.",
    close: "إغلاق", patient: "المريض", appointment: "الموعد", therapist: "المعالج", service: "الخدمة",
    status: "حالة السجل", draft: "مسودة", completed: "مكتمل", treatmentSummary: "ملخص العلاج",
    clinicalObservations: "الملاحظات السريرية", recommendations: "التوصيات",
    followUpInstructions: "تعليمات المتابعة", internalNotes: "الملاحظات السريرية الداخلية",
    save: "حفظ المسودة", update: "حفظ التغييرات", complete: "إكمال السجل السريري",
    required: "مطلوب", restricted: "المحتوى السريري محجوب حسب صلاحيات دورك.",
    metadata: "يوجد سجل زيارة سريرية لهذا الموعد.", newRecord: "لم تُسجل زيارة سريرية بعد.",
    completionHint: "إكمال هذا السجل لا يغيّر حالة الموعد تلقائياً.",
  },
};

const t = (language, key) => copy[language]?.[key] || copy.en[key] || key;
const safe = (value) => escapeHtml(value ?? "");
const attr = (value) => escapeAttribute(value ?? "");

function boundary(language, status, error) {
  const message = status === "loading" ? t(language, "loading") : error || t(language, "error");
  return `<div class="clinical-visit-boundary" ${status === "loading" ? 'aria-busy="true"' : 'role="alert"'}><p>${safe(message)}</p></div>`;
}

function summary(language, appointment, visit) {
  return `<section class="clinical-visit-summary">
    <div><span>${safe(t(language, "patient"))}</span><strong>${safe(appointment.patientName || "")}</strong><small>${safe(appointment.patientPhone || "")}</small></div>
    <div><span>${safe(t(language, "appointment"))}</span><strong>${safe(`${appointment.date || ""} ${appointment.time || ""}`)}</strong></div>
    <div><span>${safe(t(language, "service"))}</span><strong>${safe(appointment.serviceName || "")}</strong></div>
    <div><span>${safe(t(language, "therapist"))}</span><strong>${safe(appointment.therapistName || "")}</strong></div>
    ${visit ? `<div><span>${safe(t(language, "status"))}</span><strong class="patient-status patient-status-${attr(visit.status)}">${safe(t(language, visit.status))}</strong></div>` : ""}
  </section>`;
}

function textarea(language, name, value, required = false) {
  return `<label class="${name === "treatmentSummary" || name === "clinicalObservations" ? "full" : ""}">
    <span>${safe(t(language, name))}${required ? ` <b class="required-marker" aria-hidden="true">*</b><span class="sr-only"> (${safe(t(language, "required"))})</span>` : ""}</span>
    <textarea name="${attr(name)}" maxlength="${name === "clinicalObservations" || name === "internalNotes" ? "8000" : "4000"}" ${required ? "required" : ""}>${safe(value || "")}</textarea>
  </label>`;
}

export function renderClinicalVisit({
  language = "en",
  status = "ready",
  data = null,
  error = "",
  saving = false,
  message = "",
} = {}) {
  let content;
  if (status !== "ready" || !data) {
    content = boundary(language, status, error);
  } else {
    const appointment = data.appointment || {};
    const visit = data.visit;
    const capabilities = data.capabilities || {};
    if (!capabilities.sensitive) {
      content = `${summary(language, appointment, visit)}<div class="clinical-visit-restricted"><strong>${safe(visit ? t(language, "metadata") : t(language, "newRecord"))}</strong><p>${safe(t(language, "restricted"))}</p></div>`;
    } else {
      content = `${summary(language, appointment, visit)}
        <form class="clinical-visit-form" data-clinical-visit-form="${attr(visit?.id || "")}" data-appointment-id="${attr(appointment.id)}" aria-busy="${saving ? "true" : "false"}">
          <div class="clinical-visit-fields">
            ${textarea(language, "treatmentSummary", visit?.treatmentSummary, true)}
            ${textarea(language, "clinicalObservations", visit?.clinicalObservations)}
            ${textarea(language, "recommendations", visit?.recommendations)}
            ${textarea(language, "followUpInstructions", visit?.followUpInstructions)}
            ${textarea(language, "internalNotes", visit?.internalNotes)}
          </div>
          <p class="form-message" role="alert">${safe(message)}</p>
          <div class="clinical-visit-actions">
            <button class="btn" type="submit" ${saving || !capabilities.write ? "disabled" : ""}>${safe(visit ? t(language, "update") : t(language, "save"))}</button>
            ${visit?.status === "draft" && capabilities.complete ? `<button class="btn secondary" type="button" data-complete-clinical-visit="${attr(visit.id)}" ${saving ? "disabled" : ""}>${safe(t(language, "complete"))}</button>` : ""}
          </div>
          <small class="muted">${safe(t(language, "completionHint"))}</small>
        </form>`;
    }
  }
  return `<div class="modal clinical-visit-modal"><section class="modal-card clinical-visit-card" role="dialog" aria-modal="true" aria-labelledby="clinicalVisitTitle">
    <div class="modal-head"><h3 id="clinicalVisitTitle">${safe(t(language, "title"))}</h3><button type="button" class="btn ghost" data-close-clinical-visit>${safe(t(language, "close"))}</button></div>
    <div class="modal-body clinical-visit-body">${content}</div>
  </section></div>`;
}

export function clinicalVisitText(language, key) {
  return t(language, key);
}
