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
import { getProduct, getProductOptionsWithValues } from "../api/catalog";

export type CartItem = {
  id: string;
  productId: number;
  name: string;
  price: number;
  // ✅ original unit price for strike-through UI
    originalPrice?: number;

    // optional UI helpers (from backend)
    discounted?: boolean;
    discountPercentOff?: number;
    discountLabel?: string;
  qty: number;
  image?: string;
  variant?: string;

  // ✅ NEW: used to re-check variant visibility + reprice on refresh
  selectedValueIds?: number[];

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
function readValueFinalPrice(v: any): number | undefined {
  const cand = [v?.finalPrice, v?.price, v?.absolutePrice, v?.amount];
  for (const c of cand) if (typeof c === "number") return Number(c);
  if (typeof v?.priceDelta === "number") return Number(v.priceDelta); // fallback
  return undefined;
}

function readValueOriginalPrice(v: any): number | undefined {
  const cand = [v?.originalPrice, v?.priceDelta, v?.price];
  for (const c of cand) if (typeof c === "number") return Number(c);
  return undefined;
}

// Treat option value's price as ABSOLUTE (not delta), but allow fallback fields
function readValuePrice(v: any): number | undefined {
  const cand = [v?.price, v?.finalPrice, v?.absolutePrice, v?.amount];
  for (const c of cand) if (typeof c === "number") return Number(c);
  if (typeof v?.priceDelta === "number") return Number(v.priceDelta);
  return undefined;
}

function normalizeSelectedValueIds(it: any): number[] {
  // ✅ supports older carts:
  // if selectedValueIds missing, try parse from id "pid:1,2,3"
  if (Array.isArray(it.selectedValueIds) && it.selectedValueIds.length) {
    return it.selectedValueIds;
  }

  const parts = String(it.id || "").split(":");
  if (parts.length >= 2 && parts[1] && parts[1] !== "base") {
    return parts[1]
      .split(",")
      .map((x: string) => Number(x))
      .filter((n: number) => Number.isFinite(n));
  }
  return [];
}

function computeVariantStatusAndPrices(
  baseOriginal: number,
  baseFinal: number,
  options: any[] | null | undefined,
  selectedValueIds: number[]
): { unitOriginal: number; unitFinal: number; variantUnavailable: boolean } {
  if (!selectedValueIds.length) {
    return { unitOriginal: baseOriginal, unitFinal: baseFinal, variantUnavailable: false };
  }

  if (!Array.isArray(options) || options.length === 0) {
    return { unitOriginal: baseOriginal, unitFinal: baseFinal, variantUnavailable: true };
  }

  let unitOriginal = baseOriginal;
  let unitFinal = baseFinal;
  let variantUnavailable = false;

  for (const o of options) {
    const values = (o?.values || []) as any[];
    const selected = values.find((v) => selectedValueIds.includes(v.id));
    if (!selected) continue;

    const visible = (selected as any)?.visible !== false;
    const active = (selected as any)?.active !== false;
    if (!visible || !active) variantUnavailable = true;

    // ✅ if a value has its own absolute price, it overrides unit prices
    const vOrig = readValueOriginalPrice(selected);
    const vFinal = readValueFinalPrice(selected);

    if (typeof vOrig === "number") unitOriginal = vOrig;
    if (typeof vFinal === "number") unitFinal = vFinal;
  }

  // If user selected IDs that don't exist anymore => unavailable
  const allValueIds = new Set(options.flatMap((o) => (o?.values || []).map((v: any) => v.id)));
  for (const id of selectedValueIds) {
    if (!allValueIds.has(id)) {
      variantUnavailable = true;
      break;
    }
  }

  return { unitOriginal, unitFinal, variantUnavailable };
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
          // keep latest selectedValueIds if provided
          selectedValueIds:
            incoming.selectedValueIds?.length ? incoming.selectedValueIds : copy[idx].selectedValueIds,
        };
        return copy;
      }

      return [
        ...prev,
        {
          ...incoming,
          qty,
          selectedValueIds: incoming.selectedValueIds?.length ? incoming.selectedValueIds : undefined,
          inStock: incoming.inStock ?? undefined,
          unavailable: incoming.unavailable ?? undefined,
          lastCheckedAt: incoming.lastCheckedAt ?? undefined,
        },
      ];
    });
  };

  const remove = (id: string) =>
    setItems((prev) => prev.filter((p) => p.id !== id));

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
   * Refresh availability + latest pricing from backend.
   * - Dedupe by productId (one call per product, even if multiple variants)
   * - Throttled by lastCheckedAt unless force=true
   * - Updates:
   *    - product availability (active/visible/inStock)
   *    - variant availability (selected value visible/active/existing)
   *    - latest price (base or selected value absolute price)
   */
  const refresh = useCallback(async (force: boolean = false): Promise<CartItem[]> => {
    // Always return a list
    if (refreshingRef.current) return itemsRef.current;

    refreshingRef.current = true;

    try {
      const snapshot = itemsRef.current;
      if (!snapshot.length) return [];

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

      if (!productIdsToCheck.length) return itemsRef.current;

      // Fetch products + their options (for pricing/variant validation)
      const fetchedProducts = await Promise.allSettled(
        productIdsToCheck.map((pid) => getProduct(pid))
      );
      const fetchedOptions = await Promise.allSettled(
        productIdsToCheck.map((pid) => getProductOptionsWithValues(pid))
      );

      const statusByProduct = new Map<
        number,
        {
          inStock: boolean;
          unavailable: boolean;
          checkedAt: number;
          baseOriginal: number;
          baseFinal: number;
          options: any[] | null;
          product: any;
        }
      >();

      productIdsToCheck.forEach((pid, idx) => {
        const checkedAt = now();

        const prodRes = fetchedProducts[idx];
        if (prodRes.status !== "fulfilled") {
          statusByProduct.set(pid, {
            inStock: false,
            unavailable: true,
            checkedAt,
            baseOriginal: 0,
            baseFinal: 0,
            options: null,
            product: null,
          });

          return;
        }

        const p: any = prodRes.value;
        const active = p?.active !== false;
        const visible = visibleForCustomer(p);
        const inStock = inStockForCustomer(p);
        const baseUnavailable = !(active && visible && inStock);
        const baseOriginal = Number(p?.originalPrice ?? p?.price ?? 0);
        const baseFinal = Number(p?.finalPrice ?? p?.price ?? 0);


        const optRes = fetchedOptions[idx];
        const options = optRes.status === "fulfilled" ? ((optRes.value as any[]) ?? []) : null;

        statusByProduct.set(pid, {
          inStock,
          unavailable: baseUnavailable,
          checkedAt,
          baseOriginal,
          baseFinal,
          options,
          product: p,
        });

      });

      const base = itemsRef.current;

      const nextItems: CartItem[] = base.map((it: any) => {
        const st = statusByProduct.get(it.productId);
        if (!st) return it;

        const selectedValueIds = normalizeSelectedValueIds(it);

        const { unitOriginal, unitFinal, variantUnavailable } = computeVariantStatusAndPrices(
          st.baseOriginal,
          st.baseFinal,
          st.options,
          selectedValueIds
        );

        const unavailable = st.unavailable || variantUnavailable;

        return {
          ...it,
          selectedValueIds,
          originalPrice: unitOriginal,
          price: unitFinal,

          // optional UI helpers from backend product (base-level info)
          discounted: Boolean(st.product?.discounted),
          discountPercentOff: Number(st.product?.discountPercentOff ?? 0),
          discountLabel: st.product?.discountLabel ?? null,

          inStock: st.inStock,
          unavailable,
          lastCheckedAt: st.checkedAt,
        };
      });


      itemsRef.current = nextItems;
      setItems(nextItems);
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
