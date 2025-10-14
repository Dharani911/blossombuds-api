import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAdminToken, setAdminToken } from "../api/adminHttp";

type AdminUser = { username?: string; roles?: string[] } | null;

type Ctx = {
  token: string | null;
  admin: AdminUser;
  loading: boolean;
  loginWithToken: (t: string) => void;
  logout: () => void;
};

const C = createContext<Ctx | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getAdminToken();
    setToken(t);
    // Optional: parse roles/claims from JWT if you encode them
    setAdmin(t ? { username: "admin" } : null);
    setLoading(false);
  }, []);

  const value = useMemo(() => ({
    token,
    admin,
    loading,
    loginWithToken: (t: string) => {
      setAdminToken(t);
      setToken(t);
      setAdmin({ username: "admin" });
    },
    logout: () => {
      setAdminToken(null);
      setToken(null);
      setAdmin(null);
    },
  }), [token, admin, loading]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
