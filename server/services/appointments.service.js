import {
  appointmentClientExists,
  appointmentAssignment,
  appointmentServiceExists,
  appointmentTherapistExists,
  archiveAppointment,
  auditAppointment,
  createAppointment,
  findConsentSignature,
  findServiceCategory,
  findServiceForConflict,
  listAppointmentRows,
  listConflictingAppointmentRows,
  listConsentTemplatesForCategory,
  updateAppointment,
} from "../repositories/appointments.repository.js";
import { clinicSettings } from "../repositories/settings.repository.js";
import { isValidIsoDate, isValidTime } from "../shared/validation/date-time.js";

function toMinutes(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function localTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validWorkTime(value, fallback) {
  return isValidTime(value) ? String(value).slice(0, 5) : fallback;
}

function hasRequiredFields(body, fields) {
  return fields.every((field) => body[field] !== undefined && body[field] !== null);
}

function hasRequiredUpdateFields(body) {
  return ["clientId", "serviceId", "therapistId", "date", "time"].every((field) => {
    const value = body[field];
    return value !== undefined && value !== null;
  });
}

function validNumber(value, { integer = false, min = null } = {}) {
  const validType = typeof value === "number" || typeof value === "string";
  if (!validType || (typeof value === "string" && value.trim() === "")) return false;
  const number = Number(value);
  return Number.isFinite(number)
    && (!integer || Number.isInteger(number))
    && (min === null || number >= min);
}

function hasExplicitValue(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined && body[field] !== null && body[field] !== "";
}

function validateAppointmentNumbers(user, body) {
  const idFields = user.role === "therapist"
    ? ["clientId", "serviceId"]
    : ["clientId", "serviceId", "therapistId"];
  if (idFields.some((field) => Object.prototype.hasOwnProperty.call(body, field)
      && !validNumber(body[field], { integer: true, min: 1 }))) {
    return { status: 400, body: { error: "Valid client, service, and therapist are required." } };
  }
  if (Object.prototype.hasOwnProperty.call(body, "paidAmount")
      && body.paidAmount !== null
      && body.paidAmount !== ""
      && !validNumber(body.paidAmount)) {
    return { status: 400, body: { error: "Valid paid amount is required." } };
  }
  return null;
}

function validateAppointmentEnums(body) {
  if (hasExplicitValue(body, "status") && !["pending", "done", "cancelled"].includes(body.status)) {
    return { status: 400, body: { error: "Valid appointment status is required." } };
  }
  if (hasExplicitValue(body, "paymentStatus") && !["paid", "unpaid", "deposit"].includes(body.paymentStatus)) {
    return { status: 400, body: { error: "Valid payment status is required." } };
  }
  return null;
}

function validateAppointmentDateTime(body) {
  if ((Object.prototype.hasOwnProperty.call(body, "date") && !isValidIsoDate(body.date))
      || (Object.prototype.hasOwnProperty.call(body, "time") && !isValidTime(body.time))) {
    return { status: 400, body: { error: "Valid appointment date and time are required." } };
  }
  return null;
}

function appointmentFromRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: `${row.fname} ${row.lname}`,
    clientPhone: row.phone,
    serviceId: row.service_id,
    serviceName: row.service_name,
    therapistId: row.therapist_id,
    therapistName: row.therapist_name,
    date: row.date,
    time: row.time,
    status: row.status,
    notes: row.notes,
    duration: row.duration,
    price: row.price,
    paymentStatus: row.payment_status || "unpaid",
    paidAmount: Number(row.paid_amount || 0),
  };
}

async function appointmentConflict({ id, tenantId, date, time, serviceId }) {
  const service = await findServiceForConflict(serviceId, tenantId);
  if (!service) return null;
  const start = toMinutes(time);
  const end = start + service.duration;
  const rows = await listConflictingAppointmentRows({ tenantId, date, categoryId: service.category_id, id });
  for (const row of rows) {
    const otherStart = toMinutes(row.time);
    const otherEnd = otherStart + row.duration;
    if (!(end <= otherStart || start >= otherEnd)) {
      return {
        code: "appointment_category_conflict",
        serviceName: row.service_name,
        clientName: `${row.fname} ${row.lname}`,
        time: row.time,
      };
    }
  }
  return null;
}

async function missingLegalConsents({ tenantId, clientId, appointmentId, serviceId }) {
  const service = await findServiceCategory(serviceId, tenantId);
  if (!service?.category_id) return [];
  const templates = await listConsentTemplatesForCategory(tenantId, service.category_id);
  const missing = [];
  for (const template of templates) {
    const signature = await findConsentSignature({
      tenantId,
      templateId: template.id,
      clientId: clientId || 0,
      appointmentId: appointmentId || 0,
    });
    if (!signature) missing.push(template);
  }
  return missing;
}

function appointmentValues(user, body) {
  return {
    clientId: body.clientId,
    serviceId: body.serviceId,
    therapistId: user.role === "therapist" ? user.id : body.therapistId,
    date: body.date,
    time: body.time,
    status: body.status || "pending",
    paymentStatus: ["paid", "unpaid", "deposit"].includes(body.paymentStatus) ? body.paymentStatus : "unpaid",
    paidAmount: Number(body.paidAmount || 0),
    notes: body.notes || "",
  };
}

async function validateAppointmentWrite(user, id, values) {
  if (!await appointmentClientExists(values.clientId, user.tenantId)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  const service = await findServiceForConflict(values.serviceId, user.tenantId);
  if (!service) {
    return { status: 404, body: { error: "Service not found." } };
  }
  if (!await appointmentTherapistExists(values.therapistId, user.tenantId)) {
    return { status: 404, body: { error: "Therapist not found." } };
  }
  if (values.date < localTodayIso()) {
    return { status: 400, body: { error: "Appointment date cannot be in the past." } };
  }

  const settings = await clinicSettings(user.tenantId);
  const workStart = toMinutes(validWorkTime(settings.workStart, "09:00"));
  const workEnd = toMinutes(validWorkTime(settings.workEnd, "18:00"));
  const appointmentStart = toMinutes(values.time);
  const appointmentEnd = appointmentStart + Number(service.duration || 0);
  if (appointmentStart < workStart || appointmentEnd > workEnd) {
    return { status: 400, body: { error: "Appointment must be within clinic working hours." } };
  }

  const conflict = await appointmentConflict({
    id,
    tenantId: user.tenantId,
    date: values.date,
    time: values.time,
    serviceId: values.serviceId,
    therapistId: values.therapistId,
  });
  if (conflict) return { status: 409, body: { error: "appointment_category_conflict", details: conflict } };

  if ((values.status || "pending") === "done") {
    const missingConsents = await missingLegalConsents({
      tenantId: user.tenantId,
      clientId: values.clientId,
      appointmentId: id,
      serviceId: values.serviceId,
    });
    if (missingConsents.length) {
      return { status: 409, body: { error: "consent_required", details: { missing: missingConsents } } };
    }
  }

  return null;
}

export async function getAppointments(user) {
  return { status: 200, body: (await listAppointmentRows(user)).map(appointmentFromRow) };
}

export async function addAppointment(user, body) {
  const requiredFields = user.role === "therapist"
    ? ["clientId", "serviceId", "date", "time"]
    : ["clientId", "serviceId", "therapistId", "date", "time"];
  if (!hasRequiredFields(body, requiredFields)) {
    return { status: 400, body: { error: "Client, service, therapist, date, and time are required." } };
  }
  const numericValidation = validateAppointmentNumbers(user, body);
  if (numericValidation) return numericValidation;
  const dateTimeValidation = validateAppointmentDateTime(body);
  if (dateTimeValidation) return dateTimeValidation;
  const enumValidation = validateAppointmentEnums(body);
  if (enumValidation) return enumValidation;

  const values = appointmentValues(user, body);
  const validation = await validateAppointmentWrite(user, null, values);
  if (validation) return validation;

  const id = await createAppointment(user.tenantId, values);
  await auditAppointment(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id } };
}

export async function editAppointment(user, id, body) {
  if (user.role === "therapist") {
    const appointment = await appointmentAssignment(id, user.tenantId);
    if (!appointment || Number(appointment.therapistId) !== Number(user.id)) {
      return { status: 404, body: { error: "Appointment not found." } };
    }
  }
  if (!hasRequiredUpdateFields(body)) {
    return { status: 400, body: { error: "Client, service, therapist, date, and time are required." } };
  }
  const numericValidation = validateAppointmentNumbers(user, body);
  if (numericValidation) return numericValidation;
  const dateTimeValidation = validateAppointmentDateTime(body);
  if (dateTimeValidation) return dateTimeValidation;
  const enumValidation = validateAppointmentEnums(body);
  if (enumValidation) return enumValidation;

  const values = appointmentValues(user, body);
  const validation = await validateAppointmentWrite(user, id, values);
  if (validation) return validation;

  const changes = await updateAppointment(id, user.tenantId, values);
  if (!changes) return { status: 404, body: { error: "Appointment not found." } };
  await auditAppointment(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}

export async function removeAppointment(user, id) {
  const changes = await archiveAppointment(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "Appointment not found." } };
  await auditAppointment(user.id, "archive", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
