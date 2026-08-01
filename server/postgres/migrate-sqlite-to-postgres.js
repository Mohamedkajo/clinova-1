import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { config } from "../config.js";
import { currentSchemaVersion } from "../schema-version.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Example: postgres://user:pass@host:5432/clinova");
  process.exit(1);
}

const sqlite = new DatabaseSync(config.databasePath, { readOnly: true });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
  ssl: config.databaseSsl ? { rejectUnauthorized: config.databaseSslRejectUnauthorized } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
    await client.query(schema);

    await clearTables(client);
    await copyTenants(client);
    await copySubscriptions(client);
    await copyUsers(client);
    await copyCategories(client);
    await copyServices(client);
    await copyClients(client);
    await copyCrmTasks(client);
    await copyAppointments(client);
    await copyCrmEvents(client);
    await copyClinicalVisits(client);
    await copyConsentTemplates(client);
    await copyConsentSignatures(client);
    await copyPatientConsents(client);
    await copyNotifications(client);
    await copyAppointmentReminders(client);
    await copyPatientInvoices(client);
    await copyPatientInvoiceItems(client);
    await copyPatientPayments(client);
    await copyPatientLedgerEntries(client);
    await copySettings(client);
    await copyTenantDomains(client);
    await copyBillingInvoices(client);
    await copyClientFiles(client);
    await copyFeedbackRequests(client);
    await copyGiftCards(client);
    await copyMessageLogs(client);
    await copyUserInvitations(client);
    await copyAudit(client);
    await resetSequences(client);
    await client.query(`
      INSERT INTO schema_migrations (version, description)
      VALUES ($1, $2)
      ON CONFLICT (version) DO NOTHING
    `, [currentSchemaVersion, "Sprint 2.6 production readiness"]);

    await client.query("COMMIT");
    console.log("SQLite data migrated to PostgreSQL successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

async function clearTables(client) {
  await client.query("TRUNCATE worker_heartbeats, audit_log, sessions, user_invitations, message_logs, gift_cards, feedback_requests, patient_ledger_entries, patient_payments, patient_invoice_items, patient_invoices, appointment_reminders, notifications, patient_consents, consent_signatures, consent_templates, client_files, clinical_visits, clinic_settings, billing_invoices, tenant_domains, appointments, crm_events, crm_tasks, clients, services, categories, users, subscriptions, tenants RESTART IDENTITY CASCADE");
}

async function copyTenants(client) {
  const rows = sqlite.prepare("SELECT * FROM tenants ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO tenants (
        id, name, slug, status, plan, billing_email, trial_ends_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.id, row.name, row.slug, row.status, row.plan || "starter",
        row.billing_email || "", row.trial_ends_at || null, row.created_at, row.updated_at,
      ],
    );
  }
}

async function copySubscriptions(client) {
  const rows = sqlite.prepare("SELECT * FROM subscriptions ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO subscriptions (
        id, tenant_id, provider, provider_customer_id, provider_subscription_id,
        status, plan, billing_day, auto_billing_enabled, current_period_end, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        row.id, row.tenant_id, row.provider || "manual", row.provider_customer_id || "",
        row.provider_subscription_id || "", row.status || "trial", row.plan || "starter",
        row.billing_day || 1, Number(row.auto_billing_enabled || 0), row.current_period_end || null,
        row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyUsers(client) {
  const rows = sqlite.prepare("SELECT * FROM users ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO users (id, tenant_id, username, email, password_hash, name, title, role, workdays, service_ids, is_platform_owner, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [row.id, row.tenant_id || 1, row.username, row.email || "", row.password_hash, row.name, row.title || "", row.role, row.workdays || "[]", row.service_ids || "[]", Number(row.is_platform_owner || 0), Number(row.active ?? 1), row.created_at, row.updated_at]
    );
  }
}

async function copyCategories(client) {
  const rows = sqlite.prepare("SELECT * FROM categories ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      "INSERT INTO categories (id, tenant_id, name, active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)",
      [row.id, row.tenant_id || 1, row.name, Number(row.active ?? 1), row.created_at, row.updated_at]
    );
  }
}

async function copyServices(client) {
  const rows = sqlite.prepare("SELECT * FROM services ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO services (id, tenant_id, name, category_id, duration, price, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [row.id, row.tenant_id || 1, row.name, row.category_id, row.duration, row.price, Number(row.active ?? 1), row.created_at, row.updated_at]
    );
  }
}

async function copyClients(client) {
  const rows = sqlite.prepare("SELECT * FROM clients ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO clients (id, tenant_id, fname, lname, phone, email, therapist_id, stage, source, tags, notes, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [row.id, row.tenant_id || 1, row.fname, row.lname, row.phone, row.email || "", row.therapist_id || null, row.stage || "lead", row.source || "", row.tags || "[]", row.notes || "", Number(row.active ?? 1), row.created_at, row.updated_at]
    );
  }
}

async function copyCrmTasks(client) {
  const rows = sqlite.prepare("SELECT * FROM crm_tasks ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO crm_tasks (
        id, tenant_id, client_id, assigned_to, type, title, due_date, status,
        priority, notes, completed_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.id, row.tenant_id, row.client_id, row.assigned_to || null, row.type || "follow_up",
        row.title, row.due_date || null, row.status || "open", row.priority || "normal",
        row.notes || "", row.completed_at || null, row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyAppointments(client) {
  const rows = sqlite.prepare("SELECT * FROM appointments ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO appointments (id, tenant_id, client_id, service_id, therapist_id, date, time, status, payment_status, paid_amount, notes, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id,
        row.tenant_id || 1,
        row.client_id,
        row.service_id,
        row.therapist_id,
        row.date,
        row.time,
        row.status,
        row.payment_status || "unpaid",
        row.paid_amount || 0,
        row.notes || "",
        Number(row.active ?? 1),
        row.created_at,
        row.updated_at,
      ]
    );
  }
}

async function copyCrmEvents(client) {
  const rows = sqlite.prepare("SELECT * FROM crm_events ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO crm_events (
        id, tenant_id, client_id, user_id, appointment_id, type, description, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.id, row.tenant_id, row.client_id || null, row.user_id || null,
        row.appointment_id || null, row.type, row.description, row.created_at,
      ],
    );
  }
}

async function copySettings(client) {
  const rows = sqlite.prepare("SELECT * FROM clinic_settings ORDER BY key").all();
  for (const row of rows) {
    await client.query(
      "INSERT INTO clinic_settings (tenant_id, key, value, updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
      [row.tenant_id || 1, row.key, row.value, row.updated_at]
    );
  }
}

async function copyClinicalVisits(client) {
  const rows = sqlite.prepare("SELECT * FROM clinical_visits ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO clinical_visits (
        id, tenant_id, appointment_id, client_id, therapist_id, service_id, visit_date, visit_time,
        treatment_summary, clinical_observations, recommendations, follow_up_instructions,
        internal_notes, status, completed_at, created_by, updated_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        row.id, row.tenant_id || 1, row.appointment_id, row.client_id, row.therapist_id,
        row.service_id || null, row.visit_date, row.visit_time, row.treatment_summary,
        row.clinical_observations || "", row.recommendations || "", row.follow_up_instructions || "",
        row.internal_notes || "", row.status || "draft", row.completed_at || null,
        row.created_by, row.updated_by, row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyConsentTemplates(client) {
  const rows = sqlite.prepare("SELECT * FROM consent_templates ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO consent_templates (
        id, tenant_id, category_id, service_id, title, description, consent_text, language,
        expiration_days, version, created_by, updated_by, url, original_name, mime_type,
        size, path, active, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        row.id, row.tenant_id || 1, row.category_id || null, row.service_id || null, row.title,
        row.description || "", row.consent_text || "", row.language || "he",
        row.expiration_days || null, row.version || 1, row.created_by || null, row.updated_by || null,
        row.url || "", row.original_name || "", row.mime_type || "application/pdf",
        row.size || 0, row.path || "", Number(row.active ?? 1), row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyConsentSignatures(client) {
  const rows = sqlite.prepare("SELECT * FROM consent_signatures ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO consent_signatures (
        id, tenant_id, template_id, client_id, appointment_id, signer_name, signature_data, signed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.tenant_id || 1, row.template_id, row.client_id || null, row.appointment_id || null, row.signer_name, row.signature_data, row.signed_at],
    );
  }
}

async function copyPatientConsents(client) {
  const rows = sqlite.prepare("SELECT * FROM patient_consents ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO patient_consents (
        id, tenant_id, template_id, client_id, appointment_id, service_id, status, signature_id,
        assigned_by, witness_user_id, signed_at, expires_at, declined_at, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.id, row.tenant_id || 1, row.template_id, row.client_id, row.appointment_id || null,
        row.service_id || null, row.status, row.signature_id || null, row.assigned_by,
        row.witness_user_id || null, row.signed_at || null, row.expires_at || null,
        row.declined_at || null, row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyNotifications(client) {
  const rows = sqlite.prepare("SELECT * FROM notifications ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO notifications (
        id, tenant_id, user_id, type, title, message, related_entity_type,
        related_entity_id, status, created_at, read_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id, row.tenant_id, row.user_id, row.type, row.title, row.message,
        row.related_entity_type || null, row.related_entity_id || null,
        row.status || "unread", row.created_at, row.read_at || null,
      ],
    );
  }
}

async function copyAppointmentReminders(client) {
  const rows = sqlite.prepare("SELECT * FROM appointment_reminders ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO appointment_reminders (
        id, tenant_id, appointment_id, reminder_type, channel, recipient,
        scheduled_for, status, created_by, dispatched_at, cancelled_at,
        last_error, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id, row.tenant_id, row.appointment_id, row.reminder_type, row.channel,
        row.recipient, row.scheduled_for, row.status || "pending", row.created_by || null,
        row.dispatched_at || null, row.cancelled_at || null, row.last_error || "",
        row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyPatientInvoices(client) {
  const rows = sqlite.prepare("SELECT * FROM patient_invoices ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO patient_invoices (
        id, tenant_id, patient_id, appointment_id, invoice_number, issue_date, status,
        subtotal_minor, discount_minor, tax_minor, total_minor, currency, created_by,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.id, row.tenant_id, row.patient_id, row.appointment_id || null,
        row.invoice_number, row.issue_date || null, row.status, row.subtotal_minor,
        row.discount_minor, row.tax_minor, row.total_minor, row.currency,
        row.created_by, row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyPatientInvoiceItems(client) {
  const rows = sqlite.prepare("SELECT * FROM patient_invoice_items ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO patient_invoice_items (
        id, tenant_id, invoice_id, service_id, description, quantity,
        unit_price_minor, discount_minor, tax_minor, line_total_minor, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id, row.tenant_id, row.invoice_id, row.service_id || null, row.description,
        row.quantity, row.unit_price_minor, row.discount_minor, row.tax_minor,
        row.line_total_minor, row.created_at,
      ],
    );
  }
}

async function copyPatientPayments(client) {
  const rows = sqlite.prepare("SELECT * FROM patient_payments ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO patient_payments (
        id, tenant_id, patient_id, invoice_id, amount_minor, payment_method,
        reference, payment_date, status, created_by, reversed_by, reversed_at,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id, row.tenant_id, row.patient_id, row.invoice_id || null,
        row.amount_minor, row.payment_method, row.reference || "", row.payment_date,
        row.status, row.created_by, row.reversed_by || null, row.reversed_at || null,
        row.created_at, row.updated_at,
      ],
    );
  }
}

async function copyPatientLedgerEntries(client) {
  const rows = sqlite.prepare("SELECT * FROM patient_ledger_entries ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO patient_ledger_entries (
        id, tenant_id, patient_id, type, reference_type, reference_id,
        debit_minor, credit_minor, posted_at, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        row.id, row.tenant_id, row.patient_id, row.type, row.reference_type,
        row.reference_id, row.debit_minor, row.credit_minor, row.posted_at, row.created_by,
      ],
    );
  }
}

async function copyBillingInvoices(client) {
  const rows = sqlite.prepare("SELECT * FROM billing_invoices ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO billing_invoices (id, tenant_id, subscription_id, number, status, currency, amount, period_start, period_end, due_at, paid_at, notes, billing_cycle, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        row.id,
        row.tenant_id || 1,
        row.subscription_id || null,
        row.number,
        row.status || "draft",
        row.currency || "USD",
        row.amount || 0,
        row.period_start || null,
        row.period_end || null,
        row.due_at || null,
        row.paid_at || null,
        row.notes || "",
        row.billing_cycle || "",
        row.created_at,
        row.updated_at,
      ]
    );
  }
}

async function copyTenantDomains(client) {
  const rows = sqlite.prepare("SELECT * FROM tenant_domains ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO tenant_domains (id, tenant_id, domain, status, is_primary, verified_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.tenant_id || 1, row.domain, row.status || "pending", Number(row.is_primary || 0), row.verified_at || null, row.created_at, row.updated_at]
    );
  }
}

async function copyClientFiles(client) {
  const rows = sqlite.prepare("SELECT * FROM client_files ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO client_files (
        id, tenant_id, client_id, appointment_id, clinical_visit_id, name, url, original_name,
        stored_name, mime_type, size, path, notes, category, uploaded_by, active, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        row.id,
        row.tenant_id || 1,
        row.client_id,
        row.appointment_id || null,
        row.clinical_visit_id || null,
        row.name,
        row.url,
        row.original_name || "",
        row.stored_name || "",
        row.mime_type || "",
        row.size || 0,
        row.path || "",
        row.notes || "",
        row.category || "clinical",
        row.uploaded_by || null,
        Number(row.active ?? 1),
        row.created_at,
        row.updated_at,
      ]
    );
  }
}

async function copyFeedbackRequests(client) {
  const rows = sqlite.prepare("SELECT * FROM feedback_requests ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO feedback_requests (
        id, tenant_id, appointment_id, token, rating, comment, status, sent_at, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.id, row.tenant_id, row.appointment_id, row.token, row.rating || null,
        row.comment || "", row.status || "sent", row.sent_at, row.submitted_at || null,
      ],
    );
  }
}

async function copyGiftCards(client) {
  const rows = sqlite.prepare("SELECT * FROM gift_cards ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO gift_cards (
        id, tenant_id, code, from_client_id, to_client_id, service_id, sessions,
        message, status, created_at, redeemed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id, row.tenant_id, row.code, row.from_client_id || null, row.to_client_id || null,
        row.service_id || null, row.sessions || 1, row.message || "", row.status || "active",
        row.created_at, row.redeemed_at || null,
      ],
    );
  }
}

async function copyMessageLogs(client) {
  const rows = sqlite.prepare("SELECT * FROM message_logs ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO message_logs (
        id, tenant_id, user_id, channel, entity, entity_id, recipient, message,
        status, provider_message_id, fallback_url, error, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.id, row.tenant_id, row.user_id || null, row.channel || "whatsapp", row.entity,
        row.entity_id || null, row.recipient, row.message, row.status,
        row.provider_message_id || "", row.fallback_url || "", row.error || "", row.created_at,
      ],
    );
  }
}

async function copyUserInvitations(client) {
  const rows = sqlite.prepare("SELECT * FROM user_invitations ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO user_invitations (
        id, tenant_id, email, name, role, token, invited_by, expires_at, accepted_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        row.id, row.tenant_id, row.email, row.name, row.role, row.token,
        row.invited_by || null, row.expires_at, row.accepted_at || null, row.created_at,
      ],
    );
  }
}

async function copyAudit(client) {
  const rows = sqlite.prepare("SELECT * FROM audit_log ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO audit_log (id, tenant_id, user_id, action, entity, entity_id, details, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.tenant_id || 1, row.user_id || null, row.action, row.entity, row.entity_id || null, row.details || "{}", row.created_at]
    );
  }
}

async function resetSequences(client) {
  for (const table of ["tenants", "subscriptions", "users", "categories", "services", "clients", "crm_tasks", "crm_events", "appointments", "clinical_visits", "consent_templates", "consent_signatures", "patient_consents", "notifications", "appointment_reminders", "patient_invoices", "patient_invoice_items", "patient_payments", "patient_ledger_entries", "tenant_domains", "billing_invoices", "client_files", "feedback_requests", "gift_cards", "message_logs", "user_invitations", "audit_log"]) {
    await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
  }
}

main();
