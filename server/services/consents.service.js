import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { config } from "../config.js";
import { hasValidFileSignature } from "../shared/uploads/file-signatures.js";
import {
  addConsentTimelineEvent,
  archiveConsentTemplate,
  auditConsent,
  clientById,
  consentAppointmentById,
  consentAppointmentExists,
  consentCategoryExists,
  consentServiceExists,
  consentTemplateById,
  consentTemplateMatchesAppointmentService,
  createConsentSignature,
  createConsentTemplate,
  createPatientConsent,
  createSignedClientFile,
  deleteUnlinkedConsentSignature,
  expirePatientConsents,
  findDuplicatePatientConsent,
  findDuplicateSignature,
  listPatientConsents,
  listConsentTemplates,
  patientConsentById,
  signPatientConsentRecord,
  templateHasSignedRecords,
  updateConsentTemplate,
  updatePatientConsentStatus,
  updateClientFileUrl,
  updateConsentTemplateUrl,
} from "../repositories/consents.repository.js";
import { canSeeClient } from "../repositories/files.repository.js";

function pdfSafeText(value) {
  return String(value ?? "").slice(0, 120);
}

const consentFontPaths = [
  resolve("server/assets/fonts/DejaVuSans.ttf"),
  resolve("assets/fonts/DejaVuSans.ttf"),
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\Arial.ttf",
];

async function embedConsentFont(pdf) {
  const fontPath = consentFontPaths.find((candidate) => existsSync(candidate));
  if (fontPath) {
    pdf.registerFontkit(fontkit);
    return { font: await pdf.embedFont(readFileSync(fontPath), { subset: true }), unicode: true };
  }
  return { font: await pdf.embedFont(StandardFonts.Helvetica), unicode: false };
}

function consentFontText(value, unicode) {
  const text = pdfSafeText(value);
  return unicode ? text : text.replace(/[^\x20-\x7E]/g, "?");
}

function consentPdfLabels(lang = "he") {
  if (lang === "ar") {
    return {
      title: "إقرار قانوني موقّع",
      form: "النموذج",
      client: "العميل",
      signer: "الموقّع",
      appointment: "الموعد",
      signedAt: "وقت التوقيع",
      signatureStamp: "ختم التوقيع",
      displayName: "إقرار موقّع",
      notes: "إقرار قانوني موقّع",
    };
  }
  return {
    title: "טופס משפטי חתום",
    form: "טופס",
    client: "לקוח",
    signer: "חותם",
    appointment: "תור",
    signedAt: "נחתם בתאריך",
    signatureStamp: "חותמת חתימה",
    displayName: "טופס חתום",
    notes: "טופס משפטי חתום",
  };
}

function hasValidConsentDocument(template) {
  return Boolean(
    (template?.path && template.mimeType === "application/pdf" && existsSync(template.path))
    || String(template?.consentText || "").trim(),
  );
}

function validPngSignature(value) {
  const match = String(value || "").match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const buffer = Buffer.from(match[1], "base64");
  return hasValidFileSignature({ filename: "signature.png", type: "image/png", buffer });
}

async function createSignedConsentClientFile({
  signatureId, tenantId, templateId, clientId, appointmentId, signerName, signatureData, userId, lang = "he",
}) {
  if (!clientId) return null;
  const template = await consentTemplateById(templateId, tenantId);
  const client = await clientById(clientId, tenantId);
  if (!template || !client || !hasValidConsentDocument(template)) return null;

  const clientDir = resolve(config.uploads.dir, "tenants", String(tenantId), "clients", String(clientId), "consents");
  mkdirSync(clientDir, { recursive: true });
  const fileName = `signed-consent-${signatureId}.pdf`;
  const target = resolve(clientDir, fileName);
  const signedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const labels = consentPdfLabels(lang);
  const pdf = template.path && existsSync(template.path)
    ? await PDFDocument.load(readFileSync(template.path))
    : await PDFDocument.create();
  const { font, unicode } = await embedConsentFont(pdf);
  const page = pdf.addPage();
  const { width, height } = page.getSize();
  page.drawText(consentFontText(labels.title, unicode), { x: 48, y: height - 70, size: 20, font, color: rgb(0.18, 0.42, 0.31) });
  page.drawText(consentFontText(`${labels.form}: ${pdfSafeText(template.title)}`, unicode), { x: 48, y: height - 110, size: 12, font });
  page.drawText(consentFontText(`${labels.client}: ${pdfSafeText(`${client.fname} ${client.lname}`)}`, unicode), { x: 48, y: height - 132, size: 12, font });
  page.drawText(consentFontText(`${labels.signer}: ${pdfSafeText(signerName)}`, unicode), { x: 48, y: height - 154, size: 12, font });
  page.drawText(consentFontText(`${labels.appointment}: ${appointmentId || "-"}`, unicode), { x: 48, y: height - 176, size: 12, font });
  page.drawText(consentFontText(`${labels.signedAt}: ${signedAt}`, unicode), { x: 48, y: height - 198, size: 12, font });
  if (template.consentText) {
    const normalizedText = consentFontText(template.consentText, unicode);
    const lines = normalizedText.match(/.{1,82}(?:\s|$)/g)?.slice(0, 8) || [normalizedText.slice(0, 82)];
    lines.forEach((line, index) => page.drawText(line.trim(), { x: 48, y: height - 220 - (index * 15), size: 9, font }));
  }
  page.drawRectangle({ x: 48, y: height - 385, width: width - 96, height: 145, borderColor: rgb(0.18, 0.42, 0.31), borderWidth: 1 });
  page.drawText(consentFontText(labels.signatureStamp, unicode), { x: 60, y: height - 260, size: 11, font, color: rgb(0.42, 0.55, 0.48) });

  const signatureBytes = Buffer.from(String(signatureData).split(",")[1] || "", "base64");
  if (signatureBytes.length) {
    const image = await pdf.embedPng(signatureBytes);
    const scaled = image.scaleToFit(width - 130, 105);
    page.drawImage(image, { x: 65, y: height - 370, width: scaled.width, height: scaled.height });
  }

  const stampedBytes = await pdf.save();
  writeFileSync(target, stampedBytes);

  const displayName = `${labels.displayName} - ${template.title}`;
  const fileId = await createSignedClientFile({
    tenantId,
    clientId,
    appointmentId,
    name: displayName,
    originalName: fileName,
    storedName: fileName,
    mimeType: "application/pdf",
    size: stampedBytes.length,
    path: target,
    notes: labels.notes,
    uploadedBy: userId,
  });
  const downloadUrl = `/api/client-files/${fileId}/download`;
  await updateClientFileUrl(fileId, downloadUrl);
  return fileId;
}

export async function getConsents(user) {
  return { status: 200, body: await listConsentTemplates(user.tenantId) };
}

const supportedLanguages = new Set(["he", "ar", "en"]);

function optionalPositiveInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
}

function templatePayload(body) {
  return {
    title: String(body.title || "").trim().slice(0, 160),
    description: String(body.description || "").trim().slice(0, 1000),
    consentText: String(body.consentText || "").trim().slice(0, 20000),
    language: String(body.language || "he").toLowerCase(),
    serviceId: optionalPositiveInteger(body.serviceId),
    categoryId: optionalPositiveInteger(body.categoryId),
    expirationDays: optionalPositiveInteger(body.expirationDays),
  };
}

async function validateTemplatePayload(user, body) {
  const data = templatePayload(body);
  if (!data.title || !data.consentText) return { error: "Title and consent text are required." };
  if (!supportedLanguages.has(data.language)) return { error: "Unsupported consent language." };
  if ([data.serviceId, data.categoryId, data.expirationDays].some(Number.isNaN)) return { error: "Invalid consent template reference." };
  if (data.expirationDays && data.expirationDays > 3650) return { error: "Expiration period is too long." };
  if (!await consentCategoryExists(data.categoryId, user.tenantId)) return { error: "Category not found.", status: 404 };
  if (!await consentServiceExists(data.serviceId, user.tenantId)) return { error: "Service not found.", status: 404 };
  return { data };
}

export async function getConsentTemplates(user, includeInactive = false) {
  return { status: 200, body: await listConsentTemplates(user.tenantId, { includeInactive: user.role === "admin" && includeInactive }) };
}

export async function addConsentTemplate(user, body) {
  const validation = await validateTemplatePayload(user, body);
  if (validation.error) return { status: validation.status || 400, body: { error: validation.error } };
  const id = await createConsentTemplate({ tenantId: user.tenantId, userId: user.id, ...validation.data });
  await auditConsent(user.id, "create", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 201, body: await consentTemplateById(id, user.tenantId) };
}

export async function editConsentTemplate(user, id, body) {
  const current = await consentTemplateById(id, user.tenantId, { includeInactive: true });
  if (!current) return { status: 404, body: { error: "Consent template not found." } };
  if (!current.active) return { status: 409, body: { error: "Inactive templates cannot be updated." } };
  const validation = await validateTemplatePayload(user, body);
  if (validation.error) return { status: validation.status || 400, body: { error: validation.error } };

  if (await templateHasSignedRecords(id, user.tenantId)) {
    await archiveConsentTemplate(id, user.tenantId, user.id);
    const newId = await createConsentTemplate({
      tenantId: user.tenantId,
      userId: user.id,
      ...validation.data,
      version: Number(current.version || 1) + 1,
      url: current.url,
      originalName: current.originalName,
      mimeType: current.mimeType,
      size: current.size,
      path: current.path,
    });
    await auditConsent(user.id, "update_version", "consent_templates", newId, { tenantId: user.tenantId, previousTemplateId: id });
    return { status: 200, body: { ...(await consentTemplateById(newId, user.tenantId)), previousTemplateId: id } };
  }

  await updateConsentTemplate(id, user.tenantId, validation.data, user.id);
  await auditConsent(user.id, "update", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 200, body: await consentTemplateById(id, user.tenantId) };
}

export async function deactivateConsentTemplate(user, id) {
  const changes = await archiveConsentTemplate(id, user.tenantId, user.id);
  if (!changes) return { status: 404, body: { error: "Active consent template not found." } };
  await auditConsent(user.id, "deactivate", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 200, body: { ok: true } };
}

export async function getPatientConsents(user, clientId) {
  if (!await canSeeClient(user, clientId)) return { status: 404, body: { error: "Patient not found." } };
  await expirePatientConsents(user.tenantId, clientId);
  return { status: 200, body: await listPatientConsents(clientId, user.tenantId) };
}

export async function assignPatientConsent(user, clientId, body) {
  if (!await canSeeClient(user, clientId)) return { status: 404, body: { error: "Patient not found." } };
  const templateId = optionalPositiveInteger(body.templateId);
  const appointmentId = optionalPositiveInteger(body.appointmentId);
  if (!templateId || Number.isNaN(templateId) || Number.isNaN(appointmentId)) {
    return { status: 400, body: { error: "Valid consent template is required." } };
  }
  const template = await consentTemplateById(templateId, user.tenantId);
  if (!template) return { status: 404, body: { error: "Consent template not found." } };
  const appointment = appointmentId ? await consentAppointmentById(appointmentId, user.tenantId) : null;
  if (appointmentId && (!appointment || Number(appointment.clientId) !== Number(clientId))) {
    return { status: 404, body: { error: "Appointment not found for this patient." } };
  }
  const serviceId = appointment?.serviceId || template.serviceId || null;
  if (appointmentId && !await consentTemplateMatchesAppointmentService({ templateId, appointmentId, tenantId: user.tenantId })) {
    return { status: 400, body: { error: "Consent template does not apply to this appointment service." } };
  }
  await expirePatientConsents(user.tenantId, clientId);
  const duplicate = await findDuplicatePatientConsent({ tenantId: user.tenantId, templateId, clientId, appointmentId, serviceId });
  if (duplicate) return { status: 409, body: { error: "An active patient consent already exists.", id: duplicate.id } };
  let id;
  try {
    id = await createPatientConsent({
      tenantId: user.tenantId, templateId, clientId, appointmentId, serviceId, assignedBy: user.id,
    });
  } catch (error) {
    const concurrentDuplicate = await findDuplicatePatientConsent({
      tenantId: user.tenantId, templateId, clientId, appointmentId, serviceId,
    });
    if (concurrentDuplicate) {
      return {
        status: 409,
        body: { error: "An active patient consent already exists.", id: concurrentDuplicate.id },
      };
    }
    throw error;
  }
  await addConsentTimelineEvent({
    tenantId: user.tenantId, clientId, userId: user.id, appointmentId, type: "consent_assigned",
  });
  await auditConsent(user.id, "assign", "patient_consents", id, { tenantId: user.tenantId, templateId, clientId, appointmentId });
  return { status: 201, body: await patientConsentById(id, user.tenantId) };
}

function expirationDate(days) {
  if (!days) return null;
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + Number(days));
  return expires.toISOString();
}

export async function signAssignedConsent(user, id, body) {
  const assignment = await patientConsentById(id, user.tenantId);
  if (!assignment) return { status: 404, body: { error: "Patient consent not found." } };
  if (!await canSeeClient(user, assignment.clientId)) return { status: 404, body: { error: "Patient consent not found." } };
  if (assignment.status !== "pending") return { status: 409, body: { error: "Only pending consent can be signed." } };
  const template = await consentTemplateById(assignment.templateId, user.tenantId);
  if (!hasValidConsentDocument(template)) {
    return { status: 400, body: { error: "Valid consent document is required." } };
  }
  if (!body.signatureData || !String(body.signatureData).startsWith("data:image/png;base64,")) {
    return { status: 400, body: { error: "A PNG signature is required." } };
  }
  if (!validPngSignature(body.signatureData)) {
    return { status: 400, body: { error: "The signature image is invalid." } };
  }
  const signerName = String(body.signerName || "").trim().slice(0, 160);
  if (!signerName) return { status: 400, body: { error: "Signer name is required." } };
  const witnessUserId = body.witness ? user.id : null;
  const signatureId = await createConsentSignature({
    tenantId: user.tenantId,
    templateId: assignment.templateId,
    clientId: assignment.clientId,
    appointmentId: assignment.appointmentId,
    signerName,
    signatureData: body.signatureData,
  });
  const expiresAt = expirationDate(assignment.expirationDays);
  const signed = await signPatientConsentRecord({ id, tenantId: user.tenantId, signatureId, witnessUserId, expiresAt });
  if (!signed) {
    await deleteUnlinkedConsentSignature(signatureId, user.tenantId);
    return { status: 409, body: { error: "Only pending consent can be signed." } };
  }
  const fileId = await createSignedConsentClientFile({
    signatureId, tenantId: user.tenantId, templateId: assignment.templateId,
    clientId: assignment.clientId, appointmentId: assignment.appointmentId,
    signerName, signatureData: body.signatureData, userId: user.id,
    lang: assignment.language,
  });
  await addConsentTimelineEvent({
    tenantId: user.tenantId, clientId: assignment.clientId, userId: user.id,
    appointmentId: assignment.appointmentId, type: "consent_signed",
  });
  await auditConsent(user.id, "sign", "patient_consents", id, { tenantId: user.tenantId, signatureId, clientFileId: fileId });
  return { status: 200, body: { ...(await patientConsentById(id, user.tenantId)), clientFileId: fileId } };
}

export async function changePatientConsentStatus(user, id, body) {
  const status = String(body.status || "");
  if (!new Set(["declined", "expired"]).has(status)) return { status: 400, body: { error: "Invalid consent status." } };
  const assignment = await patientConsentById(id, user.tenantId);
  if (!assignment) return { status: 404, body: { error: "Patient consent not found." } };
  if (!await canSeeClient(user, assignment.clientId)) return { status: 404, body: { error: "Patient consent not found." } };
  if (!await updatePatientConsentStatus({ id, tenantId: user.tenantId, status })) {
    return { status: 409, body: { error: "Consent status cannot be changed." } };
  }
  await addConsentTimelineEvent({
    tenantId: user.tenantId, clientId: assignment.clientId, userId: user.id,
    appointmentId: assignment.appointmentId, type: `consent_${status}`,
  });
  await auditConsent(user.id, `status_${status}`, "patient_consents", id, { tenantId: user.tenantId });
  return { status: 200, body: await patientConsentById(id, user.tenantId) };
}

export async function signConsent(user, id, body) {
  if (!body.signatureData || !String(body.signatureData).startsWith("data:image/")) {
    return { status: 400, body: { error: "Signature is required." } };
  }
  const clientId = body.clientId || null;
  const appointmentId = body.appointmentId || null;
  const template = await consentTemplateById(id, user.tenantId);
  if (!template) {
    return { status: 404, body: { error: "Consent file not found." } };
  }
  if (!hasValidConsentDocument(template)) {
    return { status: 400, body: { error: "Valid consent document is required." } };
  }
  if (clientId && !await clientById(clientId, user.tenantId)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  if (!await consentAppointmentExists(appointmentId, user.tenantId)) {
    return { status: 404, body: { error: "Appointment not found." } };
  }
  if (!await consentTemplateMatchesAppointmentService({ templateId: id, appointmentId, tenantId: user.tenantId })) {
    return { status: 400, body: { error: "Valid consent document is required for this service." } };
  }
  if (!validPngSignature(body.signatureData)) {
    return { status: 400, body: { error: "A valid PNG signature is required." } };
  }
  const existingSignature = await findDuplicateSignature({
    tenantId: user.tenantId,
    templateId: id,
    clientId,
    appointmentId,
  });
  if (existingSignature) {
    return { status: 409, body: { error: body.lang === "he" ? "נחתם כבר" : "تم التوقيع" } };
  }
  const signatureId = await createConsentSignature({
    tenantId: user.tenantId,
    templateId: id,
    clientId,
    appointmentId,
    signerName: String(body.signerName || ""),
    signatureData: body.signatureData,
    userId: user.id,
  });
  const fileId = await createSignedConsentClientFile({
    signatureId,
    tenantId: user.tenantId,
    templateId: id,
    clientId,
    appointmentId,
    signerName: String(body.signerName || ""),
    signatureData: body.signatureData,
    userId: user.id,
    lang: body.lang === "ar" ? "ar" : "he",
  });
  await auditConsent(user.id, "sign", "consent_templates", id, { tenantId: user.tenantId, signatureId, clientFileId: fileId });
  return { status: 201, body: { id: signatureId, clientFileId: fileId } };
}

export async function getConsentDownload(user, id) {
  const file = await consentTemplateById(id, user.tenantId);
  if (!file) return { status: 404, body: { error: "Consent file not found." } };
  if (!file.path) return { status: 404, body: { error: "Consent file missing from storage." } };
  const tenantRoot = `${resolve(config.uploads.dir, "tenants", String(user.tenantId), "consents")}${sep}`;
  const legacyRoot = `${resolve(config.uploads.dir, "consents")}${sep}`;
  const resolvedPath = resolve(file.path);
  if (!resolvedPath.startsWith(tenantRoot) && !resolvedPath.startsWith(legacyRoot)) {
    await auditConsent(user.id, "download_blocked", "consent_templates", id, {
      tenantId: user.tenantId,
      reason: "invalid_storage_path",
    });
    return { status: 403, body: { error: "Stored consent path is invalid." } };
  }
  if (!existsSync(resolvedPath)) return { status: 404, body: { error: "Consent file missing from storage." } };
  await auditConsent(user.id, "download", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 200, file, buffer: readFileSync(resolvedPath) };
}

export async function uploadConsent(user, multipart) {
  const file = multipart.files.file;
  if (!file || file.buffer.length === 0) {
    return { status: 400, body: { error: "Choose a PDF file." } };
  }
  if (file.type !== "application/pdf") {
    return { status: 400, body: { error: "Only PDF consent files are supported." } };
  }

  if (!hasValidFileSignature(file)) {
    return { status: 400, body: { error: "File content does not match its type." } };
  }
  const categoryId = multipart.fields.categoryId || null;
  if (!await consentCategoryExists(categoryId, user.tenantId)) {
    return { status: 404, body: { error: "Category not found." } };
  }

  const consentDir = resolve(config.uploads.dir, "tenants", String(user.tenantId), "consents");
  mkdirSync(consentDir, { recursive: true });
  const storedName = `${Date.now()}-${randomUUID()}.pdf`;
  const target = resolve(consentDir, storedName);
  writeFileSync(target, file.buffer);

  const id = await createConsentTemplate({
    tenantId: user.tenantId,
    userId: user.id,
    categoryId,
    serviceId: null,
    title: String(multipart.fields.title || file.filename).trim(),
    description: String(multipart.fields.description || ""),
    consentText: String(multipart.fields.consentText || ""),
    language: supportedLanguages.has(multipart.fields.language) ? multipart.fields.language : "he",
    expirationDays: optionalPositiveInteger(multipart.fields.expirationDays),
    originalName: file.filename,
    mimeType: file.type,
    size: file.buffer.length,
    path: target,
  });
  const url = `/api/consents/${id}/download`;
  await updateConsentTemplateUrl(id, url);
  await auditConsent(user.id, "create", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 201, body: { id, url } };
}

export async function removeConsent(user, id) {
  const changes = await archiveConsentTemplate(id, user.tenantId, user.id);
  if (!changes) return { status: 404, body: { error: "Consent file not found." } };
  await auditConsent(user.id, "deactivate", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 200, body: { ok: true } };
}
