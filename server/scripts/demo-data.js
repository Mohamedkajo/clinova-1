import { existsSync, rmSync } from "node:fs";
import { hashPassword } from "../security.js";
import { configureDemoEnvironment } from "./demo-environment.js";

const mode = process.argv[2] || "seed";
if (!["seed", "reset"].includes(mode)) {
  throw new Error("Usage: node server/scripts/demo-data.js <seed|reset>");
}

const password = String(process.env.DEMO_PASSWORD || "");
if (password.length < 12) {
  throw new Error("DEMO_PASSWORD must contain at least 12 characters.");
}

const { databasePath } = configureDemoEnvironment();

if (mode === "reset") {
  for (const candidate of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (existsSync(candidate)) rmSync(candidate);
  }
}

const { db, initDatabase } = await import("../db.js");
await initDatabase();

await db.exec(`
  PRAGMA foreign_keys = OFF;
  BEGIN TRANSACTION;
  DELETE FROM audit_log;
  DELETE FROM user_invitations;
  DELETE FROM sessions;
  DELETE FROM message_logs;
  DELETE FROM feedback_requests;
  DELETE FROM patient_consents;
  DELETE FROM consent_signatures;
  DELETE FROM consent_templates;
  DELETE FROM client_files;
  DELETE FROM crm_events;
  DELETE FROM crm_tasks;
  DELETE FROM gift_cards;
  DELETE FROM clinical_visits;
  DELETE FROM appointments;
  DELETE FROM clients;
  DELETE FROM services;
  DELETE FROM categories;
  DELETE FROM billing_invoices;
  DELETE FROM subscriptions;
  DELETE FROM tenant_domains;
  DELETE FROM clinic_settings;
  DELETE FROM users;
  DELETE FROM tenants;
  DELETE FROM sqlite_sequence;
  COMMIT;
  PRAGMA foreign_keys = ON;
`);

await db.prepare(`
  INSERT INTO tenants (id, name, slug, status, plan, billing_email)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(1, "Clinova Alpha Demo", "demo", "active", "alpha", "billing@example.test");

const addUser = db.prepare(`
  INSERT INTO users (
    id, tenant_id, username, email, password_hash, name, title, role,
    workdays, service_ids, is_platform_owner, active
  ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);
const passwordHash = hashPassword(password);
await addUser.run(1, "owner", "owner@example.test", passwordHash, "Alpha Platform Owner", "Platform owner", "admin", "[]", "[]", 1);
await addUser.run(2, "admin", "admin@example.test", passwordHash, "Maya Admin", "Clinic administrator", "admin", "[]", "[]", 0);
await addUser.run(3, "reception", "reception@example.test", passwordHash, "Rina Reception", "Reception", "reception", "[]", "[]", 0);
await addUser.run(4, "sara", "sara@example.test", passwordHash, "Sara Therapist", "Therapist", "therapist", "[0,1,2,3,4,5]", "[1,2,3]", 0);

await db.prepare("INSERT INTO categories (id, tenant_id, name, active) VALUES (?, 1, ?, 1)").run(1, "Skin care");
await db.prepare("INSERT INTO categories (id, tenant_id, name, active) VALUES (?, 1, ?, 1)").run(2, "Wellness");

const addService = db.prepare("INSERT INTO services (id, tenant_id, name, category_id, duration, price, active) VALUES (?, 1, ?, ?, ?, ?, 1)");
await addService.run(1, "Consultation", 1, 30, 120);
await addService.run(2, "Facial treatment", 1, 60, 280);
await addService.run(3, "Wellness session", 2, 45, 220);

const addClient = db.prepare(`
  INSERT INTO clients (
    id, tenant_id, fname, lname, phone, email, therapist_id, stage,
    source, tags, last_contacted_at, notes, active, created_at, updated_at
  ) VALUES (?, 1, ?, ?, ?, ?, 4, ?, ?, ?, ?, ?, 1, ?, ?)
`);
const now = new Date();
const isoDate = (offset) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const isoTime = (offsetDays, hour) => `${isoDate(offsetDays)} ${hour}:00`;
await addClient.run(1, "Noa", "Example", "+15550100101", "noa@example.test", "active", "Demo referral", '["alpha","returning"]', isoTime(-2, "13"), "Fictional demo patient.", isoTime(-30, "09"), isoTime(-2, "13"));
await addClient.run(2, "Omar", "Sample", "+15550100102", "omar@example.test", "follow_up", "Website demo", '["alpha"]', isoTime(-1, "10"), "Fictional demo patient.", isoTime(-20, "10"), isoTime(-1, "10"));
await addClient.run(3, "Lina", "Preview", "+15550100103", "lina@example.test", "vip", "Demo referral", '["alpha","vip"]', isoTime(-5, "15"), "Fictional demo patient.", isoTime(-60, "11"), isoTime(-5, "15"));
await addClient.run(4, "Ari", "Fixture", "+15550100104", "ari@example.test", "lead", "Walk-in demo", "[]", null, "Fictional demo patient.", isoTime(-3, "12"), isoTime(-3, "12"));

const addAppointment = db.prepare(`
  INSERT INTO appointments (
    id, tenant_id, client_id, service_id, therapist_id, date, time,
    status, payment_status, paid_amount, notes, active, created_at, updated_at
  ) VALUES (?, 1, ?, ?, 4, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`);
await addAppointment.run(1, 1, 1, isoDate(0), "09:30", "pending", "unpaid", 0, "Alpha walkthrough appointment.", isoTime(-2, "09"), isoTime(-2, "09"));
await addAppointment.run(2, 2, 2, isoDate(0), "11:00", "done", "paid", 280, "Completed demo visit.", isoTime(-5, "10"), isoTime(0, "12"));
await addAppointment.run(3, 3, 3, isoDate(1), "14:00", "pending", "deposit", 50, "Upcoming demo session.", isoTime(-1, "08"), isoTime(-1, "08"));
await addAppointment.run(4, 1, 2, isoDate(-7), "10:30", "done", "paid", 280, "Historical demo visit.", isoTime(-10, "09"), isoTime(-7, "12"));

const addEvent = db.prepare(`
  INSERT INTO crm_events (tenant_id, client_id, user_id, appointment_id, type, description, created_at)
  VALUES (1, ?, ?, ?, ?, ?, ?)
`);
for (const clientId of [1, 2, 3, 4]) {
  await addEvent.run(clientId, 3, null, "patient_created", "Fictional demo patient created.", isoTime(-31 + clientId, "09"));
}
await addEvent.run(1, 3, 1, "appointment_created", "Alpha walkthrough appointment created.", isoTime(-2, "09"));
await addEvent.run(2, 4, 2, "appointment_created", "Completed demo appointment created.", isoTime(-5, "10"));
await addEvent.run(2, 4, 2, "appointment_status_changed", "Appointment status changed from pending to done.", isoTime(0, "12"));
await addEvent.run(3, 3, 3, "appointment_created", "Upcoming demo appointment created.", isoTime(-1, "08"));

await db.prepare(`
  INSERT INTO crm_tasks (tenant_id, client_id, assigned_to, type, title, due_date, status, priority, notes)
  VALUES (1, 2, 3, 'follow_up', 'Confirm next visit', ?, 'open', 'normal', 'Fictional alpha demo task.')
`).run(isoDate(2));

const settings = {
  clinicName: "Clinova Alpha Demo",
  logoUrl: "/logo.svg",
  currency: "₪",
  workStart: "09:00",
  workEnd: "18:00",
  workDays: "[0,1,2,3,4,5]",
  whatsappEnabled: "false",
  whatsappMode: "fallback",
};
const addSetting = db.prepare("INSERT INTO clinic_settings (tenant_id, key, value) VALUES (1, ?, ?)");
for (const [key, value] of Object.entries(settings)) await addSetting.run(key, value);

await db.prepare(`
  INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details, created_at)
  VALUES (1, 3, 'demo_seeded', 'system', 1, ?, CURRENT_TIMESTAMP)
`).run(JSON.stringify({ version: "1.8.0-alpha.1", fictionalData: true }));

console.log(`DEMO_${mode.toUpperCase()}_DONE`);
console.log(`Database: ${databasePath}`);
console.log("Clinic: demo");
console.log("Users: owner, admin, reception, sara");
