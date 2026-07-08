const FRAPPE_BASE_URL = (process.env.FRAPPE_BASE_URL || "https://btm.digihoopoe.com").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY || "";
const API_SECRET = process.env.API_SECRET || "";

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

export default async function handler(req, res) {
  let method = req.query.method;
  if (!method) {
    res.status(400).json({ error: "Missing Frappe method" });
    return;
  }

  const target = `${FRAPPE_BASE_URL}/api/method/${method}`;
  const headers = {
    accept: req.headers.accept || "application/json",
    "content-type": req.headers["content-type"] || "application/x-www-form-urlencoded; charset=UTF-8",
  };

  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers["x-frappe-csrf-token"]) headers["x-frappe-csrf-token"] = req.headers["x-frappe-csrf-token"];

  if (API_KEY && API_SECRET) {
    headers.authorization = `token ${API_KEY}:${API_SECRET}`;
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: serializeBody(req),
      redirect: "manual",
    });

    const setCookie = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
    if (setCookie.length) {
      res.setHeader("set-cookie", setCookie.map(c => c.replace(/;\s*Domain=[^;]*/gi, "").replace(/;\s*SameSite=Lax/gi, "; SameSite=None").replace(/;\s*SameSite=Strict/gi, "; SameSite=None")));
    }

    const contentType = upstream.headers.get("content-type") || "application/json";
    res.setHeader("content-type", contentType);
    res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).json({ error: "Frappe proxy failed", detail: String(error.message || error) });
  }
}
