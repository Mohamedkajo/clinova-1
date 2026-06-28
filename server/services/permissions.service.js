import { currentUser, parseCookies } from "./auth.service.js";
import { permissions } from "../repositories/permissions.repository.js";

const loginRequiredError = "يجب تسجيل الدخول";
const forbiddenError = "لا تملك صلاحية لهذه العملية";

export async function requireUser(req) {
  const user = await currentUser(parseCookies(req).clinic_session);
  if (!user) {
    return {
      ok: false,
      status: 401,
      body: { error: loginRequiredError },
    };
  }
  return { ok: true, user };
}

export async function requirePermission(req, key) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  const { user } = auth;
  if (user.platformOwner) {
    return {
      ok: false,
      status: 403,
      body: { error: "Platform owners must use the platform administration API." },
    };
  }
  if (!permissions[key]?.includes(user.role)) {
    return {
      ok: false,
      status: 403,
      body: { error: forbiddenError },
    };
  }
  return { ok: true, user };
}

export async function requirePlatformOwner(req) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  if (!auth.user.platformOwner) {
    return {
      ok: false,
      status: 403,
      body: { error: "Platform owner access is required." },
    };
  }
  return auth;
}
