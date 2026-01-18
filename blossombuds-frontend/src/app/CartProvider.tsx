// src/app/CartProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { getProduct } from "../api/catalog";

export type CartItem = {
  id: string;
  productId: number;
  name: string;
  price: number;
  qty: number;
  image?: string;
  variant?: string;

  inStock?: boolean;        // last-known stock (from backend)
  unavailable?: boolean;    // true if inactive/hidden/out-of-stock/missing
  lastCheckedAt?: number;
};

type CartContext = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  refresh: (force?: boolean) => Promise<CartItem[]>;
};

const Ctx = createContext<CartContext>(null!);

const LS_KEY = "bb.cart.v2";
const LS_KEY_V1 = "bb.cart.v1";

const now = () => Date.now();

function visibleForCustomer(p: any) {
  const v = p?.visible ?? p?.isVisible ?? null;
  return v !== false; // default visible
}
function inStockForCustomer(p: any) {
  const s = p?.inStock ?? p?.isInStock ?? p?.instock ?? null;
  return s !== false; // default in stock
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const rawV2 = localStorage.getItem(LS_KEY);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        return Array.isArray(parsed) ? parsed : [];
      }

      // ✅ fallback to v1 (if you had older carts)
      const rawV1 = localStorage.getItem(LS_KEY_V1);
      const parsedV1 = rawV1 ? JSON.parse(rawV1) : [];
      return Array.isArray(parsedV1) ? parsedV1 : [];
    } catch {
      return [];
    }
  });

  // Keep latest items in a ref to avoid stale closures in refresh()
  const itemsRef = useRef<CartItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items]);

  const add = (incoming: CartItem) => {
    const qty = Math.max(1, incoming.qty | 0);

    // If caller passes unavailable or inStock=false, don't add
    if (incoming.unavailable === true || incoming.inStock === false) return;

    setItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.id === incoming.id && p.variant === incoming.variant
      );
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          qty: copy[idx].qty + qty,
          // keep unavailable if already true; otherwise leave unknown until refresh
          unavailable: copy[idx].unavailable === true ? true : undefined,
        };
        return copy;
      }

      return [
        ...prev,
        {
          ...incoming,
          qty,
          inStock: incoming.inStock ?? undefined,
          unavailable: incoming.unavailable ?? undefined,
          lastCheckedAt: incoming.lastCheckedAt ?? undefined,
        },
      ];
    });
  };

  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));

  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (p.unavailable) return { ...p, qty: Math.max(1, p.qty | 0) };
        return { ...p, qty: Math.max(1, qty | 0) };
      })
    );

  const clear = () => setItems([]);

  // Count/total exclude unavailable items
  const { count, total } = useMemo(() => {
    const available = items.filter((it) => !it.unavailable);
    const count = available.reduce((n, it) => n + it.qty, 0);
    const total = available.reduce((n, it) => n + it.price * it.qty, 0);
    return { count, total };
  }, [items]);

  const refreshingRef = useRef(false);

  /**
   * Refresh availability from backend.
   * - Dedupe by productId (one call per product, even if multiple variants)
   * - Throttled by lastCheckedAt unless force=true
   */
  const refresh = useCallback(async (force: boolean = false) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const snapshot = itemsRef.current;
      if (!snapshot.length) return;

      const THROTTLE_MS = 60_000;

      // Decide which productIds need checking
      const byProductId = new Map<number, { lastCheckedAt: number }>();
      for (const it of snapshot) {
        const ts = it.lastCheckedAt ?? 0;
        const prev = byProductId.get(it.productId);
        const minTs = prev ? Math.min(prev.lastCheckedAt, ts) : ts;
        byProductId.set(it.productId, { lastCheckedAt: minTs });
      }

      const productIdsToCheck = Array.from(byProductId.entries())
        .filter(([_, meta]) => force || now() - meta.lastCheckedAt > THROTTLE_MS)
        .map(([pid]) => pid);

      if (!productIdsToCheck.length) return;

      const fetched = await Promise.allSettled(
        productIdsToCheck.map((pid) => getProduct(pid))
      );

      const statusByProduct = new Map<number, { inStock: boolean; unavailable: boolean; checkedAt: number }>();

      fetched.forEach((res, idx) => {
        const pid = productIdsToCheck[idx];
        const checkedAt = now();

        if (res.status !== "fulfilled") {
          statusByProduct.set(pid, { inStock: false, unavailable: true, checkedAt });
          return;
        }

        const p: any = res.value;
        const active = p?.active !== false;
        const visible = visibleForCustomer(p);
        const inStock = inStockForCustomer(p);

        const unavailable = !(active && visible && inStock);
        statusByProduct.set(pid, { inStock, unavailable, checkedAt });
      });
const base = itemsRef.current;

      const nextItems = base.map((it) => {
        const st = statusByProduct.get(it.productId);
        if (!st) return it;
        return {
          ...it,
          inStock: st.inStock,
          unavailable: st.unavailable,
          lastCheckedAt: st.checkedAt,
        };
      });
      itemsRef.current = nextItems;
     // ✅ update state (UI will reflect)
           setItems(nextItems);

           // ✅ return fresh items (so Checkout/Cart button logic can block correctly)
           return nextItems;
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  // ✅ Refresh once on app load (force so it checks even if timestamps exist)
  useEffect(() => {
    refresh(true).catch(() => {});
  }, [refresh]);

  // ✅ Refresh when user comes back to tab / window (important for admin toggles)
  useEffect(() => {
    const onFocus = () => refresh(true).catch(() => {});
    const onVis = () => {
      if (document.visibilityState === "visible") refresh(true).catch(() => {});
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ items, count, total, add, remove, setQty, clear, refresh }),
    [items, count, total, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
