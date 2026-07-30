import { json } from "../shared/http/json-response.js";
import { readJsonBody } from "../shared/http/json-body.js";
import { requirePermission } from "../services/permissions.service.js";
import {
  addPatientInvoice,
  cancelInvoice,
  editPatientInvoice,
  getPatientInvoice,
  getPatientInvoices,
  getPatientLedger,
  issueInvoice,
  postPayment,
  reversePayment,
} from "../services/patient-finance.service.js";

export async function handlePatientFinanceRoute(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const invoiceId = parts[2] === "invoices" && /^\d+$/.test(parts[3] || "") ? Number(parts[3]) : null;
  const paymentId = parts[2] === "payments" && /^\d+$/.test(parts[3] || "") ? Number(parts[3]) : null;
  const patientId = parts[2] === "patients" && /^\d+$/.test(parts[3] || "") ? Number(parts[3]) : null;
  const isReverse = (invoiceId && parts[4] === "cancel") || (paymentId && parts[4] === "reverse");
  const permission = await requirePermission(
    req,
    isReverse ? "patient_finance_reverse" : req.method === "GET" ? "patient_finance_read" : "patient_finance_write",
  );
  if (!permission.ok) {
    json(res, permission.status, permission.body);
    return true;
  }

  let result;
  if (req.method === "GET" && parts[2] === "invoices" && !invoiceId) {
    result = await getPatientInvoices(permission.user, Object.fromEntries(url.searchParams));
  } else if (req.method === "POST" && parts[2] === "invoices" && !invoiceId) {
    result = await addPatientInvoice(permission.user, await readJsonBody(req));
  } else if (req.method === "GET" && invoiceId && !parts[4]) {
    result = await getPatientInvoice(permission.user, invoiceId);
  } else if (req.method === "PUT" && invoiceId && !parts[4]) {
    result = await editPatientInvoice(permission.user, invoiceId, await readJsonBody(req));
  } else if (req.method === "POST" && invoiceId && parts[4] === "issue" && !parts[5]) {
    result = await issueInvoice(permission.user, invoiceId);
  } else if (req.method === "POST" && invoiceId && parts[4] === "cancel" && !parts[5]) {
    result = await cancelInvoice(permission.user, invoiceId);
  } else if (req.method === "POST" && parts[2] === "payments" && !paymentId) {
    result = await postPayment(permission.user, await readJsonBody(req));
  } else if (req.method === "POST" && paymentId && parts[4] === "reverse" && !parts[5]) {
    result = await reversePayment(permission.user, paymentId);
  } else if (req.method === "GET" && patientId && parts[4] === "ledger" && !parts[5]) {
    result = await getPatientLedger(permission.user, patientId);
  } else {
    return false;
  }
  json(res, result.status, result.body);
  return true;
}
