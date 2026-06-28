import { config } from "../config.js";
import { createSessionToken, readSignedToken, verifyPassword } from "../security.js";
import {
  auditLogin,
  createSession,
  deleteSession,
  findActiveSession,
  findActiveUser,
  findUserForLogin,
  toUser,
} from "../repositories/auth.repository.js";
import { resolveClientIp } from "../shared/http/client-ip.js";

const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;

function loginKey(req, username) {
  return `${resolveClientIp(req)}:${String(username || "").toLowerCase()}`;
}

function isLoginBlocked(req, username) {
  const item = loginAttempts.get(loginKey(req, username));
  if (!item) return false;
  if (Date.now() - item.firstAt > loginWindowMs) {
    loginAttempts.delete(loginKey(req, username));
    return false;
  }
  return item.count >= maxLoginAttempts;
}

function recordFailedLogin(req, username) {
  const key = loginKey(req, username);
  const now = Date.now();
  const item = loginAttempts.get(key);
  if (!item || now - item.firstAt > loginWindowMs) {
    loginAttempts.set(key, { count: 1, firstAt: now });
    return;
  }
  item.count += 1;
}

function clearFailedLogin(req, username) {
  loginAttempts.delete(loginKey(req, username));
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((item) => {
    const index = item.indexOf("=");
    return index === -1 ? ["", ""] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }).filter(([key]) => key));
}

export function sessionCookie(token, expiresAt) {
  const secure = config.cookieSecure ? "; Secure" : "";
  return `clinic_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearedSessionCookie() {
  return "clinic_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

export async function login(req, body) {
  const identifier = String(body.identifier || body.email || body.username || "").trim();
  if (isLoginBlocked(req, identifier)) {
    return {
      status: 429,
      body: { error: "محاولات دخول كثيرة. حاول مرة أخرى بعد 15 دقيقة" },
    };
  }

  const row = await findUserForLogin(identifier, body.tenantSlug || body.tenant || "");
  if (!row || !verifyPassword(body.password || "", row.password_hash)) {
    recordFailedLogin(req, identifier);
    return {
      status: 401,
      body: { error: "اسم المستخدم أو كلمة المرور غير صحيحة" },
    };
  }

  clearFailedLogin(req, identifier);
  const token = createSessionToken(config.sessionSecret);
  const id = token.split(".")[0];
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const tenantId = row.tenant_id || 1;
  await createSession(id, tenantId, row.id, expiresAt);
  await auditLogin(row.id, tenantId);
  return {
    status: 200,
    body: { user: toUser(row) },
    cookie: sessionCookie(token, expiresAt),
  };
}

export async function logout(token) {
  const id = readSignedToken(token, config.sessionSecret);
  if (id) await deleteSession(id);
  return {
    status: 200,
    body: { ok: true },
    cookie: clearedSessionCookie(),
  };
}

export async function currentUser(token) {
  const id = readSignedToken(token, config.sessionSecret);
  if (!id) return null;
  const session = await findActiveSession(id, Date.now());
  if (!session) return null;
  return toUser(await findActiveUser(session.user_id, session.tenant_id || 1));
}
