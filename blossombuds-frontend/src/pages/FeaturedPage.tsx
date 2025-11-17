// src/pages/FeaturedPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import Seo from "../components/Seo";
import ProductQuickView from "../components/ProductQuickView";

/** ---------------- Types ---------------- */
type ProductImage = {
  id?: number;
  url?: string | null;
  watermarkVariantUrl?: string | null;
  active?: boolean;
  primary?: boolean;
  sortOrder?: number | null;
  altText?: string | null;
};

type Product = {
  id: number;
  slug?: string | null;
  name: string;
  price?: number | string | null;
  description?: string | null;
  primaryImageUrl?: string | null;
  imageUrl?: string | null;
  coverUrl?: string | null;
  images?: ProductImage[];
  visible?: boolean;
  isVisible?: boolean;
  featured?: boolean;
  active?: boolean;
  _coverResolved?: string | null;
};

/** Resolve best image URL */
function coverUrlOf(p: Product): string | null {
  if (!p) return null;
  if (p.primaryImageUrl) return p.primaryImageUrl;
  if (p.imageUrl) return p.imageUrl;
  if (p.coverUrl) return p.coverUrl;

  if (Array.isArray(p.images) && p.images.length) {
    const prim = p.images.find((i) => i?.primary);
    if (prim?.watermarkVariantUrl) return prim.watermarkVariantUrl;
    if (prim?.url) return prim.url;

    const s0 = p.images.find((i) => (i?.sortOrder ?? 9999) === 0);
    if (s0?.watermarkVariantUrl) return s0.watermarkVariantUrl!;
    if (s0?.url) return s0.url!;

    const active = p.images.find((i) => i?.active && (i.watermarkVariantUrl || i.url));
    if (active?.watermarkVariantUrl) return active.watermarkVariantUrl!;
    if (active?.url) return active.url!;

    if (p.images[0]?.watermarkVariantUrl) return p.images[0].watermarkVariantUrl!;
    if (p.images[0]?.url) return p.images[0].url!;
  }
  return null;
}

/** Normalize visibility (handles `visible` and `isVisible`) */
function isVisibleTrue(p: any): boolean {
  const v = p?.visible ?? p?.isVisible ?? null;
  return v === true;
}

/** Compact product card */
function ProductTile({ p, onOpen }: { p: Product; onOpen: (id: number) => void }) {
  const priceText = useMemo(() => {
    if (p?.price == null) return "";
    const num = Number(p.price);
    if (Number.isNaN(num)) return String(p.price);
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(num);
    } catch {
      return String(p.price);
    }
  }, [p?.price]);

  const img = p._coverResolved ?? coverUrlOf(p);

  return (
    <article
      className="ft-card"
      tabIndex={0}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(p.id);
      }}
      aria-label={`${p.name}${priceText ? `, ${priceText}` : ""}`}
    >
      <div className="media">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="ph" aria-hidden />}

        <button
          className="quick"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(p.id);
          }}
        >
          Quick view
        </button>
      </div>

      <div className="meta">
        <div className="name" title={p.name}>{p.name}</div>
        {priceText && <div className="price">{priceText}</div>}
      </div>

      <button
        className="btn add"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(p.id);
        }}
        aria-label={`Add ${p.name} to cart`}
      >
        Add to cart
      </button>
    </article>
  );
}

export default function FeaturedPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [qvId, setQvId] = useState<number | null>(null);

  // Load featured products
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        let rows: Product[] = [];
        try {
          const rTop = await http.get("/api/catalog/products/featured/top", {
            params: { limit: 24 },
            public: true as any,
            suppressAuthToast: true as any,
          });
          rows = Array.isArray(rTop.data) ? rTop.data : [];
        } catch {
          const r = await http.get("/api/catalog/products/featured", {
            params: { page: 0, size: 24 },
            public: true as any,
            suppressAuthToast: true as any,
          });
          rows = Array.isArray(r.data)
            ? r.data
            : Array.isArray(r.data?.content)
            ? r.data.content
            : [];
        }

        const featuredVisible = rows.filter((p: any) => (p?.active !== false) && isVisibleTrue(p));

        if (!alive) return;

        setItems(
          featuredVisible.map((p) => ({
            ...p,
            _coverResolved: coverUrlOf(p),
          }))
        );

        const need = featuredVisible.filter((p) => !coverUrlOf(p));
        if (need.length) {
          const updates = await Promise.allSettled(
            need.map(async (p) => {
              try {
                const r = await http.get(`/api/catalog/products/${p.id}/images`, {
                  public: true as any,
                  suppressAuthToast: true as any,
                });
                const imgs: ProductImage[] = Array.isArray(r.data) ? r.data : [];
                const withImgs: Product = { ...p, images: imgs };
                return { id: p.id, cover: coverUrlOf(withImgs) };
              } catch {
                return { id: p.id, cover: null as string | null };
              }
            })
          );
          const coverMap = new Map<number, string | null>();
          for (const u of updates) {
            if (u.status === "fulfilled") coverMap.set(u.value.id, u.value.cover);
          }
          if (coverMap.size && alive) {
            setItems((prev) =>
              prev.map((p) =>
                p._coverResolved ? p : { ...p, _coverResolved: coverMap.get(p.id) ?? null }
              )
            );
          }
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.response?.data?.message || "Could not load featured items.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openQuickView = (id: number) => setQvId(id);

  return (
    <div className="feat-wrap">
      <Seo title="Featured • Blossom & Buds" />
      <style>{css}</style>

      {/* HERO */}
      <header className="hero">
        <div className="inner">
          <div className="eyebrow">Editor’s Picks</div>
          <h1>Featured Blossoms</h1>
          <p>Hand-curated designs, season’s bests, and new favorites crafted for you.</p>
          <div className="cta-row">
            <Link to="/categories" className="btn pri">Browse All Categories</Link>
          </div>
        </div>
      </header>

      {/* FEATURED GRID */}
      <section className="sec">
        <div className="bar">
          <h2>Top Picks</h2>
        </div>

        {err && <div className="alert bad">{err}</div>}

        <div className="grid4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => <div className="ft-card sk" key={i} />)}
          {!loading && items.length === 0 && (
            <div className="empty">No featured products yet.</div>
          )}
          {!loading &&
            items.map((p) => <ProductTile key={p.id} p={p} onOpen={openQuickView} />)}
        </div>
      </section>

      {/* Quick View Modal */}
      {qvId != null && (
        <ProductQuickView productId={qvId} onClose={() => setQvId(null)} />
      )}
    </div>
  );
}

/* ---------------- Styles ---------------- */
const css = `
:root {
  --card-shadow: 0 8px 22px rgba(0,0,0,.10);
  --card-shadow-h: 0 12px 34px rgba(0,0,0,.16);
}
.feat-wrap{
  background: var(--bb-bg);
  color: var(--bb-primary);
  min-height:60vh;
  overflow-x:hidden;           /* ✅ prevent any horizontal overflow */
}

/* HERO */
.hero{
  background:
    radial-gradient(1200px 160px at -200px 40%, rgba(246,195,32,.25), transparent 60%),
    radial-gradient(1200px 200px at 120% -10%, rgba(240,93,139,.20), transparent 60%),
    linear-gradient(180deg, rgba(250,247,231,.94), rgba(255,255,255,.96));
  border-bottom:1px solid rgba(0,0,0,.06);
  backdrop-filter: saturate(180%) blur(10px);
}
.hero .inner{ max-width:1200px; margin:0 auto; padding: 26px 16px 22px; }
.eyebrow{ color: var(--bb-accent-2); font-weight:900; letter-spacing:.8px; font-size:12px; text-transform:uppercase; }
.hero h1{ margin:4px 0 8px; font-family: "DM Serif Display", Georgia, serif; font-size: 34px; line-height:1.1; }
.hero p{ margin:0 0 14px; opacity:.92; max-width: 740px; }
.cta-row{ display:flex; gap:10px; }
.btn{
  height:40px; padding:0 16px; border-radius:12px; border:none; font-weight:900; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center;
  box-shadow: 0 12px 32px rgba(0,0,0,.10);
}
.btn.pri{ background: var(--bb-accent); color:#fff; box-shadow: 0 14px 38px rgba(240,93,139,.34); }
.btn.ghost{ background:#fff; color: var(--bb-primary); border:1px solid rgba(0,0,0,.08); }

/* SECTION */
.sec{ max-width:1200px; margin: 14px auto 28px; padding: 0 16px; }
.bar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.bar h2{ margin:0; font-size:22px; font-family: "DM Serif Display", Georgia, serif; }

/* GRID — compact, always 2-up on phones */
.grid4{
  display:grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap:14px;
}
@media (max-width: 1100px){
  .grid4{ grid-template-columns: repeat(3, minmax(0,1fr)); }
}
@media (max-width: 820px){
  .grid4{ grid-template-columns: repeat(2, minmax(0,1fr)); }
}
/* ✅ keep two cards even on very small phones */
@media (max-width: 480px){
  .grid4{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; }
}
@media (max-width: 360px){
  .grid4{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; }
}

/* CARD (extra-compact) */
.ft-card{
  display:flex; flex-direction:column;
  border-radius:12px; overflow:hidden; text-decoration:none; background:#fff;
  border:1px solid rgba(0,0,0,.06); box-shadow: var(--card-shadow);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  outline: none;
  min-height: 0;
}
.ft-card:hover{ transform: translateY(-2px); box-shadow: var(--card-shadow-h); border-color: rgba(246,195,32,.35); }
.ft-card:focus-visible{ box-shadow: 0 0 0 3px rgba(246,195,32,.45), var(--card-shadow-h); }

/* MEDIA — square, tiny gutters on mobile */
.media{ position:relative; background:#f7f7f7; }
.media::after{
  content:""; position:absolute; inset:0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.08));
  opacity:0; transition: opacity .18s ease; pointer-events:none;
}
.ft-card:hover .media::after{ opacity:1; }
.media img{ width:100%; aspect-ratio: 1 / 1; object-fit:cover; display:block; }

/* quick-view hover button (hide on tiny screens to save space) */
.quick{
  position:absolute; right:10px; bottom:10px;
  height:26px; padding:0 10px; border-radius:10px; border:1px solid rgba(255,255,255,.7);
  background: rgba(255,255,255,.92); color:#111; font-weight:800; cursor:pointer;
  opacity:0; transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease, background .18s ease;
  font-size:12px;
}
.ft-card:hover .quick{ opacity:1; transform: translateY(0); }
@media (max-width: 480px){
  .quick{ display:none; } /* ✅ cleaner, less overlap on phones */
}

/* META — denser */
.meta{ padding:8px 10px 0; display:grid; gap:2px; min-height:52px; }
.name{
  font-weight:900; line-height:1.25; color: var(--bb-primary);
  display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
  font-size:13px;
}
.price{ font-weight:900; color: var(--bb-accent); font-size:13px; }

/* CTA — smaller on phones */
.btn.add{
  height:32px; margin:8px 10px 10px;
  border-radius:10px; border:none; font-weight:900; cursor:pointer;
  background: var(--bb-accent); color:#fff;
  box-shadow: 0 10px 24px rgba(240,93,139,.24);
  transition: transform .06s ease, box-shadow .18s ease;
  font-size:12.5px;
}
.btn.add:hover{ transform: translateY(-1px); box-shadow: 0 14px 32px rgba(240,93,139,.30); }
.btn.add:active{ transform: translateY(0); }
@media (max-width: 480px){
  .btn.add{ height:30px; font-size:12px; margin:6px 8px 8px; }
}

/* FALLBACK placeholder */
.ph{
  width:100%; aspect-ratio: 1 / 1;
  background: radial-gradient(1000px 240px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff);
}

/* FEEDBACK */
.alert.bad{ margin: 8px 0; padding: 10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }
.empty{ padding: 12px; opacity:.85; }

/* SKELETON — match compact card size */
.sk{
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee); background-size:200% 100%;
  animation: shimmer 1.15s linear infinite;
  border-radius:12px; height: 220px;
}
@keyframes shimmer{ from{ background-position: 200% 0; } to { background-position: -200% 0; } }
`;
