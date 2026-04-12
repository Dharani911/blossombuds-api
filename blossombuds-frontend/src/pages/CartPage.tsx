// src/pages/CartPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { useCart } from "../app/CartProvider";
import { listProductImages, getProduct, listCartSuggestions, type Product } from "../api/catalog";
import ProductQuickView from "../components/ProductQuickView";
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

.desktop-only{ display:block; }
.mobile-only{ display:none; }

@media (max-width: 980px){
  .desktop-only{ display:none; }
  .mobile-only{ display:block; }
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

.suggest-top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  padding:0;
  background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95));
}

.suggest-copy{
  min-width:0;
  flex:1;
}

.suggest-head{
  padding:16px 16px 6px;
  font-weight:900;
  font-size:22px;
  line-height:1.2;
  color:var(--primary);
}

.suggest-sub{
  padding:0 16px 14px;
  font-size:14px;
  line-height:1.45;
  color:var(--primary);
  opacity:.82;
}

.suggest-nav{
  display:flex;
  align-items:center;
  gap:8px;
  padding:14px 14px 0 0;
  flex:0 0 auto;
}

.suggest-arrow{
  width:34px;
  height:34px;
  border:none;
  border-radius:999px;
  background:#fff;
  color:var(--primary);
  font-size:22px;
  line-height:1;
  font-weight:900;
  cursor:pointer;
  box-shadow:0 8px 20px rgba(0,0,0,.10);
  display:flex;
  align-items:center;
  justify-content:center;
  touch-action:manipulation;
}

.suggest-arrow:hover{
  transform:translateY(-1px);
}

.suggest-arrow:disabled{
  opacity:.45;
  cursor:not-allowed;
  transform:none;
}

.suggest-viewport{
  width:100%;
  overflow:hidden;
}

.suggest-track{
  display:flex;
  gap:12px;
  overflow-x:auto;
  overflow-y:hidden;
  padding:0 16px 16px;
  scroll-behavior:smooth;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}

.suggest-track::-webkit-scrollbar{
  display:none;
}

.cart-suggest-card{
  flex:0 0 220px;
  width:220px;
  min-width:220px;
  max-width:220px;
  display:flex;
  flex-direction:column;
  background:#fff;
  border:1px solid rgba(0,0,0,.06);
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 8px 22px rgba(0,0,0,.10);
}

.cart-suggest-media{
  position:relative;
  width:100%;
  aspect-ratio:1 / 1;
  background:#f7f7f7;
  overflow:hidden;
}

.cart-suggest-media img,
.cart-suggest-ph{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
}

.cart-suggest-media img{
  object-fit:cover;
  display:block;
}

.cart-suggest-ph{
  display:grid;
  place-items:center;
  background:radial-gradient(1000px 240px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff);
  font-size:12px;
  opacity:.65;
}

.cart-suggest-oos{
  position:absolute;
  left:8px;
  top:8px;
  padding:4px 8px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  background:rgba(0,0,0,.72);
  color:#fff;
}

.cart-suggest-meta{
  padding:10px 10px 0;
  display:grid;
  gap:5px;
  min-height:62px;
}

.cart-suggest-name{
  font-weight:900;
  color:var(--primary);
  font-size:13px;
  line-height:1.3;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  word-break:break-word;
  min-height:2.6em;
}

.cart-suggest-price{
  font-weight:900;
  color:var(--accent);
  font-size:13px;
}

.cart-suggest-price-discount{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:baseline;
}

.cart-suggest-price-discount .old{
  font-weight:800;
  opacity:.6;
  text-decoration:line-through;
  color:#444;
}

.cart-suggest-price-discount .new{
  font-weight:900;
  color:var(--accent);
}

.cart-suggest-price-discount .off{
  font-size:11px;
  font-weight:900;
  padding:2px 6px;
  border-radius:999px;
  background:rgba(240,93,139,.12);
  border:1px solid rgba(240,93,139,.22);
  color:var(--accent);
}

.cart-suggest-actions{
  display:grid;
  margin-top:auto;
  padding:10px;
}

.cart-suggest-btn{
  height:34px;
  border:none;
  border-radius:10px;
  background:var(--accent);
  color:#fff;
  font-weight:900;
  cursor:pointer;
  font-size:12.5px;
  box-shadow:0 10px 24px rgba(240,93,139,.24);
}

.cart-suggest-btn.disabled,
.cart-suggest-btn:disabled{
  opacity:.55;
  cursor:not-allowed;
  box-shadow:none;
}
.cart-wrap{
  --ink:rgba(0,0,0,.08);
  --accent:#F05D8B;
  --gold:#F6C320;
  --primary:#4A4F41;
  --danger:#D7263D;
  max-width:1200px;
  margin:0 auto;
  padding:5px;
  color:var(--primary);
  width:100%;
  min-width:0;
  overflow-x:clip;
  box-sizing:border-box;
}

.cart-wrap *{
  box-sizing:border-box;
}

.grid,
.card,
.items,
.items-list,
.sum,
.suggest-wrap,
.suggest-card,
.suggest-viewport,
.suggest-track{
  min-width:0;
}

@media (max-width: 560px){
  .mobile-only,
  .suggest-wrap,
  .suggest-card,
  .suggest-viewport{
    width:100%;
    max-width:100%;
    min-width:0;
    overflow:hidden;
    box-sizing:border-box;
  }

  .suggest-wrap{
    margin-top:10px;
  }

  .suggest-card{
    border-radius:12px;
  }

  .suggest-top{
    gap:6px;
    align-items:flex-start;
  }

  .suggest-copy{
    min-width:0;
  }

  .suggest-head{
    font-size:14px;
    line-height:1.15;
    padding:10px 10px 2px;
  }

  .suggest-sub{
    font-size:10.5px;
    line-height:1.25;
    padding:0 10px 8px;
  }

  .suggest-nav{
    padding:8px 8px 0 0;
    gap:4px;
    flex-shrink:0;
  }

  .suggest-arrow{
    width:24px;
    height:24px;
    font-size:16px;
    flex:0 0 24px;
  }

  .suggest-track{
    display:grid;
    grid-auto-flow:column;
    grid-auto-columns:calc((100% - 8px) / 2);
    gap:8px;
    padding:0 8px 8px;
    overflow-x:auto;
    overflow-y:hidden;
    scroll-behavior:smooth;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
    width:100%;
    max-width:100%;
    min-width:0;
    box-sizing:border-box;
    overscroll-behavior-x:contain;
    scroll-snap-type:x mandatory;
  }

  .suggest-track::-webkit-scrollbar{
    display:none;
  }

  .cart-suggest-card{
    width:100%;
    min-width:0;
    max-width:none;
    border-radius:9px;
    box-shadow:0 6px 16px rgba(0,0,0,.08);
    box-sizing:border-box;
    overflow:hidden;
    scroll-snap-align:start;
  }

  .cart-suggest-media{
    aspect-ratio:1 / 1;
    width:100%;
    overflow:hidden;
  }

  .cart-suggest-media img,
  .cart-suggest-ph{
    width:100%;
    height:100%;
    max-width:100%;
  }

  .cart-suggest-meta{
    padding:6px 6px 0;
    gap:3px;
    min-height:46px;
    min-width:0;
  }

  .cart-suggest-name{
    font-size:10.5px;
    line-height:1.15;
    min-height:2.2em;
    overflow:hidden;
    word-break:break-word;
  }

  .cart-suggest-price{
    font-size:10.5px;
  }

  .cart-suggest-price-discount{
    gap:3px;
    min-width:0;
  }

  .cart-suggest-price-discount .old{
    font-size:9.5px;
  }

  .cart-suggest-price-discount .new{
    font-size:10.5px;
  }

  .cart-suggest-price-discount .off{
    font-size:8.5px;
    padding:1px 4px;
  }

  .cart-suggest-actions{
    padding:6px;
    gap:4px;
  }

  .cart-suggest-btn{
    height:26px;
    font-size:10px;
    border-radius:7px;
  }

  .cart-suggest-oos{
    left:5px;
    top:5px;
    font-size:8.5px;
    padding:2px 5px;
  }
}
@media (max-width: 768px){
  .row{
    display:grid;
    grid-template-columns: 52px minmax(0,1fr) 78px 20px;
    grid-template-rows:auto auto;
    column-gap:6px;
    row-gap:4px;
    padding:10px 6px;
    align-items:center;
    border-bottom:1px dashed var(--ink);
    min-width:0;
  }

  .thumb{
    grid-column:1;
    grid-row:1 / span 2;
    width:52px;
    height:52px;
    border-radius:8px;
  }

  .meta{
    grid-column:2;
    grid-row:1 / span 2;
    min-width:0;
    display:flex;
    flex-direction:column;
    gap:2px;
    align-self:center;
  }

  .name{
    font-size:12px;
    font-weight:800;
    line-height:1.15;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .variant{
    font-size:10px;
    opacity:.72;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }

  .small{
    font-size:10px;
    line-height:1.15;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }

  .price-remove-wrap{
    grid-column:3 / 5;
    grid-row:1;
    width:auto;
    min-width:0;
    justify-self:end;
    display:flex;
    align-items:center;
    justify-content:flex-end;
    gap:2px;
  }

  .line{
    font-size:11px;
    font-weight:900;
    white-space:nowrap;
    text-align:right;
  }

  .rm{
    width:20px;
    height:20px;
    font-size:13px;
    flex:0 0 20px;
  }

  .qty-mini{
    grid-column:3;
    grid-row:2;
    width:78px;
    justify-self:end;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:3px;
    padding:2px 5px;
    border-radius:999px;
    border:1px solid var(--ink);
    background:#fff;
    font-size:10px;
    font-weight:700;
    box-shadow:0 4px 10px rgba(0,0,0,.06);
  }

  .qty-mini button{
    width:18px;
    height:18px;
    font-size:12px;
    font-weight:800;
    border-radius:999px;
    border:1px solid var(--ink);
    background:#f8f8f8;
    display:grid;
    place-items:center;
    padding:0;
    line-height:1;
  }

  .qty-mini span{
    min-width:12px;
    text-align:center;
  }

  .stock-slot{
    grid-column:3;
    grid-row:2;
    width:78px;
    justify-self:end;
    display:flex;
    align-items:center;
    justify-content:center;
  }

  .stock{
    height:18px;
    padding:0 6px;
    font-size:9px;
  }
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
function SuggestThumb({
  productId,
  src,
  alt,
}: {
  productId?: number;
  src?: string | null;
  alt: string;
}) {
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

      if (alive) {
        setImgSrc(src ? cacheBust(src) : null);
      }
    }

    resolveFresh();
    return () => {
      alive = false;
    };
  }, [productId, src]);

  return (
    <>
      {imgSrc ? (
        <img src={imgSrc} alt={alt} loading="lazy" />
      ) : (
        <div className="cart-suggest-ph" aria-hidden />
      )}
    </>
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
function SuggestionProductCard({
  p,
  onView,
}: {
  p: Product;
  onView: (productId: number) => void;
}) {
  const inStock = (p as any)?.inStock ?? (p as any)?.isInStock ?? true;
  const outOfStock = inStock === false;

  function formatINR(n: number) {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(n);
    } catch {
      return `₹${n.toFixed(2)}`;
    }
  }

  const isExcluded = Boolean((p as any)?.excludeFromGlobalDiscount);

  const discountPercent = (() => {
    const pct = Number((p as any)?.discountPercentOff ?? 0);
    if (Number.isFinite(pct) && pct > 0) return Math.min(95, Math.max(0, pct));

    const orig = Number((p as any)?.originalPrice);
    const fin = Number((p as any)?.finalPrice);
    if (Number.isFinite(orig) && orig > 0 && Number.isFinite(fin) && fin >= 0 && fin < orig) {
      return Math.min(95, Math.max(0, Math.round(((orig - fin) / orig) * 100)));
    }
    return 0;
  })();

  const originalPrice = (() => {
    const n = Number((p as any)?.price);
    return Number.isFinite(n) ? n : null;
  })();

  const displayPrices = (() => {
    if (originalPrice == null) return null;

    if (isExcluded || discountPercent <= 0) {
      return { showDiscount: false, original: originalPrice, final: originalPrice };
    }

    const final = Number((p as any)?.finalPrice ?? Math.round(originalPrice * (1 - discountPercent / 100)));
    return { showDiscount: final < originalPrice, original: originalPrice, final };
  })();

  return (
    <article className="cart-suggest-card" aria-label={p.name}>
      <div className="cart-suggest-media">
        <SuggestThumb
          productId={p.id}
          src={p.primaryImageUrl || null}
          alt={p.name}
        />
        {outOfStock && <span className="cart-suggest-oos">Out of stock</span>}
      </div>

      <div className="cart-suggest-meta">
        <div className="cart-suggest-name" title={p.name}>
          {p.name}
        </div>

        {displayPrices && (
          displayPrices.showDiscount ? (
            <div className="cart-suggest-price cart-suggest-price-discount">
              <span className="old">{formatINR(displayPrices.original)}</span>
              <span className="new">{formatINR(displayPrices.final)}</span>
              <span className="off">{discountPercent}% OFF</span>
            </div>
          ) : (
            <div className="cart-suggest-price">{formatINR(displayPrices.final)}</div>
          )
        )}
      </div>

      <div className="cart-suggest-actions">
        <button
          className={"cart-suggest-btn" + (outOfStock ? " disabled" : "")}
          onClick={() => !outOfStock && onView(p.id)}
          disabled={outOfStock || p.active === false || p.visible === false}
          type="button"
        >
          Add to cart
        </button>
      </div>
    </article>
  );
}
export default function CartPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

const { items, total, remove, setQty, clear, refresh } = useCart();
const [qvId, setQvId] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
const [allSuggestions, setAllSuggestions] = useState<Product[]>([]);
const [suggestLoading, setSuggestLoading] = useState(false);
  const hasUnavailable = useMemo(
    () => items.some((it: any) => it.unavailable === true),
    [items]
  );
  const suggestions = useMemo(() => {
    const cartProductIds = new Set(
      items.map((it: any) => Number(it.productId)).filter(Boolean)
    );

    return allSuggestions
      .filter((p) => !cartProductIds.has(Number(p.id)))
      .slice(0, 10);
  }, [allSuggestions, items]);
const mobileSuggestTrackRef = useRef<HTMLDivElement | null>(null);
const desktopSuggestTrackRef = useRef<HTMLDivElement | null>(null);

  function scrollSuggestions(dir: "left" | "right") {
    const isMobile = window.innerWidth <= 980;
    const el = isMobile ? mobileSuggestTrackRef.current : desktopSuggestTrackRef.current;
    if (!el) return;

    const step =
      window.innerWidth <= 560
        ? Math.max(140, Math.floor(el.clientWidth * 0.52))
        : (() => {
            const card = el.querySelector(".cart-suggest-card") as HTMLElement | null;
            return card ? card.getBoundingClientRect().width + 12 : 232;
          })();

    el.scrollBy({
      left: dir === "right" ? step : -step,
      behavior: "smooth",
    });
  }
useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      setSuggestLoading(true);
      const rows = await listCartSuggestions();
      if (cancelled) return;
      setAllSuggestions(rows || []);
    } catch {
      if (!cancelled) setAllSuggestions([]);
    } finally {
      if (!cancelled) setSuggestLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);
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
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const productParam = params.get("product");

  if (!productParam) {
    setQvId(null);
    return;
  }

  const idNum = Number(productParam);
  if (Number.isFinite(idNum) && idNum > 0) {
    setQvId(idNum);
  } else {
    setQvId(null);
  }
}, [location.search]);
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

  // ✅ helper: treat "unavailable" as the only time we show the pill & hide qty
  const isUnavailable = (it: any) => it?.unavailable === true;
function openProductQuickView(productId: number) {
  const params = new URLSearchParams(location.search);
  params.set("product", String(productId));

  setQvId(productId);

  nav(
    {
      pathname: location.pathname,
      search: `?${params.toString()}`,
    },
    { replace: false }
  );
}

function closeQuickView() {
  const params = new URLSearchParams(location.search);
  params.delete("product");

  setQvId(null);

  const nextSearch = params.toString();
  nav(
    {
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : "",
    },
    { replace: true }
  );
}
const renderSuggestionsSection = (trackRef: React.RefObject<HTMLDivElement | null>) =>
  (suggestLoading || suggestions.length > 0) ? (
    <section className="suggest-wrap">
      <div className="suggest-card">
        <div className="suggest-top">
          <div className="suggest-copy">
            <div className="suggest-head">You may also like</div>
            <div className="suggest-sub">
              Handpicked products chosen from admin suggestions.
            </div>
          </div>

          {!suggestLoading && suggestions.length > 2 && (
            <div className="suggest-nav">
              <button
                type="button"
                className="suggest-arrow"
                onClick={() => scrollSuggestions("left")}
                aria-label="Scroll products left"
              >
                ‹
              </button>
              <button
                type="button"
                className="suggest-arrow"
                onClick={() => scrollSuggestions("right")}
                aria-label="Scroll products right"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {suggestLoading ? (
          <div className="suggest-viewport">
            <div className="suggest-track">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="cart-suggest-card">
                  <div className="cart-suggest-media">
                    <div className="cart-suggest-ph" />
                  </div>
                  <div className="cart-suggest-meta">
                    <div className="small">Loading product…</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="suggest-viewport">
            <div className="suggest-track" ref={trackRef}>
              {suggestions.map((p) => (
                <SuggestionProductCard
                  key={p.id}
                  p={p}
                  onView={openProductQuickView}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  ) : null;
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
                                <button onClick={() => setQty(it.id, Math.max(1, it.qty - 1))}>−</button>
                                <span>{it.qty}</span>
                                <button onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                              </div>
                            )}

                            <div className="price-remove-wrap">
                              <div className="line">{inr(it.price * it.qty)}</div>
                              <button className="rm" onClick={() => remove(it.id)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="mobile-only">
                      {renderSuggestionsSection(mobileSuggestTrackRef)}
                    </div>

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

                  <div className="desktop-only">
                    {renderSuggestionsSection(desktopSuggestTrackRef)}
                  </div>
                </>

      )}
      {qvId != null && (
        <ProductQuickView
          productId={qvId}
          onClose={closeQuickView}
        />
      )}
    </div>
  );
}
