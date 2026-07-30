import { clinicSettings } from "../repositories/settings.repository.js";
import {
  activeReminder,
  auditReminder,
  cancelAppointmentReminders,
  cancelTenantActiveReminders,
  createAppointmentReminder,
  listAppointmentReminders,
  markDueRemindersReady,
  markReminderSimulatedSent,
  readyReminders,
  reminderAppointmentContext,
  reminderForSchedule,
  upcomingReminderAppointments,
} from "../repositories/reminders.repository.js";
import { isValidTime } from "../shared/validation/date-time.js";

function configuredNow() {
  const value = String(process.env.CLINOVA_TEST_NOW || "").trim();
  const parsed = value ? new Date(value.replace(" ", "T")) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function appointmentDate(date, time) {
  const match = `${date} ${time}`.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && !/^0+$/.test(digits);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function reminderConfiguration(settings) {
  const timing = Number(settings.reminderTimingHours || 24);
  return {
    enabled: String(settings.appointmentRemindersEnabled || "true") === "true",
    timingHours: Number.isInteger(timing) && timing >= 1 && timing <= 168 ? timing : 24,
    sameDayEnabled: String(settings.sameDayReminderEnabled || "false") === "true",
    sameDayTime: isValidTime(settings.sameDayReminderTime) ? settings.sameDayReminderTime.slice(0, 5) : "08:00",
    channel: settings.reminderChannel === "email" ? "email" : "whatsapp",
  };
}

function contactFor(appointment, channel) {
  if (channel === "email") return validEmail(appointment.email) ? String(appointment.email).trim() : null;
  return validPhone(appointment.phone) ? String(appointment.phone).trim() : null;
}

async function cancelWithAudit({ tenantId, appointmentId, actorUserId, reason }) {
  const cancelled = await cancelAppointmentReminders(tenantId, appointmentId);
  for (const reminder of cancelled) {
    await auditReminder(actorUserId, "cancel", reminder.id, tenantId, {
      appointmentId,
      reminderType: reminder.reminderType,
      reason,
    });
  }
  return cancelled;
}

export async function cancelRemindersForAppointment({
  tenantId,
  appointmentId,
  actorUserId,
  reason = "appointment_cancelled",
}) {
  return cancelWithAudit({ tenantId, appointmentId, actorUserId, reason });
}

export async function syncAppointmentReminders({
  tenantId,
  appointmentId,
  actorUserId,
  replace = false,
}) {
  const appointment = await reminderAppointmentContext(appointmentId, tenantId);
  if (!appointment || appointment.status !== "pending") {
    await cancelWithAudit({ tenantId, appointmentId, actorUserId, reason: "appointment_not_pending" });
    return [];
  }
  if (replace) {
    await cancelWithAudit({ tenantId, appointmentId, actorUserId, reason: "appointment_rescheduled" });
  }

  const configuration = reminderConfiguration(await clinicSettings(tenantId));
  if (!configuration.enabled) {
    await cancelWithAudit({ tenantId, appointmentId, actorUserId, reason: "reminders_disabled" });
    return [];
  }
  const recipient = contactFor(appointment, configuration.channel);
  if (!recipient) {
    await cancelWithAudit({ tenantId, appointmentId, actorUserId, reason: "invalid_recipient" });
    return [];
  }
  const startsAt = appointmentDate(appointment.date, appointment.time);
  const now = configuredNow();
  if (!startsAt || startsAt <= now) return [];

  const windows = [{
    reminderType: "24h",
    scheduledFor: new Date(startsAt.getTime() - (configuration.timingHours * 60 * 60 * 1000)),
  }];
  if (configuration.sameDayEnabled) {
    windows.push({
      reminderType: "same_day",
      scheduledFor: appointmentDate(appointment.date, configuration.sameDayTime),
    });
  }

  const created = [];
  for (const window of windows) {
    if (!window.scheduledFor || window.scheduledFor >= startsAt) continue;
    const scheduledFor = window.scheduledFor.toISOString();
    const sameSchedule = await reminderForSchedule(
      tenantId,
      appointmentId,
      window.reminderType,
      scheduledFor,
    );
    if (sameSchedule) {
      created.push(sameSchedule);
      continue;
    }
    const existing = await activeReminder(tenantId, appointmentId, window.reminderType);
    if (existing) {
      created.push(existing);
      continue;
    }
    const status = window.scheduledFor <= now ? "ready" : "pending";
    let id;
    try {
      id = await createAppointmentReminder({
        tenantId,
        appointmentId,
        reminderType: window.reminderType,
        channel: configuration.channel,
        recipient,
        scheduledFor,
        status,
        createdBy: actorUserId,
      });
    } catch (error) {
      const duplicate = await activeReminder(tenantId, appointmentId, window.reminderType);
      if (duplicate) {
        created.push(duplicate);
        continue;
      }
      throw error;
    }
    await auditReminder(actorUserId, "create", id, tenantId, {
      appointmentId,
      reminderType: window.reminderType,
      channel: configuration.channel,
      scheduledFor,
    });
    created.push(await activeReminder(tenantId, appointmentId, window.reminderType));
  }
  return created.filter(Boolean);
}

export async function syncTenantReminders({ tenantId, actorUserId, replace = false }) {
  const now = configuredNow();
  if (replace) {
    const cancelled = await cancelTenantActiveReminders(tenantId);
    for (const reminder of cancelled) {
      await auditReminder(actorUserId, "cancel", reminder.id, tenantId, {
        appointmentId: reminder.appointmentId,
        reason: "settings_changed",
      });
    }
  }
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const appointments = await upcomingReminderAppointments(tenantId, date);
  for (const appointment of appointments) {
    await syncAppointmentReminders({
      tenantId,
      appointmentId: appointment.id,
      actorUserId,
      replace: false,
    });
  }
  return listAppointmentReminders(tenantId);
}

export async function getReminders(user) {
  return { status: 200, body: { items: await listAppointmentReminders(user.tenantId) } };
}

export async function prepareReminders(user) {
  const items = await syncTenantReminders({ tenantId: user.tenantId, actorUserId: user.id });
  return { status: 200, body: { items } };
}

export async function simulateReminderDispatch(user) {
  const now = configuredNow().toISOString();
  await markDueRemindersReady(user.tenantId, now);
  const ready = await readyReminders(user.tenantId);
  const sent = [];
  for (const reminder of ready) {
    if (!await markReminderSimulatedSent(reminder.id, user.tenantId)) continue;
    await auditReminder(user.id, "simulated_dispatch", reminder.id, user.tenantId, {
      appointmentId: reminder.appointmentId,
      channel: reminder.channel,
    });
    sent.push(reminder.id);
  }
  return { status: 200, body: { simulated: sent.length, reminderIds: sent } };
}

export function hasReminderSettingChanges(body) {
  return [
    "appointmentRemindersEnabled",
    "reminderTimingHours",
    "sameDayReminderEnabled",
    "sameDayReminderTime",
    "reminderChannel",
  ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

export function validateReminderSettings(body) {
  if (Object.prototype.hasOwnProperty.call(body, "appointmentRemindersEnabled")
      && !["true", "false"].includes(String(body.appointmentRemindersEnabled))) {
    return "Invalid appointment reminder setting.";
  }
  if (Object.prototype.hasOwnProperty.call(body, "sameDayReminderEnabled")
      && !["true", "false"].includes(String(body.sameDayReminderEnabled))) {
    return "Invalid same-day reminder setting.";
  }
  if (Object.prototype.hasOwnProperty.call(body, "reminderChannel")
      && !["whatsapp", "email"].includes(String(body.reminderChannel))) {
    return "Invalid reminder channel.";
  }
  if (Object.prototype.hasOwnProperty.call(body, "reminderTimingHours")) {
    const hours = Number(body.reminderTimingHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) return "Reminder timing must be between 1 and 168 hours.";
  }
  if (Object.prototype.hasOwnProperty.call(body, "sameDayReminderTime")
      && !isValidTime(body.sameDayReminderTime)) {
    return "Invalid same-day reminder time.";
  }
  return null;
}
