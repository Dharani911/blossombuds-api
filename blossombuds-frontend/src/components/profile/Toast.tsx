import React, { createContext, useContext, useMemo, useState } from "react";

export type Toast = { id: number; text: string; tone?: "ok"|"warn"|"bad" };

const ToastCtx = createContext<{
  items: Toast[];
  push: (text: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  const api = useMemo(()=>({
    items,
    push(text: string, tone: Toast["tone"]="ok") {
      const id = Date.now() + Math.random();
      setItems(t => [...t, { id, text, tone }]);
      setTimeout(() => setItems(t => t.filter(x=>x.id !== id)), 2200);
    }
  }), [items]);
  return api;
}

// Visual host you can mount once per page
export function ToastHost({ items }: { items: Toast[] }) {
  return (
    <div className="toasts">
      <style>{styles}</style>
      {items.map(t => (
        <div key={t.id} className={`toast ${t.tone||"ok"}`}>{t.text}</div>
      ))}
    </div>
  );
}

const styles = `
.toasts{ position: fixed; z-index: 999; right: 16px; bottom: 16px; display:grid; gap: 8px; }
.toast{ padding: 10px 12px; border-radius: 12px; background:#fff; border:1px solid rgba(0,0,0,.08);
  box-shadow: 0 18px 40px rgba(0,0,0,.18); font-weight: 800; color: var(--bb-primary);
  animation: toastIn .18s ease both; }
.toast.ok{ border-color: rgba(46,125,50,.24); }
.toast.warn{ border-color: rgba(246,195,32,.44); }
.toast.bad{ border-color: rgba(198,40,40,.34); }
@keyframes toastIn{ from{opacity:0; transform: translateY(6px)} to{opacity:1; transform:none} }
`;
