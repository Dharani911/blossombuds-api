// src/pages/CartPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { useCart } from "../app/CartProvider";
import { listProductImages, getProduct, listCartSuggestions, type Product } from "../api/catalog";

const styles = `
.cart-wrap{ --ink:rgba(0,0,0,.08); --accent:#F05D8B; --gold:#F6C320; --primary:#4A4F41; --danger:#D7263D;
  max-width:1200px; margin:0 auto; padding: 5px; color: var(--primary); }

.cart-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:12px; }
.cart-head h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; font-size:28px; }

.cart-empty{ display:grid; place-items:center; gap:10px; padding:24px; background:#fff; border:1px solid var(--ink); border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,.08); }
.cart-empty p{ margin:0; opacity:.85; }

.cta{ display:inline-flex; align-items:center; justify-content:center; height:40px; padding:0 16px; border:none; border-radius:12px;
  font-weight:900; cursor:pointer; background: var(--accent); color:#fff; box-shadow:0 12px 26px rgba(240,93,139,.28); text-decoration:none; }
.cta:hover{ transform: translateY(-1px); box-shadow:0 16px 36px rgba(240,93,139,.36); }

.grid{ display:grid; grid-template-columns: 1.6fr 0.9fr; gap:14px;align-items: flex-start;  }
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }

.card{ background:#fff; border:1px solid var(--ink); border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }

.items{ padding:8px; }
.items-list{ display:block; }

@media (min-width: 981px){
  .items{
    padding:8px;
    display:flex;
    flex-direction:column;
    max-height: 460px;
  }

  .items-head{ flex:0 0 auto; }
  .items-list{ flex:1 1 auto; overflow:auto; }
}

/* ---------- DESKTOP ROW ---------- */
.row {
  display: grid;
  grid-template-columns: 96px 1fr 120px auto;
  gap: 10px;
  align-items: center;
  padding: 10px 8px;
  border-bottom: 1px dashed var(--ink);
}
.row:last-child{ border-bottom:none; }

.thumb{ width:96px; height:72px; border-radius:10px; overflow:hidden; background:#f5f5f5; display:grid; place-items:center; }
.thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.thumb .ph{
  width:100%; height:100%; background: radial-gradient(120px 60px at -20px 50%, #ffe9a8, #ffd3e1 60%, #fff);
  display:grid; place-items:center; font-size:12px; opacity:.6;
}

.meta{ display:flex; flex-direction:column; gap:2px; min-width:0; }
.name{ font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.variant{ font-size:12px; opacity:.75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.line {
  text-align: right;
  font-size: 15px;
  font-weight: 900;
  color: var(--accent);
}

.rm {
  width: 30px;
  height: 30px;
  font-size: 18px;
  background: transparent;
  border: none;
  color: var(--danger);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.rm:hover { background: rgba(240,93,139,.10); }

/* ---------- DESKTOP QTY MINI ---------- */
@media (min-width: 769px) {
  .qty-mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--ink);
    border-radius: 10px;
    background: #fff;
    font-size: 14px;
    font-weight: 700;
    width: fit-content;
    box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  }

  .qty-mini button {
    width: 28px;
    height: 28px;
    font-size: 16px;
    font-weight: 800;
    background: #f8f8f8;
    border: 1px solid var(--ink);
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .qty-mini button:hover {
    background: #fff;
    box-shadow: 0 8px 18px rgba(0,0,0,0.08);
  }

  .qty-mini span {
    min-width: 24px;
    text-align: center;
  }

  .price-remove-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
}

/* ---------- MOBILE VIEW ---------- */
@media (max-width: 768px) {
  .row {
    display: grid;
    grid-template-columns: 60px 1fr auto auto;
    grid-template-rows: auto auto;
    gap: 6px;
    padding: 10px 6px;
    align-items: center;
    border-bottom: 1px dashed var(--ink);
  }

  .thumb {
    grid-row: 1 / span 2;
    width: 60px;
    height: 60px;
    border-radius: 8px;
  }

  .meta {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .qty-mini {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--ink);
    background: #fff;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba(0,0,0,.06);
  }

  .qty-mini button {
    width: 22px;
    height: 22px;
    font-size: 14px;
    font-weight: 800;
    border-radius: 999px;
    border: 1px solid var(--ink);
    background: #f8f8f8;
    display: grid;
    place-items: center;
    padding: 0;
    line-height: 1;
  }

  .qty-mini span {
    min-width: 18px;
    text-align: center;
  }

  .rm {
    grid-column: 4;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: 16px;
    width: 26px;
    height: 26px;
  }

  .name {
    font-size: 13px;
    font-weight: 800;
  }

  .variant {
    font-size: 11px;
    opacity: 0.7;
  }

  .price-remove-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
}

/* --- SUMMARY AND BUTTONS (unchanged) --- */
.items-head, .sum-head{ padding:10px 12px; border-bottom:1px solid var(--ink); background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); font-weight:900; font-size:13px; }

.sum{ position:relative; }
.sum-inner{ position:sticky; top:16px; padding:12px; display:grid; gap:10px; }

.row-sum{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.row-sum .lbl{ opacity:.85; }
.total{ font-size:20px; font-weight:900; }

.actions{ display:grid; gap:8px; margin-top:6px; }

.primary{
  height:42px; border:none; border-radius:12px; background: var(--accent); color:#fff; font-weight:900;
  cursor:pointer; box-shadow:0 12px 28px rgba(240,93,139,.28); transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.primary:hover{ transform: translateY(-1px); box-shadow:0 16px 40px rgba(240,93,139,.36); background:#f1497b; }
.primary:disabled{ opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; }

.secondary{
  height:40px; border:none; border-radius:12px; background: var(--gold); color:#2b2b2b; font-weight:900;
  cursor:pointer; box-shadow:0 10px 20px rgba(246,195,32,.22); transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.secondary:hover{ transform: translateY(-1px); box-shadow:0 14px 30px rgba(246,195,32,.30); background:#f5bd07; }

.danger{
  height:38px; border:1px solid rgba(215,38,61,.25);
  background: linear-gradient(180deg, rgba(215,38,61,.06), #fff);
  color: var(--danger); font-weight:900; border-radius:12px; cursor:pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.danger:hover{ transform: translateY(-1px); box-shadow:0 8px 22px rgba(215,38,61,.18); background:#fff; }

.link{ text-decoration:none; color: var(--primary); font-weight:800; opacity:.85; }
.hr{ height:1px; background: var(--ink); margin:4px 0; }
.small{ font-size:12px; opacity:.75; }

/* ✅ only show pill when unavailable */
.stock{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height:22px;
  padding:0 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  border:1px solid rgba(0,0,0,.10);
  width: fit-content;
  white-space: nowrap;
}
.stock.bad{ background: rgba(240,93,139,.12); color: var(--danger); }

/* ✅ this pill takes the same "slot" as qty-mini */
.stock-slot{
  justify-self: end;          /* line up with qty on desktop/mobile */
}
@media (min-width: 769px){
  .stock-slot{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding: 6px 10px;        /* visually matches qty-mini padding */
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.06);
    background: #fff;
  }
}

.notice{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid rgba(240,93,139,.25);
  background:#fff3f5;
  color:#8a0024;
  font-weight:800;
  font-size:13px;
}
@media (max-width: 768px) {
  .row {
    display: grid;
    grid-template-columns: 60px 1fr 110px auto; /* ✅ fixed qty column */
    grid-template-rows: auto auto;
    gap: 6px;
    padding: 10px 6px;
    align-items: center;
    border-bottom: 1px dashed var(--ink);
  }

  /* ✅ meta spans 2 rows so layout never jumps */
  .meta {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    align-self: center;
  }

  /* ✅ price stays in row1 of the fixed column */
  .price-remove-wrap {
    grid-column: 3;
    grid-row: 1;
    width: 110px;                /* ✅ match the column */
    justify-self: end;
    display: flex;
    align-items: center;
    justify-content: flex-end;     /* price at end */
    gap: 6px;
  }

  /* ✅ qty always sits row2 col3 (stable) */
  .qty-mini {
    grid-column: 3;
    grid-row: 2;
    width: 110px;                 /* ✅ match the column */
    justify-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--ink);
    background: #fff;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 4px 10px rgba(0,0,0,.06);
  }

  /* ✅ unavailable pill uses the exact same slot as qty */
  .stock-slot {
    grid-column: 3;
    grid-row: 2;
    width: 110px;                 /* ✅ match the column */
    justify-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
.suggest-wrap{
  margin-top:16px;
}

.suggest-card{
  background:#fff;
  border:1px solid var(--ink);
  border-radius:16px;
  box-shadow:0 12px 36px rgba(0,0,0,.08);
  overflow:hidden;
}

.suggest-head{
  padding:10px 12px;
  border-bottom:1px solid var(--ink);
  background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95));
  font-weight:900;
  font-size:13px;
}

.suggest-sub{
  padding:0 12px 10px;
  font-size:12px;
  opacity:.72;
}

.suggest-grid{
  padding:12px;
  display:grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap:12px;
}

@media (max-width: 980px){
  .suggest-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px){
  .suggest-grid{
    grid-template-columns: 1fr;
  }
}

.suggest-item{
  border:1px solid var(--ink);
  border-radius:14px;
  overflow:hidden;
  background:#fff;
  box-shadow:0 8px 22px rgba(0,0,0,.05);
  display:flex;
  flex-direction:column;
  min-width:0;
}

.suggest-thumb{
  aspect-ratio: 1 / 1;
  background:#f7f7f7;
  overflow:hidden;
}

.suggest-thumb img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.suggest-thumb .ph{
  width:100%;
  height:100%;
  display:grid;
  place-items:center;
  font-size:12px;
  opacity:.6;
}

.suggest-body{
  padding:10px;
  display:grid;
  gap:6px;
  min-width:0;
}

.suggest-name{
  font-size:14px;
  font-weight:800;
  color:var(--primary);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.suggest-price{
  font-size:14px;
  font-weight:900;
  color:var(--accent);
}

.suggest-price-old{
  font-size:12px;
  opacity:.6;
  text-decoration:line-through;
  margin-right:6px;
  color:#222;
}

.suggest-actions{
  display:grid;
  gap:8px;
  margin-top:2px;
}

.suggest-btn{
  height:38px;
  border:none;
  border-radius:10px;
  background:var(--accent);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  box-shadow:0 10px 20px rgba(240,93,139,.22);
}

.suggest-btn:hover{
  transform:translateY(-1px);
}

.suggest-link{
  height:36px;
  border:1px solid var(--ink);
  border-radius:10px;
  background:#fff;
  color:var(--primary);
  font-weight:800;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}

.suggest-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:fit-content;
  height:22px;
  padding:0 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  background:rgba(240,93,139,.12);
  color:var(--accent);
}
`;

function isAwsSignedUrl(url: string) {
  return (
    /[?&]X-Amz-Algorithm=AWS4-HMAC-SHA256/i.test(url) ||
    /[?&]X-Amz-Signature=/i.test(url)
  );
}
function cacheBust(url: string) {
  if (!url) return url;
  if (isAwsSignedUrl(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}cb=${Date.now()}`;
}

function Thumb({ productId, src, alt }: { productId?: number; src?: string; alt: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;

    if (!productId) {
      setImgSrc(src ? cacheBust(src) : null);
      return () => { alive = false; };
    }

    async function resolveFreshUrl() {
      try {
        const imgs = await listProductImages(productId);
        if (!alive) return;
        const first = (imgs || [])
          .filter((im) => !!im?.url)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
        if (first?.url) {
          setImgSrc(cacheBust(first.url));
          return;
        }
      } catch {}

      try {
        const p = await getProduct(productId);
        if (!alive) return;
        if ((p as any)?.primaryImageUrl) {
          setImgSrc(cacheBust((p as any).primaryImageUrl));
          return;
        }
      } catch {}

      if (alive) setImgSrc(src ? cacheBust(src) : null);
    }

    setImgSrc(null);
    resolveFreshUrl();

    return () => { alive = false; };
  }, [productId, src, refreshKey]);

  function handleError() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="thumb" aria-label={alt}>
      {imgSrc ? (
        <img src={imgSrc} alt={alt} loading="lazy" onError={handleError} />
      ) : (
        <div className="ph">No image</div>
      )}
    </div>
  );
}
function SuggestThumb({ productId, src, alt }: { productId?: number; src?: string | null; alt: string }) {
  const [imgSrc, setImgSrc] = useState<string | null>(src ? cacheBust(src) : null);

  useEffect(() => {
    let alive = true;

    async function resolveFresh() {
      if (!productId) {
        setImgSrc(src ? cacheBust(src) : null);
        return;
      }

      try {
        const imgs = await listProductImages(productId);
        if (!alive) return;
        const first = (imgs || [])
          .filter((im) => !!im?.url)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];

        if (first?.url) {
          setImgSrc(cacheBust(first.url));
          return;
        }
      } catch {}

      try {
        const p = await getProduct(productId);
        if (!alive) return;
        if ((p as any)?.primaryImageUrl) {
          setImgSrc(cacheBust((p as any).primaryImageUrl));
          return;
        }
      } catch {}

      if (alive) setImgSrc(src ? cacheBust(src) : null);
    }

    resolveFresh();
    return () => { alive = false; };
  }, [productId, src]);

  return (
    <div className="suggest-thumb" aria-label={alt}>
      {imgSrc ? (
        <img src={imgSrc} alt={alt} loading="lazy" />
      ) : (
        <div className="ph">No image</div>
      )}
    </div>
  );
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `₹${(n || 0).toFixed(2)}`;
  }
}

export default function CartPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

const { items, total, remove, setQty, clear, refresh, add } = useCart();
  const [checking, setChecking] = useState(false);
const [suggestions, setSuggestions] = useState<Product[]>([]);
const [suggestLoading, setSuggestLoading] = useState(false);
  const hasUnavailable = useMemo(
    () => items.some((it: any) => it.unavailable === true),
    [items]
  );
useEffect(() => {
  let alive = true;

  (async () => {
    try {
      setSuggestLoading(true);
      const rows = await listCartSuggestions();
      if (!alive) return;

      const cartProductIds = new Set(
        items.map((it: any) => Number(it.productId)).filter(Boolean)
      );

      const filtered = (rows || [])
        .filter((p) => !cartProductIds.has(Number(p.id)))
        .slice(0, 10);

      setSuggestions(filtered);
    } catch {
      if (!alive) return;
      setSuggestions([]);
    } finally {
      if (alive) setSuggestLoading(false);
    }
  })();

  return () => { alive = false; };
}, [items]);
  // Refresh when Cart page opens (force)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setChecking(true);
        await refresh(true);
      } catch {
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => { live = false; };
  }, [refresh]);

  async function handleProceed() {
    if (!user?.id) {
      nav("/login", { state: { background: location, from: location } });
      return;
    }

    let updated = items;
    try {
      setChecking(true);
      updated = await refresh(true);
    } finally {
      setChecking(false);
    }

    const stillBad = (updated as any[]).some((it) => it.unavailable === true);
    if (stillBad) return;

    nav("/checkout");
  }
function addSuggestedProduct(p: Product) {
  add({
    id: `${p.id}:base`,
    productId: p.id,
    name: p.name,
    price: Number(p.finalPrice ?? p.price ?? 0),
    originalPrice:
      p.originalPrice != null ? Number(p.originalPrice) : Number(p.price ?? 0),
    qty: 1,
    image: (p as any).primaryImageUrl || "",
    variant: "",
    selectedValueIds: [],
    inStock: p.inStock !== false,
    unavailable:
      p.inStock === false ||
      p.active === false ||
      p.visible === false,
    lastCheckedAt: Date.now(),
  });
}
  // ✅ helper: treat "unavailable" as the only time we show the pill & hide qty
  const isUnavailable = (it: any) => it?.unavailable === true;

  return (
    <div className="cart-wrap">
      <style>{styles}</style>

      <header className="cart-head">
        <h1>Your Cart</h1>
        {items.length > 0 && (
          <span className="small">
            {items.length} item{items.length > 1 ? "s" : ""}
          </span>
        )}
      </header>

      {items.length === 0 ? (
        <div className="cart-empty">
          <p>Your cart is empty.</p>
          <Link to="/categories" className="cta">
            Start shopping
          </Link>
        </div>
      ) : (
                <>
                  <div className="grid">
                    <section className="card items">
                      <div className="items-head">Items</div>

                      <div className="items-list">
                        {items.map((it: any) => (
                          <div className="row" key={it.id}>
                            <Thumb productId={it.productId} src={it.image} alt={it.name} />

                            <div className="meta">
                              <div className="name">{it.name}</div>
                              {it.variant && (
                                <div className="variant" title={it.variant}>
                                  {it.variant}
                                </div>
                              )}

                              <span className="small">
                                {it.originalPrice != null && Number(it.originalPrice) > Number(it.price) ? (
                                  <>
                                    <span style={{ textDecoration: "line-through", opacity: 0.65, marginRight: 6 }}>
                                      {inr(it.originalPrice)}
                                    </span>
                                    <span style={{ fontWeight: 900 }}>{inr(it.price)}</span> each
                                  </>
                                ) : (
                                  <>
                                    {inr(it.price)} each
                                  </>
                                )}
                              </span>
                            </div>

                            {isUnavailable(it) ? (
                              <div className="stock-slot">
                                <span className="stock bad">Unavailable</span>
                              </div>
                            ) : (
                              <div className="qty-mini">
                                <button onClick={() => setQty(it.id, Math.max(1, it.qty - 1))}>
                                  −
                                </button>
                                <span>{it.qty}</span>
                                <button onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                              </div>
                            )}

                            <div className="price-remove-wrap">
                              <div className="line">{inr(it.price * it.qty)}</div>
                              <button className="rm" onClick={() => remove(it.id)}>
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <aside className="card sum">
                      <div className="sum-head">Order Summary</div>
                      <div className="sum-inner">
                        {hasUnavailable && (
                          <div className="notice">
                            Some items in your cart are unavailable (hidden/out of stock). Remove them to continue.
                          </div>
                        )}

                        <div className="row-sum">
                          <span className="lbl">Subtotal</span>
                          <span className="val">{inr(total)}</span>
                        </div>
                        <div className="hr" />
                        <div className="row-sum total">
                          <span>Total</span>
                          <span>{inr(total)}</span>
                        </div>

                        <div className="actions">
                          <button
                            className="primary"
                            onClick={handleProceed}
                            disabled={checking || hasUnavailable}
                            title={
                              hasUnavailable
                                ? "Remove unavailable items to proceed"
                                : checking
                                ? "Checking availability…"
                                : undefined
                            }
                          >
                            {checking ? "Checking…" : "Proceed to Checkout"}
                          </button>

                          <button className="secondary" onClick={() => nav("/categories")}>
                            Continue Shopping
                          </button>

                          <button
                            className="danger"
                            onClick={() => {
                              const ok = confirm("Clear all items from your cart?");
                              if (ok) clear();
                            }}
                          >
                            Clear Cart
                          </button>

                          <button
                            className="danger"
                            onClick={async () => {
                              try {
                                setChecking(true);
                                await refresh(true);
                              } finally {
                                setChecking(false);
                              }
                            }}
                          >
                            Refresh Availability
                          </button>
                        </div>
                      </div>
                    </aside>
                  </div>

                  {(suggestLoading || suggestions.length > 0) && (
                    <section className="suggest-wrap">
                      <div className="suggest-card">
                        <div className="suggest-head">You may also like</div>
                        <div className="suggest-sub">
                          Handpicked products chosen from admin suggestions.
                        </div>

                        {suggestLoading ? (
                          <div className="suggest-grid">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="suggest-item">
                                <div className="suggest-thumb">
                                  <div className="ph">Loading…</div>
                                </div>
                                <div className="suggest-body">
                                  <div className="small">Loading product…</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="suggest-grid">
                            {suggestions.map((p) => {
                              const discounted =
                                p.originalPrice != null &&
                                p.finalPrice != null &&
                                Number(p.finalPrice) < Number(p.originalPrice);

                              const finalUnit = Number(p.finalPrice ?? p.price ?? 0);

                              return (
                                <div key={p.id} className="suggest-item">
                                  <SuggestThumb
                                    productId={p.id}
                                    src={(p as any).primaryImageUrl || null}
                                    alt={p.name}
                                  />

                                  <div className="suggest-body">
                                    <div className="suggest-name" title={p.name}>
                                      {p.name}
                                    </div>

                                    {discounted && (
                                      <span className="suggest-badge">
                                        {Math.round(Number(p.discountPercentOff || 0))}% OFF
                                      </span>
                                    )}

                                    <div className="suggest-price">
                                      {discounted ? (
                                        <>
                                          <span className="suggest-price-old">
                                            {inr(Number(p.originalPrice))}
                                          </span>
                                          {inr(finalUnit)}
                                        </>
                                      ) : (
                                        inr(finalUnit)
                                      )}
                                    </div>

                                    <div className="suggest-actions">
                                      <button
                                        className="suggest-btn"
                                        onClick={() => addSuggestedProduct(p)}
                                        disabled={
                                          p.inStock === false ||
                                          p.active === false ||
                                          p.visible === false
                                        }
                                      >
                                        {p.inStock === false ? "Out of stock" : "Add to cart"}
                                      </button>

                                      <Link className="suggest-link" to={`/products/${p.id}`}>
                                        View product
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </>
      )}
    </div>
  );
}
