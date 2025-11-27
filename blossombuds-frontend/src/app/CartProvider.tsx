// src/app/CartProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  id: string;
  productId: number; // unique per product+variant (e.g., "prod_123|v:45,67")
  name: string;
  price: number;       // unit price actually charged
  qty: number;
  image?: string;
  variant?: string;    // human-readable, e.g. "Red / Large"
};

type CartContext = {
  items: CartItem[];
  count: number;                        // total quantity across items
  total: number;                        // sum(price * qty)
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartContext>(null!);
const LS_KEY = "bb.cart.v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
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
    setItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.id === incoming.id && p.variant === incoming.variant
      );
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { ...incoming, qty }];
    });
  };

  // Remove by id
  const remove = (id: string) =>
    setItems((prev) => prev.filter((p) => p.id !== id));

  // Set quantity (min 1)
  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: Math.max(1, qty | 0) } : p))
    );

  // Clear all
  const clear = () => setItems([]);

  // Derive count & total from items
  const { count, total } = useMemo(() => {
    const count = items.reduce((n, it) => n + it.qty, 0);
    const total = items.reduce((n, it) => n + it.price * it.qty, 0);
    return { count, total };
  }, [items]);

  const value = useMemo(
    () => ({ items, count, total, add, remove, setQty, clear }),
    [items, count, total]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);