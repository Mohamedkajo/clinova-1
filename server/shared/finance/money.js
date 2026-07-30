const MAX_MINOR = 999_999_999_999;

export function parseMoneyToMinor(value, { allowZero = true } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const minor = (Number(match[1]) * 100) + Number(String(match[2] || "").padEnd(2, "0") || 0);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR || (!allowZero && minor <= 0)) return null;
  return minor;
}

export function moneyFromMinor(value) {
  const minor = Number(value || 0);
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function validQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 1000 ? quantity : null;
}

export function safeFinancialText(value, max = 240) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
