// src/api/authFetch.ts
const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8080"; // <- backend

export function getToken(): string | null {
  return localStorage.getItem("bb.admin.jwt");
}

export async function authFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  if (res.status === 403) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return res;
}
