import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { config } from "../config.js";

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
    await copyUsers(client);
    await copyCategories(client);
    await copyServices(client);
    await copyClients(client);
    await copyAppointments(client);
    await copyClinicalVisits(client);
    await copyConsentTemplates(client);
    await copyConsentSignatures(client);
    await copyPatientConsents(client);
    await copySettings(client);
    await copyTenantDomains(client);
    await copyBillingInvoices(client);
    await copyClientFiles(client);
    await copyAudit(client);
    await resetSequences(client);

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
  await client.query("TRUNCATE audit_log, sessions, user_invitations, message_logs, patient_consents, consent_signatures, consent_templates, client_files, clinical_visits, clinic_settings, billing_invoices, tenant_domains, appointments, crm_events, crm_tasks, clients, services, categories, users RESTART IDENTITY CASCADE");
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
      "INSERT INTO categories (id, name, active, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
      [row.id, row.name, Number(row.active ?? 1), row.created_at, row.updated_at]
    );
  }
}

async function copyServices(client) {
  const rows = sqlite.prepare("SELECT * FROM services ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO services (id, name, category_id, duration, price, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, row.name, row.category_id, row.duration, row.price, Number(row.active ?? 1), row.created_at, row.updated_at]
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

async function copyAppointments(client) {
  const rows = sqlite.prepare("SELECT * FROM appointments ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO appointments (id, client_id, service_id, therapist_id, date, time, status, payment_status, paid_amount, notes, active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.id,
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

async function copyAudit(client) {
  const rows = sqlite.prepare("SELECT * FROM audit_log ORDER BY id").all();
  for (const row of rows) {
    await client.query(
      `INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.user_id || null, row.action, row.entity, row.entity_id || null, row.details || "{}", row.created_at]
    );
  }
}

async function resetSequences(client) {
  for (const table of ["users", "categories", "services", "clients", "crm_tasks", "crm_events", "appointments", "clinical_visits", "consent_templates", "consent_signatures", "patient_consents", "tenant_domains", "billing_invoices", "client_files", "message_logs", "user_invitations", "audit_log"]) {
    await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
  }
}

main();
