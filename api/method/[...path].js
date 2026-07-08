const FRAPPE_BASE_URL = (process.env.FRAPPE_BASE_URL || process.env.VITE_FRAPPE_BASE_URL || "https://btm.digihoopoe.com").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY || process.env.VITE_API_KEY || "";
const API_SECRET = process.env.API_SECRET || process.env.VITE_API_SECRET || "";

function normalizePath(value) {
  if (Array.isArray(value)) return value.join("/");
  return String(value || "");
}

function serializeBody(req) {
  if (req.body == null) return undefined;
  if (Buffer.isBuffer(req.body) || typeof req.body === "string") return req.body;

  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body)) {
      params.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    return params.toString();
  }

  return JSON.stringify(req.body);
}

function rewriteCookie(cookie) {
  return cookie
    .replace(/;\s*Domain=[^;]*/gi, "")
    .replace(/;\s*SameSite=Lax/gi, "; SameSite=None")
    .replace(/;\s*SameSite=Strict/gi, "; SameSite=None");
}

export default async function handler(req, res) {
  const methodPath = normalizePath(req.query.path);
  if (!methodPath) {
    res.status(400).json({ error: "Missing Frappe method path" });
    return;
  }

  const target = `${FRAPPE_BASE_URL}/api/method/${methodPath}`;
  const headers = {
    accept: req.headers.accept || "application/json",
    "content-type": req.headers["content-type"] || "application/x-www-form-urlencoded; charset=UTF-8",
  };

  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers["x-frappe-csrf-token"]) headers["x-frappe-csrf-token"] = req.headers["x-frappe-csrf-token"];
  if (req.headers.authorization) headers.authorization = req.headers.authorization;

  // Inject server-side API key/secret if no client auth is present
  if (!headers.cookie && !headers.authorization && API_KEY && API_SECRET) {
    headers.authorization = `token ${API_KEY}:${API_SECRET}`;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : serializeBody(req),
      redirect: "manual",
    });

    const setCookie = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
    if (setCookie.length) res.setHeader("set-cookie", setCookie.map(rewriteCookie));

    const contentType = upstream.headers.get("content-type") || "application/json";
    res.setHeader("content-type", contentType);
    res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ error: "Frappe proxy failed", detail: String(error && error.message ? error.message : error) });
  }
}
