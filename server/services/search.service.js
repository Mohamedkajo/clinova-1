import {
  listAppointmentRowsForSearch,
  listClientRowsForSearch,
  listServiceRowsForSearch,
} from "../repositories/search.repository.js";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function searchScore(text, query, phone = "") {
  const source = String(text || "").toLowerCase();
  const needle = String(query || "").toLowerCase();
  const phoneNeedle = digitsOnly(query);
  let score = 0;
  const words = source.split(/\s+/).filter(Boolean);
  if (source === needle) score += 140;
  if (words.some((word) => word === needle)) score += 110;
  if (source.startsWith(needle)) score += 90;
  if (words.some((word) => word.startsWith(needle))) score += 70;
  if (source.includes(needle)) score += 45 + Math.min(needle.length, 20);
  if (phoneNeedle && digitsOnly(phone).includes(phoneNeedle)) score += 70 + Math.min(phoneNeedle.length, 20);
  for (const part of needle.split(/\s+/).filter(Boolean)) {
    if (part.length < 2) continue;
    if (words.some((word) => word === part)) score += 18;
    else if (words.some((word) => word.startsWith(part))) score += 14;
    else if (source.includes(part)) score += 8;
  }
  return score;
}

export async function globalSearch(user, query) {
  const term = String(query || "").trim();
  if (term.length < 2) return { status: 200, body: { clients: [], appointments: [], services: [] } };

  const like = `%${term}%`;
  const digitTerm = `%${digitsOnly(term)}%`;
  const clientRows = await listClientRowsForSearch(user);
  const clients = clientRows
    .map((row) => {
      const name = `${row.fname} ${row.lname}`;
      const score = searchScore(`${name} ${row.email || ""} ${row.notes || ""} ${row.therapistName || ""}`, term, row.phone);
      return { id: row.id, name, phone: row.phone, email: row.email, therapistName: row.therapistName || "", score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    status: 200,
    body: {
      clients,
      appointments: await listAppointmentRowsForSearch(user, like, digitTerm),
      services: await listServiceRowsForSearch(user, like),
    },
  };
}
