import { audit, db } from "../db.js";

const visitSelect = `
  SELECT v.*, a.status AS appointment_status, c.fname, c.lname, c.phone,
         s.name AS service_name, u.name AS therapist_name,
         creator.name AS created_by_name, updater.name AS updated_by_name
  FROM clinical_visits v
  JOIN appointments a ON a.id = v.appointment_id AND a.tenant_id = v.tenant_id
  JOIN clients c ON c.id = v.client_id AND c.tenant_id = v.tenant_id
  LEFT JOIN services s ON s.id = v.service_id AND s.tenant_id = v.tenant_id
  JOIN users u ON u.id = v.therapist_id AND u.tenant_id = v.tenant_id
  JOIN users creator ON creator.id = v.created_by AND creator.tenant_id = v.tenant_id
  JOIN users updater ON updater.id = v.updated_by AND updater.tenant_id = v.tenant_id
`;

export async function findClinicalAppointment(user, appointmentId) {
  const therapistClause = user.role === "therapist"
    ? "AND a.therapist_id = ? AND c.therapist_id = ?"
    : "";
  const values = user.role === "therapist"
    ? [appointmentId, user.tenantId, user.id, user.id]
    : [appointmentId, user.tenantId];
  return await db.prepare(`
    SELECT a.*, c.fname, c.lname, c.phone, c.therapist_id AS client_therapist_id,
           s.name AS service_name, s.duration, u.name AS therapist_name
    FROM appointments a
    JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id AND c.active = 1
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id AND s.active = 1
    JOIN users u ON u.id = a.therapist_id AND u.tenant_id = a.tenant_id AND u.active = 1
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1 ${therapistClause}
  `).get(...values);
}

export async function findClinicalVisitByAppointment(user, appointmentId) {
  const therapistClause = user.role === "therapist"
    ? "AND v.therapist_id = ? AND c.therapist_id = ?"
    : "";
  const values = user.role === "therapist"
    ? [appointmentId, user.tenantId, user.id, user.id]
    : [appointmentId, user.tenantId];
  return await db.prepare(`${visitSelect}
    WHERE v.appointment_id = ? AND v.tenant_id = ? ${therapistClause}
  `).get(...values);
}

export async function findClinicalVisit(user, visitId) {
  const therapistClause = user.role === "therapist"
    ? "AND v.therapist_id = ? AND c.therapist_id = ?"
    : "";
  const values = user.role === "therapist"
    ? [visitId, user.tenantId, user.id, user.id]
    : [visitId, user.tenantId];
  return await db.prepare(`${visitSelect}
    WHERE v.id = ? AND v.tenant_id = ? ${therapistClause}
  `).get(...values);
}

export async function createClinicalVisit(user, appointment, values) {
  const result = await db.prepare(`
    INSERT INTO clinical_visits (
      tenant_id, appointment_id, client_id, therapist_id, service_id,
      visit_date, visit_time, treatment_summary, clinical_observations,
      recommendations, follow_up_instructions, internal_notes,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.tenantId,
    appointment.id,
    appointment.client_id,
    appointment.therapist_id,
    appointment.service_id,
    appointment.date,
    appointment.time,
    values.treatmentSummary,
    values.clinicalObservations,
    values.recommendations,
    values.followUpInstructions,
    values.internalNotes,
    user.id,
    user.id,
  );
  return Number(result.lastInsertRowid);
}

export async function updateClinicalVisit(visitId, user, values) {
  const result = await db.prepare(`
    UPDATE clinical_visits
    SET treatment_summary = ?, clinical_observations = ?, recommendations = ?,
        follow_up_instructions = ?, internal_notes = ?, updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(
    values.treatmentSummary,
    values.clinicalObservations,
    values.recommendations,
    values.followUpInstructions,
    values.internalNotes,
    user.id,
    visitId,
    user.tenantId,
  );
  return result.changes;
}

export async function completeClinicalVisit(visitId, user) {
  const result = await db.prepare(`
    UPDATE clinical_visits
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'draft'
  `).run(user.id, visitId, user.tenantId);
  return result.changes;
}

export async function listClientClinicalVisits(user, clientId) {
  const therapistClause = user.role === "therapist"
    ? "AND v.therapist_id = ? AND c.therapist_id = ?"
    : "";
  const values = user.role === "therapist"
    ? [user.tenantId, clientId, user.id, user.id]
    : [user.tenantId, clientId];
  return await db.prepare(`${visitSelect}
    WHERE v.tenant_id = ? AND v.client_id = ? ${therapistClause}
    ORDER BY v.visit_date DESC, v.visit_time DESC, v.id DESC
  `).all(...values);
}

export async function addClinicalVisitTimelineEvent({ user, visit, type, description }) {
  await db.prepare(`
    INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.tenantId, visit.client_id, user.id, visit.appointment_id, type, description);
}

export async function auditClinicalVisit(user, action, visit) {
  await audit(user.id, action, "clinical_visits", visit.id, {
    tenantId: user.tenantId,
    appointmentId: visit.appointment_id,
    patientId: visit.client_id,
  });
}
