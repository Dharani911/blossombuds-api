import { createContext, useContext, useEffect, useMemo, useState } from "react";
export type CartItem = { id:string; name:string; price:number; qty:number; image?:string; variant?:string };

type Ctx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item:CartItem)=>void;
  remove: (id:string)=>void;
  setQty: (id:string, qty:number)=>void;
  clear: ()=>void;
};
const C = createContext<Ctx>(null!);
const KEY = "bb.cart.v1";

export function CartProvider({children}:{children:React.ReactNode}){
  const [items,setItems] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(KEY);
    return raw? JSON.parse(raw): [];
  });
  useEffect(()=>{ localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (it:CartItem)=> {
    setItems(prev=>{
      const idx = prev.findIndex(p=>p.id===it.id && p.variant===it.variant);
      if (idx>-1){ const c=[...prev]; c[idx]={...c[idx], qty:c[idx].qty+it.qty}; return c; }
      return [...prev, it];
    });
  };
  const remove = (id:string)=> setItems(prev=>prev.filter(p=>p.id!==id));
  const setQty = (id:string, qty:number)=> setItems(prev=>prev.map(p=>p.id===id? {...p, qty}: p));
  const clear = ()=> setItems([]);
  const count = items.reduce((a,b)=>a+b.qty,0);
  const total = items.reduce((a,b)=>a+b.price*b.qty,0);

  const value = useMemo(()=>({items,count,total,add,remove,setQty,clear}),[items,count,total]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useCart = ()=>useContext(C);
