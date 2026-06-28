import { json } from "../../shared/http/json-response.js";
import { currentUser, parseCookies } from "../../services/auth.service.js";
import { changePassword } from "./account.service.js";
import { readJsonBody } from "../../shared/http/json-body.js";

const loginRequiredError = "يجب تسجيل الدخول";

export async function handleAccountRoute(req, res, url) {
  if (req.method !== "POST" || url.pathname !== "/api/account/password") return false;

  const user = await currentUser(parseCookies(req).clinic_session);
  if (!user) {
    json(res, 401, { error: loginRequiredError });
    return true;
  }

  const result = await changePassword(user, await readJsonBody(req));
  if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
  json(res, result.status, result.body);
  return true;
}
