import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { emptyPatientFilters, renderPatientProfile, renderPatientWorkspace } from "../patient-workspace.js";

const patient = { id: 41, name: "Maya Levi", phone: "0501234567", email: "maya@example.test", stage: "active", therapist: { id: 3, name: "Sara" }, lastAppointmentDate: "2035-08-01", nextAppointmentDate: "2035-09-12" };

function workspace(overrides = {}) {
  return {
    status: "ready",
    error: "",
    filters: { ...emptyPatientFilters },
    data: { items: [patient], page: 1, pageSize: 20, total: 1, totalPages: 1, filterOptions: { statuses: ["active"], therapists: [{ id: 3, name: "Sara" }] } },
    ...overrides,
  };
}

test("patient list renders loading, error, empty, desktop, mobile, filters, and pagination states", () => {
  assert.match(renderPatientWorkspace({ language: "en", workspace: workspace({ status: "loading" }) }), /aria-busy="true"/);
  assert.match(renderPatientWorkspace({ language: "en", workspace: workspace({ status: "error", error: "Network unavailable" }) }), /data-patient-retry/);
  assert.match(renderPatientWorkspace({ language: "en", workspace: workspace({ data: { items: [], page: 1, total: 0, totalPages: 0, filterOptions: { statuses: [], therapists: [] } } }) }), /No patients match/);
  const ready = renderPatientWorkspace({ language: "en", workspace: workspace(), canManage: true });
  assert.match(ready, /data-patient-search/);
  assert.match(ready, /patient-table-wrap/);
  assert.match(ready, /patient-mobile-list/);
  assert.match(ready, /data-profile="41"/);
  assert.match(ready, /data-patient-page/);
  assert.match(ready, /data-edit="clients"/);
});

test("patient list and profile escape stored content and hide management actions for therapists", () => {
  const hostile = { ...patient, name: '<img src=x onerror="alert(1)">' };
  const list = renderPatientWorkspace({ language: "ar", workspace: workspace({ data: { ...workspace().data, items: [hostile] } }), canManage: false });
  assert.doesNotMatch(list, /<img src=x/);
  assert.match(list, /&lt;img/);
  assert.doesNotMatch(list, /data-edit="clients"|data-delete="clients"/);

  const profile = renderPatientProfile({ language: "he", data: {
    patient: { ...hostile, firstName: "Maya", lastName: "Levi", tags: [], notes: "Clinical" },
    upcomingAppointment: { id: 7, serviceName: "Consultation", date: "2035-09-12", time: "09:00", status: "pending" },
    recentAppointment: null, appointments: [], files: [],
    timeline: [{ id: "appointment-7", type: "appointment", occurredAt: "2035-09-12T09:00:00", description: '<script>alert(1)</script>', related: { appointmentId: 7 } }],
    indicators: {}, capabilities: { clinicalNotes: false, financial: false, write: false },
  } });
  assert.match(profile, /patient-profile-panel/);
  assert.match(profile, /data-patient-appointment-details="7"/);
  assert.doesNotMatch(profile, /<script>alert/);
  assert.doesNotMatch(profile, /Clinical|clientNoteForm|clientFileForm/);
});

test("appointment details patient action remains integrated with the patient profile", async () => {
  const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /data-appointment-patient/);
  assert.match(appSource, /openClientProfile\(Number\(patientButton\.dataset\.appointmentPatient\)\)/);
  assert.match(appSource, /api\(`\/api\/clients\/\$\{id\}\/history`\)/);
});

test("patient consents and protected clinical files render safely in RTL and 390px layout", async () => {
  const profile = renderPatientProfile({
    language: "ar",
    data: {
      patient: { ...patient, firstName: "Maya", lastName: "Levi", tags: [] },
      appointments: [],
      clinicalVisits: [],
      patientConsents: [{
        id: 9,
        templateId: 3,
        templateTitle: '<img src=x onerror="alert(1)">',
        status: "pending",
        createdAt: "2035-09-12",
      }],
      availableConsentTemplates: [{ id: 3, title: "موافقة العلاج" }],
      files: [{
        id: 4,
        name: '<script>alert(1)</script>',
        category: "diagnostic",
        createdAt: "2035-09-12",
        uploaderName: "Sara",
        canDownload: false,
      }],
      timeline: [],
      indicators: {},
      capabilities: {
        clinicalNotes: false,
        clinicalVisits: false,
        consentAssign: true,
        consentSign: true,
        fileUpload: false,
        fileDelete: false,
      },
    },
  });
  assert.match(profile, /الموافقات/);
  assert.match(profile, /data-patient-consent-sign="9"/);
  assert.match(profile, /patientConsentAssignForm/);
  assert.match(profile, /diagnostic/);
  assert.doesNotMatch(profile, /href="undefined"|<img src=x|<script>alert/);

  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.patient-inline-form \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.patient-consent-list/);
});
