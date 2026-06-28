import { json } from "./json-response.js";

export const apiNotFoundBody = {
  error: "المسار غير موجود",
};

export function apiNotFound(res) {
  json(res, 404, apiNotFoundBody);
}
