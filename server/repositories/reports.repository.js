import { audit, db } from "../db.js";

function appointmentWhere(tenantId, filters, user, alias = "a") {
  const clauses = [`${alias}.tenant_id = ?`, `${alias}.active = 1`, `${alias}.date BETWEEN ? AND ?`];
  const values = [tenantId, filters.from, filters.to];
  const therapistId = user.role === "therapist" ? user.id : filters.therapistId;
  if (therapistId) {
    clauses.push(`${alias}.therapist_id = ?`);
    values.push(therapistId);
  }
  if (filters.serviceId) {
    clauses.push(`${alias}.service_id = ?`);
    values.push(filters.serviceId);
  }
  if (filters.appointmentStatus) {
    clauses.push(`${alias}.status = ?`);
    values.push(filters.appointmentStatus);
  }
  if (filters.paymentStatus) {
    clauses.push(`${alias}.payment_status = ?`);
    values.push(filters.paymentStatus);
  }
  return { sql: clauses.join(" AND "), values };
}

function clinicalWhere(tenantId, filters, user) {
  const clauses = ["v.tenant_id = ?", "v.visit_date BETWEEN ? AND ?"];
  const values = [tenantId, filters.from, filters.to];
  const therapistId = user.role === "therapist" ? user.id : filters.therapistId;
  if (therapistId) {
    clauses.push("v.therapist_id = ?");
    values.push(therapistId);
  }
  if (filters.serviceId) {
    clauses.push("v.service_id = ?");
    values.push(filters.serviceId);
  }
  if (filters.appointmentStatus) {
    clauses.push("a.status = ?");
    values.push(filters.appointmentStatus);
  }
  if (filters.paymentStatus) {
    clauses.push("a.payment_status = ?");
    values.push(filters.paymentStatus);
  }
  return { sql: clauses.join(" AND "), values };
}

function financialWhere(tenantId, filters, { includeFrom = true } = {}) {
  const clauses = ["l.tenant_id = ?"];
  const values = [tenantId];
  if (includeFrom) {
    clauses.push("SUBSTR(CAST(l.posted_at AS TEXT), 1, 10) BETWEEN ? AND ?");
    values.push(filters.from, filters.to);
  } else {
    clauses.push("SUBSTR(CAST(l.posted_at AS TEXT), 1, 10) <= ?");
    values.push(filters.to);
  }
  if (filters.therapistId) {
    clauses.push("a.therapist_id = ?");
    values.push(filters.therapistId);
  }
  if (filters.serviceId) {
    clauses.push("a.service_id = ?");
    values.push(filters.serviceId);
  }
  if (filters.appointmentStatus) {
    clauses.push("a.status = ?");
    values.push(filters.appointmentStatus);
  }
  if (filters.paymentStatus) {
    clauses.push("a.payment_status = ?");
    values.push(filters.paymentStatus);
  }
  return { sql: clauses.join(" AND "), values };
}

const financialJoins = `
  LEFT JOIN patient_payments p
    ON l.reference_type = 'payment' AND p.id = l.reference_id AND p.tenant_id = l.tenant_id
  LEFT JOIN patient_invoices i
    ON i.tenant_id = l.tenant_id
   AND i.id = CASE WHEN l.reference_type = 'invoice' THEN l.reference_id ELSE p.invoice_id END
  LEFT JOIN appointments a ON a.id = i.appointment_id AND a.tenant_id = l.tenant_id
  LEFT JOIN services s ON s.id = a.service_id AND s.tenant_id = l.tenant_id
  LEFT JOIN users u ON u.id = a.therapist_id AND u.tenant_id = l.tenant_id
`;

function numbers(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value]));
}

export async function reportFilterOptions(tenantId, user) {
  const therapistSql = user.role === "therapist"
    ? "SELECT id, name FROM users WHERE tenant_id = ? AND id = ? AND active = 1"
    : "SELECT id, name FROM users WHERE tenant_id = ? AND role = 'therapist' AND active = 1 ORDER BY name";
  const [therapists, services] = await Promise.all([
    db.prepare(therapistSql).all(...(user.role === "therapist" ? [tenantId, user.id] : [tenantId])),
    db.prepare("SELECT id, name FROM services WHERE tenant_id = ? AND active = 1 ORDER BY name").all(tenantId),
  ]);
  return { therapists, services };
}

export async function appointmentReport(tenantId, filters, user) {
  const where = appointmentWhere(tenantId, filters, user);
  const queries = [
    db.prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'done' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM appointments a WHERE ${where.sql}`).get(...where.values),
    db.prepare(`SELECT u.id, u.name, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'done' THEN 1 ELSE 0 END), 0) AS completed
      FROM appointments a JOIN users u ON u.id = a.therapist_id AND u.tenant_id = a.tenant_id
      WHERE ${where.sql} GROUP BY u.id, u.name ORDER BY total DESC, u.name`).all(...where.values),
    db.prepare(`SELECT s.id, s.name, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'done' THEN 1 ELSE 0 END), 0) AS completed
      FROM appointments a JOIN services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
      WHERE ${where.sql} GROUP BY s.id, s.name ORDER BY total DESC, s.name`).all(...where.values),
    db.prepare(`SELECT a.date AS period, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'done' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM appointments a WHERE ${where.sql} GROUP BY a.date ORDER BY a.date`).all(...where.values),
    db.prepare(`SELECT SUBSTR(CAST(a.date AS TEXT), 1, 7) AS period, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN a.status = 'done' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled
      FROM appointments a WHERE ${where.sql} GROUP BY SUBSTR(CAST(a.date AS TEXT), 1, 7) ORDER BY period`).all(...where.values),
  ];
  const [summaryRow, byTherapist, byService, dailyTrend, monthlyTrend] = await Promise.all(queries);
  const summary = numbers(summaryRow);
  const total = Number(summary.total || 0);
  summary.completionRate = total ? Number(((Number(summary.completed) / total) * 100).toFixed(1)) : 0;
  summary.cancellationRate = total ? Number(((Number(summary.cancelled) / total) * 100).toFixed(1)) : 0;
  return {
    summary,
    byTherapist: byTherapist.map(numbers),
    byService: byService.map(numbers),
    dailyTrend: dailyTrend.map(numbers),
    monthlyTrend: monthlyTrend.map(numbers),
  };
}

export async function patientReport(tenantId, filters) {
  const activeWhere = appointmentWhere(tenantId, filters, { role: "admin" });
  const assignedFilter = filters.therapistId ? " AND c.therapist_id = ?" : "";
  const assignedValues = filters.therapistId ? [filters.therapistId] : [];
  const queries = [
    db.prepare(`SELECT COUNT(*) AS total FROM clients c
      WHERE c.tenant_id = ? AND c.active = 1 AND SUBSTR(CAST(c.created_at AS TEXT), 1, 10) BETWEEN ? AND ?${assignedFilter}`)
      .get(tenantId, filters.from, filters.to, ...assignedValues),
    db.prepare(`SELECT COUNT(DISTINCT a.client_id) AS total FROM appointments a
      WHERE ${activeWhere.sql} AND a.status != 'cancelled'`).get(...activeWhere.values),
    db.prepare(`SELECT COUNT(DISTINCT a.client_id) AS total FROM appointments a
      WHERE ${activeWhere.sql} AND a.status != 'cancelled'
        AND EXISTS (SELECT 1 FROM appointments old
          WHERE old.tenant_id = a.tenant_id AND old.client_id = a.client_id
            AND old.active = 1 AND old.status != 'cancelled' AND old.date < ?)`)
      .get(...activeWhere.values, filters.from),
    db.prepare(`SELECT COUNT(DISTINCT t.client_id) AS total FROM crm_tasks t
      WHERE t.tenant_id = ? AND t.type = 'follow_up' AND t.status = 'open'
        AND SUBSTR(CAST(COALESCE(t.due_date, CAST(t.created_at AS TEXT)) AS TEXT), 1, 10) <= ?${filters.therapistId ? " AND t.assigned_to = ?" : ""}`)
      .get(tenantId, filters.to, ...assignedValues),
    db.prepare(`SELECT COUNT(DISTINCT pc.client_id) AS total FROM patient_consents pc
      WHERE pc.tenant_id = ? AND pc.status = 'pending'
        AND (pc.expires_at IS NULL OR SUBSTR(CAST(pc.expires_at AS TEXT), 1, 10) >= ?)
        AND SUBSTR(CAST(pc.created_at AS TEXT), 1, 10) BETWEEN ? AND ?`)
      .get(tenantId, filters.today, filters.from, filters.to),
    db.prepare(`SELECT u.id, u.name, COUNT(DISTINCT a.client_id) AS total
      FROM appointments a JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id
      JOIN users u ON u.id = c.therapist_id AND u.tenant_id = c.tenant_id
      WHERE ${activeWhere.sql} AND a.status != 'cancelled'
      GROUP BY u.id, u.name ORDER BY total DESC, u.name`).all(...activeWhere.values),
  ];
  const [newPatients, activePatients, returningPatients, followUpRequired, pendingConsent, byAssignedTherapist] = await Promise.all(queries);
  return {
    summary: {
      newPatients: Number(newPatients?.total || 0),
      activePatients: Number(activePatients?.total || 0),
      returningPatients: Number(returningPatients?.total || 0),
      followUpRequired: Number(followUpRequired?.total || 0),
      pendingConsent: Number(pendingConsent?.total || 0),
    },
    byAssignedTherapist: byAssignedTherapist.map(numbers),
    activePatientRule: "At least one active, non-cancelled appointment within the selected date range.",
  };
}

export async function clinicalReport(tenantId, filters, user) {
  const where = clinicalWhere(tenantId, filters, user);
  const [summaryRow, byTherapist, byService] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS started,
      COALESCE(SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN v.status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
      COALESCE(SUM(CASE WHEN TRIM(v.follow_up_instructions) != '' THEN 1 ELSE 0 END), 0) AS followUpRequired
      FROM clinical_visits v JOIN appointments a ON a.id = v.appointment_id AND a.tenant_id = v.tenant_id
      WHERE ${where.sql}`).get(...where.values),
    db.prepare(`SELECT u.id, u.name, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed
      FROM clinical_visits v JOIN appointments a ON a.id = v.appointment_id AND a.tenant_id = v.tenant_id
      JOIN users u ON u.id = v.therapist_id AND u.tenant_id = v.tenant_id
      WHERE ${where.sql} GROUP BY u.id, u.name ORDER BY total DESC, u.name`).all(...where.values),
    db.prepare(`SELECT s.id, s.name, COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed
      FROM clinical_visits v JOIN appointments a ON a.id = v.appointment_id AND a.tenant_id = v.tenant_id
      LEFT JOIN services s ON s.id = v.service_id AND s.tenant_id = v.tenant_id
      WHERE ${where.sql} GROUP BY s.id, s.name ORDER BY total DESC, s.name`).all(...where.values),
  ]);
  return { summary: numbers(summaryRow), byTherapist: byTherapist.map(numbers), byService: byService.map(numbers) };
}

export async function financialReport(tenantId, filters) {
  const range = financialWhere(tenantId, filters);
  const throughEnd = financialWhere(tenantId, filters, { includeFrom: false });
  const [summaryRow, balanceRow, byService, byTherapist, dailyTrend, monthlyTrend] = await Promise.all([
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN l.type = 'invoice' THEN 1 ELSE 0 END), 0) AS issuedInvoices,
      COALESCE(SUM(CASE WHEN l.type = 'invoice' THEN l.debit_minor WHEN l.type = 'invoice_reversal' THEN -l.credit_minor ELSE 0 END), 0) AS grossInvoicedMinor,
      COALESCE(SUM(CASE WHEN l.type = 'payment' THEN l.credit_minor WHEN l.type = 'payment_reversal' THEN -l.debit_minor ELSE 0 END), 0) AS paymentsReceivedMinor,
      COALESCE(SUM(CASE WHEN l.type = 'invoice_reversal' THEN 1 ELSE 0 END), 0) AS cancelledInvoices,
      COALESCE(SUM(CASE WHEN l.type = 'payment_reversal' THEN 1 ELSE 0 END), 0) AS reversedPayments
      FROM patient_ledger_entries l ${financialJoins} WHERE ${range.sql}`).get(...range.values),
    db.prepare(`SELECT COALESCE(SUM(l.debit_minor - l.credit_minor), 0) AS outstandingMinor
      FROM patient_ledger_entries l ${financialJoins} WHERE ${throughEnd.sql}`).get(...throughEnd.values),
    db.prepare(`SELECT s.id, s.name,
      COALESCE(SUM(CASE WHEN l.type = 'payment' THEN l.credit_minor WHEN l.type = 'payment_reversal' THEN -l.debit_minor ELSE 0 END), 0) AS revenueMinor
      FROM patient_ledger_entries l ${financialJoins}
      WHERE ${range.sql} AND l.type IN ('payment','payment_reversal') AND s.id IS NOT NULL
      GROUP BY s.id, s.name ORDER BY "revenueMinor" DESC, s.name`).all(...range.values),
    db.prepare(`SELECT u.id, u.name,
      COALESCE(SUM(CASE WHEN l.type = 'payment' THEN l.credit_minor WHEN l.type = 'payment_reversal' THEN -l.debit_minor ELSE 0 END), 0) AS revenueMinor
      FROM patient_ledger_entries l ${financialJoins}
      WHERE ${range.sql} AND l.type IN ('payment','payment_reversal') AND u.id IS NOT NULL
      GROUP BY u.id, u.name ORDER BY "revenueMinor" DESC, u.name`).all(...range.values),
    db.prepare(`SELECT SUBSTR(CAST(l.posted_at AS TEXT), 1, 10) AS period,
      COALESCE(SUM(CASE WHEN l.type = 'invoice' THEN l.debit_minor WHEN l.type = 'invoice_reversal' THEN -l.credit_minor ELSE 0 END), 0) AS invoicedMinor,
      COALESCE(SUM(CASE WHEN l.type = 'payment' THEN l.credit_minor WHEN l.type = 'payment_reversal' THEN -l.debit_minor ELSE 0 END), 0) AS paymentsMinor
      FROM patient_ledger_entries l ${financialJoins} WHERE ${range.sql}
      GROUP BY SUBSTR(CAST(l.posted_at AS TEXT), 1, 10) ORDER BY period`).all(...range.values),
    db.prepare(`SELECT SUBSTR(CAST(l.posted_at AS TEXT), 1, 7) AS period,
      COALESCE(SUM(CASE WHEN l.type = 'invoice' THEN l.debit_minor WHEN l.type = 'invoice_reversal' THEN -l.credit_minor ELSE 0 END), 0) AS invoicedMinor,
      COALESCE(SUM(CASE WHEN l.type = 'payment' THEN l.credit_minor WHEN l.type = 'payment_reversal' THEN -l.debit_minor ELSE 0 END), 0) AS paymentsMinor
      FROM patient_ledger_entries l ${financialJoins} WHERE ${range.sql}
      GROUP BY SUBSTR(CAST(l.posted_at AS TEXT), 1, 7) ORDER BY period`).all(...range.values),
  ]);
  return {
    summary: { ...numbers(summaryRow), outstandingMinor: Number(balanceRow?.outstandingMinor || 0) },
    byService: byService.map(numbers),
    byTherapist: byTherapist.map(numbers),
    dailyTrend: dailyTrend.map(numbers),
    monthlyTrend: monthlyTrend.map(numbers),
    attributionRule: "Revenue attribution includes net ledger payments linked to an invoice and appointment.",
  };
}

export async function consentReport(tenantId, filters) {
  const appointment = appointmentWhere(tenantId, filters, { role: "admin" });
  const [summaryRow, missingRow] = await Promise.all([
    db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN pc.status = 'pending' AND (pc.expires_at IS NULL OR SUBSTR(CAST(pc.expires_at AS TEXT), 1, 10) >= ?) THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN pc.status = 'signed' THEN 1 ELSE 0 END), 0) AS signed,
      COALESCE(SUM(CASE WHEN pc.status = 'declined' THEN 1 ELSE 0 END), 0) AS declined,
      COALESCE(SUM(CASE WHEN pc.status = 'expired' OR (pc.status = 'pending' AND pc.expires_at IS NOT NULL AND SUBSTR(CAST(pc.expires_at AS TEXT), 1, 10) < ?) THEN 1 ELSE 0 END), 0) AS expired
      FROM patient_consents pc WHERE pc.tenant_id = ? AND SUBSTR(CAST(pc.created_at AS TEXT), 1, 10) BETWEEN ? AND ?`)
      .get(filters.today, filters.today, tenantId, filters.from, filters.to),
    db.prepare(`SELECT COUNT(DISTINCT a.id) AS total FROM appointments a
      WHERE ${appointment.sql} AND a.status = 'pending' AND a.date >= ?
        AND EXISTS (SELECT 1 FROM consent_templates ct
          WHERE ct.tenant_id = a.tenant_id AND ct.active = 1
            AND (ct.service_id IS NULL OR ct.service_id = a.service_id)
            AND NOT EXISTS (SELECT 1 FROM patient_consents pc
              WHERE pc.tenant_id = a.tenant_id AND pc.template_id = ct.id
                AND pc.client_id = a.client_id AND (pc.appointment_id = a.id OR pc.appointment_id IS NULL)
                AND pc.status = 'signed' AND (pc.expires_at IS NULL OR SUBSTR(CAST(pc.expires_at AS TEXT), 1, 10) >= a.date)))`)
      .get(...appointment.values, filters.today),
  ]);
  return { summary: { ...numbers(summaryRow), upcomingMissingRequired: Number(missingRow?.total || 0) } };
}

export async function auditReportExport(user, filters, format) {
  await audit(user.id, "report_export", "reports", null, {
    tenantId: user.tenantId,
    format,
    from: filters.from,
    to: filters.to,
    therapistId: filters.therapistId || null,
    serviceId: filters.serviceId || null,
  });
}
