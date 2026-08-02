import { safeSetText } from "./safe-html.js";

const token = new URLSearchParams(location.search).get("token") || "";
let rating = 5;
const app = document.getElementById("app");

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Error");
  return data;
}

function render(row) {
  const title = document.createElement("h1");
  safeSetText(title, "נשמח לחוות דעתך");
  const details = document.createElement("div");
  details.className = "muted";
  safeSetText(details, `${row.clientName || ""} · ${row.serviceName || ""} · ${row.date || ""} ${row.time || ""}`);
  const stars = document.createElement("div");
  stars.className = "stars";
  for (const value of [1, 2, 3, 4, 5]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rate = String(value);
    button.classList.toggle("active", value <= rating);
    safeSetText(button, "★");
    button.onclick = () => {
      rating = value;
      render(row);
    };
    stars.append(button);
  }
  const comment = document.createElement("textarea");
  comment.id = "comment";
  comment.placeholder = "אפשר לכתוב הערה קצרה";
  const send = document.createElement("button");
  send.className = "submit";
  send.id = "send";
  safeSetText(send, "שליחה");
  send.onclick = async () => {
    await api(`/api/public/feedback/${encodeURIComponent(token)}`, { method: "POST", body: { rating, comment: comment.value } });
    const done = document.createElement("div");
    done.className = "done";
    safeSetText(done, "תודה רבה, המשוב התקבל.");
    app.replaceChildren(done);
  };
  app.replaceChildren(title, details, stars, comment, send);
}

api(`/api/public/feedback/${encodeURIComponent(token)}`).then(render).catch((errorValue) => {
  const error = document.createElement("div");
  safeSetText(error, errorValue.message);
  app.replaceChildren(error);
});
