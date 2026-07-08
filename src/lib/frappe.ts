export function resolveFrappeBaseUrl(): string {
  const envBase = import.meta.env.VITE_FRAPPE_BASE_URL as string | undefined;
  const trimmed = envBase?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
}

function getCookie(name: string): string {
  const key = `${name}=`;
  const parts = document.cookie.split(";").map((v) => v.trim());
  const match = parts.find((p) => p.startsWith(key));
  return match ? decodeURIComponent(match.slice(key.length)) : "";
}

export async function loginFrappe(usr: string, pwd: string): Promise<void> {
  const baseUrl = resolveFrappeBaseUrl();
  const url = baseUrl
    ? new URL("/api/method/login", baseUrl).toString()
    : "/api/method/login";

  const body = new URLSearchParams();
  body.set("usr", usr);
  body.set("pwd", pwd);

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as { message?: string; exc?: string; _server_messages?: string };
  if (!res.ok || json.exc) {
    throw new Error(json.exc || json._server_messages || "Login failed. Check the username and password.");
  }
}

export async function callFrappe<T = unknown>(
  method: string,
  args?: Record<string, unknown>
): Promise<T> {
  const baseUrl = resolveFrappeBaseUrl();
  const url = baseUrl
    ? new URL(`/api/method/${method}`, baseUrl).toString()
    : `/api/method/${method}`;

  const body = new URLSearchParams();
  if (args) {
    for (const [key, value] of Object.entries(args)) {
      if (value == null || value === "") continue;
      body.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }

  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  const apiSecret = import.meta.env.VITE_API_SECRET as string | undefined;
  const useToken = apiKey && apiSecret && resolveFrappeBaseUrl() !== window.location?.origin;

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
      ...(useToken
        ? { Authorization: `token ${apiKey}:${apiSecret}` }
        : {
            "X-Frappe-CSRF-Token":
              (window as { csrf_token?: string }).csrf_token || getCookie("csrftoken") || "Guest",
          }),
    },
    body: body.toString(),
  });

  const json = (await res.json()) as { message?: T; exc?: string; _server_messages?: string };
  if (!res.ok || json.exc) {
    throw new Error(json.exc || json._server_messages || `Request failed: ${res.status}`);
  }
  return (json.message ?? (json as unknown)) as T;
}
