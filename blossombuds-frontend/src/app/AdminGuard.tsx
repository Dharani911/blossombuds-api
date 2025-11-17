import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAdminToken } from "../api/adminHttp";

/**
 * Minimal guard: if an admin token exists, allow.
 * API will still enforce roles; if the token is wrong, calls will 401/403
 * and adminHttp will handle redirect back to /admin/login.
 */
export default function AdminGuard() {
  const loc = useLocation();
  const token = getAdminToken();

  if (!token) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ next: loc.pathname + loc.search }}
      />
    );
  }
  return <Outlet />;
}