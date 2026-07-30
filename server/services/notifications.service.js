import {
  appointmentNotificationContext,
  countUnreadNotifications,
  createNotification,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  recipientIdsForRoles,
} from "../repositories/notifications.repository.js";

function safeText(value, max = 300) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function notifyRecipients({
  tenantId,
  recipientIds,
  type,
  title,
  message,
  relatedEntityType,
  relatedEntityId,
}) {
  const ids = [...new Set(recipientIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const created = [];
  for (const userId of ids) {
    const id = await createNotification({
      tenantId,
      userId,
      type: safeText(type, 80),
      title: safeText(title, 160),
      message: safeText(message, 500),
      relatedEntityType: safeText(relatedEntityType, 80) || null,
      relatedEntityId: relatedEntityId || null,
    });
    if (id) created.push(id);
  }
  return created;
}

export async function getNotifications(user) {
  const [items, unreadCount] = await Promise.all([
    listUserNotifications(user),
    countUnreadNotifications(user),
  ]);
  return { status: 200, body: { items, unreadCount } };
}

export async function readNotification(user, id) {
  const changes = await markNotificationRead(id, user);
  if (!changes) return { status: 404, body: { error: "Notification not found." } };
  return { status: 200, body: { ok: true, unreadCount: await countUnreadNotifications(user) } };
}

export async function readAllNotifications(user) {
  await markAllNotificationsRead(user);
  return { status: 200, body: { ok: true, unreadCount: 0 } };
}

export async function notifyAppointmentAssigned({ tenantId, appointmentId }) {
  const appointment = await appointmentNotificationContext(appointmentId, tenantId);
  if (!appointment) return [];
  return notifyRecipients({
    tenantId,
    recipientIds: [appointment.therapistId],
    type: "appointment_assigned",
    title: "New appointment assigned",
    message: `Appointment with ${appointment.clientName} on ${appointment.date} at ${appointment.time}.`,
    relatedEntityType: "appointment",
    relatedEntityId: appointment.id,
  });
}

async function appointmentOperationalRecipients(tenantId, therapistId, actorUserId) {
  const operational = await recipientIdsForRoles(tenantId, ["admin", "reception"], { excludeUserId: actorUserId });
  return [...operational, Number(therapistId)].filter((id) => id !== Number(actorUserId));
}

export async function notifyAppointmentRescheduled({ tenantId, appointmentId, actorUserId }) {
  const appointment = await appointmentNotificationContext(appointmentId, tenantId);
  if (!appointment) return [];
  return notifyRecipients({
    tenantId,
    recipientIds: await appointmentOperationalRecipients(tenantId, appointment.therapistId, actorUserId),
    type: "appointment_rescheduled",
    title: "Appointment rescheduled",
    message: `Appointment with ${appointment.clientName} moved to ${appointment.date} at ${appointment.time}.`,
    relatedEntityType: "appointment",
    relatedEntityId: appointment.id,
  });
}

export async function notifyAppointmentStatusChanged({
  tenantId,
  appointmentId,
  actorUserId,
  previousStatus,
  status,
  appointment: suppliedAppointment = null,
}) {
  const appointment = suppliedAppointment || await appointmentNotificationContext(appointmentId, tenantId);
  if (!appointment) return [];
  const cancelled = status === "cancelled";
  return notifyRecipients({
    tenantId,
    recipientIds: await appointmentOperationalRecipients(tenantId, appointment.therapistId, actorUserId),
    type: cancelled ? "appointment_cancelled" : "appointment_status_changed",
    title: cancelled ? "Appointment cancelled" : "Appointment status changed",
    message: cancelled
      ? `Appointment with ${safeText(appointment.clientName)} on ${appointment.date} at ${appointment.time} was cancelled.`
      : `Appointment status changed from ${safeText(previousStatus)} to ${safeText(status)}.`,
    relatedEntityType: "appointment",
    relatedEntityId: appointmentId,
  });
}

export async function notifyConsentPending({ tenantId, appointmentId, clientId }) {
  const appointment = appointmentId
    ? await appointmentNotificationContext(appointmentId, tenantId)
    : null;
  const operational = await recipientIdsForRoles(tenantId, ["admin", "reception"]);
  return notifyRecipients({
    tenantId,
    recipientIds: [...operational, ...(appointment?.therapistId ? [appointment.therapistId] : [])],
    type: "consent_pending",
    title: "Consent pending",
    message: appointment
      ? `Consent is pending before the appointment on ${appointment.date} at ${appointment.time}.`
      : "A patient consent is pending.",
    relatedEntityType: appointment ? "appointment" : "patient",
    relatedEntityId: appointment?.id || clientId,
  });
}

export async function notifyClinicalVisitCompleted({ user, visit }) {
  const recipientIds = await recipientIdsForRoles(user.tenantId, ["admin", "reception"], { excludeUserId: user.id });
  return notifyRecipients({
    tenantId: user.tenantId,
    recipientIds,
    type: "clinical_visit_completed",
    title: "Clinical visit completed",
    message: `Clinical visit for appointment #${visit.appointment_id} was completed.`,
    relatedEntityType: "appointment",
    relatedEntityId: visit.appointment_id,
  });
}

export async function notifyFollowUpRequired({ tenantId, therapistId, clientId, appointmentId = null }) {
  return notifyRecipients({
    tenantId,
    recipientIds: [therapistId],
    type: "follow_up_required",
    title: "Follow-up required",
    message: appointmentId
      ? `Follow-up is required after appointment #${appointmentId}.`
      : "Patient follow-up is required.",
    relatedEntityType: appointmentId ? "appointment" : "patient",
    relatedEntityId: appointmentId || clientId,
  });
}
