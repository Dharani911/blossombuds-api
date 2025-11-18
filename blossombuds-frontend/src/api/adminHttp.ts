// src/api/adminHttp.ts
import axios from "axios";

/**
 * Dedicated HTTP client for ADMIN APIs.
 * Keeps its OWN token (bb.admin.jwt) separate from the customer token.
 */

// Resolve admin API base the same way as the main client
const ADMIN_API_BASE =
  import.meta.env.VITE_API_BASE_URL || // optional override
  import.meta.env.VITE_API_BASE ||     // main API base (Railway / backend)
  import.meta.env.VITE_API_URL ||      // legacy/admin-specific env
  "/api";                              // fallback (dev proxy)

console.log("🛠 ADMIN_API_BASE =", ADMIN_API_BASE);
console.log("   VITE_API_BASE =", import.meta.env.VITE_API_BASE);
console.log("   VITE_API_URL  =", import.meta.env.VITE_API_URL);

const adminHttp = axios.create({
  baseURL: ADMIN_API_BASE,
  withCredentials: false,     // we use Bearer token, not cookies
  timeout: 120000,            // prevents large upload timeouts
});

// ---- admin token plumbing ----
let _adminJwt: string | null = null;

export function setAdminToken(token: string | null) {
  _adminJwt = token;
  if (token) {
    try { localStorage.setItem("bb.admin.jwt", token); } catch {}
    adminHttp.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    try { localStorage.removeItem("bb.admin.jwt"); } catch {}
    delete adminHttp.defaults.headers.common["Authorization"];
  }
}

export function getAdminToken(): string | null {
  if (_adminJwt) return _adminJwt;
  try {
    const saved = localStorage.getItem("bb.admin.jwt");
    if (saved) {
      _adminJwt = saved;
      adminHttp.defaults.headers.common["Authorization"] = `Bearer ${saved}`;
      return saved;
    }
  } catch {}
  return null;
}

// boot: restore token if present
getAdminToken();

// attach token on every request (belt & suspenders)
adminHttp.interceptors.request.use((config) => {
  const tok = getAdminToken();
  if (tok && !config.headers?.Authorization) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${tok}` };
  }
  return config;
});

// admin-only 401 → go to /admin/login (do NOT touch customer session)
adminHttp.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/admin/login?expired=1&next=${next}`);
      return; // stop further processing
    }
    return Promise.reject(err);
  }
);

export default adminHttp;
