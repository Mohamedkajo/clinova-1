import { config } from "../../config.js";
import { db } from "../../db.js";
import { readSignedToken } from "../../security.js";
import { json } from "../http/json-response.js";
import { rowToUser } from "./user-mapper.js";

export const legacyLoginRequiredBody = {
  error: "يجب تسجيل الدخول",
};

export function parseRequestCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((item) => {
    const index = item.indexOf("=");
    return index === -1 ? ["", ""] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }).filter(([key]) => key));
}

export async function resolveCurrentUser(req) {
  const token = parseRequestCookies(req).clinic_session;
  const id = readSignedToken(token, config.sessionSecret);
  if (!id) {
    return {
      ok: false,
      status: 401,
      body: legacyLoginRequiredBody,
    };
  }

  const now = Date.now();
  const session = await db.prepare("SELECT tenant_id, user_id FROM sessions WHERE id = ? AND expires_at > ?").get(id, now);
  if (!session) {
    return {
      ok: false,
      status: 401,
      body: legacyLoginRequiredBody,
    };
  }

  const row = await db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ? AND active = 1").get(session.user_id, session.tenant_id || 1);
  const user = rowToUser(row);
  if (!user) {
    return {
      ok: false,
      status: 401,
      body: legacyLoginRequiredBody,
    };
  }

  return { ok: true, user };
}

export async function requireCurrentUserCompat(req, res) {
  const result = await resolveCurrentUser(req);
  if (!result.ok) {
    json(res, result.status, result.body);
    return null;
  }
  return result.user;
}
