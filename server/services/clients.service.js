import {
  addCrmEvent,
  archiveClient,
  archiveClientAppointments,
  auditClient,
  canSeeClient,
  clientTherapistExists,
  createClient,
  findClientCrmFields,
  findClientProfileRow,
  findDuplicateClient,
  listClientAppointments,
  listClientConsentSignatures,
  listClientPatientConsents,
  listClientCrmEvents,
  listClientFiles,
  listClientRows,
  listPatientTherapistOptions,
  listPatientWorkspaceRows,
  tenantBillingSnapshot,
  updateClient,
} from "../repositories/clients.repository.js";
import { permissions } from "../repositories/permissions.repository.js";
import { listClientClinicalVisits } from "../repositories/clinical-visits.repository.js";
import { expirePatientConsents, listConsentTemplates } from "../repositories/consents.repository.js";

const planCatalog = {
  starter: { name: "Starter", monthlyPrice: 49, maxUsers: 5, maxClients: 200, whatsapp: false, billing: false },
  growth: { name: "Growth", monthlyPrice: 99, maxUsers: 10, maxClients: 2000, whatsapp: true, billing: false },
  scale: { name: "Scale", monthlyPrice: 199, maxUsers: null, maxClients: null, whatsapp: true, billing: true },
};

const validClientStages = new Set(["lead", "contacted", "qualified", "active", "follow_up", "vip", "inactive", "lost"]);

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

function clientFromRow(row, { includeClinical = true } = {}) {
  const client = {
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
  };
  if (includeClinical) client.notes = row.notes;
  return client;
}

function appointmentFromRow(row, { includeClinical = true, includeFinancial = true } = {}) {
  const appointment = {
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
    duration: row.duration,
  };
  if (includeClinical) appointment.notes = row.notes;
  if (includeFinancial) {
    appointment.price = row.price;
    appointment.paymentStatus = row.payment_status || "unpaid";
    appointment.paidAmount = Number(row.paid_amount || 0);
  }
  return appointment;
}

function clinicalVisitFromRow(row, includeClinical) {
  const visit = {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.client_id,
    therapistId: row.therapist_id,
    therapistName: row.therapist_name || "",
    serviceId: row.service_id,
    serviceName: row.service_name || "",
    visitDate: row.visit_date,
    visitTime: row.visit_time,
    status: row.status,
    appointmentStatus: row.appointment_status,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeClinical) {
    visit.treatmentSummary = row.treatment_summary || "";
    visit.clinicalObservations = row.clinical_observations || "";
    visit.recommendations = row.recommendations || "";
    visit.followUpInstructions = row.follow_up_instructions || "";
    visit.internalNotes = row.internal_notes || "";
  }
  return visit;
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
    notes: Object.prototype.hasOwnProperty.call(body, "notes") ? body.notes || "" : existing.notes || "",
  };
}

function validateClientStage(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "stage") || body.stage === undefined || body.stage === null || body.stage === "") {
    return null;
  }
  return validClientStages.has(body.stage) ? null : { status: 400, body: { error: "Valid client stage is required." } };
}

function localDate() {
  return new Date().toISOString().slice(0, 10);
}

function recentCutoff(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function maxTimestamp(...values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

function patientListFromRow(row) {
  return {
    id: row.id,
    firstName: row.fname,
    lastName: row.lname,
    name: `${row.fname} ${row.lname}`.trim(),
    phone: row.phone,
    email: row.email || "",
    stage: row.stage || "lead",
    therapist: row.therapist_id ? { id: row.therapist_id, name: row.therapist_name || "" } : null,
    lastAppointmentDate: row.last_appointment_date || null,
    nextAppointmentDate: row.next_appointment_date || null,
    lastActivityAt: maxTimestamp(row.updated_at, row.latest_crm_at, row.latest_appointment_at),
  };
}

function patientProfileFromRow(row, includeClinical) {
  const patient = {
    id: row.id,
    firstName: row.fname,
    lastName: row.lname,
    name: `${row.fname} ${row.lname}`.trim(),
    phone: row.phone,
    email: row.email || "",
    stage: row.stage || "lead",
    source: row.source || "",
    tags: jsonArray(row.tags),
    lastContactedAt: row.last_contacted_at || null,
    therapist: row.therapist_id ? { id: row.therapist_id, name: row.therapist_name || "", username: row.therapist_username || "" } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeClinical) patient.notes = row.notes || "";
  return patient;
}

function patientTimeline({
  patientRow,
  appointmentRows,
  crmEvents,
  files,
  consents,
  patientConsents,
  includeClinical,
  includeFinancial,
}) {
  const visibleCrmEvents = crmEvents.filter((event) => includeClinical || event.type !== "note");
  const events = visibleCrmEvents.map((event) => ({
    id: `crm-${event.id}`,
    type: event.type === "note" ? "clinical_note" : event.type,
    occurredAt: event.createdAt,
    description: event.type === "file_uploaded" && /^file:\d+$/.test(event.description || "") ? null : event.description,
    actor: event.userName || null,
    ...((event.appointmentId || (event.type === "file_uploaded" && /^file:\d+$/.test(event.description || "")))
      ? { related: {
          ...(event.appointmentId ? { appointmentId: event.appointmentId } : {}),
          ...(event.type === "file_uploaded" && /^file:\d+$/.test(event.description || "")
            ? { fileId: Number(event.description.slice(5)) }
            : {}),
        } }
      : {}),
  }));

  if (!visibleCrmEvents.some((event) => event.type === "client_created")) {
    events.push({ id: `patient-created-${patientRow.id}`, type: "patient_created", occurredAt: patientRow.created_at, description: null, actor: null });
  }

  for (const row of appointmentRows) {
    const event = {
      id: `appointment-${row.id}`,
      type: "appointment",
      occurredAt: `${row.date}T${row.time || "00:00"}:00`,
      description: row.service_name,
      actor: row.therapist_name || null,
      status: row.status,
      related: { appointmentId: row.id },
    };
    if (includeFinancial) {
      event.financial = {
        price: Number(row.price || 0),
        paymentStatus: row.payment_status || "unpaid",
        paidAmount: Number(row.paid_amount || 0),
      };
    }
    events.push(event);
  }

  for (const file of files) {
    if (!events.some((event) => event.related?.fileId === file.id)) {
      events.push({ id: `file-${file.id}`, type: "file_uploaded", occurredAt: file.createdAt, description: null, actor: file.uploaderName || null, related: { fileId: file.id } });
    }
  }
  const assignedSignatureIds = new Set(patientConsents.map((consent) => Number(consent.signatureId)).filter(Boolean));
  for (const consent of consents.filter((item) => !assignedSignatureIds.has(Number(item.id)))) {
    events.push({ id: `consent-${consent.id}`, type: "consent_signed", occurredAt: consent.signedAt, description: consent.templateTitle, actor: consent.signerName || null, related: { appointmentId: consent.appointmentId || null } });
  }
  return events.filter((event) => event.occurredAt).sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
}

export async function getClients(user) {
  const includeClinical = permissions.clients_clinical_read.includes(user.role);
  return { status: 200, body: (await listClientRows(user)).map((row) => clientFromRow(row, { includeClinical })) };
}

export async function getPatientWorkspace(user, query) {
  const stage = String(query.status || "").trim();
  const upcoming = String(query.upcoming || "all").trim();
  const recent = String(query.recent || "all").trim();
  if (stage && !validClientStages.has(stage)) return { status: 400, body: { error: "Invalid patient status filter." } };
  if (!new Set(["all", "yes", "no"]).has(upcoming)) return { status: 400, body: { error: "Invalid upcoming appointment filter." } };
  if (!new Set(["all", "30", "90"]).has(recent)) return { status: 400, body: { error: "Invalid recent activity filter." } };

  const page = positiveInteger(query.page, 1);
  const pageSize = Math.min(50, positiveInteger(query.pageSize, 20));
  const therapistId = query.therapistId ? positiveInteger(query.therapistId, null) : null;
  if (query.therapistId && !therapistId) return { status: 400, body: { error: "Invalid therapist filter." } };
  const filters = {
    query: String(query.q || "").trim().slice(0, 100),
    stage: stage || null,
    therapistId,
    upcoming,
    recentSince: recent === "all" ? null : recentCutoff(Number(recent)),
    today: localDate(),
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
  const { rows, total } = await listPatientWorkspaceRows(user, filters);
  const therapists = await listPatientTherapistOptions(user);
  return {
    status: 200,
    body: {
      items: rows.map(patientListFromRow),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      filterOptions: {
        statuses: [...validClientStages],
        therapists: therapists.map((item) => ({ id: item.id, name: item.name || item.username })),
      },
    },
  };
}

async function getLegacyClientHistory(user, id) {
  if (!await canSeeClient(user, id)) {
    return { status: 403, body: { error: "لا تملك صلاحية لهذا العميل" } };
  }
  const client = (await listClientRows(user)).map(clientFromRow).find((item) => item.id === id);
  const appointments = (await listClientAppointments(user, id)).map(appointmentFromRow);
  return {
    status: 200,
    body: { client, appointments, files: await listClientFiles(id, user.tenantId), crmEvents: await listClientCrmEvents(id, user.tenantId) },
  };
}

export async function getClientHistory(user, id) {
  const patientRow = await findClientProfileRow(user, id);
  if (!patientRow) return { status: 404, body: { error: "Patient not found." } };
  await expirePatientConsents(user.tenantId, id);

  const includeClinical = permissions.clients_clinical_read.includes(user.role);
  const includeFinancial = permissions.clients_financial_read.includes(user.role);
  const [appointmentRows, crmEvents, rawFiles, consents, patientConsents, clinicalVisitRows, availableConsentTemplates] = await Promise.all([
    listClientAppointments(user, id),
    listClientCrmEvents(id, user.tenantId),
    listClientFiles(id, user.tenantId),
    listClientConsentSignatures(id, user.tenantId),
    listClientPatientConsents(id, user.tenantId),
    listClientClinicalVisits(user, id),
    listConsentTemplates(user.tenantId),
  ]);
  const files = rawFiles.map((file) => includeClinical
    ? { ...file, canDownload: true }
    : (({ notes, url, ...safeFile }) => ({ ...safeFile, canDownload: false }))(file));
  const appointments = appointmentRows.map((row) => appointmentFromRow(row, { includeClinical, includeFinancial }));
  const today = localDate();
  const upcomingAppointment = appointments
    .filter((item) => item.status === "pending" && item.date >= today)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] || null;
  const recentAppointment = appointments
    .filter((item) => item.status === "done" && item.date <= today)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0] || null;
  const visibleCrmEvents = crmEvents.filter((event) => includeClinical || event.type !== "note");
  const timeline = patientTimeline({
    patientRow,
    appointmentRows,
    crmEvents,
    files,
    consents,
    patientConsents,
    includeClinical,
    includeFinancial,
  });

  return {
    status: 200,
    body: {
      patient: patientProfileFromRow(patientRow, includeClinical),
      client: clientFromRow(patientRow, { includeClinical }),
      appointments,
      upcomingAppointment,
      recentAppointment,
      files,
      consentSignatures: consents,
      patientConsents,
      availableConsentTemplates,
      clinicalVisits: clinicalVisitRows.map((row) => clinicalVisitFromRow(row, includeClinical)),
      crmEvents: visibleCrmEvents,
      timeline,
      indicators: {
        appointmentCount: appointments.length,
        completedCount: appointments.filter((item) => item.status === "done").length,
        fileCount: files.length,
        consentCount: patientConsents.length || consents.length,
        clinicalVisitCount: clinicalVisitRows.length,
      },
      capabilities: {
        clinicalNotes: includeClinical,
        clinicalVisits: includeClinical,
        financial: includeFinancial,
        write: permissions.clients_write.includes(user.role),
        consentAssign: permissions.patient_consents_write.includes(user.role),
        consentSign: permissions.consents.includes(user.role),
        fileUpload: permissions.client_files_write.includes(user.role),
        fileDownload: permissions.client_files_read.includes(user.role),
        fileDelete: permissions.client_files_delete.includes(user.role),
      },
    },
  };
}

export async function addClient(user, body) {
  if (!hasRequiredFields(body, ["fname", "lname", "phone"])) {
    return { status: 400, body: { error: "First name, last name, and phone are required." } };
  }
  const stageValidation = validateClientStage(body);
  if (stageValidation) return stageValidation;
  const duplicate = await findDuplicateClient(user.tenantId, body.phone, body.email);
  if (duplicate) {
    return {
      status: 409,
      body: {
        error: "Patient with this phone or email already exists.",
        code: "CLIENT_DUPLICATE",
        existingPatientId: duplicate.id,
      },
    };
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
  const stageValidation = validateClientStage(body);
  if (stageValidation) return stageValidation;
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

export async function addClientNote(user, id, body) {
  if (!await canSeeClient(user, id)) {
    return { status: 404, body: { error: "Client not found" } };
  }
  const note = String(body.note || body.description || "").trim();
  if (!note) {
    return { status: 400, body: { error: "Note is required." } };
  }
  await addCrmEvent({ tenantId: user.tenantId, clientId: id, userId: user.id, type: "note", description: note });
  await auditClient(user.id, "note", id, user.tenantId);
  return { status: 201, body: { ok: true } };
}

export async function removeClient(user, id) {
  const changes = await archiveClient(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "Client not found" } };
  await archiveClientAppointments(id, user.tenantId);
  await auditClient(user.id, "archive", id, user.tenantId);
  return { status: 200, body: { ok: true } };
}
