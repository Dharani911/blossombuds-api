// src/app/CartProvider.tsx
import { createContext, useContext, useEffect, useRef, useMemo, useState } from "react";
import { getProduct } from "../api/catalog";
export type CartItem = {
  id: string;
  productId: number; // unique per product+variant (e.g., "prod_123|v:45,67")
  name: string;
  price: number;       // unit price actually charged
  qty: number;
  image?: string;
  variant?: string;    // human-readable, e.g. "Red / Large"
  inStock?: boolean;        // last-known stock (from backend)
  unavailable?: boolean;    // convenience flag for UI (out-of-stock / missing / inactive / invisible)
  lastCheckedAt?: number;
};

type CartContext = {
  items: CartItem[];
  count: number;                        // total quantity across items
  total: number;                        // sum(price * qty)
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CartContext>(null!);
const LS_KEY = "bb.cart.v2";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {

    try {
      const rawV2 = localStorage.getItem(LS_KEY);
      if (rawV2) return JSON.parse(rawV2);

      const rawV1 = localStorage.getItem("bb.cart.v2");
      const parsed = rawV1 ? JSON.parse(rawV1) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  // Add or merge
  const add = (incoming: CartItem) => {
    const qty = Math.max(1, incoming.qty | 0);

    // If caller passes unavailable=false/true we respect it
        if (incoming.unavailable === true || incoming.inStock === false) {
          // silently ignore OR you can throw / toast outside
          return;
        }

    setItems((prev) => {
          const idx = prev.findIndex((p) => p.id === incoming.id && p.variant === incoming.variant);
          if (idx > -1) {
            const copy = [...prev];
            const nextQty = copy[idx].qty + qty;
            copy[idx] = {
              ...copy[idx],
              qty: nextQty,
              // reset availability to “unknown” until refresh confirms
              unavailable: copy[idx].unavailable === true ? true : undefined,
            };
            return copy;
          }
          return [
            ...prev,
            {
              ...incoming,
              qty,
              // normalize missing flags
              inStock: incoming.inStock ?? undefined,
              unavailable: incoming.unavailable ?? undefined,
              lastCheckedAt: incoming.lastCheckedAt ?? undefined,
            },
          ];
        });
  };

  // Remove by id
  const remove = (id: string) =>
    setItems((prev) => prev.filter((p) => p.id !== id));

  // Set quantity (min 1)
  const setQty = (id: string, qty: number) =>
      setItems((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (p.unavailable) return { ...p, qty: Math.max(1, p.qty | 0) }; // keep existing qty
          return { ...p, qty: Math.max(1, qty | 0) };
        })
      );

  // Clear all
  const clear = () => setItems([]);

  // Derive count & total from items
  const { count, total } = useMemo(() => {
      const available = items.filter((it) => !it.unavailable);
      const count = available.reduce((n, it) => n + it.qty, 0);
      const total = available.reduce((n, it) => n + it.price * it.qty, 0);
      return { count, total };
    }, [items]);

  const refreshingRef = useRef(false);

  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const snapshot = items;
      if (!snapshot.length) return;

      const THROTTLE_MS = 60_000; // check each product at most once per minute

      // build list to check
      const toCheck = snapshot.filter((it) => {
        const ts = it.lastCheckedAt ?? 0;
        return now() - ts > THROTTLE_MS;
      });

      if (!toCheck.length) return;

      // fetch in parallel (small fan-out). If you have many items, limit concurrency.
      const results = await Promise.all(
        toCheck.map(async (it) => {
          try {
            const p: any = await getProduct(it.productId);

            // Determine availability from product flags
            const active = p?.active !== false;
            const visible = (p?.visible ?? p?.isVisible ?? true) !== false;
            const inStock = (p?.inStock ?? true) !== false;

            const unavailable = !(active && visible && inStock);

            return {
              id: it.id,
              inStock,
              unavailable,
              lastCheckedAt: now(),
            };
          } catch {
            // product missing / API error => treat as unavailable (safer)
            return {
              id: it.id,
              inStock: false,
              unavailable: true,
              lastCheckedAt: now(),
            };
          }
        })
      );

      // merge results into state
      setItems((prev) =>
        prev.map((it) => {
          const r = results.find((x) => x.id === it.id);
          if (!r) return it;
          return {
            ...it,
            inStock: r.inStock,
            unavailable: r.unavailable,
            lastCheckedAt: r.lastCheckedAt,
          };
        })
      );
    } finally {
      refreshingRef.current = false;
    }
  };

  // ✅ Refresh once on app load
  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Refresh when cart changes (but throttled per item)
  useEffect(() => {
    if (!items.length) return;
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const value = useMemo(
    () => ({ items, count, total, add, remove, setQty, clear,refresh }),
    [items, count, total]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);