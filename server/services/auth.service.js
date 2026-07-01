import { config } from "../config.js";
import { createSessionToken, readSignedToken, verifyPassword } from "../security.js";
import {
  auditLogin,
  createSession,
  deleteSession,
  findActiveSession,
  findActiveUser,
  findPlatformOwnerForLogin,
  findUserForLogin,
  tenantIdentifierExists,
  toUser,
} from "../repositories/auth.repository.js";
import { resolveClientIp } from "../shared/http/client-ip.js";

const loginAttempts = new Map();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;

function loginKey(req, username, clinicIdentifier = "") {
  return `${resolveClientIp(req)}:${String(clinicIdentifier || "").toLowerCase()}:${String(username || "").toLowerCase()}`;
}

function isLoginBlocked(req, username, clinicIdentifier = "") {
  const item = loginAttempts.get(loginKey(req, username, clinicIdentifier));
  if (!item) return false;
  if (Date.now() - item.firstAt > loginWindowMs) {
    loginAttempts.delete(loginKey(req, username, clinicIdentifier));
    return false;
  }
  return item.count >= maxLoginAttempts;
}

function recordFailedLogin(req, username, clinicIdentifier = "") {
  const key = loginKey(req, username, clinicIdentifier);
  const now = Date.now();
  const item = loginAttempts.get(key);
  if (!item || now - item.firstAt > loginWindowMs) {
    loginAttempts.set(key, { count: 1, firstAt: now });
    return;
  }
  item.count += 1;
}

function clearFailedLogin(req, username, clinicIdentifier = "") {
  loginAttempts.delete(loginKey(req, username, clinicIdentifier));
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
  const clinicIdentifier = String(body.clinicIdentifier || body.tenantSlug || body.tenant || "").trim();
  if (isLoginBlocked(req, identifier, clinicIdentifier)) {
    return {
      status: 429,
      body: { error: "Too many login attempts. Try again in 15 minutes." },
    };
  }

  let row = null;
  if (clinicIdentifier) {
    if (!await tenantIdentifierExists(clinicIdentifier)) {
      recordFailedLogin(req, identifier, clinicIdentifier);
      return { status: 400, body: { error: "Clinic identifier not found." } };
    }
    row = await findUserForLogin(identifier, clinicIdentifier);
  } else {
    row = await findPlatformOwnerForLogin(identifier);
    if (!row) {
      recordFailedLogin(req, identifier, clinicIdentifier);
      return { status: 400, body: { error: "Clinic identifier is required." } };
    }
  }

  if (!row || !verifyPassword(body.password || "", row.password_hash)) {
    recordFailedLogin(req, identifier, clinicIdentifier);
    return {
      status: 401,
      body: { error: "Invalid username or password." },
    };
  }

  clearFailedLogin(req, identifier, clinicIdentifier);
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
