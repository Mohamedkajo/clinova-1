import { renderReminderMessage, sendWhatsAppText, whatsappFallbackUrl } from "../whatsapp.js";
import {
  auditWhatsApp,
  clinicSettings,
  listAppointmentRows,
  listGiftCards,
  listMessageLogs,
  logMessage,
  tenantBillingSnapshot,
} from "../repositories/whatsapp.repository.js";

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

export async function getMessageLogs(user) {
  return { status: 200, body: { messageLogs: await listMessageLogs(user.tenantId) } };
}

export async function sendAppointmentReminder(user, id) {
  const appointment = (await listAppointmentRows(user)).map(appointmentFromRow).find((item) => item.id === id);
  if (!appointment) return { status: 404, body: { error: "התור לא נמצא" } };
  const settings = await clinicSettings(user.tenantId);
  const message = renderReminderMessage(appointment, settings);
  const result = await sendTenantWhatsApp({ user, entity: "appointments", entityId: id, to: appointment.clientPhone, message });
  await auditWhatsApp(user.id, result.ok ? "whatsapp_sent" : "whatsapp_fallback", "appointments", id, {
    tenantId: user.tenantId,
    configured: result.configured !== false,
    dryRun: Boolean(result.dryRun),
    messageId: result.messageId || "",
  });
  return {
    status: 200,
    body: {
      ...result,
      fallbackUrl: result.fallbackUrl || whatsappFallbackUrl(appointment.clientPhone, message),
    },
  };
}

export async function sendGiftWhatsApp(user, id) {
  const gift = (await listGiftCards(user.tenantId)).find((item) => item.id === id);
  if (!gift) return { status: 404, body: { error: "Gift card not found." } };
  const message = `🎁 ${gift.toClientName || ""}, קיבלת מתנה מ-${gift.fromClientName || "Clinova"}: ${gift.sessions} جلسة ${gift.serviceName || ""}. קוד המתנה: ${gift.code}. ${gift.message || ""}`;
  const settings = await clinicSettings(user.tenantId);
  const finalMessage = renderTemplate(settings.whatsappGiftTemplate || message, {
    from: gift.fromClientName || settings.clinicName || "Clinova",
    to: gift.toClientName || "",
    sessions: gift.sessions,
    service: gift.serviceName || "",
    code: gift.code,
    message: gift.message || "",
  });
  const sent = await sendTenantWhatsApp({ user, entity: "gift_cards", entityId: id, to: gift.toClientPhone, message: finalMessage });
  await auditWhatsApp(user.id, sent.ok ? "gift_whatsapp_sent" : "gift_whatsapp_fallback", "gift_cards", id, { tenantId: user.tenantId });
  return {
    status: 200,
    body: { ...sent, fallbackUrl: sent.fallbackUrl || whatsappFallbackUrl(gift.toClientPhone, finalMessage) },
  };
}
