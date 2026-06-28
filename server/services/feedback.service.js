import { randomUUID } from "node:crypto";
import { sendWhatsAppText, whatsappFallbackUrl } from "../whatsapp.js";
import {
  auditFeedback,
  clinicSettings,
  createFeedbackRequest,
  listAppointmentRows,
  listFeedbackRequests,
  logMessage,
  publicFeedbackByToken,
  submitPublicFeedback,
  tenantBillingSnapshot,
} from "../repositories/feedback.repository.js";

const planCatalog = {
  starter: { name: "Starter", monthlyPrice: 49, maxUsers: 5, maxClients: 200, whatsapp: false, billing: false },
  growth: { name: "Growth", monthlyPrice: 99, maxUsers: 10, maxClients: 2000, whatsapp: true, billing: false },
  scale: { name: "Scale", monthlyPrice: 199, maxUsers: null, maxClients: null, whatsapp: true, billing: true },
};

function renderTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? "")), String(template || ""));
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

async function sendTenantWhatsApp({ user, entity, entityId, to, message }) {
  const billing = await tenantBillingSnapshot(user.tenantId);
  const settings = await clinicSettings(user.tenantId);
  const fallbackUrl = whatsappFallbackUrl(to, message);
  const limits = planCatalog[billing.plan] || planCatalog.starter;
  if (!limits.whatsapp || settings.whatsappEnabled !== "true" || settings.whatsappMode === "fallback") {
    const result = { ok: false, configured: false, fallbackUrl, message: "WhatsApp is in fallback mode for this tenant." };
    await logMessage({ tenantId: user.tenantId, userId: user.id, entity, entityId, recipient: to, message, result });
    return result;
  }
  try {
    const result = await sendWhatsAppText({ to, message });
    const finalResult = { ...result, fallbackUrl: result.fallbackUrl || fallbackUrl };
    await logMessage({ tenantId: user.tenantId, userId: user.id, entity, entityId, recipient: to, message, result: finalResult });
    return finalResult;
  } catch (error) {
    await logMessage({ tenantId: user.tenantId, userId: user.id, entity, entityId, recipient: to, message, result: { fallbackUrl }, error: error.message });
    throw error;
  }
}

export async function getPublicFeedback(token) {
  const row = await publicFeedbackByToken(token);
  if (!row) return { status: 404, body: { error: "Feedback request not found." } };
  return { status: 200, body: row };
}

export async function submitFeedback(token, body) {
  const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
  if (!rating) return { status: 400, body: { error: "Rating is required." } };
  const result = await submitPublicFeedback(token, rating, String(body.comment || ""));
  if (!result.changes) return { status: 404, body: { error: "Feedback request not found." } };
  return { status: 200, body: { ok: true } };
}

export async function getFeedback(user) {
  return { status: 200, body: await listFeedbackRequests(user.tenantId) };
}

export async function createFeedback(user, body, req) {
  const appointment = (await listAppointmentRows(user)).map(appointmentFromRow)
    .find((item) => item.id === Number(body.appointmentId));
  if (!appointment) return { status: 404, body: { error: "Appointment not found." } };

  const token = randomUUID();
  const id = await createFeedbackRequest(user.tenantId, appointment.id, token);
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const link = `${proto}://${host}/feedback.html?token=${encodeURIComponent(token)}`;
  const message = `שלום ${appointment.clientName}, נשמח לקבל חוות דעת קצרה אחרי הטיפול: ${link}`;
  const settings = await clinicSettings(user.tenantId);
  const finalMessage = renderTemplate(settings.whatsappFeedbackTemplate || message, {
    client: appointment.clientName,
    clinic: settings.clinicName || "Clinova",
    service: appointment.serviceName,
    link,
  });
  const sent = await sendTenantWhatsApp({
    user,
    entity: "feedback_requests",
    entityId: id,
    to: appointment.clientPhone,
    message: finalMessage,
  });
  await auditFeedback(user.id, sent.ok ? "feedback_whatsapp_sent" : "feedback_whatsapp_fallback", id, user.tenantId);
  return {
    status: 201,
    body: {
      id,
      ...sent,
      fallbackUrl: sent.fallbackUrl || whatsappFallbackUrl(appointment.clientPhone, finalMessage),
    },
  };
}
