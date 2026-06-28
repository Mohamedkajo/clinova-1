import { permissions } from "../../repositories/permissions.repository.js";
import { json } from "../http/json-response.js";
import { resolveCurrentUser } from "./current-user.js";

export const legacyPlatformClinicApiBody = {
  error: "Platform owners must use the platform administration API.",
};

export const legacyForbiddenBody = {
  error: "لا تملك صلاحية لهذه العملية",
};

export const legacyPlatformOwnerRequiredBody = {
  error: "Platform owner access is required.",
};

export async function requirePermissionCompat(req, res, keyOrAllowedRoles) {
  const result = await resolveCurrentUser(req);
  if (!result.ok) {
    json(res, result.status, result.body);
    return null;
  }

  const { user } = result;
  if (user.platformOwner) {
    json(res, 403, legacyPlatformClinicApiBody);
    return null;
  }

  const allowedRoles = Array.isArray(keyOrAllowedRoles) ? keyOrAllowedRoles : permissions[keyOrAllowedRoles];
  if (!allowedRoles?.includes(user.role)) {
    json(res, 403, legacyForbiddenBody);
    return null;
  }

  return user;
}

export async function requirePlatformOwnerCompat(req, res) {
  const result = await resolveCurrentUser(req);
  if (!result.ok) {
    json(res, result.status, result.body);
    return null;
  }

  if (!result.user.platformOwner) {
    json(res, 403, legacyPlatformOwnerRequiredBody);
    return null;
  }

  return result.user;
}
