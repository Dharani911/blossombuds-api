// src/app/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { extractCustomerFromToken } from "../lib/jwt";
import { getAuthToken, setAuthToken, clearAuthToken, onUnauthorized } from "../api/http";

export type Customer = {
  id?: string | number;
  name?: string;
  email?: string;
  phone?:string |number;
};

type AuthCtx = {
  user: Customer | null;
  token: string | null;
  loading: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void;
  refreshFromStorage: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [didAlert, setDidAlert] = useState(false); // prevent duplicate popups in a burst of 401s

  const derive = (tok: string | null) => {
    if (!tok) return setUser(null);
    const { id, email, name } = extractCustomerFromToken(tok);
    setUser({ id, email, name });
  };

  // boot from localStorage
  useEffect(() => {
    const t = getAuthToken();
    setToken(t);
    derive(t);
    setLoading(false);
  }, []);

  // Listen for global 401s → auto-logout + popup
  useEffect(() => {
    const off = onUnauthorized(() => {
      // Clear token & user
      clearAuthToken();
      setToken(null);
      setUser(null);
      // Popup message (once per “wave”)
      if (!didAlert) {
        setDidAlert(true);
        // Simple popup; replace with your toast system if you prefer
        window.alert("Session ended. Please login again.");
        // reset guard after a short delay so future expiries can alert again
        setTimeout(() => setDidAlert(false), 1500);
      }
    });
    return off;
  }, [didAlert]);

  const value = useMemo<AuthCtx>(() => ({
    user,
    token,
    loading,
    loginWithToken: (t: string) => {
      setAuthToken(t);
      setToken(t);
      derive(t);
    },
    logout: () => {
      setAuthToken(null);
      setToken(null);
      setUser(null);
    },
    refreshFromStorage: () => {
      const t = getAuthToken();
      setToken(t);
      derive(t);
    }
  }), [user, token, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}