import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { hashPassword } from "./security.js";
export { rowToUser } from "./shared/auth/user-mapper.js";
import { rowToUser } from "./shared/auth/user-mapper.js";

const isPostgres = Boolean(config.databaseUrl);
const pgModule = isPostgres ? await import("pg") : null;
const Pool = pgModule?.default?.Pool;

function postgresPoolOptions() {
  const options = {
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
  };

  if (config.databaseSsl) {
    options.ssl = {
      rejectUnauthorized: config.databaseSslRejectUnauthorized,
    };
  }

  return options;
}

function sqliteValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function pgSql(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bAS\s+([a-z][A-Za-z0-9_]*[A-Z][A-Za-z0-9_]*)/g, 'AS "$1"');
}

function pgValues(values) {
  return values.map((value) => {
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  });
}

function postgresPrepared(queryable, sql) {
  return {
    all: async (...values) => (await queryable.query(pgSql(sql), pgValues(values))).rows,
    get: async (...values) => (await queryable.query(pgSql(sql), pgValues(values))).rows[0],
    run: async (...values) => {
      let text = pgSql(sql);
      const wantsId = /^\s*INSERT\s+INTO\s+(tenants|tenant_domains|subscriptions|billing_invoices|patient_invoices|patient_invoice_items|patient_payments|patient_ledger_entries|users|categories|services|clients|crm_tasks|crm_events|appointments|clinical_visits|client_files|consent_templates|consent_signatures|patient_consents|notifications|appointment_reminders|feedback_requests|gift_cards|user_invitations|message_logs|audit_log)\b/i.test(text) && !/\bRETURNING\b/i.test(text);
      if (wantsId) text += " RETURNING id";
      const result = await queryable.query(text, pgValues(values));
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id,
      };
    },
  };
}

class SqliteAdapter {
  constructor() {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    this.client = new DatabaseSync(config.databasePath);
    this.client.exec("PRAGMA foreign_keys = ON");
    this.client.exec("PRAGMA journal_mode = WAL");
  }

  prepare(sql) {
    const stmt = this.client.prepare(sql);
    return {
      all: (...values) => stmt.all(...values.map(sqliteValue)),
      get: (...values) => stmt.get(...values.map(sqliteValue)),
      run: (...values) => stmt.run(...values.map(sqliteValue)),
    };
  }

  exec(sql) {
    return this.client.exec(sql);
  }

  async transaction(callback) {
    this.client.exec("BEGIN IMMEDIATE");
    try {
      const result = await callback(this);
      this.client.exec("COMMIT");
      return result;
    } catch (error) {
      this.client.exec("ROLLBACK");
      throw error;
    }
  }
}

class PostgresAdapter {
  constructor() {
    this.pool = new Pool(postgresPoolOptions());
  }

  prepare(sql) {
    return postgresPrepared(this.pool, sql);
  }

  async exec(sql) {
    return this.pool.query(sql);
  }

  async close() {
    return this.pool.end();
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const scoped = {
        prepare: (sql) => postgresPrepared(client, sql),
        exec: (sql) => client.query(sql),
      };
      const result = await callback(scoped);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function applyPendingSqliteRestore() {
  if (isPostgres) return;
  const pending = resolve(config.backup.dir, "pending-restore.sqlite");
  if (!existsSync(pending)) return;

  mkdirSync(dirname(config.databasePath), { recursive: true });
  mkdirSync(config.backup.dir, { recursive: true });
  if (existsSync(config.databasePath)) {
    copyFileSync(config.databasePath, resolve(config.backup.dir, `before-pending-restore-${timestamp()}.sqlite`));
  }
  rmSync(`${config.databasePath}-wal`, { force: true });
  rmSync(`${config.databasePath}-shm`, { force: true });
  copyFileSync(pending, config.databasePath);
  rmSync(pending, { force: true });
  rmSync(resolve(config.backup.dir, "pending-restore.json"), { force: true });
}

applyPendingSqliteRestore();

export const db = isPostgres ? new PostgresAdapter() : new SqliteAdapter();
export const databaseEngine = isPostgres ? "postgresql" : "sqlite";

export async function initDatabase() {
  if (isPostgres) await initPostgres();
  else await initSqlite();
  await seedDefaultTenant();
  await seedSettings(1);

  const userCount = (await db.prepare("SELECT COUNT(*) AS count FROM users").get()).count;
  if (Number(userCount) === 0 && process.env.NODE_ENV !== "production") await seedDatabase();
  await seedDevelopmentPlatformOwner();
  await assertProductionPlatformOwner();
}

export async function checkDatabaseConnection() {
  const row = await db.prepare("SELECT 1 AS ok").get();
  return row?.ok === 1 || row?.ok === "1";
}

export async function assertProductionPlatformOwner() {
  if (process.env.NODE_ENV !== "production") return;
  const owner = await db.prepare(`
    SELECT id
    FROM users
    WHERE active = 1 AND COALESCE(is_platform_owner, 0) = 1
    LIMIT 1
  `).get();
  if (!owner) {
    throw new Error("Production startup blocked: no active Platform Owner exists.");
  }
}

async function initSqlite() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','past_due','suspended','cancelled')),
      plan TEXT NOT NULL DEFAULT 'starter',
      billing_email TEXT DEFAULT '',
      trial_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'manual',
      provider_customer_id TEXT DEFAULT '',
      provider_subscription_id TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'trial',
      plan TEXT NOT NULL DEFAULT 'starter',
      billing_day INTEGER NOT NULL DEFAULT 1,
      auto_billing_enabled INTEGER NOT NULL DEFAULT 0,
      current_period_end TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tenant_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      domain TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','failed','disabled')),
      is_primary INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS billing_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','paid','void','uncollectible')),
      currency TEXT NOT NULL DEFAULT 'USD',
      amount REAL NOT NULL CHECK(amount >= 0),
      period_start TEXT,
      period_end TEXT,
      due_at TEXT,
      paid_at TEXT,
      notes TEXT DEFAULT '',
      billing_cycle TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      email TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('admin','reception','therapist')),
      workdays TEXT NOT NULL DEFAULT '[]',
      service_ids TEXT NOT NULL DEFAULT '[]',
      is_platform_owner INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      duration INTEGER NOT NULL CHECK(duration > 0),
      price REAL NOT NULL CHECK(price >= 0),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      fname TEXT NOT NULL,
      lname TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      therapist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      stage TEXT NOT NULL DEFAULT 'lead',
      source TEXT DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      last_contacted_at TEXT,
      notes TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'follow_up',
      title TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
      notes TEXT DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS crm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','done','cancelled')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      paid_amount REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clinical_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      therapist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      visit_date TEXT NOT NULL,
      visit_time TEXT NOT NULL,
      treatment_summary TEXT NOT NULL,
      clinical_observations TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '',
      follow_up_instructions TEXT NOT NULL DEFAULT '',
      internal_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed')),
      completed_at TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, appointment_id)
    );
    CREATE TABLE IF NOT EXISTS clinic_settings (
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, key)
    );
    CREATE TABLE IF NOT EXISTS client_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      mime_type TEXT DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      stored_name TEXT DEFAULT '',
      category TEXT NOT NULL DEFAULT 'clinical',
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      clinical_visit_id INTEGER REFERENCES clinical_visits(id) ON DELETE SET NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS consent_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      consent_text TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT 'he',
      expiration_days INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      url TEXT NOT NULL,
      original_name TEXT DEFAULT '',
      mime_type TEXT DEFAULT 'application/pdf',
      size INTEGER NOT NULL DEFAULT 0,
      path TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS consent_signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      template_id INTEGER NOT NULL REFERENCES consent_templates(id) ON DELETE RESTRICT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      signer_name TEXT NOT NULL,
      signature_data TEXT NOT NULL,
      signed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patient_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      template_id INTEGER NOT NULL REFERENCES consent_templates(id) ON DELETE RESTRICT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','signed','declined','expired')),
      signature_id INTEGER REFERENCES consent_signatures(id) ON DELETE SET NULL,
      assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      witness_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      signed_at TEXT,
      expires_at TEXT,
      declined_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT
    );
    CREATE TABLE IF NOT EXISTS appointment_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      reminder_type TEXT NOT NULL CHECK(reminder_type IN ('24h','same_day')),
      channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email')),
      recipient TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','sent','failed','cancelled')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      dispatched_at TEXT,
      cancelled_at TEXT,
      last_error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patient_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE RESTRICT,
      invoice_number TEXT NOT NULL,
      issue_date TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','partially_paid','paid','cancelled')),
      subtotal_minor INTEGER NOT NULL CHECK(subtotal_minor >= 0),
      discount_minor INTEGER NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
      tax_minor INTEGER NOT NULL DEFAULT 0 CHECK(tax_minor >= 0),
      total_minor INTEGER NOT NULL CHECK(total_minor >= 0),
      currency TEXT NOT NULL DEFAULT 'ILS',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patient_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      invoice_id INTEGER NOT NULL REFERENCES patient_invoices(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id) ON DELETE RESTRICT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0),
      discount_minor INTEGER NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
      tax_minor INTEGER NOT NULL DEFAULT 0 CHECK(tax_minor >= 0),
      line_total_minor INTEGER NOT NULL CHECK(line_total_minor >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patient_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      invoice_id INTEGER REFERENCES patient_invoices(id) ON DELETE RESTRICT,
      amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card','bank_transfer','check','other')),
      reference TEXT NOT NULL DEFAULT '',
      payment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','reversed')),
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reversed_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      reversed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS patient_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      patient_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
      type TEXT NOT NULL CHECK(type IN ('invoice','invoice_reversal','payment','payment_reversal')),
      reference_type TEXT NOT NULL CHECK(reference_type IN ('invoice','payment')),
      reference_id INTEGER NOT NULL,
      debit_minor INTEGER NOT NULL DEFAULT 0 CHECK(debit_minor >= 0),
      credit_minor INTEGER NOT NULL DEFAULT 0 CHECK(credit_minor >= 0),
      posted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      CHECK((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
    );
    CREATE TABLE IF NOT EXISTS feedback_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      rating INTEGER,
      comment TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent',
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS gift_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      from_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      to_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      sessions INTEGER NOT NULL DEFAULT 1,
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      redeemed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      entity TEXT NOT NULL,
      entity_id INTEGER,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('sent','fallback','failed','dry_run')),
      provider_message_id TEXT DEFAULT '',
      fallback_url TEXT DEFAULT '',
      error TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','reception','therapist')),
      token TEXT NOT NULL UNIQUE,
      invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      expires_at INTEGER NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureSqliteColumn("users", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("users", "email", "TEXT DEFAULT ''");
  await ensureSqliteColumn("users", "is_platform_owner", "INTEGER NOT NULL DEFAULT 0");
  await ensureSqliteColumn("categories", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("services", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("clients", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("clients", "stage", "TEXT NOT NULL DEFAULT 'lead'");
  await ensureSqliteColumn("clients", "source", "TEXT DEFAULT ''");
  await ensureSqliteColumn("clients", "tags", "TEXT NOT NULL DEFAULT '[]'");
  await ensureSqliteColumn("clients", "last_contacted_at", "TEXT");
  await ensureSqliteColumn("crm_tasks", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("crm_events", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("crm_events", "appointment_id", "INTEGER REFERENCES appointments(id) ON DELETE SET NULL");
  await ensureSqliteColumn("appointments", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("clinic_settings", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await migrateSqliteClinicSettingsPrimaryKey();
  await ensureSqliteColumn("client_files", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("consent_templates", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("consent_signatures", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("feedback_requests", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("gift_cards", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("message_logs", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("sessions", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("user_invitations", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("audit_log", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("tenant_domains", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("tenant_domains", "is_primary", "INTEGER NOT NULL DEFAULT 0");
  await ensureSqliteColumn("tenant_domains", "verified_at", "TEXT");
  await ensureSqliteColumn("billing_invoices", "tenant_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("billing_invoices", "subscription_id", "INTEGER");
  await ensureSqliteColumn("billing_invoices", "notes", "TEXT DEFAULT ''");
  await ensureSqliteColumn("billing_invoices", "billing_cycle", "TEXT DEFAULT ''");
  await ensureSqliteColumn("subscriptions", "billing_day", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("subscriptions", "auto_billing_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureSqliteColumn("clients", "active", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("categories", "active", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("appointments", "active", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("appointments", "payment_status", "TEXT NOT NULL DEFAULT 'unpaid'");
  await ensureSqliteColumn("appointments", "paid_amount", "REAL NOT NULL DEFAULT 0");
  await ensureSqliteColumn("client_files", "original_name", "TEXT DEFAULT ''");
  await ensureSqliteColumn("client_files", "mime_type", "TEXT DEFAULT ''");
  await ensureSqliteColumn("client_files", "size", "INTEGER NOT NULL DEFAULT 0");
  await ensureSqliteColumn("client_files", "path", "TEXT DEFAULT ''");
  await ensureSqliteColumn("client_files", "stored_name", "TEXT DEFAULT ''");
  await ensureSqliteColumn("client_files", "category", "TEXT NOT NULL DEFAULT 'clinical'");
  await ensureSqliteColumn("client_files", "appointment_id", "INTEGER REFERENCES appointments(id) ON DELETE SET NULL");
  await ensureSqliteColumn("client_files", "clinical_visit_id", "INTEGER REFERENCES clinical_visits(id) ON DELETE SET NULL");
  await ensureSqliteColumn("client_files", "uploaded_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await ensureSqliteColumn("consent_templates", "service_id", "INTEGER REFERENCES services(id) ON DELETE SET NULL");
  await ensureSqliteColumn("consent_templates", "description", "TEXT NOT NULL DEFAULT ''");
  await ensureSqliteColumn("consent_templates", "consent_text", "TEXT NOT NULL DEFAULT ''");
  await ensureSqliteColumn("consent_templates", "language", "TEXT NOT NULL DEFAULT 'he'");
  await ensureSqliteColumn("consent_templates", "expiration_days", "INTEGER");
  await ensureSqliteColumn("consent_templates", "version", "INTEGER NOT NULL DEFAULT 1");
  await ensureSqliteColumn("consent_templates", "created_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await ensureSqliteColumn("consent_templates", "updated_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_username ON users(tenant_id, username)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email) WHERE email <> ''");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_tenant_name ON categories(tenant_id, name)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(domain)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_tenant_number ON billing_invoices(tenant_id, number)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_tenant_cycle ON billing_invoices(tenant_id, billing_cycle) WHERE billing_cycle <> ''");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_status ON billing_invoices(tenant_id, status)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_clients_tenant_stage ON clients(tenant_id, stage)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant_status ON crm_tasks(tenant_id, status)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_crm_tasks_client ON crm_tasks(client_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_crm_events_tenant ON crm_events(tenant_id)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_visits_tenant_appointment ON clinical_visits(tenant_id, appointment_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_clinical_visits_tenant_client_date ON clinical_visits(tenant_id, client_id, visit_date)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_clinical_visits_tenant_therapist ON clinical_visits(tenant_id, therapist_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_client_files_tenant_client ON client_files(tenant_id, client_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant_client ON patient_consents(tenant_id, client_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant_appointment ON patient_consents(tenant_id, appointment_id)");
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_consents_active_unique
    ON patient_consents(
      tenant_id, template_id, client_id,
      COALESCE(appointment_id, 0), COALESCE(service_id, 0)
    )
    WHERE status IN ('pending','signed')
  `);
  await db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(tenant_id, user_id, status, created_at)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reminders_tenant_status_schedule ON appointment_reminders(tenant_id, status, scheduled_for)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reminders_appointment ON appointment_reminders(tenant_id, appointment_id)");
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_active_unique
    ON appointment_reminders(tenant_id, appointment_id, reminder_type)
    WHERE status IN ('pending','ready')
  `);
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_invoices_tenant_number ON patient_invoices(tenant_id, invoice_number)");
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_invoices_active_appointment
    ON patient_invoices(tenant_id, appointment_id)
    WHERE appointment_id IS NOT NULL AND status != 'cancelled'
  `);
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_invoices_patient ON patient_invoices(tenant_id, patient_id, created_at)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_payments_patient ON patient_payments(tenant_id, patient_id, payment_date)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_payments_invoice ON patient_payments(tenant_id, invoice_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_patient_ledger_patient ON patient_ledger_entries(tenant_id, patient_id, posted_at, id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_appointments ON appointments(tenant_id, date, active, therapist_id, service_id, status, payment_status)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_clients ON clients(tenant_id, created_at, active, therapist_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_clinical_visits ON clinical_visits(tenant_id, visit_date, therapist_id, service_id, status)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_consents ON patient_consents(tenant_id, created_at, status, expires_at)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_ledger ON patient_ledger_entries(tenant_id, posted_at, type)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_reports_follow_up ON crm_tasks(tenant_id, type, status, due_date, assigned_to)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_message_logs_tenant ON message_logs(tenant_id)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_message_logs_entity ON message_logs(entity, entity_id)");
  await db.prepare("UPDATE users SET email = username || '@clinova.local' WHERE tenant_id = 1 AND COALESCE(email, '') = '' AND username NOT LIKE '%@%'").run();
  if (process.env.NODE_ENV === "test") {
    await db.prepare("UPDATE users SET is_platform_owner = 1 WHERE tenant_id = 1 AND username = 'admin'").run();
  }
}

async function initPostgres() {
  const schema = readFileSync(new URL("./postgres/schema.sql", import.meta.url), "utf8");
  await db.exec(schema);
}

async function seedDefaultTenant() {
  await db.prepare(`
    INSERT INTO tenants (id, name, slug, status, plan, billing_email)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO NOTHING
  `).run(1, "Clinova Demo Clinic", "demo", "trial", "starter", "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function tenantSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function seedSettings(tenantId = 1) {
  const defaults = {
    clinicName: "Clinova",
    logoUrl: "/logo.svg",
    currency: "₪",
    workStart: "09:00",
    workEnd: "18:00",
    workDays: "[0,1,2,3,4,5]",
    whatsappTemplate: "שלום {client}, תזכורת לתור שלך ב-{clinic} בתאריך {date} בשעה {time}.",
  };
  Object.assign(defaults, {
    whatsappEnabled: "false",
    whatsappMode: "fallback",
    whatsappBusinessPhone: "",
    whatsappFeedbackTemplate: "שלום {client}, נשמח למשוב על הביקור שלך ב-{clinic}: {link}",
    whatsappGiftTemplate: "קיבלת מתנה מ-{from}: {sessions} جلسة {service}. קוד המתנה: {code}. {message}",
    appointmentRemindersEnabled: "true",
    reminderTimingHours: "24",
    sameDayReminderEnabled: "false",
    sameDayReminderTime: "08:00",
    reminderChannel: "whatsapp",
  });
  const insert = db.prepare(`
    INSERT INTO clinic_settings (tenant_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id, key) DO NOTHING
  `);
  for (const [key, value] of Object.entries(defaults)) await insert.run(tenantId, key, value);
}

async function migrateSqliteClinicSettingsPrimaryKey() {
  if (isPostgres) return;
  const columns = await db.prepare("PRAGMA table_info(clinic_settings)").all();
  const tenantPk = columns.find((row) => row.name === "tenant_id")?.pk || 0;
  const keyPk = columns.find((row) => row.name === "key")?.pk || 0;
  if (tenantPk === 1 && keyPk === 2) return;

  await db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;
    ALTER TABLE clinic_settings RENAME TO clinic_settings_legacy;
    CREATE TABLE clinic_settings (
      tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, key)
    );
    INSERT OR IGNORE INTO clinic_settings (tenant_id, key, value, updated_at)
      SELECT COALESCE(tenant_id, 1), key, value, COALESCE(updated_at, CURRENT_TIMESTAMP)
      FROM clinic_settings_legacy;
    DROP TABLE clinic_settings_legacy;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

async function ensureSqliteColumn(table, column, definition) {
  const columns = (await db.prepare(`PRAGMA table_info(${table})`).all()).map((row) => row.name);
  if (!columns.includes(column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function seedDatabase() {
  const addUser = db.prepare(`
    INSERT INTO users (username, password_hash, name, title, role, workdays, service_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  await addUser.run("admin", hashPassword("ChangeMe123!"), "Clinova Admin", "System administrator", "admin", "[]", "[]");
  await addUser.run("reception", hashPassword("ChangeMe123!"), "קבלה", "קבלה", "reception", "[]", "[]");
  await addUser.run("sara", hashPassword("ChangeMe123!"), "סארה", "מטפלת", "therapist", "[0,1,2,3,4]", "[1,2,3]");
  await addUser.run("lina", hashPassword("ChangeMe123!"), "לינה", "מטפלת", "therapist", "[1,3,4]", "[3,4,5]");

  const addCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
  await addCategory.run("גבות");
  await addCategory.run("טיפוח");
  await addCategory.run("צביעת שיער");
  await addCategory.run("איפור קבוע");

  const addService = db.prepare("INSERT INTO services (name, category_id, duration, price) VALUES (?, ?, ?, ?)");
  await addService.run("עיצוב גבות", 1, 60, 180);
  await addService.run("צביעת גבות", 1, 45, 150);
  await addService.run("ניקוי עור עמוק", 2, 90, 320);
  await addService.run("איפור קבוע לשפתיים", 4, 120, 600);
  await addService.run("צביעת שיער", 3, 120, 350);
}

async function seedDevelopmentPlatformOwner() {
  if (process.env.NODE_ENV !== "development") return;

  await db.prepare(`
    UPDATE users
    SET is_platform_owner = 0
    WHERE tenant_id = ? AND username = ?
  `).run(1, "admin");

  const existing = await db.prepare(`
    SELECT id
    FROM users
    WHERE tenant_id = ? AND username = ?
    LIMIT 1
  `).get(1, "owner");

  if (existing) {
    await db.prepare(`
      UPDATE users
      SET email = ?, name = ?, title = ?, role = ?, workdays = ?, service_ids = ?,
          is_platform_owner = 1, active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      "owner@clinova.local",
      "Clinova Platform Owner",
      "Platform owner",
      "admin",
      "[]",
      "[]",
      existing.id,
    );
    return;
  }

  await db.prepare(`
    INSERT INTO users (
      tenant_id, username, email, password_hash, name, title, role,
      workdays, service_ids, is_platform_owner, active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    1,
    "owner",
    "owner@clinova.local",
    hashPassword("ChangeMe123!"),
    "Clinova Platform Owner",
    "Platform owner",
    "admin",
    "[]",
    "[]",
    1,
    1,
  );
}

export async function findLoginUser(identifier, tenant = "") {
  const normalized = normalizeEmail(identifier);
  const slug = tenantSlug(tenant);
  if (!normalized) return null;
  if (slug) {
    return await db.prepare(`
      SELECT u.*
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE (t.slug = ? OR EXISTS (
        SELECT 1
        FROM tenant_domains d
        WHERE d.tenant_id = t.id AND lower(d.domain) = ?
      ))
        AND u.active = 1
        AND (lower(u.username) = ? OR lower(u.email) = ?)
      LIMIT 1
    `).get(slug, slug, normalized, normalized);
  }
  return await db.prepare(`
    SELECT *
    FROM users
    WHERE active = 1 AND (lower(username) = ? OR lower(email) = ?)
    ORDER BY tenant_id, id
    LIMIT 1
  `).get(normalized, normalized);
}

export async function provisionTenant({ clinicName, slug, ownerName, email, password }) {
  const name = String(clinicName || "").trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedSlug = tenantSlug(slug || name);
  const owner = String(ownerName || "Owner").trim();
  const secret = String(password || "");

  if (name.length < 2) {
    const error = new Error("Clinic name is required.");
    error.status = 400;
    throw error;
  }
  if (!normalizedSlug) {
    const error = new Error("Tenant slug is required.");
    error.status = 400;
    throw error;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error("Valid owner email is required.");
    error.status = 400;
    throw error;
  }
  if (secret.length < 8) {
    const error = new Error("Password must be at least 8 characters.");
    error.status = 400;
    throw error;
  }

  const existing = await db.prepare("SELECT id FROM tenants WHERE slug = ?").get(normalizedSlug);
  if (existing) {
    const error = new Error("Tenant slug already exists.");
    error.status = 409;
    throw error;
  }

  const trialEndsAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  const tenantResult = await db.prepare(`
    INSERT INTO tenants (name, slug, status, plan, billing_email, trial_ends_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, normalizedSlug, "trial", "starter", normalizedEmail, trialEndsAt);
  const tenantId = Number(tenantResult.lastInsertRowid);

  await db.prepare(`
    INSERT INTO subscriptions (tenant_id, provider, status, plan, current_period_end)
    VALUES (?, ?, ?, ?, ?)
  `).run(tenantId, "manual", "trial", "starter", trialEndsAt);
  await seedSettings(tenantId);
  await db.prepare("UPDATE clinic_settings SET value = ? WHERE tenant_id = ? AND key = ?").run(name, tenantId, "clinicName");

  const userResult = await db.prepare(`
    INSERT INTO users (tenant_id, username, email, password_hash, name, title, role, workdays, service_ids, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, normalizedEmail, normalizedEmail, hashPassword(secret), owner, "Owner", "admin", "[]", "[]", 1);
  const user = await db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?").get(userResult.lastInsertRowid, tenantId);
  const tenant = await db.prepare("SELECT id, name, slug, status, plan, billing_email AS billingEmail, trial_ends_at AS trialEndsAt FROM tenants WHERE id = ?").get(tenantId);
  return { tenant, user: rowToUser(user) };
}

export async function audit(userId, action, entity, entityId, details = {}) {
  const tenantId = details?.tenantId || 1;
  await db.prepare("INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tenantId, userId || null, action, entity, entityId || null, JSON.stringify(details));
}
