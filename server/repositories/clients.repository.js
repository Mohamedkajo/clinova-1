import { audit, db } from "../db.js";

export async function listClientRows(user) {
  return user.role === "therapist"
    ? await db.prepare("SELECT * FROM clients WHERE tenant_id = ? AND active = 1 AND therapist_id = ? ORDER BY updated_at DESC")
      .all(user.tenantId, user.id)
    : await db.prepare("SELECT * FROM clients WHERE tenant_id = ? AND active = 1 ORDER BY updated_at DESC")
      .all(user.tenantId);
}

function patientWorkspaceWhere(user, filters) {
  const clauses = ["c.tenant_id = ?", "c.active = 1"];
  const values = [user.tenantId];
  if (user.role === "therapist") {
    clauses.push("c.therapist_id = ?");
    values.push(user.id);
  }
  if (filters.query) {
    const term = `%${filters.query.toLowerCase()}%`;
    clauses.push("(LOWER(c.fname || ' ' || c.lname) LIKE ? OR LOWER(c.phone) LIKE ? OR LOWER(COALESCE(c.email, '')) LIKE ?)");
    values.push(term, term, term);
  }
  if (filters.stage) {
    clauses.push("c.stage = ?");
    values.push(filters.stage);
  }
  if (filters.therapistId) {
    clauses.push("c.therapist_id = ?");
    values.push(filters.therapistId);
  }
  if (filters.upcoming === "yes" || filters.upcoming === "no") {
    clauses.push(`${filters.upcoming === "no" ? "NOT " : ""}EXISTS (
      SELECT 1 FROM appointments upcoming
      WHERE upcoming.tenant_id = c.tenant_id AND upcoming.client_id = c.id
        AND upcoming.active = 1 AND upcoming.status = 'pending' AND upcoming.date >= ?
    )`);
    values.push(filters.today);
  }
  if (filters.recentSince) {
    clauses.push(`(
      c.updated_at >= ?
      OR EXISTS (SELECT 1 FROM crm_events recent_event WHERE recent_event.tenant_id = c.tenant_id AND recent_event.client_id = c.id AND recent_event.created_at >= ?)
      OR EXISTS (SELECT 1 FROM appointments recent_appointment WHERE recent_appointment.tenant_id = c.tenant_id AND recent_appointment.client_id = c.id AND recent_appointment.active = 1 AND recent_appointment.updated_at >= ?)
    )`);
    values.push(filters.recentSince, filters.recentSince, filters.recentSince);
  }
  return { sql: clauses.join(" AND "), values };
}

export async function listPatientWorkspaceRows(user, filters) {
  const where = patientWorkspaceWhere(user, filters);
  const rows = await db.prepare(`
    SELECT c.*, u.name AS therapist_name,
      (SELECT MAX(a.date) FROM appointments a WHERE a.tenant_id = c.tenant_id AND a.client_id = c.id AND a.active = 1 AND a.status = 'done' AND a.date <= ?) AS last_appointment_date,
      (SELECT MIN(a.date) FROM appointments a WHERE a.tenant_id = c.tenant_id AND a.client_id = c.id AND a.active = 1 AND a.status = 'pending' AND a.date >= ?) AS next_appointment_date,
      (SELECT MAX(e.created_at) FROM crm_events e WHERE e.tenant_id = c.tenant_id AND e.client_id = c.id) AS latest_crm_at,
      (SELECT MAX(a.updated_at) FROM appointments a WHERE a.tenant_id = c.tenant_id AND a.client_id = c.id AND a.active = 1) AS latest_appointment_at
    FROM clients c
    LEFT JOIN users u ON u.id = c.therapist_id AND u.tenant_id = c.tenant_id
    WHERE ${where.sql}
    ORDER BY c.updated_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `).all(filters.today, filters.today, ...where.values, filters.pageSize, filters.offset);
  const totalRow = await db.prepare(`SELECT COUNT(*) AS count FROM clients c WHERE ${where.sql}`).get(...where.values);
  return { rows, total: Number(totalRow?.count || 0) };
}

export async function listPatientTherapistOptions(user) {
  const therapistClause = user.role === "therapist" ? "AND c.therapist_id = ?" : "";
  const values = user.role === "therapist" ? [user.tenantId, user.id] : [user.tenantId];
  return await db.prepare(`
    SELECT DISTINCT u.id, u.name, u.username
    FROM clients c
    JOIN users u ON u.id = c.therapist_id AND u.tenant_id = c.tenant_id AND u.active = 1
    WHERE c.tenant_id = ? AND c.active = 1 ${therapistClause}
    ORDER BY u.name, u.id
  `).all(...values);
}

export async function findClientProfileRow(user, clientId) {
  const therapistClause = user.role === "therapist" ? "AND c.therapist_id = ?" : "";
  const values = user.role === "therapist" ? [clientId, user.tenantId, user.id] : [clientId, user.tenantId];
  return await db.prepare(`
    SELECT c.*, u.name AS therapist_name, u.username AS therapist_username
    FROM clients c
    LEFT JOIN users u ON u.id = c.therapist_id AND u.tenant_id = c.tenant_id
    WHERE c.id = ? AND c.tenant_id = ? AND c.active = 1 ${therapistClause}
  `).get(...values);
}

export async function canSeeClient(user, clientId) {
  if (user.role !== "therapist") {
    const row = await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1")
      .get(clientId, user.tenantId);
    return Boolean(row);
  }
  const row = await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1 AND therapist_id = ?")
    .get(clientId, user.tenantId, user.id);
  return Boolean(row);
}

export async function clientTherapistExists(therapistId, tenantId) {
  if (!therapistId) return true;
  const row = await db.prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(therapistId, tenantId);
  return Boolean(row);
}

export async function createClient(tenantId, values) {
  const result = await db.prepare("INSERT INTO clients (tenant_id, fname, lname, phone, email, therapist_id, stage, source, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(tenantId, values.fname, values.lname, values.phone, values.email, values.therapistId, values.stage, values.source, values.tags, values.notes);
  return result.lastInsertRowid;
}

export async function findClientCrmFields(id, tenantId) {
  return await db.prepare("SELECT stage, source, tags, notes FROM clients WHERE id = ? AND tenant_id = ?").get(id, tenantId);
}

export async function updateClient(id, tenantId, values) {
  await db.prepare("UPDATE clients SET fname = ?, lname = ?, phone = ?, email = ?, therapist_id = ?, stage = ?, source = ?, tags = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(values.fname, values.lname, values.phone, values.email, values.therapistId, values.stage, values.source, values.tags, values.notes, id, tenantId);
}

export async function archiveClient(id, tenantId) {
  const result = await db.prepare("UPDATE clients SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, tenantId);
  return result.changes;
}

export async function archiveClientAppointments(clientId, tenantId) {
  await db.prepare("UPDATE appointments SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND tenant_id = ?")
    .run(clientId, tenantId);
}

export async function addCrmEvent({ tenantId, clientId, userId, type, description }) {
  await db.prepare("INSERT INTO crm_events (tenant_id, client_id, user_id, type, description) VALUES (?, ?, ?, ?, ?)")
    .run(tenantId, clientId || null, userId || null, type, description);
}

export async function listClientCrmEvents(clientId, tenantId) {
  return await db.prepare(`
    SELECT e.id, e.client_id AS clientId, e.user_id AS userId, e.type, e.description,
           e.created_at AS createdAt, u.name AS userName
    FROM crm_events e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.tenant_id = ? AND e.client_id = ?
    ORDER BY e.id DESC
    LIMIT 100
  `).all(tenantId, clientId);
}

export async function listClientAppointments(user, clientId) {
  const base = `
    SELECT a.*, c.fname, c.lname, c.phone, s.name AS service_name, s.duration, s.price, u.name AS therapist_name
    FROM appointments a
    JOIN clients c ON c.id = a.client_id
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.therapist_id
  `;
  const rows = user.role === "therapist"
    ? await db.prepare(`${base} WHERE a.tenant_id = ? AND a.active = 1 AND a.therapist_id = ? AND a.client_id = ? ORDER BY a.date DESC, a.time DESC`)
      .all(user.tenantId, user.id, clientId)
    : await db.prepare(`${base} WHERE a.tenant_id = ? AND a.active = 1 AND a.client_id = ? ORDER BY a.date DESC, a.time DESC`)
      .all(user.tenantId, clientId);
  return rows;
}

export async function listClientFiles(clientId, tenantId) {
  return await db.prepare(`
    SELECT id, client_id AS clientId, name, url, original_name AS originalName, mime_type AS mimeType, size, notes, created_at AS createdAt
    FROM client_files
    WHERE tenant_id = ? AND active = 1 AND client_id = ?
    ORDER BY id DESC
  `).all(tenantId, clientId);
}

export async function listClientConsentSignatures(clientId, tenantId) {
  return await db.prepare(`
    SELECT s.id, s.template_id AS templateId, s.appointment_id AS appointmentId,
           s.signer_name AS signerName, s.signed_at AS signedAt, t.title AS templateTitle
    FROM consent_signatures s
    JOIN consent_templates t ON t.id = s.template_id AND t.tenant_id = s.tenant_id
    WHERE s.tenant_id = ? AND s.client_id = ?
    ORDER BY s.signed_at DESC, s.id DESC
  `).all(tenantId, clientId);
}

export async function tenantBillingSnapshot(tenantId) {
  const tenant = await db.prepare("SELECT id, status, plan FROM tenants WHERE id = ?").get(tenantId);
  const subscription = await db.prepare(`
    SELECT status, plan
    FROM subscriptions
    WHERE tenant_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(tenantId);
  const usage = await db.prepare("SELECT COUNT(*) AS count FROM clients WHERE tenant_id = ? AND active = 1").get(tenantId);
  return {
    plan: subscription?.plan || tenant?.plan || "starter",
    status: subscription?.status || tenant?.status || "trial",
    usage: { clients: Number(usage?.count || 0) },
  };
}

export async function auditClient(userId, action, entityId, tenantId) {
  await audit(userId, action, "clients", entityId, { tenantId });
}
