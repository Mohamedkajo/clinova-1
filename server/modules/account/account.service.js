import { hashPassword, verifyPassword } from "../../security.js";
import { clearedSessionCookie } from "../../services/auth.service.js";
import { auditPasswordChange, deleteUserSessions, findUserById, updateUserPassword } from "./account.repository.js";

const shortPasswordError = "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل";
const currentPasswordError = "كلمة المرور الحالية غير صحيحة";

export async function changePassword(user, body) {
  if (!body.newPassword || String(body.newPassword).length < 8) {
    return { status: 400, body: { error: shortPasswordError } };
  }

  const row = await findUserById(user.tenantId, user.id);
  if (!row || !verifyPassword(body.currentPassword || "", row.password_hash)) {
    return { status: 400, body: { error: currentPasswordError } };
  }

  await updateUserPassword(user.tenantId, user.id, hashPassword(body.newPassword));
  await deleteUserSessions(user.tenantId, user.id);
  await auditPasswordChange(user.id, user.tenantId);
  return { status: 200, body: { ok: true }, cookie: clearedSessionCookie() };
}
