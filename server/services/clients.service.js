import {
  addCrmEvent,
  archiveClient,
  archiveClientAppointments,
  auditClient,
  canSeeClient,
  clientTherapistExists,
  createClient,
  findClientCrmFields,
  listClientAppointments,
  listClientFiles,
  listClientRows,
  tenantBillingSnapshot,
  updateClient,
} from "../repositories/clients.repository.js";

const planCatalog = {
  starter: { name: "Starter", monthlyPrice: 49, maxUsers: 5, maxClients: 200, whatsapp: false, billing: false },
  growth: { name: "Growth", monthlyPrice: 99, maxUsers: 10, maxClients: 2000, whatsapp: true, billing: false },
  scale: { name: "Scale", monthlyPrice: 199, maxUsers: null, maxClients: null, whatsapp: true, billing: true },
};

function jsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseTags(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(String).filter(Boolean));
  return JSON.stringify(String(value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function limitReached(current, max) {
  return max !== null && max !== undefined && Number(current || 0) >= Number(max);
}

function hasRequiredFields(body, fields) {
  return fields.every((field) => {
    const value = body[field];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

async function assertTenantCanWrite(tenantId, feature = "write") {
  const billing = await tenantBillingSnapshot(tenantId);
  if (["suspended", "cancelled", "past_due"].includes(billing.status)) {
    const error = new Error(`Subscription status blocks ${feature}.`);
    error.status = 402;
    throw error;
  }
  return {
    ...billing,
    limits: planCatalog[billing.plan] || planCatalog.starter,
  };
}

function clientFromRow(row) {
  return {
    id: row.id,
    fname: row.fname,
    lname: row.lname,
    phone: row.phone,
    email: row.email,
    therapistId: row.therapist_id,
    stage: row.stage || "lead",
    source: row.source || "",
    tags: jsonArray(row.tags),
    lastContactedAt: row.last_contacted_at || "",
    notes: row.notes,
  };
}

function appointmentFromRow(row) {
  return {
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
    notes: row.notes,
    duration: row.duration,
    price: row.price,
    paymentStatus: row.payment_status || "unpaid",
    paidAmount: Number(row.paid_amount || 0),
  };
}

function clientValues(body, existing = {}) {
  return {
    fname: body.fname,
    lname: body.lname,
    phone: body.phone,
    email: body.email || "",
    therapistId: body.therapistId || null,
    stage: Object.prototype.hasOwnProperty.call(body, "stage") ? body.stage || "lead" : existing.stage || "lead",
    source: Object.prototype.hasOwnProperty.call(body, "source") ? body.source || "" : existing.source || "",
    tags: Object.prototype.hasOwnProperty.call(body, "tags") ? parseTags(body.tags) : existing.tags || "[]",
    notes: body.notes || "",
  };
}

export async function getClients(user) {
  return { status: 200, body: (await listClientRows(user)).map(clientFromRow) };
}

export async function getClientHistory(user, id) {
  if (!await canSeeClient(user, id)) {
    return { status: 403, body: { error: "لا تملك صلاحية لهذا العميل" } };
  }
  const client = (await listClientRows(user)).map(clientFromRow).find((item) => item.id === id);
  const appointments = (await listClientAppointments(user, id)).map(appointmentFromRow);
  return {
    status: 200,
    body: { client, appointments, files: await listClientFiles(id, user.tenantId) },
  };
}

export async function addClient(user, body) {
  if (!hasRequiredFields(body, ["fname", "lname", "phone"])) {
    return { status: 400, body: { error: "First name, last name, and phone are required." } };
  }
  if (!await clientTherapistExists(body.therapistId, user.tenantId)) {
    return { status: 404, body: { error: "Therapist not found." } };
  }

  const billing = await assertTenantCanWrite(user.tenantId, "client creation");
  if (limitReached(billing.usage.clients, billing.limits.maxClients)) {
    return { status: 402, body: { error: `Plan client limit reached (${billing.limits.maxClients}).` } };
  }
  const id = await createClient(user.tenantId, clientValues(body, { stage: "lead", source: "", tags: "[]" }));
  await addCrmEvent({ tenantId: user.tenantId, clientId: id, userId: user.id, type: "client_created", description: "Client profile created" });
  await auditClient(user.id, "create", id, user.tenantId);
  return { status: 201, body: { id } };
}

export async function editClient(user, id, body) {
  if (!hasRequiredFields(body, ["fname", "lname", "phone"])) {
    return { status: 400, body: { error: "First name, last name, and phone are required." } };
  }
  if (!await clientTherapistExists(body.therapistId, user.tenantId)) {
    return { status: 404, body: { error: "Therapist not found." } };
  }

  const current = await findClientCrmFields(id, user.tenantId);
  if (!current) return { status: 404, body: { error: "Client not found" } };

  const next = clientValues(body, current);
  await updateClient(id, user.tenantId, next);
  if (current.stage !== next.stage) {
    await addCrmEvent({ tenantId: user.tenantId, clientId: id, userId: user.id, type: "stage_changed", description: `${current.stage || "lead"} -> ${next.stage}` });
  }
  await auditClient(user.id, "update", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}

export async function removeClient(user, id) {
  const changes = await archiveClient(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "Client not found" } };
  await archiveClientAppointments(id, user.tenantId);
  await auditClient(user.id, "archive", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
