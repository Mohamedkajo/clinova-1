import { audit, db } from "../db.js";

export async function listAppointmentRows(user) {
  const base = `
    SELECT a.*, c.fname, c.lname, c.phone, s.name AS service_name, s.duration, s.price, u.name AS therapist_name
    FROM appointments a
    JOIN clients c ON c.id = a.client_id
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.therapist_id
  `;
  return user.role === "therapist"
    ? await db.prepare(`${base} WHERE a.tenant_id = ? AND a.active = 1 AND a.therapist_id = ? ORDER BY a.date DESC, a.time DESC`)
      .all(user.tenantId, user.id)
    : await db.prepare(`${base} WHERE a.tenant_id = ? AND a.active = 1 ORDER BY a.date DESC, a.time DESC`)
      .all(user.tenantId);
}

export async function findAppointmentRow(user, id) {
  const base = `
    SELECT a.*, c.fname, c.lname, c.phone, s.name AS service_name, s.duration, s.price, u.name AS therapist_name
    FROM appointments a
    JOIN clients c ON c.id = a.client_id
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.therapist_id
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1
  `;
  return user.role === "therapist"
    ? await db.prepare(`${base} AND a.therapist_id = ?`).get(id, user.tenantId, user.id)
    : await db.prepare(base).get(id, user.tenantId);
}

export async function listQueuedAppointmentRows(user, date) {
  const base = `
    SELECT a.*, c.fname, c.lname, c.phone, s.name AS service_name, s.duration, s.price, u.name AS therapist_name
    FROM appointments a
    JOIN clients c ON c.id = a.client_id
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.therapist_id
    WHERE a.tenant_id = ? AND a.active = 1 AND a.date = ? AND a.status = 'pending'
  `;
  return user.role === "therapist"
    ? await db.prepare(`${base} AND a.therapist_id = ? ORDER BY a.time, a.id`).all(user.tenantId, date, user.id)
    : await db.prepare(`${base} ORDER BY a.time, a.id`).all(user.tenantId, date);
}

export async function findServiceForConflict(serviceId, tenantId) {
  return await db.prepare("SELECT duration, category_id, name FROM services WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(serviceId, tenantId);
}

export async function appointmentClientExists(clientId, tenantId) {
  return Boolean(await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1").get(clientId, tenantId));
}

export async function appointmentClientAssignedTo(clientId, tenantId, therapistId) {
  return Boolean(await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1 AND therapist_id = ?")
    .get(clientId, tenantId, therapistId));
}

export async function appointmentServiceExists(serviceId, tenantId) {
  return Boolean(await db.prepare("SELECT id FROM services WHERE id = ? AND tenant_id = ? AND active = 1").get(serviceId, tenantId));
}

export async function appointmentTherapistExists(therapistId, tenantId) {
  return Boolean(await db.prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1 AND role = 'therapist'").get(therapistId, tenantId));
}

export async function appointmentAssignment(id, tenantId) {
  return db.prepare("SELECT therapist_id AS therapistId FROM appointments WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(id, tenantId);
}

export async function listConflictingAppointmentRows({ tenantId, date, categoryId, therapistId, id }) {
  return await db.prepare(`
    SELECT a.*, s.duration, s.name AS service_name, s.category_id, c.fname, c.lname
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN clients c ON c.id = a.client_id
    WHERE a.tenant_id = ? AND a.date = ? AND a.status != 'cancelled' AND a.active = 1
      AND (s.category_id = ? OR a.therapist_id = ?) AND a.id != ?
  `).all(tenantId, date, categoryId, therapistId, id || 0);
}

export async function findServiceCategory(serviceId, tenantId) {
  return await db.prepare("SELECT category_id FROM services WHERE id = ? AND tenant_id = ?").get(serviceId, tenantId);
}

export async function listConsentTemplatesForCategory(tenantId, categoryId, serviceId) {
  return await db.prepare(`
    SELECT id, title
    FROM consent_templates
    WHERE tenant_id = ? AND active = 1
      AND (service_id = ? OR (service_id IS NULL AND category_id = ?))
    ORDER BY id
  `).all(tenantId, serviceId, categoryId);
}

export async function findConsentSignature({ tenantId, templateId, clientId, appointmentId }) {
  return await db.prepare(`
    SELECT id FROM patient_consents
    WHERE tenant_id = ? AND template_id = ? AND status = 'signed'
      AND (client_id = ? OR appointment_id = ?)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    UNION ALL
    SELECT id FROM consent_signatures
    WHERE tenant_id = ? AND template_id = ? AND (client_id = ? OR appointment_id = ?)
    LIMIT 1
  `).get(
    tenantId, templateId, clientId || 0, appointmentId || 0,
    tenantId, templateId, clientId || 0, appointmentId || 0,
  );
}

export async function createAppointment(tenantId, values) {
  const result = await db.prepare("INSERT INTO appointments (tenant_id, client_id, service_id, therapist_id, date, time, status, payment_status, paid_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(tenantId, values.clientId, values.serviceId, values.therapistId, values.date, values.time, values.status, values.paymentStatus, values.paidAmount, values.notes);
  return result.lastInsertRowid;
}

export async function updateAppointment(id, tenantId, values) {
  const result = await db.prepare("UPDATE appointments SET client_id = ?, service_id = ?, therapist_id = ?, date = ?, time = ?, status = ?, payment_status = ?, paid_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(values.clientId, values.serviceId, values.therapistId, values.date, values.time, values.status, values.paymentStatus, values.paidAmount, values.notes, id, tenantId);
  return result.changes;
}

export async function findAppointmentForStatus(id, tenantId) {
  return await db.prepare(`
    SELECT a.*, s.name AS service_name
    FROM appointments a
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1
  `).get(id, tenantId);
}

export async function updateAppointmentStatus(id, tenantId, status) {
  const result = await db.prepare("UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND active = 1")
    .run(status, id, tenantId);
  return result.changes;
}

export async function addAppointmentTimelineEvent({ tenantId, clientId, userId, appointmentId, type, description }) {
  await db.prepare(`
    INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, clientId, userId, appointmentId, type, description);
}

export async function archiveAppointment(id, tenantId) {
  const result = await db.prepare("UPDATE appointments SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(id, tenantId);
  return result.changes;
}

export async function auditAppointment(userId, action, entityId, tenantId) {
  await audit(userId, action, "appointments", entityId, { tenantId });
}
