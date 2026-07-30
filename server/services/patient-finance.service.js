import { randomBytes } from "node:crypto";
import {
  activeAppointmentInvoice,
  addPatientInvoiceItem,
  auditPatientFinance,
  cancelPatientInvoice,
  createLedgerEntry,
  createPatientInvoice,
  createPatientPayment,
  financeAppointment,
  financePatient,
  financeService,
  issuePatientInvoice,
  listPatientInvoices,
  patientFinanceTransaction,
  patientInvoiceById,
  patientInvoiceItems,
  patientInvoicePayments,
  patientLedgerRows,
  patientPaymentById,
  postedInvoicePaymentMinor,
  replacePatientInvoiceItems,
  reversePatientPayment,
  updateAppointmentPaymentIndicator,
  updatePatientInvoicePaymentStatus,
} from "../repositories/patient-finance.repository.js";
import {
  moneyFromMinor,
  parseMoneyToMinor,
  safeFinancialText,
  validQuantity,
} from "../shared/finance/money.js";
import { isValidIsoDate } from "../shared/validation/date-time.js";

const paymentMethods = new Set(["cash", "card", "bank_transfer", "check", "other"]);

function configuredToday() {
  const configured = String(process.env.CLINOVA_TEST_NOW || "").trim();
  const date = configured ? new Date(configured.replace(" ", "T")) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 10);
}

function invoiceNumber(tenantId) {
  return `INV-${new Date().getUTCFullYear()}-${tenantId}-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function moneyFields(row) {
  return {
    subtotal: moneyFromMinor(row.subtotalMinor),
    discount: moneyFromMinor(row.discountMinor),
    tax: moneyFromMinor(row.taxMinor),
    total: moneyFromMinor(row.totalMinor),
  };
}

function itemFromRow(row) {
  return {
    id: Number(row.id),
    serviceId: row.serviceId ? Number(row.serviceId) : null,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: moneyFromMinor(row.unitPriceMinor),
    discount: moneyFromMinor(row.discountMinor),
    tax: moneyFromMinor(row.taxMinor),
    lineTotal: moneyFromMinor(row.lineTotalMinor),
  };
}

function paymentFromRow(row) {
  return {
    id: Number(row.id),
    patientId: Number(row.patientId),
    invoiceId: row.invoiceId ? Number(row.invoiceId) : null,
    amount: moneyFromMinor(row.amountMinor),
    paymentMethod: row.paymentMethod,
    reference: row.reference,
    paymentDate: row.paymentDate,
    status: row.status,
    createdBy: Number(row.createdBy),
    creatorName: row.creatorName,
    reversedBy: row.reversedBy ? Number(row.reversedBy) : null,
    reversedAt: row.reversedAt || null,
    createdAt: row.createdAt,
  };
}

async function invoiceFromRow(row, { details = false, connection } = {}) {
  if (!row) return null;
  const paidMinor = await postedInvoicePaymentMinor(row.id, row.tenantId || row.tenant_id || row.tenantIdValue, connection);
  const invoice = {
    id: Number(row.id),
    patientId: Number(row.patientId),
    patientName: row.patientName,
    appointmentId: row.appointmentId ? Number(row.appointmentId) : null,
    appointmentDate: row.appointmentDate || null,
    appointmentTime: row.appointmentTime || null,
    invoiceNumber: row.invoiceNumber,
    issueDate: row.issueDate || null,
    status: row.status,
    currency: row.currency,
    ...moneyFields(row),
    paid: moneyFromMinor(paidMinor),
    outstanding: moneyFromMinor(Math.max(Number(row.totalMinor) - paidMinor, 0)),
    createdBy: Number(row.createdBy),
    creatorName: row.creatorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (details) {
    invoice.items = (await patientInvoiceItems(row.id, row.tenantId || row.tenant_id || row.tenantIdValue, connection)).map(itemFromRow);
    invoice.payments = (await patientInvoicePayments(row.id, row.tenantId || row.tenant_id || row.tenantIdValue, connection)).map(paymentFromRow);
  }
  return invoice;
}

async function normalizeItems(user, body, appointment = null) {
  let requested = Array.isArray(body.items) ? body.items : [];
  if (!requested.length && appointment) {
    requested = [{
      serviceId: appointment.serviceId,
      description: appointment.serviceName,
      quantity: 1,
      unitPrice: appointment.servicePrice,
      discount: "0",
      tax: "0",
    }];
  }
  if (!requested.length || requested.length > 100) {
    return { error: "At least one invoice item is required." };
  }

  const items = [];
  for (const raw of requested) {
    const quantity = validQuantity(raw.quantity ?? 1);
    if (!quantity) return { error: "Invoice item quantity must be a positive integer." };
    const serviceId = raw.serviceId ? Number(raw.serviceId) : null;
    const service = serviceId ? await financeService(serviceId, user.tenantId) : null;
    if (serviceId && (!service || !service.active)) return { error: "Active service not found.", status: 404 };
    const description = safeFinancialText(raw.description || service?.name, 240);
    if (!description) return { error: "Invoice item description is required." };
    const unitPriceMinor = parseMoneyToMinor(raw.unitPrice ?? service?.price);
    const discountMinor = parseMoneyToMinor(raw.discount ?? "0");
    const taxMinor = parseMoneyToMinor(raw.tax ?? "0");
    if ([unitPriceMinor, discountMinor, taxMinor].includes(null)) {
      return { error: "Invoice item amounts must use at most two decimal places." };
    }
    const baseMinor = unitPriceMinor * quantity;
    if (!Number.isSafeInteger(baseMinor) || discountMinor > baseMinor) {
      return { error: "Invoice item discount exceeds its subtotal." };
    }
    const lineTotalMinor = baseMinor - discountMinor + taxMinor;
    items.push({
      serviceId,
      description,
      quantity,
      unitPriceMinor,
      discountMinor,
      taxMinor,
      lineTotalMinor,
    });
  }
  return { items };
}

async function normalizeDraft(user, body, existing = null) {
  const appointmentId = existing?.appointmentId || (body.appointmentId ? Number(body.appointmentId) : null);
  const appointment = appointmentId ? await financeAppointment(appointmentId, user.tenantId) : null;
  if (appointmentId && (!appointment || appointment.status === "cancelled" || !appointment.active)) {
    return { error: "Eligible appointment not found.", status: 404 };
  }
  const patientId = existing?.patientId || Number(body.patientId || appointment?.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0 || !await financePatient(patientId, user.tenantId)) {
    return { error: "Patient not found.", status: 404 };
  }
  if (appointment && Number(appointment.patientId) !== patientId) {
    return { error: "Appointment does not belong to the patient.", status: 400 };
  }
  if (!existing && appointmentId && await activeAppointmentInvoice(appointmentId, user.tenantId)) {
    return { error: "An active invoice already exists for this appointment.", status: 409, code: "DUPLICATE_APPOINTMENT_INVOICE" };
  }
  const normalizedItems = await normalizeItems(user, body, appointment);
  if (normalizedItems.error) return normalizedItems;
  const headerDiscount = parseMoneyToMinor(body.discount ?? "0");
  const headerTax = parseMoneyToMinor(body.tax ?? "0");
  if (headerDiscount === null || headerTax === null) {
    return { error: "Invoice discount and tax must use at most two decimal places." };
  }
  const subtotalMinor = normalizedItems.items.reduce((sum, item) => sum + (item.unitPriceMinor * item.quantity), 0);
  const itemDiscountMinor = normalizedItems.items.reduce((sum, item) => sum + item.discountMinor, 0);
  const itemTaxMinor = normalizedItems.items.reduce((sum, item) => sum + item.taxMinor, 0);
  const discountMinor = itemDiscountMinor + headerDiscount;
  const taxMinor = itemTaxMinor + headerTax;
  if (discountMinor > subtotalMinor) return { error: "Invoice discount exceeds subtotal." };
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) return { error: "Invoice total must be greater than zero." };
  const currency = /^[A-Z]{3}$/.test(String(body.currency || existing?.currency || "ILS").trim().toUpperCase())
    ? String(body.currency || existing?.currency || "ILS").trim().toUpperCase()
    : null;
  if (!currency) return { error: "Valid three-letter currency is required." };
  return {
    patientId,
    appointmentId,
    items: normalizedItems.items,
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor,
    currency,
  };
}

async function recalculateInvoicePaymentState(invoice, connection) {
  const paidMinor = await postedInvoicePaymentMinor(invoice.id, invoice.tenantIdValue, connection);
  const status = paidMinor <= 0 ? "issued" : paidMinor < Number(invoice.totalMinor) ? "partially_paid" : "paid";
  await updatePatientInvoicePaymentStatus(invoice.id, invoice.tenantIdValue, status, connection);
  const indicator = status === "paid" ? "paid" : status === "partially_paid" ? "deposit" : "unpaid";
  await updateAppointmentPaymentIndicator(invoice.appointmentId, invoice.tenantIdValue, indicator, paidMinor, connection);
  return status;
}

export async function getPatientInvoices(user, query = {}) {
  const patientId = query.patientId ? Number(query.patientId) : null;
  const appointmentId = query.appointmentId ? Number(query.appointmentId) : null;
  if ((query.patientId && !Number.isInteger(patientId)) || (query.appointmentId && !Number.isInteger(appointmentId))) {
    return { status: 400, body: { error: "Invalid invoice filter." } };
  }
  const rows = await listPatientInvoices(user.tenantId, patientId, appointmentId);
  const items = [];
  for (const row of rows) {
    row.tenantIdValue = user.tenantId;
    items.push(await invoiceFromRow(row));
  }
  return { status: 200, body: { items } };
}

export async function getPatientInvoice(user, invoiceId) {
  const row = await patientInvoiceById(invoiceId, user.tenantId);
  if (!row) return { status: 404, body: { error: "Invoice not found." } };
  row.tenantIdValue = user.tenantId;
  return { status: 200, body: { invoice: await invoiceFromRow(row, { details: true }) } };
}

export async function addPatientInvoice(user, body) {
  const draft = await normalizeDraft(user, body);
  if (draft.error) return { status: draft.status || 400, body: { error: draft.error, ...(draft.code ? { code: draft.code } : {}) } };
  try {
    const id = await patientFinanceTransaction(async (connection) => {
      const invoiceId = await createPatientInvoice({
        ...draft,
        tenantId: user.tenantId,
        invoiceNumber: invoiceNumber(user.tenantId),
        createdBy: user.id,
      }, connection);
      for (const item of draft.items) await addPatientInvoiceItem(invoiceId, user.tenantId, item, connection);
      await auditPatientFinance(connection, user.id, "invoice_created", "patient_invoices", invoiceId, user.tenantId);
      return invoiceId;
    });
    return getPatientInvoice(user, id).then((result) => ({ status: 201, body: result.body }));
  } catch (error) {
    if (draft.appointmentId && await activeAppointmentInvoice(draft.appointmentId, user.tenantId)) {
      return { status: 409, body: { error: "An active invoice already exists for this appointment.", code: "DUPLICATE_APPOINTMENT_INVOICE" } };
    }
    throw error;
  }
}

export async function editPatientInvoice(user, invoiceId, body) {
  const existing = await patientInvoiceById(invoiceId, user.tenantId);
  if (!existing) return { status: 404, body: { error: "Invoice not found." } };
  if (existing.status !== "draft") return { status: 409, body: { error: "Issued invoices are immutable." } };
  existing.tenantIdValue = user.tenantId;
  const draft = await normalizeDraft(user, body, existing);
  if (draft.error) return { status: draft.status || 400, body: { error: draft.error } };
  await patientFinanceTransaction(async (connection) => {
    await replacePatientInvoiceItems(invoiceId, user.tenantId, draft, draft.items, connection);
  });
  return getPatientInvoice(user, invoiceId);
}

export async function issueInvoice(user, invoiceId) {
  const existing = await patientInvoiceById(invoiceId, user.tenantId);
  if (!existing) return { status: 404, body: { error: "Invoice not found." } };
  if (existing.status !== "draft") return { status: 409, body: { error: "Only draft invoices can be issued." } };
  await patientFinanceTransaction(async (connection) => {
    if (!await issuePatientInvoice(invoiceId, user.tenantId, configuredToday(), connection)) {
      throw new Error("Invoice changed before issue.");
    }
    await createLedgerEntry({
      tenantId: user.tenantId,
      patientId: existing.patientId,
      type: "invoice",
      referenceType: "invoice",
      referenceId: invoiceId,
      debitMinor: existing.totalMinor,
      createdBy: user.id,
    }, connection);
    await updateAppointmentPaymentIndicator(existing.appointmentId, user.tenantId, "unpaid", 0, connection);
    await auditPatientFinance(connection, user.id, "invoice_issued", "patient_invoices", invoiceId, user.tenantId);
  });
  return getPatientInvoice(user, invoiceId);
}

export async function cancelInvoice(user, invoiceId) {
  const existing = await patientInvoiceById(invoiceId, user.tenantId);
  if (!existing) return { status: 404, body: { error: "Invoice not found." } };
  if (existing.status === "cancelled") return { status: 409, body: { error: "Invoice is already cancelled." } };
  await patientFinanceTransaction(async (connection) => {
    if (!await cancelPatientInvoice(invoiceId, user.tenantId, connection)) throw new Error("Invoice changed before cancellation.");
    if (existing.status !== "draft") {
      await createLedgerEntry({
        tenantId: user.tenantId,
        patientId: existing.patientId,
        type: "invoice_reversal",
        referenceType: "invoice",
        referenceId: invoiceId,
        creditMinor: existing.totalMinor,
        createdBy: user.id,
      }, connection);
    }
    await updateAppointmentPaymentIndicator(existing.appointmentId, user.tenantId, "unpaid", 0, connection);
    await auditPatientFinance(connection, user.id, "invoice_cancelled", "patient_invoices", invoiceId, user.tenantId);
  });
  return getPatientInvoice(user, invoiceId);
}

export async function postPayment(user, body) {
  const patientId = Number(body.patientId);
  const invoiceId = body.invoiceId ? Number(body.invoiceId) : null;
  const amountMinor = parseMoneyToMinor(body.amount, { allowZero: false });
  const paymentMethod = String(body.paymentMethod || "");
  const paymentDate = String(body.paymentDate || configuredToday());
  if (!Number.isInteger(patientId) || !await financePatient(patientId, user.tenantId)) {
    return { status: 404, body: { error: "Patient not found." } };
  }
  if (!amountMinor) return { status: 400, body: { error: "Payment amount must be greater than zero with at most two decimal places." } };
  if (!paymentMethods.has(paymentMethod)) return { status: 400, body: { error: "Valid payment method is required." } };
  if (!isValidIsoDate(paymentDate)) return { status: 400, body: { error: "Valid payment date is required." } };
  const invoice = invoiceId ? await patientInvoiceById(invoiceId, user.tenantId) : null;
  if (invoiceId && (!invoice || Number(invoice.patientId) !== patientId)) {
    return { status: 404, body: { error: "Invoice not found for patient." } };
  }
  if (invoice && !["issued", "partially_paid"].includes(invoice.status)) {
    return { status: 409, body: { error: "Payments require an issued invoice with an outstanding balance." } };
  }
  if (invoice) {
    const posted = await postedInvoicePaymentMinor(invoiceId, user.tenantId);
    if (amountMinor > Number(invoice.totalMinor) - posted) {
      return { status: 409, body: { error: "Invoice overpayment is not allowed; record an unallocated patient credit instead.", code: "OVERPAYMENT_NOT_ALLOWED" } };
    }
  }
  const paymentId = await patientFinanceTransaction(async (connection) => {
    const id = await createPatientPayment({
      tenantId: user.tenantId,
      patientId,
      invoiceId,
      amountMinor,
      paymentMethod,
      reference: safeFinancialText(body.reference, 160),
      paymentDate,
      createdBy: user.id,
    }, connection);
    await createLedgerEntry({
      tenantId: user.tenantId,
      patientId,
      type: "payment",
      referenceType: "payment",
      referenceId: id,
      creditMinor: amountMinor,
      createdBy: user.id,
    }, connection);
    if (process.env.CLINOVA_TEST_FINANCE_FAIL_STAGE === "payment_after_ledger") {
      throw new Error("Injected finance transaction failure.");
    }
    if (invoice) {
      invoice.tenantIdValue = user.tenantId;
      await recalculateInvoicePaymentState(invoice, connection);
    }
    await auditPatientFinance(connection, user.id, "payment_posted", "patient_payments", id, user.tenantId);
    return id;
  });
  return { status: 201, body: { paymentId, ledger: (await getPatientLedger(user, patientId)).body } };
}

export async function reversePayment(user, paymentId) {
  const payment = await patientPaymentById(paymentId, user.tenantId);
  if (!payment) return { status: 404, body: { error: "Payment not found." } };
  if (payment.status !== "posted") return { status: 409, body: { error: "Payment is already reversed." } };
  await patientFinanceTransaction(async (connection) => {
    if (!await reversePatientPayment(paymentId, user.tenantId, user.id, connection)) {
      throw new Error("Payment changed before reversal.");
    }
    await createLedgerEntry({
      tenantId: user.tenantId,
      patientId: payment.patientId,
      type: "payment_reversal",
      referenceType: "payment",
      referenceId: paymentId,
      debitMinor: payment.amountMinor,
      createdBy: user.id,
    }, connection);
    if (payment.invoiceId) {
      const invoice = await patientInvoiceById(payment.invoiceId, user.tenantId, connection);
      if (invoice && invoice.status !== "cancelled") {
        invoice.tenantIdValue = user.tenantId;
        await recalculateInvoicePaymentState(invoice, connection);
      }
    }
    await auditPatientFinance(connection, user.id, "payment_reversed", "patient_payments", paymentId, user.tenantId);
  });
  return { status: 200, body: { ok: true, ledger: (await getPatientLedger(user, payment.patientId)).body } };
}

export async function getPatientLedger(user, patientId) {
  if (!await financePatient(patientId, user.tenantId)) return { status: 404, body: { error: "Patient not found." } };
  const rows = await patientLedgerRows(patientId, user.tenantId);
  let balanceMinor = 0;
  const entries = rows.map((row) => {
    balanceMinor += Number(row.debitMinor) - Number(row.creditMinor);
    return {
      id: Number(row.id),
      type: row.type,
      referenceType: row.referenceType,
      referenceId: Number(row.referenceId),
      reference: row.invoiceNumber || `PAY-${row.referenceId}`,
      debit: moneyFromMinor(row.debitMinor),
      credit: moneyFromMinor(row.creditMinor),
      balance: moneyFromMinor(balanceMinor),
      postedAt: row.postedAt,
      createdBy: Number(row.createdBy),
      creatorName: row.creatorName,
      invoiceStatus: row.invoiceStatus || null,
      paymentMethod: row.paymentMethod || null,
      paymentStatus: row.paymentStatus || null,
    };
  });
  return {
    status: 200,
    body: {
      patientId,
      balance: moneyFromMinor(balanceMinor),
      entries: entries.reverse(),
    },
  };
}

export async function patientFinancialSnapshot(user, patientId) {
  const [ledgerResult, invoiceResult] = await Promise.all([
    getPatientLedger(user, patientId),
    getPatientInvoices(user, { patientId }),
  ]);
  if (ledgerResult.status !== 200) return null;
  return {
    balance: ledgerResult.body.balance,
    ledgerEntries: ledgerResult.body.entries,
    invoices: invoiceResult.body.items,
  };
}
