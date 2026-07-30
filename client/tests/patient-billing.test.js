import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { renderBillingWorkspace, renderPatientFinancialSection } from "../patient-billing.js";

const invoice = {
  id: 7,
  invoiceNumber: "INV-2035-1-ABC",
  patientName: "Maya Levi",
  appointmentId: 42,
  issueDate: "2035-09-10",
  status: "partially_paid",
  total: "100.50",
  paid: "40.25",
  outstanding: "60.25",
  currency: "ILS",
};

test("billing workspace renders loading, error, empty, desktop and mobile states", () => {
  assert.match(renderBillingWorkspace({ language: "en", workspace: { status: "loading" } }), /Loading invoices/);
  assert.match(renderBillingWorkspace({ language: "en", workspace: { status: "error", error: "Offline" } }), /data-billing-retry/);
  assert.match(renderBillingWorkspace({ language: "en", workspace: { status: "ready", items: [] } }), /data-new-invoice/);
  const ready = renderBillingWorkspace({ language: "ar", workspace: { status: "ready", items: [invoice] } });
  assert.match(ready, /billing-table/);
  assert.match(ready, /billing-mobile-list/);
  assert.match(ready, /data-invoice-details="7"/);
  assert.match(ready, /مدفوعة جزئياً/);
});

test("billing and patient ledger escape financial text and expose no balance editor", () => {
  const hostile = { ...invoice, patientName: '<img src=x onerror="alert(1)">', invoiceNumber: "</td><script>alert(1)</script>" };
  const workspace = renderBillingWorkspace({ language: "he", workspace: { status: "ready", items: [hostile] } });
  assert.doesNotMatch(workspace, /<script>|<img/);
  assert.match(workspace, /&lt;script&gt;|&lt;img/);

  const section = renderPatientFinancialSection({
    capabilities: { financial: true },
    financial: {
      balance: "60.25",
      invoices: [hostile],
      ledgerEntries: [{ id: 1, postedAt: "2035-09-10", reference: '<svg onload="alert(1)">', debit: "100.50", credit: "0.00", balance: "100.50" }],
    },
  }, "en");
  assert.match(section, /Patient ledger/);
  assert.match(section, /data-patient-invoice="7"/);
  assert.doesNotMatch(section, /<svg|<script|<img/);
  assert.doesNotMatch(section, /name="balance"|contenteditable/);
  assert.equal(renderPatientFinancialSection({ capabilities: { financial: false }, financial: {} }, "en"), "");
});

test("billing UI integrates real APIs, immutable actions, RTL/LTR and 390px mobile layout", async () => {
  const [app, styles, shell] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../foundation-shell.js", import.meta.url), "utf8"),
  ]);
  for (const token of [
    "/api/patient-finance/invoices",
    "/api/patient-finance/payments",
    "/issue",
    "/cancel",
    "/reverse",
    "data-new-invoice",
    "data-reverse-payment",
  ]) assert.ok(app.includes(token), `missing billing integration token: ${token}`);
  assert.match(shell, /reception:[\s\S]*canViewBilling/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.billing-mobile-list/);
  assert.match(styles, /text-align:\s*start/);
  assert.match(styles, /\.patient-financial-section/);
});
