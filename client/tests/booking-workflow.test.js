import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderBookingWorkflow, selectedServiceDuration } from "../booking-workflow.js";
import { renderAppointmentDetails } from "../appointment-workspace.js";

const services = [
  { id: 11, name: "Consultation", duration: 45, active: true },
  { id: 12, name: "Follow-up", duration: 30, active: true },
];
const therapists = [{ id: 21, name: "Sara", role: "therapist" }];
const values = { serviceId: 11, therapistId: 21, date: "2038-04-10", time: "09:00", notes: "" };

test("booking workflow searches, selects, creates, validates, and renders service duration", () => {
  assert.equal(selectedServiceDuration(services, 11), 45);
  const initial = renderBookingWorkflow({ language: "en", services, therapists, values, canCreatePatient: true });
  assert.match(initial, /data-booking-search/);
  assert.match(initial, /Select or create a patient/);
  assert.match(initial, /45 minutes/);
  assert.match(initial, /disabled/);

  const empty = renderBookingWorkflow({ language: "ar", services, therapists, values, searched: true, canCreatePatient: true });
  assert.match(empty, /data-booking-show-create/);
  const create = renderBookingWorkflow({ language: "he", services, therapists, values, searched: true, showCreate: true, canCreatePatient: true });
  assert.match(create, /data-booking-create-patient/);

  const selected = renderBookingWorkflow({
    language: "en",
    services,
    therapists,
    values,
    selectedPatient: { id: 31, name: "Maya Levi", phone: "0501234567" },
  });
  assert.match(selected, /name="clientId" value="31"/);
  assert.match(selected, /Save appointment/);
});

test("booking workflow and status controls escape stored values and respect role UI", () => {
  const hostile = renderBookingWorkflow({
    language: "en",
    services,
    therapists,
    values,
    searched: true,
    canCreatePatient: false,
    patientResults: [{ id: 31, name: '<img src=x onerror="alert(1)">', phone: "0501" }],
  });
  assert.doesNotMatch(hostile, /<img src=x/);
  assert.match(hostile, /&lt;img/);
  assert.doesNotMatch(hostile, /data-booking-show-create|data-booking-create-patient/);

  const drawer = renderAppointmentDetails({
    language: "en",
    canChangeStatus: true,
    appointment: { id: 44, clientId: 31, clientName: "Maya Levi", serviceName: "Consultation", therapistName: "Sara", date: "2038-04-10", time: "09:00", duration: 45, status: "pending" },
  });
  assert.match(drawer, /data-appointment-status-form="44"/);
  assert.match(drawer, /value="pending" selected/);
});

test("app integrates booking save with the shared calendar and queue refresh", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /resource === "appointments" && !id/);
  assert.match(appSource, /api\("\/api\/appointments", \{ method: "POST", body \}\)/);
  assert.match(appSource, /setProtectedRoute\("calendar", \{ render: false \}\)/);
  assert.match(appSource, /await refreshAppointmentWorkspace\(\)/);
  assert.match(appSource, /api\(`\/api\/appointments\/\$\{appointmentId\}\/status`/);
});
