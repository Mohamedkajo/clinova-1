import assert from "node:assert/strict";
import test from "node:test";

import { renderClinicalVisit } from "../clinical-visit.js";
import { renderPatientProfile } from "../patient-workspace.js";

const data = {
  appointment: {
    id: 7,
    patientName: "Clinical Patient",
    patientPhone: "0500000000",
    therapistName: "Sara",
    serviceName: "Consultation",
    date: "2038-07-14",
    time: "10:00",
  },
  visit: {
    id: 9,
    appointmentId: 7,
    status: "draft",
    treatmentSummary: "Treatment summary",
    clinicalObservations: "Observation",
    recommendations: "Recommendation",
    followUpInstructions: "Follow up",
    internalNotes: "Internal",
  },
  capabilities: { sensitive: true, write: true, complete: true },
};

test("clinical visit editor renders persisted fields, draft actions, and localized mobile-safe structure", () => {
  const markup = renderClinicalVisit({ language: "en", data });
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /name="treatmentSummary"/);
  assert.match(markup, /Treatment summary/);
  assert.match(markup, /data-complete-clinical-visit="9"/);
  assert.match(markup, /does not implicitly change the appointment status/i);
  assert.match(renderClinicalVisit({ language: "ar", data }), /الزيارة السريرية/);
  assert.match(renderClinicalVisit({ language: "he", data }), /ביקור קליני/);
});

test("clinical visit editor escapes every clinical field and duplicate-submit state disables actions", () => {
  const markup = renderClinicalVisit({
    language: "en",
    data: {
      ...data,
      visit: { ...data.visit, treatmentSummary: '<img src=x onerror="alert(1)">' },
    },
    saving: true,
  });
  assert.doesNotMatch(markup, /<img src=x/);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /disabled/);
});

test("reception sees occurrence metadata without sensitive clinical content", () => {
  const markup = renderClinicalVisit({
    language: "en",
    data: { ...data, capabilities: { sensitive: false, write: false, complete: false } },
  });
  assert.match(markup, /clinical visit record exists/i);
  assert.match(markup, /restricted for your role/);
  assert.doesNotMatch(markup, /Treatment summary/);
  assert.doesNotMatch(markup, /<textarea/);
});

test("patient profile clinical section respects content capability and escapes persisted data", () => {
  const base = {
    patient: { name: "Patient", firstName: "P", lastName: "T", tags: [] },
    capabilities: { clinicalVisits: true },
    indicators: {},
    clinicalVisits: [{
      id: 9,
      appointmentId: 7,
      serviceName: "Consultation",
      therapistName: "Sara",
      visitDate: "2038-07-14",
      visitTime: "10:00",
      status: "draft",
      treatmentSummary: "<script>alert(1)</script>",
    }],
  };
  const clinical = renderPatientProfile({ language: "en", data: base });
  assert.match(clinical, /Clinical visits/);
  assert.match(clinical, /&lt;script&gt;/);
  assert.doesNotMatch(clinical, /<script>/);

  const restricted = renderPatientProfile({
    language: "en",
    data: { ...base, capabilities: { clinicalVisits: false }, clinicalVisits: [{ ...base.clinicalVisits[0], treatmentSummary: undefined }] },
  });
  assert.match(restricted, /restricted for your role/);
  assert.doesNotMatch(restricted, /&lt;script&gt;/);
});
