import { audit, db } from "../db.js";

const templateSelect = `
  SELECT t.id, t.category_id AS categoryId, t.service_id AS serviceId, t.title,
         t.description, t.consent_text AS consentText, t.language,
         t.expiration_days AS expirationDays, t.version, t.active, t.url,
         t.original_name AS originalName, t.mime_type AS mimeType, t.size, t.path,
         t.created_at AS createdAt, t.updated_at AS updatedAt,
         c.name AS categoryName, s.name AS serviceName
  FROM consent_templates t
  LEFT JOIN categories c ON c.id = t.category_id AND c.tenant_id = t.tenant_id
  LEFT JOIN services s ON s.id = t.service_id AND s.tenant_id = t.tenant_id
`;

export async function listConsentTemplates(tenantId, { includeInactive = false } = {}) {
  return await db.prepare(`${templateSelect}
    WHERE t.tenant_id = ? ${includeInactive ? "" : "AND t.active = 1"}
    ORDER BY t.id DESC
  `).all(tenantId);
}

export async function consentTemplateById(id, tenantId, { includeInactive = false } = {}) {
  return await db.prepare(`${templateSelect}
    WHERE t.id = ? AND t.tenant_id = ? ${includeInactive ? "" : "AND t.active = 1"}
  `).get(id, tenantId);
}

export async function listConsentSignatures(tenantId) {
  return await db.prepare(`
    SELECT s.id, s.template_id AS templateId, s.client_id AS clientId, s.appointment_id AS appointmentId,
           s.signer_name AS signerName, s.signed_at AS signedAt, t.title AS templateTitle,
           c.fname || ' ' || c.lname AS clientName
    FROM consent_signatures s
    JOIN consent_templates t ON t.id = s.template_id AND t.tenant_id = s.tenant_id
    LEFT JOIN clients c ON c.id = s.client_id AND c.tenant_id = s.tenant_id
    WHERE s.tenant_id = ?
    ORDER BY s.id DESC
    LIMIT 100
  `).all(tenantId);
}

export async function findDuplicateSignature({ tenantId, templateId, clientId, appointmentId }) {
  return await db.prepare(`
    SELECT id FROM consent_signatures
    WHERE tenant_id = ? AND template_id = ?
      AND COALESCE(client_id, 0) = ? AND COALESCE(appointment_id, 0) = ?
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

export async function deleteUnlinkedConsentSignature(id, tenantId) {
  await db.prepare(`
    DELETE FROM consent_signatures
    WHERE id = ? AND tenant_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM patient_consents
        WHERE signature_id = consent_signatures.id AND tenant_id = consent_signatures.tenant_id
      )
  `).run(id, tenantId);
}

export async function clientById(clientId, tenantId) {
  return await db.prepare("SELECT id, fname, lname, therapist_id AS therapistId FROM clients WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(clientId, tenantId);
}

export async function consentAppointmentById(appointmentId, tenantId) {
  if (!appointmentId) return null;
  return await db.prepare(`
    SELECT id, client_id AS clientId, service_id AS serviceId
    FROM appointments WHERE id = ? AND tenant_id = ? AND active = 1
  `).get(appointmentId, tenantId);
}

export async function consentAppointmentExists(appointmentId, tenantId) {
  if (!appointmentId) return true;
  return Boolean(await consentAppointmentById(appointmentId, tenantId));
}

export async function consentTemplateMatchesAppointmentService({ templateId, appointmentId, tenantId }) {
  if (!appointmentId) return true;
  const row = await db.prepare(`
    SELECT t.id
    FROM appointments a
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    JOIN consent_templates t ON t.id = ? AND t.tenant_id = a.tenant_id AND t.active = 1
    WHERE a.id = ? AND a.tenant_id = ?
      AND (t.service_id IS NULL OR t.service_id = a.service_id)
      AND (t.category_id IS NULL OR t.category_id = s.category_id)
    LIMIT 1
  `).get(templateId, appointmentId, tenantId);
  return Boolean(row);
}

export async function consentCategoryExists(categoryId, tenantId) {
  if (!categoryId) return true;
  return Boolean(await db.prepare("SELECT id FROM categories WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(categoryId, tenantId));
}

export async function consentServiceExists(serviceId, tenantId) {
  if (!serviceId) return true;
  return Boolean(await db.prepare("SELECT id FROM services WHERE id = ? AND tenant_id = ? AND active = 1")
    .get(serviceId, tenantId));
}

export async function createSignedClientFile({
  tenantId, clientId, appointmentId, name, originalName, storedName, mimeType, size, path, notes, uploadedBy,
}) {
  const result = await db.prepare(`
    INSERT INTO client_files (
      tenant_id, client_id, appointment_id, name, url, original_name, stored_name,
      mime_type, size, path, notes, category, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'consent', ?)
  `).run(tenantId, clientId, appointmentId, name, "", originalName, storedName, mimeType, size, path, notes, uploadedBy);
  return result.lastInsertRowid;
}

export async function updateClientFileUrl(id, url) {
  await db.prepare("UPDATE client_files SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, id);
}

export async function createConsentTemplate(data) {
  const result = await db.prepare(`
    INSERT INTO consent_templates (
      tenant_id, category_id, service_id, title, description, consent_text, language,
      expiration_days, version, created_by, updated_by, url, original_name, mime_type, size, path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.tenantId, data.categoryId, data.serviceId, data.title, data.description || "",
    data.consentText || "", data.language || "he", data.expirationDays, data.version || 1,
    data.userId, data.userId, data.url || "", data.originalName || "", data.mimeType || "application/pdf",
    data.size || 0, data.path || "",
  );
  return result.lastInsertRowid;
}

export async function updateConsentTemplate(id, tenantId, data, userId) {
  const result = await db.prepare(`
    UPDATE consent_templates
    SET category_id = ?, service_id = ?, title = ?, description = ?, consent_text = ?,
        language = ?, expiration_days = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(
    data.categoryId, data.serviceId, data.title, data.description || "", data.consentText || "",
    data.language, data.expirationDays, userId, id, tenantId,
  );
  return result.changes;
}

export async function updateConsentTemplateUrl(id, url) {
  await db.prepare("UPDATE consent_templates SET url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(url, id);
}

export async function templateHasSignedRecords(id, tenantId) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM consent_signatures
    WHERE tenant_id = ? AND template_id = ?
  `).get(tenantId, id);
  return Number(row?.count || 0) > 0;
}

export async function archiveConsentTemplate(id, tenantId, userId = null) {
  const result = await db.prepare(`
    UPDATE consent_templates
    SET active = 0, updated_by = COALESCE(?, updated_by), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).run(userId, id, tenantId);
  return result.changes;
}

export async function expirePatientConsents(tenantId, clientId = null) {
  const params = [tenantId];
  const clientClause = clientId ? "AND client_id = ?" : "";
  if (clientId) params.push(clientId);
  const expiring = await db.prepare(`
    SELECT id
    FROM patient_consents
    WHERE tenant_id = ? ${clientClause}
      AND status = 'signed' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).all(...params);
  if (!expiring.length) return [];
  await db.prepare(`
    INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description)
    SELECT tenant_id, client_id, assigned_by, appointment_id, 'consent_expired', ''
    FROM patient_consents
    WHERE tenant_id = ? ${clientClause}
      AND status = 'signed' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run(...params);
  await db.prepare(`
    UPDATE patient_consents
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? ${clientClause}
      AND status = 'signed' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `).run(...params);
  for (const row of expiring) {
    await audit(null, "status_expired", "patient_consents", row.id, {
      tenantId,
      automatic: true
    });
  }
  return expiring;
}

export async function findDuplicatePatientConsent({ tenantId, templateId, clientId, appointmentId, serviceId }) {
  return await db.prepare(`
    SELECT id, status
    FROM patient_consents
    WHERE tenant_id = ? AND template_id = ? AND client_id = ?
      AND COALESCE(appointment_id, 0) = ? AND COALESCE(service_id, 0) = ?
      AND status IN ('pending','signed')
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    LIMIT 1
  `).get(tenantId, templateId, clientId, Number(appointmentId || 0), Number(serviceId || 0));
}

export async function createPatientConsent({ tenantId, templateId, clientId, appointmentId, serviceId, assignedBy }) {
  const result = await db.prepare(`
    INSERT INTO patient_consents (tenant_id, template_id, client_id, appointment_id, service_id, assigned_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, templateId, clientId, appointmentId, serviceId, assignedBy);
  return result.lastInsertRowid;
}

const patientConsentSelect = `
  SELECT pc.id, pc.template_id AS templateId, pc.client_id AS clientId,
         pc.appointment_id AS appointmentId, pc.service_id AS serviceId, pc.status,
         pc.signature_id AS signatureId, pc.assigned_by AS assignedBy,
         pc.witness_user_id AS witnessUserId, pc.signed_at AS signedAt,
         pc.expires_at AS expiresAt, pc.declined_at AS declinedAt,
         pc.created_at AS createdAt, pc.updated_at AS updatedAt,
         t.title AS templateTitle, t.language, t.expiration_days AS expirationDays,
         au.name AS assignedByName, wu.name AS witnessName
  FROM patient_consents pc
  JOIN consent_templates t ON t.id = pc.template_id AND t.tenant_id = pc.tenant_id
  LEFT JOIN users au ON au.id = pc.assigned_by AND au.tenant_id = pc.tenant_id
  LEFT JOIN users wu ON wu.id = pc.witness_user_id AND wu.tenant_id = pc.tenant_id
`;

export async function patientConsentById(id, tenantId) {
  return await db.prepare(`${patientConsentSelect} WHERE pc.id = ? AND pc.tenant_id = ?`).get(id, tenantId);
}

export async function listPatientConsents(clientId, tenantId) {
  return await db.prepare(`${patientConsentSelect}
    WHERE pc.client_id = ? AND pc.tenant_id = ?
    ORDER BY pc.id DESC
  `).all(clientId, tenantId);
}

export async function signPatientConsentRecord({ id, tenantId, signatureId, witnessUserId, expiresAt }) {
  const result = await db.prepare(`
    UPDATE patient_consents
    SET status = 'signed', signature_id = ?, witness_user_id = ?, signed_at = CURRENT_TIMESTAMP,
        expires_at = ?, declined_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'pending'
  `).run(signatureId, witnessUserId, expiresAt, id, tenantId);
  return result.changes;
}

export async function updatePatientConsentStatus({ id, tenantId, status }) {
  const result = await db.prepare(`
    UPDATE patient_consents
    SET status = ?, declined_at = CASE WHEN ? = 'declined' THEN CURRENT_TIMESTAMP ELSE declined_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
      AND ((status = 'pending' AND ? = 'declined') OR (status = 'signed' AND ? = 'expired'))
  `).run(status, status, id, tenantId, status, status);
  return result.changes;
}

export async function addConsentTimelineEvent({ tenantId, clientId, userId, appointmentId, type }) {
  await db.prepare(`
    INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description)
    VALUES (?, ?, ?, ?, ?, '')
  `).run(tenantId, clientId, userId, appointmentId, type);
}

export async function auditConsent(userId, action, entity, entityId, details) {
  await audit(userId, action, entity, entityId, details);
}
