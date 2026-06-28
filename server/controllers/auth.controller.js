import { json } from "../shared/http/json-response.js";
import { currentUser, login, logout, parseCookies } from "../services/auth.service.js";
import { readJsonBody } from "../shared/http/json-body.js";

export async function handleAuthRoute(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/login") {
    const result = await login(req, await readJsonBody(req));
    if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const result = await logout(parseCookies(req).clinic_session);
    if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
    json(res, result.status, result.body);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    json(res, 200, { user: await currentUser(parseCookies(req).clinic_session) });
    return true;
  }

  return false;
}
