import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Admin-only "Demo Mode": visually blurs anything wrapped in <Sensitive> (customer PII,
 * financial figures, internal notes, admin identities) so the live admin app can be shown
 * to prospective clients without exposing real data. Persisted across reloads/navigation
 * so it doesn't silently drop mid-demo.
 */
const STORAGE_KEY = "bb:admin:demoMode";

type Ctx = {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  toggleDemoMode: () => void;
};

const C = createContext<Ctx | null>(null);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, demoMode ? "1" : "0");
    } catch {
      /* ignore quota/availability errors */
    }
  }, [demoMode]);

  const value = useMemo<Ctx>(() => ({
    demoMode,
    setDemoMode: setDemoModeState,
    toggleDemoMode: () => setDemoModeState((v) => !v),
  }), [demoMode]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDemoMode() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useDemoMode must be used within DemoModeProvider");
  return ctx;
}
