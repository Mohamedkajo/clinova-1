import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderBookingWorkflow } from "../booking-workflow.js";
import { renderPatientProfile } from "../patient-workspace.js";

const services = [{ id: 1, name: "Consultation", duration: 30 }];
const therapists = [{ id: 4, name: "Sara Therapist" }];
const values = { serviceId: 1, therapistId: 4, date: "2038-04-10", time: "09:30" };

test("booking and patient dialogs expose accessible labels, required state, and feedback", () => {
  const booking = renderBookingWorkflow({
    language: "en",
    services,
    therapists,
    values,
    selectedPatient: { id: 1, name: "Noa Example" },
    success: "Patient created and selected.",
  });
  assert.match(booking, /role="dialog" aria-modal="true"/);
  assert.match(booking, /for="bookingPatientSearch"/);
  assert.match(booking, /id="bookingService"/);
  assert.match(booking, /aria-required="true"/);
  assert.match(booking, /class="required-marker"/);
  assert.match(booking, /role="status" aria-live="polite"/);

  const searching = renderBookingWorkflow({ language: "en", services, therapists, values, searching: true });
  assert.match(searching, /type="submit" disabled aria-disabled="true"/);

  const profile = renderPatientProfile({ language: "en", status: "loading" });
  assert.match(profile, /role="dialog" aria-modal="true"/);
  assert.match(profile, /aria-labelledby="patientProfileTitle"/);
});

test("alpha shell includes focus management, English appointment copy, and styled feedback", async () => {
  const [appSource, styles, packageInfo, version] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../VERSION", import.meta.url), "utf8"),
  ]);
  assert.match(appSource, /function bindModalAccessibility/);
  assert.match(appSource, /event\.key === "Escape"/);
  assert.match(appSource, /if \(state\.page === "calendar"\) void refreshAppointmentWorkspace\(\)/);
  assert.match(appSource, /New patient/);
  assert.match(appSource, /Search appointments\.\.\./);
  assert.match(styles, /\.center-toast/);
  assert.match(styles, /\.form-message/);
  assert.equal(packageInfo.version, "1.8.0-rc.1");
  assert.equal(version.trim(), packageInfo.version);
});
