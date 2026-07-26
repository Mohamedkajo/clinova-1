export function createHttpClient(baseUrl) {
  let cookie = "";

  async function request(method, path, options = {}) {
    const headers = new Headers(options.headers);
    let body = options.body;

    if (body !== undefined && body !== null && typeof body !== "string" && !(body instanceof FormData)) {
      body = JSON.stringify(body);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
    if (cookie) headers.set("cookie", cookie);

    const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const sessionCookie = setCookie.match(/clinic_session=[^;]*/)?.[0] ?? "";
      cookie = sessionCookie === "clinic_session=" ? "" : sessionCookie;
    }

    const buffer = options.responseType === "buffer"
      ? Buffer.from(await response.arrayBuffer())
      : null;
    const text = buffer ? "" : await response.text();
    let parsedBody = buffer;
    if (!buffer) {
      parsedBody = text;
      try {
        parsedBody = text ? JSON.parse(text) : null;
      } catch {
        // Static responses intentionally remain text in this helper.
      }
    }

    return {
      body: parsedBody,
      buffer,
      headers: response.headers,
      status: response.status,
      text,
    };
  }

  return {
    clearCookie() {
      cookie = "";
    },
    delete: (path, options) => request("DELETE", path, options),
    get: (path, options) => request("GET", path, options),
    patch: (path, options) => request("PATCH", path, options),
    post: (path, options) => request("POST", path, options),
    put: (path, options) => request("PUT", path, options),
    request,
  };
}

export async function loginAs(baseUrl, username, password = "ChangeMe123!", clinicIdentifier = "demo") {
  const client = createHttpClient(baseUrl);
  const response = await client.post("/api/login", {
    body: { username, password, clinicIdentifier },
  });
  return { client, response };
}
