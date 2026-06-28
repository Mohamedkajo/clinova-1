import { audit, db } from "../../db.js";

export async function listGiftCards(tenantId) {
  return db.prepare(`
    SELECT g.id, g.code, g.from_client_id AS fromClientId, g.to_client_id AS toClientId,
           g.service_id AS serviceId, g.sessions, g.message, g.status,
           g.created_at AS createdAt, g.redeemed_at AS redeemedAt,
           fc.fname || ' ' || fc.lname AS fromClientName,
           tc.fname || ' ' || tc.lname AS toClientName,
           tc.phone AS toClientPhone,
           s.name AS serviceName
    FROM gift_cards g
    LEFT JOIN clients fc ON fc.id = g.from_client_id
    LEFT JOIN clients tc ON tc.id = g.to_client_id
    LEFT JOIN services s ON s.id = g.service_id
    WHERE g.tenant_id = ?
    ORDER BY g.id DESC
  `).all(tenantId);
}

export async function giftClientExists(clientId, tenantId) {
  if (!clientId) return true;
  return Boolean(await db.prepare("SELECT id FROM clients WHERE id = ? AND tenant_id = ?").get(clientId, tenantId));
}

export async function giftServiceExists(serviceId, tenantId) {
  if (!serviceId) return true;
  return Boolean(await db.prepare("SELECT id FROM services WHERE id = ? AND tenant_id = ?").get(serviceId, tenantId));
}

export async function createGiftCard(tenantId, code, body) {
  const result = await db
    .prepare("INSERT INTO gift_cards (tenant_id, code, from_client_id, to_client_id, service_id, sessions, message) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(tenantId, code, body.fromClientId || null, body.toClientId || null, body.serviceId || null, Math.max(1, Number(body.sessions || 1)), String(body.message || ""));
  return result.lastInsertRowid;
}

export async function updateGiftCardStatus(id, tenantId, status) {
  const result = await db
    .prepare("UPDATE gift_cards SET status = ?, redeemed_at = CASE WHEN ? = 'redeemed' THEN CURRENT_TIMESTAMP ELSE redeemed_at END WHERE id = ? AND tenant_id = ?")
    .run(status, status, id, tenantId);
  return result.changes;
}

export async function auditGift(userId, action, entityId, tenantId) {
  await audit(userId, action, "gift_cards", entityId, { tenantId });
}
