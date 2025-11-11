// src/components/ProductShowcase.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ProductQuickView from "../../components/ProductQuickView";

import { listNewArrivals, listProductImages } from "../../api/catalog";

type ProductLite = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  slug?: string | null;
  active?: boolean | null;     // hide disabled items
  visible?: boolean | null;    // explicit visibility flag
  isVisible?: boolean | null;  // alt key from some payloads
};

type Props = {
  /** If you already have the items, pass them in and no fetch will occur */
  products?: ProductLite[];
  /** Section heading */
  title?: string;
  /** "View all" link target */
  viewAllTo?: string;
  /** Limit to fetch when products prop is not supplied */
  limit?: number;
};

/** Accept only explicit visible=true (supports visible / isVisible) */
function isVisibleTrue(p: Partial<ProductLite> | any): boolean {
  const v = p?.visible ?? p?.isVisible ?? null;
  return v === true;
}

export default function ProductShowcase({
  products,
  title = "New Arrivals",
  viewAllTo = "/featured",
  limit = 12,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Filter-out disabled + hidden on initial prop too
  const initial = (products || []).filter((p) => p.active !== false && isVisibleTrue(p));

  const [items, setItems] = useState<ProductLite[]>(initial);
  const [loading, setLoading] = useState(!products);
  const [err, setErr] = useState<string | null>(null);

  // Quick View modal
  const [qvId, setQvId] = useState<number | null>(null);

  // fetch initial products
  useEffect(() => {
    let live = true;
    if (products && products.length) {
      setItems(products.filter((p) => p.active !== false && isVisibleTrue(p)));
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await listNewArrivals(limit);

        if (!live) return;

        const mapped: ProductLite[] = (res || []).map((p: any) => ({
          id: Number(p.id),
          name: p.name,
          price: Number(p.price ?? 0),
          imageUrl:
            p.imageUrl ||
            p.primaryImageUrl ||
            p.coverUrl ||
            p.primaryImage?.url ||
            (Array.isArray(p.images)
              ? p.images.find((i: any) => i?.primary || i?.isPrimary)?.url ||
                p.images[0]?.url
              : undefined) ||
            undefined,
          slug: p.slug || undefined,
          active: p.active,
          visible: p.visible ?? undefined,
          isVisible: p.isVisible ?? undefined,
        }));

        // Only keep active + explicitly visible=true
        setItems(mapped.filter((p) => p.active !== false && isVisibleTrue(p)));
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load new arrivals.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [products, limit]);

  // backfill missing thumbnails by hitting /images per product (only those with imageUrl missing)
  useEffect(() => {
    let live = true;
    const withoutImg = items.filter((p) => !p.imageUrl);
    if (!withoutImg.length) return;
    (async () => {
      try {
        const updates = await Promise.all(
          withoutImg.map(async (p) => {
            try {
              const imgs = await listProductImages(p.id);
              const best =
                imgs?.find((i: any) => i?.primary)?.url ||
                imgs?.find((i: any) => (i?.sortOrder ?? 9999) === 0)?.url ||
                imgs?.[0]?.url ||
                null;
              return { id: p.id, url: best };
            } catch {
              return { id: p.id, url: null as string | null };
            }
          })
        );
        if (!live) return;
        if (updates.some((u) => u.url)) {
          setItems((prev) =>
            prev.map((it) => {
              const u = updates.find((x) => x.id === it.id);
              return u && u.url ? { ...it, imageUrl: u.url } : it;
            })
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      live = false;
    };
  }, [items]);

  const scrollByCards = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ps-card");
    const gap = 16;
    const step = card ? card.offsetWidth + gap : 300;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  // format ₹ nicely
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }),
    []
  );

  // Click handlers
  const openQuickView = (id: number) => setQvId(id);
  const onAddClick = (id: number) => openQuickView(id);
  const onCardClick = (id: number) => openQuickView(id);

  return (
    <section className="ps" aria-label={title}>
      <style>{styles}</style>

      <div className="ps-head">
        <h2>{title}</h2>
        <div className="ps-controls">
          <button className="ps-nav" aria-label="Previous" onClick={() => scrollByCards("left")}>
            ‹
          </button>
          <button className="ps-nav" aria-label="Next" onClick={() => scrollByCards("right")}>
            ›
          </button>
          <Link to={viewAllTo} className="ps-link">
            View all ↗
          </Link>
        </div>
      </div>

      {err && <div className="ps-error">{err}</div>}

      <div className="ps-lane" ref={trackRef} aria-busy={loading}>
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <article key={`sk-${i}`} className="ps-card skel">
                <div className="ps-img" aria-hidden="true" />
                <div className="ps-body">
                  <div className="sk sk-title" />
                  <div className="ps-row2">
                    <div className="sk sk-price" />
                    <div className="sk sk-btns" />
                  </div>
                </div>
              </article>
            ))
          : items.map((p) => {
              return (
                <article
                  key={p.id}
                  className="ps-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onCardClick(Number(p.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onCardClick(Number(p.id));
                  }}
                >
                  <div className="ps-img" aria-label={p.name}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="ps-ph" aria-hidden="true" />
                    )}
                  </div>
                  <div className="ps-body" onClick={(e) => e.stopPropagation()}>
                    <div className="ps-title">{p.name}</div>
                    <div className="ps-row2">
                      <div className="ps-price">{fmt.format(p.price)}</div>
                      <div className="ps-actions">
                        <button className="ps-btn" onClick={() => onAddClick(Number(p.id))}>
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
        {!loading && items.length === 0 && (
          <div className="ps-empty">No new arrivals right now. Check back soon!</div>
        )}
      </div>

      {qvId != null && (
        <ProductQuickView productId={qvId} onClose={() => setQvId(null)} />
      )}
    </section>
  );
}

/* ————————————— STYLES ————————————— */
const styles = `
/* (unchanged styles) */
.ps{
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  width: 100vw;
  background: var(--bb-bg);
  padding-top: 8px;
  padding-bottom: 24px;
}

.ps-head,
.ps-lane {
  padding-left: clamp(8px, 3vw, 28px);
  padding-right: clamp(8px, 3vw, 28px);
}

.ps-head{
  display:flex; align-items:center; justify-content:space-between;
  gap: 12px; margin-bottom: 10px;
}
.ps-head h2{ margin:0; color: var(--bb-primary); }
.ps-controls{ display:flex; align-items:center; gap: 8px; }
.ps-link{ font-weight: 900; color: var(--bb-primary); text-decoration: none; }
.ps-nav{
  width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-size: 18px; line-height: 1; color: var(--bb-primary);
}

.ps-lane{ overflow:hidden; }
.ps-lane::-webkit-scrollbar{ display:none; }
.ps-lane{ scrollbar-width: none; }

.ps-lane{
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
}

.ps-card{
  flex: 0 0 auto;
  width: clamp(220px, 24vw, 300px);
  scroll-snap-align: start;
  background:#fff; border-radius:16px; overflow:hidden; display:flex; flex-direction:column;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 12px 34px rgba(0,0,0,.10);
  transition: transform .16s ease, box-shadow .16s ease;
}
.ps-card:hover{ transform: translateY(-2px); box-shadow: 0 18px 44px rgba(0,0,0,.12); }
.ps-card.skel{ overflow:hidden; }

.ps-img{ position:relative; display:block; background:#f3f3f3; cursor:pointer; }
.ps-img::after{
  content:""; display:block; width:100%; padding-top: 66.6667%; /* 3:2 ratio placeholder */
}
.ps-img img{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  border-bottom: 1px solid rgba(0,0,0,.06);
  display:block;
}
.ps-ph{
  position:absolute; inset:0; display:block;
  background: linear-gradient(135deg, #f2f2f2, #f8f8f8);
  border-bottom: 1px solid rgba(0,0,0,.06);
}

.ps-body{ padding: 12px 14px; display:grid; gap:6px; }
.ps-title{ font-weight:900; color: var(--bb-primary); }
.ps-row2{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.ps-price{ font-weight:900; }
.ps-actions{ display:flex; gap: 8px; }
.ps-btn{
  display:inline-flex; align-items:center; justify-content:center; padding:.55rem .9rem;
  border-radius:999px; border:none; cursor:pointer; background:var(--bb-accent); color:#fff; font-weight:900; text-decoration:none;
}
.ps-btn:active{ transform: translateY(1px); }

.ps-empty{ color: var(--bb-primary); opacity:.75; padding: 12px 0; }

 /* skeleton bits */
.sk{ background: linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size:200% 100%; animation: sk 1.2s linear infinite; border-radius:8px; }
.sk-title{ height:18px; width:70%; }
.sk-price{ height:16px; width:80px; }
.sk-btns{ height:28px; width:120px; border-radius:999px; }
@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.ps-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin: 8px clamp(8px, 3vw, 28px);
  padding: 8px 10px;
  border-radius: 12px;
}
`;
