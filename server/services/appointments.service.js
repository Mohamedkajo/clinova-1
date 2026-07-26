import {
  addAppointmentTimelineEvent,
  appointmentClientAssignedTo,
  appointmentClientExists,
  appointmentServiceExists,
  appointmentTherapistExists,
  archiveAppointment,
  auditAppointment,
  createAppointment,
  findConsentSignature,
  findAppointmentRow,
  findAppointmentForStatus,
  findServiceCategory,
  findServiceForConflict,
  listAppointmentRows,
  listConflictingAppointmentRows,
  listQueuedAppointmentRows,
  listConsentTemplatesForCategory,
  updateAppointment,
  updateAppointmentStatus,
} from "../repositories/appointments.repository.js";
import { permissions } from "../repositories/permissions.repository.js";
import { clinicSettings } from "../repositories/settings.repository.js";
import { isValidIsoDate, isValidTime } from "../shared/validation/date-time.js";

function toMinutes(time) {
  const [hours, minutes] = String(time || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function localNowParts() {
  const configuredNow = process.env.CLINOVA_TEST_NOW;
  const configuredMatch = typeof configuredNow === "string"
    ? configuredNow.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
    : null;
  if (configuredMatch) {
    return {
      date: configuredMatch[1],
      minutes: (Number(configuredMatch[2]) * 60) + Number(configuredMatch[3]),
    };
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    minutes: (now.getHours() * 60) + now.getMinutes(),
  };
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

function appointmentFromRow(row, user) {
  const appointment = {
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
    duration: row.duration,
    price: row.price,
  };
  if (permissions.clients_clinical_read.includes(user.role)) appointment.notes = row.notes;
  if (permissions.clients_financial_read.includes(user.role)) {
    appointment.paymentStatus = row.payment_status || "unpaid";
    appointment.paidAmount = Number(row.paid_amount || 0);
  }
  return appointment;
}

async function appointmentConflict({ id, tenantId, date, time, serviceId, therapistId }) {
  const service = await findServiceForConflict(serviceId, tenantId);
  if (!service) return null;
  const start = toMinutes(time);
  const end = start + service.duration;
  const rows = await listConflictingAppointmentRows({ tenantId, date, categoryId: service.category_id, therapistId, id });
  for (const row of rows) {
    const otherStart = toMinutes(row.time);
    const otherEnd = otherStart + row.duration;
    if (!(end <= otherStart || start >= otherEnd)) {
      return {
        code: Number(row.category_id) === Number(service.category_id)
          ? "appointment_category_conflict"
          : "appointment_therapist_conflict",
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
  if (user.role === "therapist" && !await appointmentClientAssignedTo(values.clientId, user.tenantId, user.id)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  const service = await findServiceForConflict(values.serviceId, user.tenantId);
  if (!service) {
    return { status: 404, body: { error: "Service not found." } };
  }
  if (!await appointmentTherapistExists(values.therapistId, user.tenantId)) {
    return { status: 404, body: { error: "Therapist not found." } };
  }
  const now = localNowParts();
  if (values.date < now.date || (values.date === now.date && toMinutes(values.time) < now.minutes)) {
    return { status: 400, body: { error: "Appointment cannot be booked in the past", code: "APPOINTMENT_IN_PAST" } };
  }

  const settings = await clinicSettings(user.tenantId);
  const workStart = toMinutes(validWorkTime(settings.workStart, "09:00"));
  const workEnd = toMinutes(validWorkTime(settings.workEnd, "18:00"));
  const appointmentStart = toMinutes(values.time);
  const appointmentEnd = appointmentStart + Number(service.duration || 0);
  if (appointmentStart < workStart || appointmentEnd > workEnd) {
    return { status: 400, body: { error: "Appointment must be within clinic working hours", code: "APPOINTMENT_OUTSIDE_WORK_HOURS" } };
  }

  const conflict = await appointmentConflict({
    id,
    tenantId: user.tenantId,
    date: values.date,
    time: values.time,
    serviceId: values.serviceId,
    therapistId: values.therapistId,
  });
  if (conflict) return { status: 409, body: { error: conflict.code, details: conflict } };

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
  return { status: 200, body: (await listAppointmentRows(user)).map((row) => appointmentFromRow(row, user)) };
}

export async function getAppointment(user, id) {
  const row = await findAppointmentRow(user, id);
  if (!row) return { status: 404, body: { error: "Appointment not found." } };
  return { status: 200, body: appointmentFromRow(row, user) };
}

export async function getAppointmentQueue(user, requestedDate = "") {
  const date = requestedDate || localNowParts().date;
  if (!isValidIsoDate(date)) {
    return { status: 400, body: { error: "Valid queue date is required." } };
  }
  return {
    status: 200,
    body: { date, items: (await listQueuedAppointmentRows(user, date)).map((row) => appointmentFromRow(row, user)) },
  };
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
  await addAppointmentTimelineEvent({
    tenantId: user.tenantId,
    clientId: values.clientId,
    userId: user.id,
    appointmentId: id,
    type: "appointment_created",
    description: `Appointment booked for ${values.date} ${values.time}`,
  });
  await auditAppointment(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id } };
}

export async function editAppointment(user, id, body) {
  let existing = null;
  if (user.role === "therapist") {
    existing = await findAppointmentForStatus(id, user.tenantId);
    if (!existing || Number(existing.therapist_id) !== Number(user.id)) {
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

  existing ||= await findAppointmentForStatus(id, user.tenantId);
  if (!existing) return { status: 404, body: { error: "Appointment not found." } };
  const values = appointmentValues(user, body);
  const validation = await validateAppointmentWrite(user, id, values);
  if (validation) return validation;

  const changes = await updateAppointment(id, user.tenantId, values);
  if (!changes) return { status: 404, body: { error: "Appointment not found." } };
  if (existing.status !== values.status) {
    await addAppointmentTimelineEvent({
      tenantId: user.tenantId,
      clientId: values.clientId,
      userId: user.id,
      appointmentId: id,
      type: "appointment_status_changed",
      description: `${existing.status} -> ${values.status}`,
    });
  }
  await auditAppointment(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}

export async function changeAppointmentStatus(user, id, body) {
  if (!["pending", "done", "cancelled"].includes(body.status)) {
    return { status: 400, body: { error: "Valid appointment status is required." } };
  }
  const appointment = await findAppointmentForStatus(id, user.tenantId);
  if (!appointment || (user.role === "therapist" && Number(appointment.therapist_id) !== Number(user.id))) {
    return { status: 404, body: { error: "Appointment not found." } };
  }
  if (appointment.status === body.status) {
    return { status: 200, body: { ok: true, status: body.status } };
  }
  if (body.status === "done") {
    const missingConsents = await missingLegalConsents({
      tenantId: user.tenantId,
      clientId: appointment.client_id,
      appointmentId: id,
      serviceId: appointment.service_id,
    });
    if (missingConsents.length) {
      return { status: 409, body: { error: "consent_required", details: { missing: missingConsents } } };
    }
  }
  const changes = await updateAppointmentStatus(id, user.tenantId, body.status);
  if (!changes) return { status: 404, body: { error: "Appointment not found." } };
  await addAppointmentTimelineEvent({
    tenantId: user.tenantId,
    clientId: appointment.client_id,
    userId: user.id,
    appointmentId: id,
    type: "appointment_status_changed",
    description: `${appointment.status} -> ${body.status}`,
  });
  await auditAppointment(user.id, "status", id, user.tenantId);
  return { status: 200, body: { ok: true, status: body.status } };
}

export async function removeAppointment(user, id) {
  const changes = await archiveAppointment(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "Appointment not found." } };
  await auditAppointment(user.id, "archive", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
