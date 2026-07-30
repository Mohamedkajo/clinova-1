import { db } from "../db.js";

const notificationSelect = `
  SELECT id, type, title, message,
         related_entity_type AS relatedEntityType,
         related_entity_id AS relatedEntityId,
         status, created_at AS createdAt, read_at AS readAt
  FROM notifications
`;

export async function listUserNotifications(user, limit = 100) {
  return await db.prepare(`${notificationSelect}
    WHERE tenant_id = ? AND user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(user.tenantId, user.id, limit);
}

export async function countUnreadNotifications(user) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE tenant_id = ? AND user_id = ? AND status = 'unread'
  `).get(user.tenantId, user.id);
  return Number(row?.count || 0);
}

export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  message,
  relatedEntityType,
  relatedEntityId,
}) {
  const recipient = await db.prepare(`
    SELECT id
    FROM users
    WHERE id = ? AND tenant_id = ? AND active = 1
      AND COALESCE(is_platform_owner, 0) = 0
  `).get(userId, tenantId);
  if (!recipient) return null;
  const result = await db.prepare(`
    INSERT INTO notifications (
      tenant_id, user_id, type, title, message,
      related_entity_type, related_entity_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    userId,
    type,
    title,
    message,
    relatedEntityType || null,
    relatedEntityId || null,
  );
  return Number(result.lastInsertRowid);
}

export async function recipientIdsForRoles(tenantId, roles, { excludeUserId = null } = {}) {
  if (!roles.length) return [];
  const placeholders = roles.map(() => "?").join(",");
  const values = [tenantId, ...roles];
  const excludeClause = excludeUserId ? "AND id != ?" : "";
  if (excludeUserId) values.push(excludeUserId);
  const rows = await db.prepare(`
    SELECT id
    FROM users
    WHERE tenant_id = ? AND role IN (${placeholders}) AND active = 1
      AND COALESCE(is_platform_owner, 0) = 0
      ${excludeClause}
  `).all(...values);
  return rows.map((row) => Number(row.id));
}

export async function appointmentNotificationContext(appointmentId, tenantId) {
  return await db.prepare(`
    SELECT a.id, a.client_id AS clientId, a.therapist_id AS therapistId,
           a.date, a.time, a.status,
           c.fname || ' ' || c.lname AS clientName,
           s.name AS serviceName
    FROM appointments a
    JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1
  `).get(appointmentId, tenantId);
}

export async function markNotificationRead(id, user) {
  const result = await db.prepare(`
    UPDATE notifications
    SET status = 'read', read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
    WHERE id = ? AND tenant_id = ? AND user_id = ?
  `).run(id, user.tenantId, user.id);
  return result.changes;
}

export async function markAllNotificationsRead(user) {
  const result = await db.prepare(`
    UPDATE notifications
    SET status = 'read', read_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND user_id = ? AND status = 'unread'
  `).run(user.tenantId, user.id);
  return result.changes;
}
