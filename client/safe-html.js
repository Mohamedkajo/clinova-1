export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value = "") {
  return escapeHtml(value);
}

export function safeSetText(element, value = "") {
  element.textContent = String(value ?? "");
  return element;
}
