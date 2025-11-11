// src/components/ProductQuickView.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../app/CartProvider";
import {
  getProduct,
  listProductImages,
  getProductOptionsWithValues,
  type Product,
  type ProductImage,
  type ProductOptionWithValues,
} from "../api/catalog";

type Props = { productId: number; onClose: () => void };

export default function ProductQuickView({ productId, onClose }: Props) {
  const { add, count } = useCart();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [p, setP] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [cur, setCur] = useState(0);

  const [opts, setOpts] = useState<ProductOptionWithValues[]>([]);
  const [sel, setSel] = useState<Record<number, number>>({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // cart pill animation when count changes
  const prevCount = useRef(count);
  const [cartPop, setCartPop] = useState(false);
  useEffect(() => {
    if (prevCount.current !== count) {
      setCartPop(true);
      const t = setTimeout(() => setCartPop(false), 450);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
  }, [count]);

  // LOAD product + images + options
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const [prod, imgs, options] = await Promise.all([
          getProduct(productId),
          listProductImages(productId),
          getProductOptionsWithValues(productId),
        ]);
        if (!live) return;

        setP(prod || null);
        const sortedImgs = (imgs || [])
          .filter(im => im?.url)
          .sort((a,b)=>(a.sortOrder ?? 0)-(b.sortOrder ?? 0));
        setImages(sortedImgs);

        // 🔒 Only keep options that are visible (visible !== false)
        const visibleOptions = (options || []).filter(o => (o as any)?.visible !== false);

        // default: select FIRST active + visible value for each visible option
        const s: Record<number, number> = {};
        visibleOptions.forEach(o => {
          const act = (o.values || []).filter(v => v.active !== false && (v as any)?.visible !== false);
          if (act.length) s[o.id] = act[0].id;
        });

        setOpts(visibleOptions);
        setSel(s);
      } catch (e:any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load product.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [productId]);

  // Treat option value's price as ABSOLUTE (not delta)
  function readValuePrice(v: any): number | undefined {
    const cand = [v?.price, v?.finalPrice, v?.absolutePrice, v?.amount];
    for (const c of cand) if (typeof c === "number") return Number(c);
    if (typeof v?.priceDelta === "number") return Number(v.priceDelta);
    return undefined;
  }

  // compute unit price from the selected (visible) value that has a price
  const unitPrice = useMemo(() => {
    for (const o of opts) {
      const vId = sel[o.id];
      const v: any = o.values.find(x => x.id === vId && (x as any)?.visible !== false);
      const vp = readValuePrice(v);
      if (typeof vp === "number") return vp;
    }
    return Number(p?.price ?? 0);
  }, [opts, sel, p?.price]);

  const priceText = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(unitPrice);
    } catch {
      return `₹${unitPrice.toFixed(2)}`;
    }
  }, [unitPrice]);

  function pick(optionId: number, valueId: number) {
    setSel(s => ({ ...s, [optionId]: valueId }));
  }

  function onAdd() {
    if (!p || adding) return;
    // ensure required options (only among visible options)
    for (const o of opts) {
      if (o.required && !sel[o.id]) {
        alert(`Please select: ${o.name}`);
        return;
      }
    }
    setAdding(true);
    add({
      id: `${p.id}:${Object.values(sel).sort().join(",") || "base"}`,
      name: p.name,
      price: unitPrice,
      qty: Math.max(1, qty|0),
      image: images[0]?.url || p.primaryImageUrl || "",
      variant: opts.map(o => {
        const v = o.values.find(x => x.id === sel[o.id]);
        return v ? `${o.name}: ${v.valueLabel}` : "";
      }).filter(Boolean).join(" / "),
    });
    // ↓ Reset quantity back to default after adding
    setQty(1);
    // keep options as chosen; just pulse the CTA for feedback
    setTimeout(() => setAdding(false), 650);
  }

  const hero = images[cur]?.url || p?.primaryImageUrl || "";
  const hasNav = images.length > 1;

  // Auto-rotate carousel
  const timerRef = useRef<number | null>(null);
  const pauseRef = useRef(false);
  const goto = (i: number) => setCur(Math.max(0, Math.min(images.length - 1, i)));
  const next = () => setCur(i => (i >= images.length - 1 ? 0 : i + 1));
  const prev = () => setCur(i => (i <= 0 ? Math.max(0, images.length - 1) : i - 1));

  useEffect(() => {
    if (!hasNav) return;
    timerRef.current = window.setInterval(() => {
      if (!pauseRef.current) next();
    }, 4500);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [hasNav, images.length]);

  const onHover = (v: boolean) => { pauseRef.current = v; };

  return (
    <div className="pqv-modal" role="dialog" aria-modal="true" onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
      <div className="pqv-panel" role="document">
        <button className="pqv-close" aria-label="Close" onClick={onClose}>✕</button>

        {/* floating cart pill */}
        <div className={"pqv-cartpill" + (cartPop ? " pop" : "")} title="Cart">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
            <path d="M6 6h14l-1.6 8H8.4L7 4H3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="9" cy="20" r="1.6" />
            <circle cx="18" cy="20" r="1.6" />
          </svg>
          <span className="txt">Cart • {count}</span>
        </div>

        {err && <div className="pqv-alert">{err}</div>}
        {loading && <div style={{ padding: 16 }}>Loading…</div>}

        {!loading && p && (
          <div className="pqv-grid">
            {/* GALLERY */}
            <div className="pqv-gallery" onMouseEnter={()=>onHover(true)} onMouseLeave={()=>onHover(false)}>
              <div className="pqv-hero">
                {hero ? <img src={hero} alt={p.name} /> : <div className="pqv-blank" />}
                {hasNav && (
                  <>
                    <button className="nav prev" onClick={prev} aria-label="Previous image">‹</button>
                    <button className="nav next" onClick={next} aria-label="Next image">›</button>
                  </>
                )}
              </div>

              {/* Thumbs wrap — no scrolling container */}
              {images.length > 0 && (
                <ul className="pqv-thumbs" role="list">
                  {images.map((im, i) => (
                    <li key={im.id ?? i}>
                      <button
                        className={`pqv-thumb ${i===cur ? "on":""}`}
                        onClick={() => goto(i)}
                        aria-label={`Image ${i+1}`}
                      >
                        <img src={im.url} alt={im.altText || p.name} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* INFO + OPTIONS */}
            <div className="pqv-info">
              <h1 className="pqv-title">{p.name}</h1>
              <div className="pqv-price">{priceText}</div>

              {/* Only render visible options; values within also must be visible */}
              {opts.map((o, idx) => {
                const act = o.values.filter(v => v.active !== false && (v as any)?.visible !== false);
                if (act.length === 0) return null; // nothing to pick, hide block
                const currentVal = sel[o.id] ?? act[0]?.id ?? undefined;
                return (
                  <div key={o.id} className={"pqv-opt" + (idx>0 ? " subtle": "")}>
                    <div className="pqv-optlabel">{o.name}{o.required ? " *" : ""}</div>
                    <div className="pqv-pills" role="radiogroup" aria-label={o.name}>
                      {act.map(v => (
                        <button
                          key={v.id}
                          className={"pill" + (currentVal === v.id ? " on": "")}
                          onClick={() => pick(o.id, v.id)}
                          role="radio"
                          aria-checked={currentVal === v.id}
                          title={v.valueLabel}
                        >
                          <span className="dot" /> {v.valueLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="pqv-qty">
                <label htmlFor="pqv-qty">Qty</label>
                <input
                  id="pqv-qty"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                />
              </div>

              <div className="pqv-actions">
                <button
                  className={"pqv-btn" + (adding ? " pulse" : "")}
                  onClick={onAdd}
                  disabled={adding}
                >
                  {adding ? "Added!" : "Add to cart"}
                </button>
                <Link to="/cart" className="pqv-btn secondary">Go to cart</Link>
              </div>

              {p.description && (
                <div className="pqv-desc" dangerouslySetInnerHTML={{ __html: p.description }} />
              )}
            </div>
          </div>
        )}
      </div>

      <style>{styles}</style>
    </div>
  );
}

const styles = `
.pqv-modal{ position:fixed; inset:0; z-index:300; display:grid; place-items:center;
  backdrop-filter: blur(6px); background: rgba(0,0,0,.28); padding: 12px; }
.pqv-panel{ width:min(1100px, 96vw); height:min(88vh, 880px); border-radius:18px; background:#fff;
  box-shadow:0 30px 70px rgba(0,0,0,.35); border:1px solid rgba(0,0,0,.08); position:relative;
  display:flex; flex-direction:column; animation: pop .18s ease-out both; overflow:hidden; }
@keyframes pop{ from{ transform: scale(.985); opacity:0 } to { transform:none; opacity:1 } }
.pqv-close{ position:absolute; top:10px; right:10px; border:1px solid rgba(0,0,0,.1);
  background:#fff; border-radius:10px; height:34px; padding:0 10px; cursor:pointer; z-index:2; }

.pqv-cartpill{ position:absolute; top:10px; left:12px; display:inline-flex; align-items:center; gap:6px;
  background: linear-gradient(90deg, #111, #333); color:#fff; font-weight:900; font-size:12px;
  border-radius:999px; padding:5px 9px; box-shadow: 0 10px 26px rgba(0,0,0,.2); z-index:2; }
.pqv-cartpill svg{ color:#ffd44e; }
.pqv-cartpill.pop{ animation: bump .42s ease; }
@keyframes bump{ 0%{ transform: scale(1) } 35%{ transform: scale(1.07) } 100%{ transform: scale(1) } }

.pqv-alert{ margin:10px 12px; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }

.pqv-grid{ display:grid; grid-template-columns: 1.15fr 1fr; gap:14px;
  padding: 44px 12px 12px; height:100%; min-height:0; }
@media (max-width: 980px){ .pqv-grid{ grid-template-columns: 1fr; } }

/* GALLERY */
.pqv-gallery{ display:grid; grid-template-rows: 1fr auto; gap:8px; min-height:0; }
.pqv-hero{
  position:relative; background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:14px;
  box-shadow:0 12px 30px rgba(0,0,0,.08);
  height: min(64vh, 560px);
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.pqv-hero img{
  max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; display:block;
}
.pqv-blank{ width:100%; height:100%; background:#f5f5f5; }
.nav{ position:absolute; top:50%; transform: translateY(-50%); width:36px; height:36px; border-radius:999px; border:none;
  cursor:pointer; background: rgba(255,255,255,.96); box-shadow: 0 6px 18px rgba(0,0,0,.16);
  font-size:20px; line-height:0; display:grid; place-items:center; }
.nav.prev{ left:10px; } .nav.next{ right:10px; }

/* Thumbs */
.pqv-thumbs{ display:flex; flex-wrap:wrap; gap:6px; padding:2px;
  border:1px solid rgba(0,0,0,.06); border-radius:10px; }
.pqv-thumbs li{ list-style:none; }
.pqv-thumb{ width:84px; height:64px; border-radius:8px; overflow:hidden; border:2px solid transparent; cursor:pointer; }
.pqv-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.pqv-thumb.on{ border-color: var(--bb-accent); }

/* INFO */
.pqv-info{ background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px;
  box-shadow:0 12px 30px rgba(0,0,0,.08); padding:12px; overflow:auto; min-height:0; }
.pqv-title{ margin:0 0 4px; font-family:"DM Serif Display", Georgia, serif; font-size:24px; }
.pqv-price{ font-weight:900; color: var(--bb-accent); margin-bottom:8px; }

/* OPTIONS — compact pills */
.pqv-opt{ margin:8px 0; }
.pqv-optlabel{ font-weight:800; font-size:12px; margin-bottom:6px; opacity:.9; }
.pqv-pills{ display:flex; flex-wrap:wrap; gap:6px; }
.pill{
  display:inline-flex; align-items:center; gap:6px; padding:6px 10px;
  border-radius:999px; border:1px solid rgba(0,0,0,.12); background:#fff; cursor:pointer;
  font-weight:700; font-size:13px; line-height:1; }
.pill .dot{ width:6px; height:6px; border-radius:999px; background: var(--bb-accent-2); }
.pill.on{ border-color: var(--bb-accent); box-shadow: 0 6px 16px rgba(240,93,139,.16); }

/* QTY + ACTIONS */
.pqv-qty{ display:flex; gap:8px; align-items:center; margin:10px 0 6px; }
.pqv-qty input{ width:78px; height:34px; border:1px solid rgba(0,0,0,.10); border-radius:8px; padding:0 10px; }

.pqv-actions{ display:flex; gap:8px; margin-top: 4px; }
.pqv-btn{ display:inline-flex; align-items:center; justify-content:center; height:38px; padding:0 14px;
  border-radius:10px; border:none; cursor:pointer; background: var(--bb-accent); color:#fff; font-weight:900;
  box-shadow: 0 10px 24px rgba(240,93,139,.28); transition: transform .12s ease; font-size:14px; }
.pqv-btn.pulse{ transform: scale(1.04); }
.pqv-btn:disabled{ opacity:.7; cursor:not-allowed; }
.secondary{ background: var(--bb-accent-2); color:#2b2b2b; box-shadow: 0 10px 24px rgba(246,195,32,.2); }

.pqv-desc{ margin-top:10px; line-height:1.5; opacity:.95; font-size:14px; }
`;
