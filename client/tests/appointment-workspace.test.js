import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarDates,
  filterWorkspaceAppointments,
  moveWorkspaceDate,
  renderAppointmentDetails,
  renderAppointmentWorkspace,
  scheduledQueue,
} from "../appointment-workspace.js";

const appointments = [
  { id: 1, clientId: 10, clientName: "Ari Cohen", serviceId: 20, serviceName: "Consultation", therapistId: 30, therapistName: "Sara", date: "2035-09-12", time: "09:00", duration: 45, status: "pending", notes: "First visit" },
  { id: 2, clientId: 11, clientName: "Maya Levi", serviceId: 21, serviceName: "Follow-up", therapistId: 31, therapistName: "Lina", date: "2035-09-12", time: "10:00", duration: 30, status: "done", notes: "" },
  { id: 3, clientId: 12, clientName: "Noa Shaham", serviceId: 20, serviceName: "Consultation", therapistId: 30, therapistName: "Sara", date: "2035-09-13", time: "11:00", duration: 45, status: "cancelled", notes: "" },
];

test("calendar navigation produces stable day and week ranges", () => {
  assert.deepEqual(calendarDates("2035-09-12", "day").map((date) => date.toISOString().slice(0, 10)), ["2035-09-12"]);
  assert.equal(calendarDates("2035-09-12", "week").length, 7);
  assert.equal(moveWorkspaceDate("2035-09-12", "day", 1), "2035-09-13");
  assert.equal(moveWorkspaceDate("2035-09-12", "week", -1), "2035-09-05");
});

test("workspace filters compose across staff, status, service, and range", () => {
  const filtered = filterWorkspaceAppointments(appointments, { staff: "30", status: "pending", service: "20" }, "2035-09-12", "day");
  assert.deepEqual(filtered.map((item) => item.id), [1]);
  assert.deepEqual(scheduledQueue(appointments, "2035-09-12").map((item) => item.id), [1]);
});

test("workspace renders loading, error, empty, desktop, mobile, and queue states", () => {
  assert.match(renderAppointmentWorkspace({ language: "en", status: "loading" }), /aria-busy="true"/);
  const error = renderAppointmentWorkspace({ language: "en", status: "error", error: "Network unavailable" });
  assert.match(error, /data-workspace-retry/);
  assert.match(error, /Network unavailable/);

  const ready = renderAppointmentWorkspace({
    language: "en",
    status: "ready",
    date: "2035-09-12",
    view: "week",
    appointments,
    queue: scheduledQueue(appointments, "2035-09-12"),
    users: [{ id: 30, name: "Sara" }, { id: 31, name: "Lina" }],
    services: [{ id: 20, name: "Consultation" }, { id: 21, name: "Follow-up" }],
  });
  assert.match(ready, /workspace-desktop-calendar/);
  assert.match(ready, /workspace-mobile-agenda/);
  assert.match(ready, /workspace-queue/);
  assert.match(ready, /data-appointment-details="1"/);

  const empty = renderAppointmentWorkspace({ language: "en", status: "ready", date: "2035-09-12", appointments: [], queue: [] });
  assert.match(empty, /workspace-empty-banner/);
  assert.match(empty, /workspace-queue-empty/);
});

test("day view positions real appointments on the time grid and shows current time", () => {
  const day = renderAppointmentWorkspace({
    language: "en",
    status: "ready",
    date: "2035-09-12",
    view: "day",
    appointments,
    users: [{ id: 30, name: "Sara" }, { id: 31, name: "Lina" }],
    services: [{ id: 20, name: "Consultation" }, { id: 21, name: "Follow-up" }],
    settings: { workStart: "08:00", workEnd: "18:00" },
    now: new Date("2035-09-12T09:30:00"),
  });
  assert.match(day, /workspace-day-timeline/);
  assert.match(day, /workspace-now-line/);
  assert.match(day, /timeline-appointment/);
  assert.match(day, /top:63px;height:48px/);
});

test("read-only detail drawer exposes required fields and escapes stored content", () => {
  const drawer = renderAppointmentDetails({
    language: "en",
    appointment: { ...appointments[0], clientName: '<img src=x onerror="alert(1)">' },
  });
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /Consultation/);
  assert.match(drawer, /First visit/);
  assert.match(drawer, /data-appointment-patient="10"/);
  assert.doesNotMatch(drawer, /<img src=x/);
  assert.match(drawer, /&lt;img/);
  assert.doesNotMatch(drawer, /<form|data-edit=/);
});
