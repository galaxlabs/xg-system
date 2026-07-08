export function resolveFrappeBaseUrl(): string {
  const envBase = import.meta.env.VITE_FRAPPE_BASE_URL as string | undefined;
  const trimmed = envBase?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
}

export async function callFrappe<T = unknown>(
  method: string,
  args?: Record<string, unknown>
): Promise<T> {
  const getCookie = (name: string): string => {
    const key = `${name}=`;
    const parts = document.cookie.split(";").map((v) => v.trim());
    const match = parts.find((p) => p.startsWith(key));
    return match ? decodeURIComponent(match.slice(key.length)) : "";
  };

  const baseUrl = resolveFrappeBaseUrl();
  const url = baseUrl
    ? new URL(`/api/method/${method}`, baseUrl).toString()
    : `/api/method/${method}`;

  const body = new URLSearchParams();
  if (args) {
    for (const [key, value] of Object.entries(args)) {
      body.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }

  // API token auth remains available for cross-site testing or local dev.
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  const apiSecret = import.meta.env.VITE_API_SECRET as string | undefined;
  const authHeader: Record<string, string> = apiKey && apiSecret
    ? { Authorization: `token ${apiKey}:${apiSecret}` }
    : {
        "X-Frappe-CSRF-Token":
          (window as { csrf_token?: string }).csrf_token || getCookie("csrftoken") || "Guest",
      };

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
      ...authHeader,
    },
    body: body.toString(),
  });

  const json = (await res.json()) as { message?: T; exc?: string; _server_messages?: string };
  if (!res.ok || json.exc) {
    throw new Error(json.exc || json._server_messages || `Request failed: ${res.status}`);
  }
  return (json.message ?? (json as unknown)) as T;
}
