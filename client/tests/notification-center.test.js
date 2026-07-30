import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { notificationTarget, renderNotificationCenter } from "../notification-center.js";

const notification = {
  id: 17,
  type: "appointment_assigned",
  title: "New appointment assigned",
  message: "Appointment with Dana on 2035-09-11 at 10:00.",
  relatedEntityType: "appointment",
  relatedEntityId: 42,
  status: "unread",
  createdAt: "2035-09-10 09:00:00",
};

test("notification bell is accessible and exposes unread state", () => {
  const html = renderNotificationCenter({
    language: "en",
    state: { status: "ready", open: false, items: [notification], unreadCount: 1 },
  });
  assert.match(html, /data-notification-toggle/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /1 unread notification/);
  assert.match(html, /notification-badge[^>]*>1</);
});

test("notification center renders loading, empty, error, retry, and ready states", () => {
  assert.match(renderNotificationCenter({ state: { status: "loading", open: true } }), /role="status"/);
  assert.match(renderNotificationCenter({ state: { status: "ready", open: true, items: [] } }), /No notifications yet/);
  assert.match(renderNotificationCenter({ state: { status: "error", open: true, error: "Offline" } }), /data-notification-retry/);
  const ready = renderNotificationCenter({
    language: "ar",
    state: { status: "ready", open: true, items: [notification], unreadCount: 1 },
  });
  assert.match(ready, /role="dialog"/);
  assert.match(ready, /data-notification-read-all/);
  assert.match(ready, /data-notification-id="17"/);
  assert.match(ready, /الإشعارات/);
});

test("notification payload is escaped and never injected into markup", () => {
  const html = renderNotificationCenter({
    language: "he",
    state: {
      status: "ready",
      open: true,
      unreadCount: 1,
      items: [{
        ...notification,
        title: '<img src=x onerror="alert(1)">',
        message: "</button><script>globalThis.pwned=true</script>",
      }],
    },
  });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.match(html, /התראות/);
});

test("only valid patient and appointment relations resolve to navigation targets", () => {
  assert.deepEqual(notificationTarget(notification), { page: "appointments", id: 42 });
  assert.deepEqual(notificationTarget({ relatedEntityType: "patient", relatedEntityId: "9" }), { page: "clients", id: 9 });
  assert.equal(notificationTarget({ relatedEntityType: "appointment", relatedEntityId: "<script>" }), null);
  assert.equal(notificationTarget({ relatedEntityType: "clinical_note", relatedEntityId: 2 }), null);
});

test("app integration includes reminder settings, APIs, RTL logical CSS, and 390px-safe mobile behavior", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
  ]);
  for (const token of [
    'api("/api/notifications")',
    "/api/notifications/read-all",
    "appointmentRemindersEnabled",
    "reminderTimingHours",
    "sameDayReminderEnabled",
    "sameDayReminderTime",
    "reminderChannel",
  ]) {
    assert.ok(app.includes(token), `missing UI integration token: ${token}`);
  }
  assert.match(styles, /\.notification-popover[\s\S]*inset-inline-end:\s*0/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.notification-popover/);
  assert.match(styles, /\.reminder-settings[\s\S]*grid-template-columns/);
  assert.doesNotMatch(app, /notification[\s\S]{0,80}(clinicalObservations|internalNotes)/);
});
