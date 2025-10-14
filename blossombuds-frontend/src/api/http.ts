// src/api/http.ts
import axios from "axios";

const AUTH_KEY = "bb.jwt";


/** Read the customer JWT from storage. */
export function getAuthToken(): string | null {
  try { return localStorage.getItem(AUTH_KEY); } catch { return null; }
}

/** Write (or clear) the customer JWT in storage and axios default header. */
export function setAuthToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(AUTH_KEY);
    else localStorage.setItem(AUTH_KEY, token);
  } catch {}
  if (!token) delete http.defaults.headers.common["Authorization"];
  else http.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

/** Convenience clearer. */
export function clearAuthToken(): void {
  setAuthToken(null);
}

/** Subscribe to unauthorized events (401/403). Returns an unsubscribe fn. */
type UnauthHandler = () => void;
const unauthHandlers = new Set<UnauthHandler>();
export function onUnauthorized(handler: UnauthHandler): () => void {
  unauthHandlers.add(handler);
  return () => unauthHandlers.delete(handler);
}

/**
 * Central HTTP client
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "", // e.g. "http://localhost:8080"
  withCredentials: false, // using Authorization header, not cookies
});

// Restore token on startup
const boot = getAuthToken();
if (boot) setAuthToken(boot);

// Attach Authorization header per request (belt & suspenders)
http.interceptors.request.use((config) => {
  const t = getAuthToken();
  if (t) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${t}` };
  }
  return config;
});

// One-shot session-expiry bounce
let authBounced = false;
http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if ((status === 401 || status === 403) && !authBounced) {
      authBounced = true;
      clearAuthToken();

      // Notify explicit subscribers
      for (const fn of Array.from(unauthHandlers)) {
        try { fn(); } catch {}
      }

      // Also broadcast a DOM event if someone listens globally
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("bb-session-expired"));
        // re-enable after a short delay/navigation
        setTimeout(() => { authBounced = false; }, 500);
      }, 0);
    }
    return Promise.reject(err);
  }
);

function isAdminUrl(url: string | undefined) {
  return !!url && /\/api\/admin\//.test(url);
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url as string | undefined;

    // Fire global unauthorized ONLY for non-admin calls
    if (status === 401 && !isAdminUrl(url)) {
      window.dispatchEvent(new CustomEvent("bb:unauthorized"));
    }
    return Promise.reject(err);
  }
);

export default http;
