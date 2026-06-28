import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { config } from "../config.js";
import { hasValidFileSignature } from "../shared/uploads/file-signatures.js";
import {
  archiveConsentTemplate,
  auditConsent,
  clientById,
  consentAppointmentExists,
  consentCategoryExists,
  consentTemplateById,
  createConsentSignature,
  createConsentTemplate,
  createSignedClientFile,
  findDuplicateSignature,
  listConsentTemplates,
  updateClientFileUrl,
  updateConsentTemplateUrl,
} from "../repositories/consents.repository.js";

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
    form: "חתימה",
    client: "לקוח",
    signer: "חותם",
    appointment: "תור",
    signedAt: "נחתם בתאריך",
    signatureStamp: "חותמת חתימה",
    displayName: "טופס חתום",
    notes: "טופס משפטי חתום",
  };
}

async function createSignedConsentClientFile({ signatureId, tenantId, templateId, clientId, appointmentId, signerName, signatureData, lang = "he" }) {
  if (!clientId) return null;
  const template = await consentTemplateById(templateId, tenantId);
  const client = await clientById(clientId, tenantId);
  if (!template || !client || !template.path || !existsSync(template.path)) return null;

  const clientDir = resolve(config.uploads.dir, "clients", String(clientId), "consents");
  mkdirSync(clientDir, { recursive: true });
  const fileName = `signed-consent-${signatureId}.pdf`;
  const target = resolve(clientDir, fileName);
  const signedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  const labels = consentPdfLabels(lang);
  const pdf = await PDFDocument.load(readFileSync(template.path));
  const { font, unicode } = await embedConsentFont(pdf);
  const page = pdf.addPage();
  const { width, height } = page.getSize();
  page.drawText(consentFontText(labels.title, unicode), { x: 48, y: height - 70, size: 20, font, color: rgb(0.18, 0.42, 0.31) });
  page.drawText(consentFontText(`${labels.form}: ${pdfSafeText(template.title)}`, unicode), { x: 48, y: height - 110, size: 12, font });
  page.drawText(consentFontText(`${labels.client}: ${pdfSafeText(`${client.fname} ${client.lname}`)}`, unicode), { x: 48, y: height - 132, size: 12, font });
  page.drawText(consentFontText(`${labels.signer}: ${pdfSafeText(signerName)}`, unicode), { x: 48, y: height - 154, size: 12, font });
  page.drawText(consentFontText(`${labels.appointment}: ${appointmentId || "-"}`, unicode), { x: 48, y: height - 176, size: 12, font });
  page.drawText(consentFontText(`${labels.signedAt}: ${signedAt}`, unicode), { x: 48, y: height - 198, size: 12, font });
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
    name: displayName,
    originalName: fileName,
    mimeType: "application/pdf",
    size: stampedBytes.length,
    path: target,
    notes: labels.notes,
  });
  const downloadUrl = `/api/client-files/${fileId}/download`;
  await updateClientFileUrl(fileId, downloadUrl);
  return fileId;
}

export async function getConsents(user) {
  return { status: 200, body: await listConsentTemplates(user.tenantId) };
}

export async function signConsent(user, id, body) {
  if (!body.signatureData || !String(body.signatureData).startsWith("data:image/")) {
    return { status: 400, body: { error: "Signature is required." } };
  }
  const clientId = body.clientId || null;
  const appointmentId = body.appointmentId || null;
  if (!await consentTemplateById(id, user.tenantId)) {
    return { status: 404, body: { error: "Consent file not found." } };
  }
  if (clientId && !await clientById(clientId, user.tenantId)) {
    return { status: 404, body: { error: "Client not found." } };
  }
  if (!await consentAppointmentExists(appointmentId, user.tenantId)) {
    return { status: 404, body: { error: "Appointment not found." } };
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
  });
  const fileId = await createSignedConsentClientFile({
    signatureId,
    tenantId: user.tenantId,
    templateId: id,
    clientId,
    appointmentId,
    signerName: String(body.signerName || ""),
    signatureData: body.signatureData,
    lang: body.lang === "ar" ? "ar" : "he",
  });
  await auditConsent(user.id, "sign", "consent_templates", id, { tenantId: user.tenantId, signatureId, clientFileId: fileId });
  return { status: 201, body: { id: signatureId, clientFileId: fileId } };
}

export async function getConsentDownload(user, id) {
  const file = await consentTemplateById(id, user.tenantId);
  if (!file) return { status: 404, body: { error: "Consent file not found." } };
  if (!existsSync(file.path)) return { status: 404, body: { error: "Consent file missing from storage." } };
  return { status: 200, file, buffer: readFileSync(file.path) };
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

  const consentDir = resolve(config.uploads.dir, "consents");
  mkdirSync(consentDir, { recursive: true });
  const storedName = `${Date.now()}-${randomUUID()}.pdf`;
  const target = resolve(consentDir, storedName);
  writeFileSync(target, file.buffer);

  const id = await createConsentTemplate({
    tenantId: user.tenantId,
    categoryId,
    title: String(multipart.fields.title || file.filename).trim(),
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
  const changes = await archiveConsentTemplate(id, user.tenantId);
  if (!changes) return { status: 404, body: { error: "Consent file not found." } };
  await auditConsent(user.id, "archive", "consent_templates", id, { tenantId: user.tenantId });
  return { status: 200, body: { ok: true } };
}
