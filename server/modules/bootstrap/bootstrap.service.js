import { rowToUser } from "../../shared/auth/user-mapper.js";
import { requireCurrentUserCompat } from "../../shared/auth/current-user.js";
import { inviteUrl } from "../../shared/http/url-helpers.js";
import { listAuditRows } from "../../repositories/audit.repository.js";
import { listAppointmentRows } from "../../repositories/appointments.repository.js";
import { tenantBilling } from "../../repositories/billing.repository.js";
import { listClientRows } from "../../repositories/clients.repository.js";
import { listConsentSignatures, listConsentTemplates } from "../../repositories/consents.repository.js";
import { listCrmEventRows, listCrmTaskRows } from "../../repositories/crm.repository.js";
import { listFeedbackRequests } from "../../repositories/feedback.repository.js";
import { clinicSettings } from "../../repositories/settings.repository.js";
import { tenantDomains } from "../../repositories/tenant-domains.repository.js";
import { listMessageLogs } from "../../repositories/whatsapp.repository.js";
import { permissions } from "../../repositories/permissions.repository.js";
import { listGiftCards } from "../gifts/gifts.repository.js";
import { platformTenants } from "../platform/platform.repository.js";
import {
  findTenantForBootstrap,
  listCategoriesForBootstrap,
  listInvitationsForBootstrap,
  listServicesForBootstrap,
  listUsersForBootstrap,
} from "./bootstrap.repository.js";

export async function buildBootstrapResponse(req, res) {
  const user = await requireCurrentUserCompat(req, res);
  if (!user) return null;

  if (user.platformOwner) {
    return platformOwnerBootstrap(user);
  }

  return clinicBootstrap(req, user);
}

async function platformOwnerBootstrap(user) {
  return {
    user,
    tenant: null,
    tenantDomains: [],
    platformTenants: await platformTenants(),
    billing: null,
    users: [],
    invitations: [],
    categories: [],
    services: [],
    clients: [],
    crmTasks: [],
    crmEvents: [],
    appointments: [],
    consentTemplates: [],
    consentSignatures: [],
    feedbackRequests: [],
    giftCards: [],
    messageLogs: [],
    settings: {},
    audits: [],
  };
}

async function clinicBootstrap(req, user) {
  return {
    user,

    // Tenant/platform context.
    tenant: await findTenantForBootstrap(user.tenantId),
    tenantDomains: user.platformOwner ? await tenantDomains(user.tenantId) : [],
    platformTenants: user.platformOwner ? await platformTenants() : [],
    billing: user.platformOwner ? await tenantBilling(user.tenantId) : null,

    // People and invitations.
    users: (await listUsersForBootstrap(user.tenantId)).map(rowToUser),
    invitations: user.role === "admin" ? (await listInvitationsForBootstrap(user.tenantId)).map((row) => ({ ...row, inviteUrl: inviteUrl(req, row.token) })) : [],

    // Catalog.
    categories: await listCategoriesForBootstrap(user.tenantId),
    services: await listServicesForBootstrap(user.tenantId),

    // Operational clinic data.
    clients: await listClientsForBootstrap(user),
    crmTasks: await listCrmTaskRows(user),
    crmEvents: await listCrmEventRows(user),
    appointments: await listAppointmentsForBootstrap(user),

    // Legal, feedback, gifts, messaging.
    consentTemplates: await listConsentTemplates(user.tenantId),
    consentSignatures: user.role === "admin" || user.role === "reception" ? await listConsentSignatures(user.tenantId) : [],
    feedbackRequests: user.role === "admin" || user.role === "reception" ? await listFeedbackRequests(user.tenantId) : [],
    giftCards: user.role === "admin" || user.role === "reception" ? await listGiftCards(user.tenantId) : [],
    messageLogs: user.role === "admin" || user.role === "reception" ? await listMessageLogs(user.tenantId) : [],

    // Settings and audit.
    settings: await clinicSettings(user.tenantId),
    audits: user.role === "admin" ? await listAuditForBootstrap(user.tenantId) : [],
  };
}

async function listAuditForBootstrap(tenantId) {
  const rows = await listAuditRows(tenantId);
  return rows.map((row) => ({
    ...row,
    details: JSON.parse(row.details || "{}"),
  }));
}

async function listClientsForBootstrap(user) {
  const rows = await listClientRows(user);
  return rows.map((row) => ({
    id: row.id,
    fname: row.fname,
    lname: row.lname,
    phone: row.phone,
    email: row.email,
    therapistId: row.therapist_id,
    stage: row.stage || "lead",
    source: row.source || "",
    tags: jsonArrayForBootstrap(row.tags),
    lastContactedAt: row.last_contacted_at || "",
    ...(permissions.clients_clinical_read.includes(user.role) ? { notes: row.notes } : {}),
  }));
}

function jsonArrayForBootstrap(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function listAppointmentsForBootstrap(user) {
  const rows = await listAppointmentRows(user);
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    clientName: `${row.fname} ${row.lname}`,
    clientPhone: row.phone,
    serviceId: row.service_id,
    serviceName: row.service_name,
    therapistId: row.therapist_id,
    therapistName: row.therapist_name,
    date: row.date,
    time: row.time,
    status: row.status,
    ...(permissions.clients_clinical_read.includes(user.role) ? { notes: row.notes } : {}),
    duration: row.duration,
    price: row.price,
    ...(permissions.clients_financial_read.includes(user.role)
      ? {
          paymentStatus: row.payment_status || "unpaid",
          paidAmount: Number(row.paid_amount || 0),
        }
      : {}),
  }));
}
