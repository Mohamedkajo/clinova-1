import { audit, db } from "../db.js";

const reminderSelect = `
  SELECT r.id, r.appointment_id AS appointmentId, r.reminder_type AS reminderType,
         r.channel, r.recipient, r.scheduled_for AS scheduledFor, r.status,
         r.dispatched_at AS dispatchedAt, r.cancelled_at AS cancelledAt,
         r.last_error AS lastError, r.created_at AS createdAt, r.updated_at AS updatedAt,
         a.date AS appointmentDate, a.time AS appointmentTime,
         c.fname || ' ' || c.lname AS clientName
  FROM appointment_reminders r
  JOIN appointments a ON a.id = r.appointment_id AND a.tenant_id = r.tenant_id
  JOIN clients c ON c.id = a.client_id AND c.tenant_id = r.tenant_id
`;

export async function reminderAppointmentContext(appointmentId, tenantId) {
  return await db.prepare(`
    SELECT a.id, a.client_id AS clientId, a.therapist_id AS therapistId,
           a.date, a.time, a.status, a.active,
           c.phone, c.email
    FROM appointments a
    JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id AND c.active = 1
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1
  `).get(appointmentId, tenantId);
}

export async function upcomingReminderAppointments(tenantId, date) {
  return await db.prepare(`
    SELECT a.id
    FROM appointments a
    JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id AND c.active = 1
    WHERE a.tenant_id = ? AND a.active = 1 AND a.status = 'pending' AND a.date >= ?
    ORDER BY a.date, a.time, a.id
  `).all(tenantId, date);
}

export async function createAppointmentReminder({
  tenantId,
  appointmentId,
  reminderType,
  channel,
  recipient,
  scheduledFor,
  status,
  createdBy,
}) {
  const result = await db.prepare(`
    INSERT INTO appointment_reminders (
      tenant_id, appointment_id, reminder_type, channel, recipient,
      scheduled_for, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    appointmentId,
    reminderType,
    channel,
    recipient,
    scheduledFor,
    status,
    createdBy || null,
  );
  return Number(result.lastInsertRowid);
}

export async function activeReminder(tenantId, appointmentId, reminderType) {
  return await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ? AND r.appointment_id = ? AND r.reminder_type = ?
      AND r.status IN ('pending','ready')
    LIMIT 1
  `).get(tenantId, appointmentId, reminderType);
}

export async function reminderForSchedule(tenantId, appointmentId, reminderType, scheduledFor) {
  return await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ? AND r.appointment_id = ? AND r.reminder_type = ?
      AND r.scheduled_for = ? AND r.status != 'cancelled'
    ORDER BY r.id DESC
    LIMIT 1
  `).get(tenantId, appointmentId, reminderType, scheduledFor);
}

export async function activeRemindersForAppointment(tenantId, appointmentId) {
  return await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ? AND r.appointment_id = ?
      AND r.status IN ('pending','ready')
    ORDER BY r.id
  `).all(tenantId, appointmentId);
}

export async function cancelAppointmentReminders(tenantId, appointmentId) {
  const rows = await activeRemindersForAppointment(tenantId, appointmentId);
  if (!rows.length) return [];
  await db.prepare(`
    UPDATE appointment_reminders
    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND appointment_id = ? AND status IN ('pending','ready')
  `).run(tenantId, appointmentId);
  return rows;
}

export async function cancelTenantActiveReminders(tenantId) {
  const rows = await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ? AND r.status IN ('pending','ready')
    ORDER BY r.id
  `).all(tenantId);
  if (!rows.length) return [];
  await db.prepare(`
    UPDATE appointment_reminders
    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND status IN ('pending','ready')
  `).run(tenantId);
  return rows;
}

export async function markDueRemindersReady(tenantId, now) {
  await db.prepare(`
    UPDATE appointment_reminders
    SET status = 'ready', updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND status = 'pending' AND scheduled_for <= ?
      AND appointment_id IN (
        SELECT id FROM appointments
        WHERE tenant_id = ? AND active = 1 AND status = 'pending'
      )
  `).run(tenantId, now, tenantId);
}

export async function readyReminders(tenantId) {
  return await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ? AND r.status = 'ready'
      AND a.active = 1 AND a.status = 'pending'
    ORDER BY r.scheduled_for, r.id
  `).all(tenantId);
}

export async function markReminderSimulatedSent(id, tenantId) {
  const result = await db.prepare(`
    UPDATE appointment_reminders
    SET status = 'sent', dispatched_at = CURRENT_TIMESTAMP,
        last_error = '', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'ready'
      AND appointment_id IN (
        SELECT id FROM appointments
        WHERE tenant_id = ? AND active = 1 AND status = 'pending'
      )
  `).run(id, tenantId, tenantId);
  return result.changes;
}

export async function listAppointmentReminders(tenantId) {
  return await db.prepare(`${reminderSelect}
    WHERE r.tenant_id = ?
    ORDER BY r.id DESC
    LIMIT 200
  `).all(tenantId);
}

export async function auditReminder(userId, action, reminderId, tenantId, details = {}) {
  await audit(userId || null, action, "appointment_reminders", reminderId, { tenantId, ...details });
}
