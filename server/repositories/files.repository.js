import { audit, db } from "../db.js";

export async function canSeeClient(user, clientId) {
  if (user.role !== "therapist") {
    const row = await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1")
      .get(clientId, user.tenantId);
    return Boolean(row);
  }
  const row = await db.prepare(`
    SELECT id FROM clients
    WHERE id = ? AND tenant_id = ? AND active = 1 AND therapist_id = ?
  `).get(clientId, user.tenantId, user.id);
  return Boolean(row);
}

const fileSelect = `
  SELECT f.id, f.client_id AS clientId, f.appointment_id AS appointmentId,
         f.clinical_visit_id AS clinicalVisitId, f.name, f.url,
         f.original_name AS originalName, f.stored_name AS storedName,
         f.mime_type AS mimeType, f.size, f.path, f.notes, f.category,
         f.uploaded_by AS uploadedBy, f.active, f.created_at AS createdAt,
         u.name AS uploaderName
  FROM client_files f
  LEFT JOIN users u ON u.id = f.uploaded_by AND u.tenant_id = f.tenant_id
`;

export async function listClientFiles(clientId, tenantId) {
  return await db.prepare(`${fileSelect}
    WHERE f.tenant_id = ? AND f.active = 1 AND f.client_id = ?
    ORDER BY f.id DESC
  `).all(tenantId, clientId);
}

export async function clientFileById(id, tenantId) {
  return await db.prepare(`${fileSelect}
    WHERE f.id = ? AND f.tenant_id = ? AND f.active = 1
  `).get(id, tenantId);
}

export async function linkedFileContext({ tenantId, clientId, appointmentId, clinicalVisitId }) {
  let normalizedAppointmentId = appointmentId || null;
  if (appointmentId) {
    const appointment = await db.prepare(`
      SELECT id, client_id AS clientId
      FROM appointments WHERE id = ? AND tenant_id = ? AND active = 1
    `).get(appointmentId, tenantId);
    if (!appointment || Number(appointment.clientId) !== Number(clientId)) return null;
  }
  if (clinicalVisitId) {
    const visit = await db.prepare(`
      SELECT id, client_id AS clientId, appointment_id AS appointmentId
      FROM clinical_visits WHERE id = ? AND tenant_id = ?
    `).get(clinicalVisitId, tenantId);
    if (!visit || Number(visit.clientId) !== Number(clientId)) return null;
    if (appointmentId && Number(visit.appointmentId) !== Number(appointmentId)) return null;
    normalizedAppointmentId ||= visit.appointmentId;
  }
  return { appointmentId: normalizedAppointmentId, clinicalVisitId: clinicalVisitId || null };
}

export async function createClientFile(data) {
  const result = await db.prepare(`
    INSERT INTO client_files (
      tenant_id, client_id, appointment_id, clinical_visit_id, name, url,
      original_name, stored_name, mime_type, size, path, notes, category, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.tenantId, data.clientId, data.appointmentId, data.clinicalVisitId, data.name, "",
    data.originalName, data.storedName, data.mimeType, data.size, data.path, data.notes,
    data.category, data.uploadedBy,
  );
  return result.lastInsertRowid;
}

export async function updateClientFileUrl(id, url) {
  await db.prepare("UPDATE client_files SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, id);
}

export async function archiveClientFile(id, tenantId) {
  const result = await db.prepare(`
    UPDATE client_files SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).run(id, tenantId);
  return result.changes;
}

export async function addFileTimelineEvent({ tenantId, clientId, userId, appointmentId, fileId }) {
  await db.prepare(`
    INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description)
    VALUES (?, ?, ?, ?, 'file_uploaded', ?)
  `).run(tenantId, clientId, userId, appointmentId, `file:${fileId}`);
}

export async function auditFile(userId, action, entityId, tenantId, details = {}) {
  await audit(userId, action, "client_files", entityId, { tenantId, ...details });
}
