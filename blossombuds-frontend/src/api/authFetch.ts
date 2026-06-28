// src/api/authFetch.ts
import { apiUrl } from "./base";


export function getToken(): string | null {
  try {
    return localStorage.getItem("bb.admin.jwt");
  } catch {
    return null;
  }
}

export async function authFetch(path: string, init: RequestInit = {}) {
  // If caller passes absolute URL, keep it. Otherwise prefix with backend base.
  const url =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : apiUrl(path); // e.g. "/api/admin/..." → "https://blossombuds-api-production.../api/admin/..."

  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...init,
    headers,
    // you *can* keep "include" if you truly need cookies, but for pure JWT it’s usually "omit"
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/admin/login?expired=1&next=${next}`);
    return res; // navigation already triggered; caller won't proceed
  }

  return res;
}
