CREATE TABLE IF NOT EXISTS tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','suspended','cancelled')),
  plan TEXT NOT NULL DEFAULT 'starter',
  billing_email TEXT DEFAULT '',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_jobs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prepare_reminders','dispatch_reminders','expire_consents')),
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  payload TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  heartbeat_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_customer_id TEXT DEFAULT '',
  provider_subscription_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'trial',
  plan TEXT NOT NULL DEFAULT 'starter',
  billing_day INTEGER NOT NULL DEFAULT 1,
  auto_billing_enabled INTEGER NOT NULL DEFAULT 0,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','failed','disabled')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
  currency TEXT NOT NULL DEFAULT 'USD',
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  billing_cycle TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (id, name, slug, status, plan, billing_email)
VALUES (1, 'Clinova Demo Clinic', 'demo', 'trial', 'starter', '')
ON CONFLICT DO NOTHING;
SELECT setval(
  pg_get_serial_sequence('tenants', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM tenants), 1), 1),
  true
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','reception','therapist')),
  workdays TEXT NOT NULL DEFAULT '[]',
  service_ids TEXT NOT NULL DEFAULT '[]',
  is_platform_owner INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  duration INTEGER NOT NULL CHECK (duration > 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  fname TEXT NOT NULL,
  lname TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  therapist_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'lead',
  source TEXT DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  last_contacted_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'follow_up',
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  notes TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  client_id BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  appointment_id BIGINT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  therapist_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','done','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_visits (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  visit_date TEXT NOT NULL,
  visit_time TEXT NOT NULL,
  treatment_summary TEXT NOT NULL,
  clinical_observations TEXT NOT NULL DEFAULT '',
  recommendations TEXT NOT NULL DEFAULT '',
  follow_up_instructions TEXT NOT NULL DEFAULT '',
  internal_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  completed_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, appointment_id)
);

CREATE TABLE IF NOT EXISTS clinic_settings (
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS client_files (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  original_name TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  size BIGINT NOT NULL DEFAULT 0,
  path TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  stored_name TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'clinical',
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  clinical_visit_id BIGINT REFERENCES clinical_visits(id) ON DELETE SET NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_templates (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  consent_text TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'he',
  expiration_days INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  original_name TEXT DEFAULT '',
  mime_type TEXT DEFAULT 'application/pdf',
  size BIGINT NOT NULL DEFAULT 0,
  path TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_signatures (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES consent_templates(id) ON DELETE RESTRICT,
  client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_consents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id BIGINT NOT NULL REFERENCES consent_templates(id) ON DELETE RESTRICT,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','declined','expired')),
  signature_id BIGINT REFERENCES consent_signatures(id) ON DELETE SET NULL,
  assigned_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  witness_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id BIGINT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h','same_day')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email')),
  recipient TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','sent','failed','cancelled')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_invoices (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  issue_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','cancelled')),
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ILS',
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id BIGINT NOT NULL REFERENCES patient_invoices(id) ON DELETE CASCADE,
  service_id BIGINT REFERENCES services(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  line_total_minor BIGINT NOT NULL CHECK (line_total_minor >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_id BIGINT REFERENCES patient_invoices(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer','check','other')),
  reference TEXT NOT NULL DEFAULT '',
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reversed_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('invoice','invoice_reversal','payment','payment_reversal')),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('invoice','payment')),
  reference_id BIGINT NOT NULL,
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

ALTER TABLE client_files ADD COLUMN IF NOT EXISTS stored_name TEXT DEFAULT '';
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'clinical';
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS clinical_visit_id BIGINT REFERENCES clinical_visits(id) ON DELETE SET NULL;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS service_id BIGINT REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS consent_text TEXT NOT NULL DEFAULT '';
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'he';
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS expiration_days INTEGER;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_files_tenant_client ON client_files(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant_client ON patient_consents(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_tenant_appointment ON patient_consents(tenant_id, appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_consents_active_unique
  ON patient_consents(
    tenant_id, template_id, client_id,
    COALESCE(appointment_id, 0), COALESCE(service_id, 0)
  )
  WHERE status IN ('pending','signed');
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON notifications(tenant_id, user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant_status_schedule
  ON appointment_reminders(tenant_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_appointment
  ON appointment_reminders(tenant_id, appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_active_unique
  ON appointment_reminders(tenant_id, appointment_id, reminder_type)
  WHERE status IN ('pending','ready');
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_invoices_tenant_number
  ON patient_invoices(tenant_id, invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_invoices_active_appointment
  ON patient_invoices(tenant_id, appointment_id)
  WHERE appointment_id IS NOT NULL AND status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_patient_invoices_patient
  ON patient_invoices(tenant_id, patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patient_payments_patient
  ON patient_payments(tenant_id, patient_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_patient_payments_invoice
  ON patient_payments(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_patient_ledger_patient
  ON patient_ledger_entries(tenant_id, patient_id, posted_at, id);
CREATE INDEX IF NOT EXISTS idx_reports_appointments
  ON appointments(tenant_id, date, active, therapist_id, service_id, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_reports_clients
  ON clients(tenant_id, created_at, active, therapist_id);
CREATE INDEX IF NOT EXISTS idx_reports_clinical_visits
  ON clinical_visits(tenant_id, visit_date, therapist_id, service_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_consents
  ON patient_consents(tenant_id, created_at, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reports_ledger
  ON patient_ledger_entries(tenant_id, posted_at, type);
CREATE INDEX IF NOT EXISTS idx_reports_follow_up
  ON crm_tasks(tenant_id, type, status, due_date, assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_claim
  ON background_jobs(status, run_at, id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status
  ON background_jobs(tenant_id, status, run_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe
  ON background_jobs(tenant_id, dedupe_key);

CREATE TABLE IF NOT EXISTS feedback_requests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  rating INTEGER,
  comment TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  from_client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  to_client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  sessions INTEGER NOT NULL DEFAULT 1,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS message_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  entity TEXT NOT NULL,
  entity_id BIGINT,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','fallback','failed','dry_run')),
  provider_message_id TEXT DEFAULT '',
  fallback_url TEXT DEFAULT '',
  error TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_invitations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','reception','therapist')),
  token TEXT NOT NULL UNIQUE,
  invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  expires_at BIGINT NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id BIGINT,
  details TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_owner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE crm_events ADD COLUMN IF NOT EXISTS appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_events_appointment_id_fkey'
      AND conrelid = 'crm_events'::regclass
  ) THEN
    ALTER TABLE crm_events
      ADD CONSTRAINT crm_events_appointment_id_fkey
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END;
$$;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE client_files ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE consent_signatures ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE feedback_requests ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tenant_domains ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE tenant_domains ADD COLUMN IF NOT EXISTS is_primary INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenant_domains ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT '';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_day INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_billing_enabled INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_username ON users(tenant_id, lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, lower(email)) WHERE email <> '';
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(lower(domain));
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_tenant_number ON billing_invoices(tenant_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_invoices_tenant_cycle ON billing_invoices(tenant_id, billing_cycle) WHERE billing_cycle <> '';
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant_status ON billing_invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_tenant_name ON categories(tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(active);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_stage ON clients(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_active_updated ON clients(tenant_id, active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant_status ON crm_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_client ON crm_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_tenant ON crm_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_tenant_client ON crm_events(tenant_id, client_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_active ON appointments(active);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date ON appointments(therapist_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_client_date ON appointments(tenant_id, client_id, active, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_visits_tenant_appointment ON clinical_visits(tenant_id, appointment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_visits_tenant_client_date ON clinical_visits(tenant_id, client_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_clinical_visits_tenant_therapist ON clinical_visits(tenant_id, therapist_id);
CREATE INDEX IF NOT EXISTS idx_consent_templates_active ON consent_templates(active);
CREATE INDEX IF NOT EXISTS idx_consent_templates_tenant ON consent_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_token ON feedback_requests(token);
CREATE INDEX IF NOT EXISTS idx_feedback_requests_tenant ON feedback_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_tenant ON gift_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_tenant ON message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_entity ON message_logs(entity, entity_id);
