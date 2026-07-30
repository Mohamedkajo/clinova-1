import {
  addClinicalVisitTimelineEvent,
  auditClinicalVisit,
  completeClinicalVisit,
  createClinicalVisit,
  findClinicalAppointment,
  findClinicalVisit,
  findClinicalVisitByAppointment,
  updateClinicalVisit,
} from "../repositories/clinical-visits.repository.js";
import {
  notifyClinicalVisitCompleted,
  notifyFollowUpRequired,
} from "./notifications.service.js";

const fields = {
  treatmentSummary: { required: true, max: 4000 },
  clinicalObservations: { required: false, max: 8000 },
  recommendations: { required: false, max: 4000 },
  followUpInstructions: { required: false, max: 4000 },
  internalNotes: { required: false, max: 8000 },
};

function validationResult(body) {
  const values = {};
  for (const [field, rule] of Object.entries(fields)) {
    const value = String(body?.[field] ?? "").trim();
    if (rule.required && !value) {
      return { error: { status: 400, body: { error: "Treatment summary is required.", code: "CLINICAL_VISIT_SUMMARY_REQUIRED" } } };
    }
    if (value.length > rule.max) {
      return { error: { status: 400, body: { error: `${field} is too long.`, code: "CLINICAL_VISIT_FIELD_TOO_LONG" } } };
    }
    values[field] = value;
  }
  return { values };
}

function appointmentSummary(row) {
  return {
    id: row.id,
    patientId: row.client_id,
    patientName: `${row.fname} ${row.lname}`.trim(),
    patientPhone: row.phone || "",
    therapistId: row.therapist_id,
    therapistName: row.therapist_name || "",
    serviceId: row.service_id,
    serviceName: row.service_name || "",
    date: row.date,
    time: row.time,
    duration: Number(row.duration || 0),
    status: row.status,
  };
}

export function clinicalVisitFromRow(row, { sensitive = true } = {}) {
  if (!row) return null;
  const visit = {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.client_id,
    therapistId: row.therapist_id,
    therapistName: row.therapist_name || "",
    serviceId: row.service_id,
    serviceName: row.service_name || "",
    visitDate: row.visit_date,
    visitTime: row.visit_time,
    status: row.status,
    appointmentStatus: row.appointment_status,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name || "",
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name || "",
  };
  if (sensitive) {
    visit.treatmentSummary = row.treatment_summary || "";
    visit.clinicalObservations = row.clinical_observations || "";
    visit.recommendations = row.recommendations || "";
    visit.followUpInstructions = row.follow_up_instructions || "";
    visit.internalNotes = row.internal_notes || "";
  }
  return visit;
}

export async function getVisitForAppointment(user, appointmentId) {
  const appointment = await findClinicalAppointment(user, appointmentId);
  if (!appointment) return { status: 404, body: { error: "Appointment not found." } };
  const row = await findClinicalVisitByAppointment(user, appointmentId);
  const sensitive = user.role !== "reception";
  return {
    status: 200,
    body: {
      appointment: appointmentSummary(appointment),
      visit: clinicalVisitFromRow(row, { sensitive }),
      capabilities: {
        sensitive,
        write: ["admin", "therapist"].includes(user.role) && appointment.status !== "cancelled",
        complete: ["admin", "therapist"].includes(user.role) && row?.status === "draft",
      },
    },
  };
}

export async function addClinicalVisit(user, body) {
  const appointmentId = Number(body?.appointmentId);
  if (!Number.isInteger(appointmentId) || appointmentId < 1) {
    return { status: 400, body: { error: "Valid appointment is required." } };
  }
  const appointment = await findClinicalAppointment(user, appointmentId);
  if (!appointment) return { status: 404, body: { error: "Appointment not found." } };
  if (appointment.status === "cancelled") {
    return { status: 409, body: { error: "A clinical visit cannot be created for a cancelled appointment.", code: "CLINICAL_VISIT_CANCELLED_APPOINTMENT" } };
  }
  const existing = await findClinicalVisitByAppointment(user, appointmentId);
  if (existing) {
    return { status: 409, body: { error: "A clinical visit already exists for this appointment.", code: "CLINICAL_VISIT_EXISTS", existingVisitId: existing.id } };
  }
  const validation = validationResult(body);
  if (validation.error) return validation.error;
  let id;
  try {
    id = await createClinicalVisit(user, appointment, validation.values);
  } catch (error) {
    if (/unique|duplicate/i.test(String(error?.message || ""))) {
      const duplicate = await findClinicalVisitByAppointment(user, appointmentId);
      return { status: 409, body: { error: "A clinical visit already exists for this appointment.", code: "CLINICAL_VISIT_EXISTS", existingVisitId: duplicate?.id } };
    }
    throw error;
  }
  const visit = await findClinicalVisit(user, id);
  await addClinicalVisitTimelineEvent({ user, visit, type: "clinical_visit_started", description: "Clinical visit record started." });
  await auditClinicalVisit(user, "create", visit);
  return { status: 201, body: clinicalVisitFromRow(visit) };
}

export async function editClinicalVisit(user, visitId, body) {
  const existing = await findClinicalVisit(user, visitId);
  if (!existing) return { status: 404, body: { error: "Clinical visit not found." } };
  const validation = validationResult(body);
  if (validation.error) return validation.error;
  await updateClinicalVisit(visitId, user, validation.values);
  const visit = await findClinicalVisit(user, visitId);
  await addClinicalVisitTimelineEvent({ user, visit, type: "clinical_visit_updated", description: "Clinical visit record updated." });
  await auditClinicalVisit(user, "update", visit);
  return { status: 200, body: clinicalVisitFromRow(visit) };
}

export async function finishClinicalVisit(user, visitId) {
  const existing = await findClinicalVisit(user, visitId);
  if (!existing) return { status: 404, body: { error: "Clinical visit not found." } };
  if (existing.status === "completed") {
    return { status: 200, body: clinicalVisitFromRow(existing) };
  }
  await completeClinicalVisit(visitId, user);
  const visit = await findClinicalVisit(user, visitId);
  await addClinicalVisitTimelineEvent({ user, visit, type: "clinical_visit_completed", description: "Clinical visit record completed." });
  await auditClinicalVisit(user, "complete", visit);
  await notifyClinicalVisitCompleted({ user, visit });
  if (String(visit.follow_up_instructions || "").trim()) {
    await notifyFollowUpRequired({
      tenantId: user.tenantId,
      therapistId: visit.therapist_id,
      clientId: visit.client_id,
      appointmentId: visit.appointment_id,
    });
  }
  return { status: 200, body: clinicalVisitFromRow(visit) };
}
