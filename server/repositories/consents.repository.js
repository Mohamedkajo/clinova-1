import { audit, db } from "../db.js";

export async function listConsentTemplates(tenantId) {
  return await db.prepare(`
    SELECT t.id, t.category_id AS categoryId, t.title, t.url, t.original_name AS originalName,
           t.mime_type AS mimeType, t.size, t.created_at AS createdAt, c.name AS categoryName
    FROM consent_templates t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.tenant_id = ? AND t.active = 1
    ORDER BY t.id DESC
  `).all(tenantId);
}

export async function consentTemplateById(id, tenantId) {
  return await db.prepare(`
    SELECT id, category_id AS categoryId, title, url, original_name AS originalName, mime_type AS mimeType, size, path, active
    FROM consent_templates
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).get(id, tenantId);
}

export async function listConsentSignatures(tenantId) {
  return await db.prepare(`
    SELECT s.id, s.template_id AS templateId, s.client_id AS clientId, s.appointment_id AS appointmentId,
           s.signer_name AS signerName, s.signed_at AS signedAt, t.title AS templateTitle,
           c.fname || ' ' || c.lname AS clientName
    FROM consent_signatures s
    JOIN consent_templates t ON t.id = s.template_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.tenant_id = ?
    ORDER BY s.id DESC
    LIMIT 100
  `).all(tenantId);
}

export async function findDuplicateSignature({ tenantId, templateId, clientId, appointmentId }) {
  return await db.prepare(`
    SELECT id
    FROM consent_signatures
    WHERE tenant_id = ?
      AND template_id = ?
      AND COALESCE(client_id, 0) = ?
      AND COALESCE(appointment_id, 0) = ?
    LIMIT 1
  `).get(tenantId, templateId, Number(clientId || 0), Number(appointmentId || 0));
}

export async function createConsentSignature({ tenantId, templateId, clientId, appointmentId, signerName, signatureData }) {
  const result = await db.prepare(`
    INSERT INTO consent_signatures (tenant_id, template_id, client_id, appointment_id, signer_name, signature_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, templateId, clientId, appointmentId, signerName, signatureData);
  return result.lastInsertRowid;
}

export async function clientById(clientId, tenantId) {
  return await db.prepare("SELECT fname, lname FROM clients WHERE id = ? AND tenant_id = ?").get(clientId, tenantId);
}

export async function consentAppointmentExists(appointmentId, tenantId) {
  if (!appointmentId) return true;
  return Boolean(await db.prepare("SELECT id FROM appointments WHERE id = ? AND tenant_id = ?").get(appointmentId, tenantId));
}

export async function consentTemplateMatchesAppointmentService({ templateId, appointmentId, tenantId }) {
  if (!appointmentId) return true;
  const row = await db.prepare(`
    SELECT t.id
    FROM appointments a
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    JOIN consent_templates t ON t.category_id = s.category_id
      AND t.id = ?
      AND t.tenant_id = a.tenant_id
      AND t.active = 1
    WHERE a.id = ? AND a.tenant_id = ?
    LIMIT 1
  `).get(templateId, appointmentId, tenantId);
  return Boolean(row);
}

export async function consentCategoryExists(categoryId, tenantId) {
  if (!categoryId) return true;
  return Boolean(await db.prepare("SELECT id FROM categories WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(categoryId, tenantId));
}

export async function createSignedClientFile({ tenantId, clientId, name, originalName, mimeType, size, path, notes }) {
  const result = await db.prepare(`
    INSERT INTO client_files (tenant_id, client_id, name, url, original_name, mime_type, size, path, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, clientId, name, "", originalName, mimeType, size, path, notes);
  return result.lastInsertRowid;
}

export async function updateClientFileUrl(id, url) {
  await db.prepare("UPDATE client_files SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, id);
}

export async function createConsentTemplate({ tenantId, categoryId, title, originalName, mimeType, size, path }) {
  const result = await db.prepare(`
    INSERT INTO consent_templates (tenant_id, category_id, title, url, original_name, mime_type, size, path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, categoryId, title, "", originalName, mimeType, size, path);
  return result.lastInsertRowid;
}

export async function updateConsentTemplateUrl(id, url) {
  await db.prepare("UPDATE consent_templates SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, id);
}

export async function archiveConsentTemplate(id, tenantId) {
  const result = await db.prepare("UPDATE consent_templates SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?")
    .run(id, tenantId);
  return result.changes;
}

export async function auditConsent(userId, action, entity, entityId, details) {
  await audit(userId, action, entity, entityId, details);
}
