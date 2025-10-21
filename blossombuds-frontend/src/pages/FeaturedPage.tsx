import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import Seo from "../components/Seo";

/** Light types that match your API shape closely enough */
type Product = {
  id: number;
  name: string;
  price?: number | string;
  description?: string;
  primaryImageUrl?: string;
};
type Review = {
  id: number;
  customerName?: string;
  rating?: number; // 1..5
  comment?: string;
};

/** Compact product card for the rail */
function ProductTile({ p }: { p: Product }) {
  const priceText = useMemo(() => {
    if (p?.price == null) return "";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
        .format(Number(p.price));
    } catch {
      return String(p.price);
    }
  }, [p?.price]);

  return (
    <Link to={`/products/${p.id}`} className="ft-card" title={p.name}>
      <div className="media">
        {p.primaryImageUrl ? (
          <img src={p.primaryImageUrl} alt={p.name} loading="lazy" />
        ) : (
          <div className="ph" aria-hidden />
        )}
      </div>
      <div className="meta">
        <div className="name">{p.name}</div>
        {priceText && <div className="price">{priceText}</div>}
      </div>
    </Link>
  );
}

/** A tiny review pill */
function ReviewPill({ r }: { r: Review }) {
  const stars = Math.max(0, Math.min(5, Number(r.rating || 0)));
  return (
    <div className="rev-pill">
      <div className="stars" aria-label={`${stars} star rating`}>
        {"★".repeat(stars)}{"☆".repeat(5 - stars)}
      </div>
      <div className="text">
        <span className="who">{r.customerName || "Customer"}</span>
        {r.comment && <span className="comment"> — {r.comment}</span>}
      </div>
    </div>
  );
}

export default function FeaturedPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr(null);
        setLoading(true);

        // 1) Try featured products
        let data: any;
        try {
          const r = await http.get("/api/catalog/products", {
            params: { featured: true, page: 0, size: 24 },
          });
          data = r.data;
        } catch {
          // 2) Fallback to newest (regular list)
          const r = await http.get("/api/catalog/products", {
            params: { page: 0, size: 24 },
          });
          data = r.data;
        }

        // Handle Page<Product> or array
        const rows: Product[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
          ? data.content
          : [];

        if (!alive) return;
        setItems(rows);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingReviews(true);
        // If you have an endpoint like: GET /api/reviews/featured or /api/reviews?approved=true&size=8
        // We’ll try a couple; if both fail, we just hide reviews.
        let rows: Review[] = [];
        try {
          const r1 = await http.get("/api/reviews/featured", { params: { size: 12 } });
          rows = Array.isArray(r1.data) ? r1.data : [];
        } catch {
          try {
            const r2 = await http.get("/api/reviews", { params: { approved: true, size: 12 } });
            rows = Array.isArray(r2.data) ? r2.data : Array.isArray(r2.data?.content) ? r2.data.content : [];
          } catch {
            rows = [];
          }
        }
        if (!alive) return;
        setReviews(rows);
      } finally {
        if (alive) setLoadingReviews(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="feat-wrap">
      <Seo title="Featured • Blossom & Buds" />
      <style>{css}</style>

      {/* HERO */}
      <header className="hero">
        <div className="inner">
          <div className="eyebrow">Editor’s Picks</div>
          <h1>Featured Blossoms</h1>
          <p>Hand-curated designs, season’s bests, and new favorites—crafted for you.</p>
          <div className="cta-row">
            <Link to="/categories" className="btn pri">Browse Categories</Link>
            <Link to="/products" className="btn ghost">See All Products</Link>
          </div>
        </div>
      </header>

      {/* FEATURED RAIL */}
      <section className="rail-sec">
        <div className="bar">
          <h2>Top Picks</h2>
          <div className="controls">
            <button className="nav" onClick={() => scrollerRef.current?.scrollBy({ left: -420, behavior: "smooth" })} aria-label="Scroll left">
              ‹
            </button>
            <button className="nav" onClick={() => scrollerRef.current?.scrollBy({ left: 420, behavior: "smooth" })} aria-label="Scroll right">
              ›
            </button>
          </div>
        </div>

        {err && <div className="alert bad">{err}</div>}

        <div className="rail" ref={scrollerRef}>
          {loading &&
            Array.from({ length: 8 }).map((_, i) => <div className="ft-card sk" key={i} />)}
          {!loading && items.length === 0 && (
            <div className="empty">No featured products yet.</div>
          )}
          {!loading &&
            items.map((p) => <ProductTile key={p.id} p={p} />)}
        </div>
      </section>

      {/* REVIEWS STRIP (optional; hides if none) */}
      {(reviews.length > 0 || loadingReviews) && (
        <section className="reviews-sec">
          <div className="rev-inner">
            <h3>What our customers say</h3>
            <div className="rev-row">
              {loadingReviews &&
                Array.from({ length: 6 }).map((_, i) => <div className="rev-pill sk" key={i} />)}
              {!loadingReviews && reviews.slice(0, 10).map((r) => (
                <ReviewPill key={r.id} r={r} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const css = `
.feat-wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height:60vh; }

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
.hero h1{ margin:4px 0 8px; font-family: "DM Serif Display", Georgia, serif; font-size: 36px; line-height:1.1; }
.hero p{ margin:0 0 14px; opacity:.92; max-width: 740px; }
.cta-row{ display:flex; gap:10px; }
.btn{
  height:40px; padding:0 16px; border-radius:12px; border:none; font-weight:900; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center;
  box-shadow: 0 12px 32px rgba(0,0,0,.10);
}
.btn.pri{ background: var(--bb-accent); color:#fff; box-shadow: 0 14px 38px rgba(240,93,139,.34); }
.btn.ghost{ background:#fff; color: var(--bb-primary); border:1px solid rgba(0,0,0,.08); }

/* RAIL */
.rail-sec{ max-width:1200px; margin: 14px auto 28px; padding: 0 16px; }
.bar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.bar h2{ margin:0; font-size:22px; font-family: "DM Serif Display", Georgia, serif; }
.controls{ display:flex; gap:8px; }
.nav{
  width:34px; height:34px; border-radius:10px; border:1px solid rgba(0,0,0,.08);
  background:#fff; font-weight:900; color: var(--bb-primary); cursor:pointer;
  box-shadow: 0 8px 20px rgba(0,0,0,.08);
}
.rail{
  display:grid; grid-auto-flow: column; grid-auto-columns: minmax(240px, 1fr);
  gap:12px; overflow-x:auto; padding: 6px 2px 10px; scroll-snap-type: x mandatory;
}
.rail::-webkit-scrollbar{ height:10px; }
.rail::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.12); border-radius:999px; }

/* card */
.ft-card{
  scroll-snap-align: start;
  display:grid; grid-template-rows: 180px auto; border-radius:16px; overflow:hidden; text-decoration:none;
  background:#fff; border:1px solid rgba(0,0,0,.06); box-shadow:0 16px 36px rgba(0,0,0,.08);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.ft-card:hover{ transform: translateY(-2px); box-shadow:0 22px 50px rgba(0,0,0,.12); border-color: rgba(246,195,32,.35); }
.media{ position:relative; overflow:hidden; }
.media img{ width:100%; height:100%; object-fit:cover; display:block; }
.ph{ width:100%; height:100%; background: radial-gradient(1000px 180px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff); }
.meta{ padding:10px 12px 12px; display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
.name{ font-weight:800; color: var(--bb-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.price{ font-weight:900; color: var(--bb-accent); }

/* reviews strip */
.reviews-sec{
  border-top:1px solid rgba(0,0,0,.06);
  background: linear-gradient(135deg, rgba(246,195,32,.12), rgba(240,93,139,.10));
}
.rev-inner{ max-width:1200px; margin:0 auto; padding: 14px 16px 18px; }
.rev-inner h3{ margin:0 0 8px; font-family: "DM Serif Display", Georgia, serif; font-size:18px; }
.rev-row{ display:flex; gap:10px; overflow-x:auto; padding-bottom:6px; }
.rev-row::-webkit-scrollbar{ height:8px; }
.rev-row::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.12); border-radius:999px; }

.rev-pill{
  flex:0 0 auto; min-width: 280px; max-width: 340px;
  padding:10px 12px; border-radius:14px; background:#fff; border:1px solid rgba(0,0,0,.06);
  box-shadow: 0 12px 30px rgba(0,0,0,.10);
}
.rev-pill .stars{ color:#f5a623; font-size:14px; line-height:1; margin-bottom:6px; }
.rev-pill .text{ color: var(--bb-primary); font-size:14px; }
.rev-pill .who{ font-weight:800; }
.rev-pill .comment{ opacity:.95; }

.alert.bad{ margin: 8px 0; padding: 10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }
.sk{
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee); background-size:200% 100%;
  animation: shimmer 1.15s linear infinite;
}
@keyframes shimmer{ from{ background-position: 200% 0; } to { background-position: -200% 0; } }

@media (max-width: 560px){
  .hero h1{ font-size:30px; }
  .cta-row{ flex-wrap:wrap; }
}
`;
