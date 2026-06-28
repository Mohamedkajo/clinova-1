import { audit, db } from "../db.js";

export async function listCrmTaskRows(user) {
  const rows = await db.prepare(`
    SELECT t.id, t.client_id AS clientId, t.assigned_to AS assignedTo, t.type, t.title,
           t.due_date AS dueDate, t.status, t.priority, t.notes, t.completed_at AS completedAt,
           t.created_at AS createdAt, c.fname || ' ' || c.lname AS clientName, c.phone AS clientPhone,
           u.name AS assignedToName
    FROM crm_tasks t
    JOIN clients c ON c.id = t.client_id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.tenant_id = ? AND c.active = 1
    ORDER BY CASE t.status WHEN 'open' THEN 0 ELSE 1 END, COALESCE(t.due_date, '9999-12-31'), t.id DESC
    LIMIT 150
  `).all(user.tenantId);
  if (user.role !== "therapist") return rows;
  const visibleClientIds = new Set((await db.prepare(
    "SELECT id FROM clients WHERE tenant_id = ? AND active = 1 AND therapist_id = ?",
  ).all(user.tenantId, user.id)).map((row) => Number(row.id)));
  return rows.filter((row) => Number(row.assignedTo || 0) === Number(user.id) || visibleClientIds.has(Number(row.clientId)));
}

export async function listCrmEventRows(user, clientId = null) {
  const therapistFilter = user.role === "therapist" ? " AND c.therapist_id = ?" : "";
  const clientFilter = clientId ? " AND e.client_id = ?" : "";
  const args = [user.tenantId];
  if (user.role === "therapist") args.push(user.id);
  if (clientId) args.push(clientId);
  return await db.prepare(`
    SELECT e.id, e.client_id AS clientId, e.user_id AS userId, e.type, e.description,
           e.created_at AS createdAt, c.fname || ' ' || c.lname AS clientName, u.name AS userName
    FROM crm_events e
    LEFT JOIN clients c ON c.id = e.client_id
    LEFT JOIN users u ON u.id = e.user_id
    WHERE e.tenant_id = ?${therapistFilter}${clientFilter}
    ORDER BY e.id DESC
    LIMIT 100
  `).all(...args);
}

export async function clientExists(clientId, tenantId) {
  const row = await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND active = 1").get(clientId, tenantId);
  return Boolean(row);
}

export async function assignedUserExists(userId, tenantId) {
  const row = await db.prepare("SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1").get(userId, tenantId);
  return Boolean(row);
}

export async function createCrmTask({ tenantId, clientId, assignedTo, type, title, dueDate, priority, notes }) {
  const result = await db.prepare(`
    INSERT INTO crm_tasks (tenant_id, client_id, assigned_to, type, title, due_date, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, clientId, assignedTo, type, title, dueDate, priority, notes);
  return result.lastInsertRowid;
}

export async function crmTaskById(id, tenantId) {
  return await db.prepare("SELECT client_id, assigned_to FROM crm_tasks WHERE id = ? AND tenant_id = ?").get(id, tenantId);
}

export async function updateCrmTask(id, tenantId, values) {
  await db.prepare(`
    UPDATE crm_tasks
    SET assigned_to = ?, type = ?, title = ?, due_date = ?, status = ?, priority = ?, notes = ?,
        completed_at = CASE WHEN ? = 'done' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(values.assignedTo, values.type, values.title, values.dueDate, values.status, values.priority, values.notes, values.status, id, tenantId);
}

export async function updateClientLastContacted(clientId, tenantId) {
  await db.prepare("UPDATE clients SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(clientId, tenantId);
}

export async function addCrmEvent({ tenantId, clientId, userId, type, description }) {
  await db.prepare("INSERT INTO crm_events (tenant_id, client_id, user_id, type, description) VALUES (?, ?, ?, ?, ?)")
    .run(tenantId, clientId || null, userId || null, type, description);
}

export async function auditCrmTask(userId, action, entityId, tenantId) {
  await audit(userId, action, "crm_tasks", entityId, { tenantId });
}
