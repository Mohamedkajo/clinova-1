import { db } from "../db.js";

const invoiceSelect = `
  SELECT i.id, i.tenant_id AS tenantIdValue, i.patient_id AS patientId, i.appointment_id AS appointmentId,
         i.invoice_number AS invoiceNumber, i.issue_date AS issueDate, i.status,
         i.subtotal_minor AS subtotalMinor, i.discount_minor AS discountMinor,
         i.tax_minor AS taxMinor, i.total_minor AS totalMinor, i.currency,
         i.created_by AS createdBy, i.created_at AS createdAt, i.updated_at AS updatedAt,
         c.fname || ' ' || c.lname AS patientName,
         a.date AS appointmentDate, a.time AS appointmentTime,
         u.name AS creatorName
  FROM patient_invoices i
  JOIN clients c ON c.id = i.patient_id AND c.tenant_id = i.tenant_id
  LEFT JOIN appointments a ON a.id = i.appointment_id AND a.tenant_id = i.tenant_id
  JOIN users u ON u.id = i.created_by AND u.tenant_id = i.tenant_id
`;

export async function financePatient(patientId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT id, fname, lname
    FROM clients
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).get(patientId, tenantId);
}

export async function financeAppointment(appointmentId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT a.id, a.client_id AS patientId, a.service_id AS serviceId,
           a.date, a.time, a.status, a.active,
           s.name AS serviceName, s.price AS servicePrice, s.active AS serviceActive
    FROM appointments a
    JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    WHERE a.id = ? AND a.tenant_id = ? AND a.active = 1
  `).get(appointmentId, tenantId);
}

export async function financeService(serviceId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT id, name, price, active
    FROM services
    WHERE id = ? AND tenant_id = ?
  `).get(serviceId, tenantId);
}

export async function activeAppointmentInvoice(appointmentId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT id, invoice_number AS invoiceNumber, status
    FROM patient_invoices
    WHERE appointment_id = ? AND tenant_id = ? AND status != 'cancelled'
    LIMIT 1
  `).get(appointmentId, tenantId);
}

export async function createPatientInvoice(values, connection = db) {
  const result = await connection.prepare(`
    INSERT INTO patient_invoices (
      tenant_id, patient_id, appointment_id, invoice_number, issue_date, status,
      subtotal_minor, discount_minor, tax_minor, total_minor, currency, created_by
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
  `).run(
    values.tenantId,
    values.patientId,
    values.appointmentId || null,
    values.invoiceNumber,
    null,
    values.subtotalMinor,
    values.discountMinor,
    values.taxMinor,
    values.totalMinor,
    values.currency,
    values.createdBy,
  );
  return Number(result.lastInsertRowid);
}

export async function addPatientInvoiceItem(invoiceId, tenantId, item, connection = db) {
  await connection.prepare(`
    INSERT INTO patient_invoice_items (
      tenant_id, invoice_id, service_id, description, quantity,
      unit_price_minor, discount_minor, tax_minor, line_total_minor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    invoiceId,
    item.serviceId || null,
    item.description,
    item.quantity,
    item.unitPriceMinor,
    item.discountMinor,
    item.taxMinor,
    item.lineTotalMinor,
  );
}

export async function replacePatientInvoiceItems(invoiceId, tenantId, totals, items, connection = db) {
  await connection.prepare("DELETE FROM patient_invoice_items WHERE invoice_id = ? AND tenant_id = ?").run(invoiceId, tenantId);
  for (const item of items) await addPatientInvoiceItem(invoiceId, tenantId, item, connection);
  await connection.prepare(`
    UPDATE patient_invoices
    SET subtotal_minor = ?, discount_minor = ?, tax_minor = ?, total_minor = ?,
        currency = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'draft'
  `).run(
    totals.subtotalMinor,
    totals.discountMinor,
    totals.taxMinor,
    totals.totalMinor,
    totals.currency,
    invoiceId,
    tenantId,
  );
}

export async function patientInvoiceById(invoiceId, tenantId, connection = db) {
  return await connection.prepare(`${invoiceSelect}
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId);
}

export async function patientInvoiceItems(invoiceId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT id, service_id AS serviceId, description, quantity,
           unit_price_minor AS unitPriceMinor, discount_minor AS discountMinor,
           tax_minor AS taxMinor, line_total_minor AS lineTotalMinor
    FROM patient_invoice_items
    WHERE invoice_id = ? AND tenant_id = ?
    ORDER BY id
  `).all(invoiceId, tenantId);
}

export async function patientInvoicePayments(invoiceId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT p.id, p.patient_id AS patientId, p.invoice_id AS invoiceId,
           p.amount_minor AS amountMinor, p.payment_method AS paymentMethod,
           p.reference, p.payment_date AS paymentDate, p.status,
           p.created_by AS createdBy, p.reversed_by AS reversedBy,
           p.reversed_at AS reversedAt, p.created_at AS createdAt,
           u.name AS creatorName
    FROM patient_payments p
    JOIN users u ON u.id = p.created_by AND u.tenant_id = p.tenant_id
    WHERE p.invoice_id = ? AND p.tenant_id = ?
    ORDER BY p.id
  `).all(invoiceId, tenantId);
}

export async function listPatientInvoices(tenantId, patientId = null, appointmentId = null, connection = db) {
  const filters = ["i.tenant_id = ?"];
  const values = [tenantId];
  if (patientId) {
    filters.push("i.patient_id = ?");
    values.push(patientId);
  }
  if (appointmentId) {
    filters.push("i.appointment_id = ?");
    values.push(appointmentId);
  }
  return await connection.prepare(`${invoiceSelect}
    WHERE ${filters.join(" AND ")}
    ORDER BY i.id DESC
    LIMIT 200
  `).all(...values);
}

export async function issuePatientInvoice(invoiceId, tenantId, issueDate, connection = db) {
  const result = await connection.prepare(`
    UPDATE patient_invoices
    SET status = 'issued', issue_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'draft'
  `).run(issueDate, invoiceId, tenantId);
  return result.changes;
}

export async function cancelPatientInvoice(invoiceId, tenantId, connection = db) {
  const result = await connection.prepare(`
    UPDATE patient_invoices
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status != 'cancelled'
  `).run(invoiceId, tenantId);
  return result.changes;
}

export async function createLedgerEntry(values, connection = db) {
  const result = await connection.prepare(`
    INSERT INTO patient_ledger_entries (
      tenant_id, patient_id, type, reference_type, reference_id,
      debit_minor, credit_minor, posted_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `).run(
    values.tenantId,
    values.patientId,
    values.type,
    values.referenceType,
    values.referenceId,
    values.debitMinor || 0,
    values.creditMinor || 0,
    values.createdBy,
  );
  return Number(result.lastInsertRowid);
}

export async function createPatientPayment(values, connection = db) {
  const result = await connection.prepare(`
    INSERT INTO patient_payments (
      tenant_id, patient_id, invoice_id, amount_minor, payment_method,
      reference, payment_date, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', ?)
  `).run(
    values.tenantId,
    values.patientId,
    values.invoiceId || null,
    values.amountMinor,
    values.paymentMethod,
    values.reference,
    values.paymentDate,
    values.createdBy,
  );
  return Number(result.lastInsertRowid);
}

export async function patientPaymentById(paymentId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT id, patient_id AS patientId, invoice_id AS invoiceId,
           amount_minor AS amountMinor, payment_method AS paymentMethod,
           reference, payment_date AS paymentDate, status
    FROM patient_payments
    WHERE id = ? AND tenant_id = ?
  `).get(paymentId, tenantId);
}

export async function reversePatientPayment(paymentId, tenantId, userId, connection = db) {
  const result = await connection.prepare(`
    UPDATE patient_payments
    SET status = 'reversed', reversed_by = ?, reversed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status = 'posted'
  `).run(userId, paymentId, tenantId);
  return result.changes;
}

export async function postedInvoicePaymentMinor(invoiceId, tenantId, connection = db) {
  const row = await connection.prepare(`
    SELECT COALESCE(SUM(amount_minor), 0) AS total
    FROM patient_payments
    WHERE invoice_id = ? AND tenant_id = ? AND status = 'posted'
  `).get(invoiceId, tenantId);
  return Number(row?.total || 0);
}

export async function updatePatientInvoicePaymentStatus(invoiceId, tenantId, status, connection = db) {
  await connection.prepare(`
    UPDATE patient_invoices
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND status != 'cancelled'
  `).run(status, invoiceId, tenantId);
}

export async function updateAppointmentPaymentIndicator(appointmentId, tenantId, paymentStatus, paidMinor, connection = db) {
  if (!appointmentId) return;
  await connection.prepare(`
    UPDATE appointments
    SET payment_status = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(paymentStatus, Number(paidMinor || 0) / 100, appointmentId, tenantId);
}

export async function patientLedgerRows(patientId, tenantId, connection = db) {
  return await connection.prepare(`
    SELECT l.id, l.type, l.reference_type AS referenceType,
           l.reference_id AS referenceId, l.debit_minor AS debitMinor,
           l.credit_minor AS creditMinor, l.posted_at AS postedAt,
           l.created_by AS createdBy, u.name AS creatorName,
           i.invoice_number AS invoiceNumber, i.status AS invoiceStatus,
           p.payment_method AS paymentMethod, p.status AS paymentStatus
    FROM patient_ledger_entries l
    JOIN users u ON u.id = l.created_by AND u.tenant_id = l.tenant_id
    LEFT JOIN patient_invoices i
      ON l.reference_type = 'invoice' AND i.id = l.reference_id AND i.tenant_id = l.tenant_id
    LEFT JOIN patient_payments p
      ON l.reference_type = 'payment' AND p.id = l.reference_id AND p.tenant_id = l.tenant_id
    WHERE l.patient_id = ? AND l.tenant_id = ?
    ORDER BY l.posted_at, l.id
  `).all(patientId, tenantId);
}

export async function auditPatientFinance(connection, userId, action, entity, entityId, tenantId) {
  await connection.prepare(`
    INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, userId, action, entity, entityId, JSON.stringify({ tenantId }));
}

export async function patientFinanceTransaction(callback) {
  return db.transaction(callback);
}
