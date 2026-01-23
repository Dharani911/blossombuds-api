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
  active?: boolean | null;
  visible?: boolean | null;
  isVisible?: boolean | null;
  inStock?: boolean | null;
    // ✅ discount support
    excludeFromGlobalDiscount?: boolean | null;
    discountPercentOff?: number | null;
    originalPrice?: number | null;
    finalPrice?: number | null;

};

type Props = {
  products?: ProductLite[];
  title?: string;
  viewAllTo?: string;
  limit?: number;


};

/** Visible logic: if backend doesn't send visible, default = visible */
function isVisibleForCustomer(p: Partial<ProductLite> | any): boolean {
  const v = p?.visible ?? p?.isVisible ?? null;
  return v === true || v == null;
}

/** Stock logic: if backend doesn't send inStock, default = in stock */
function isOutOfStock(p: Partial<ProductLite> | any): boolean {
  const v = p?.inStock;
  return v === false;
}

export default function ProductShowcase({
  products,
  title = "New Arrivals",
  viewAllTo = "/featured",
  limit = 12,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const initial = (products || []).filter(
    (p) => p.active !== false && isVisibleForCustomer(p)
  );

  const [items, setItems] = useState<ProductLite[]>(initial);
  const [loading, setLoading] = useState(!products);
  const [err, setErr] = useState<string | null>(null);
  const [qvId, setQvId] = useState<number | null>(null);

  useEffect(() => {
    let live = true;

    if (products && products.length) {
      setItems(products.filter((p) => p.active !== false && isVisibleForCustomer(p)));
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
              ? p.images.find((i: any) => i?.primary || i?.isPrimary)?.url || p.images[0]?.url
              : undefined) ||
            undefined,
          slug: p.slug || undefined,
          active: p.active,
          visible: p.visible ?? undefined,
          isVisible: p.isVisible ?? undefined,
          // ✅ stock normalization (default true if missing)
          inStock:
            typeof p.inStock === "boolean"
              ? p.inStock
              : typeof p.isInStock === "boolean"
              ? p.isInStock
              : typeof p.instock === "boolean"
              ? p.instock
              : typeof p.in_stock === "boolean"
              ? p.in_stock
              : true,
              excludeFromGlobalDiscount: p.excludeFromGlobalDiscount ?? p.excludedFromDiscount ?? false,
                        discountPercentOff: typeof p.discountPercentOff === "number" ? p.discountPercentOff : null,
                        originalPrice: typeof p.originalPrice === "number" ? p.originalPrice : null,
                        finalPrice: typeof p.finalPrice === "number" ? p.finalPrice : null,
        }));

        // ✅ visible=false products should not appear to customer
        setItems(mapped.filter((p) => p.active !== false && isVisibleForCustomer(p)));
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

  // backfill images
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
                (imgs as any)?.find((i: any) => i?.primary)?.url ||
                (imgs as any)?.find((i: any) => (i?.sortOrder ?? 9999) === 0)?.url ||
                (imgs as any)?.[0]?.url ||
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
    const gap = 14;
    const step = card ? card.offsetWidth + gap : 280;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }),
    []
  );
  function formatINR(n: number) {
    try {
      return fmt.format(n);
    } catch {
      return `₹${n}`;
    }
  }

  function getDiscountView(p: ProductLite) {
    const isExcluded = Boolean(p.excludeFromGlobalDiscount);

    const base = Number(p.price ?? 0);
    if (!Number.isFinite(base) || base <= 0) return null;

    // If backend already provides original/final, use them
    const orig = Number(p.originalPrice ?? base);
    const finFromApi = p.finalPrice != null ? Number(p.finalPrice) : null;

    // Percent (prefer backend)
    let pct = Number(p.discountPercentOff ?? 0);
    if (!Number.isFinite(pct) || pct < 0) pct = 0;
    pct = Math.min(95, pct);

    if (isExcluded || pct <= 0) {
      return { showDiscount: false, original: orig, final: orig, pct: 0 };
    }

    const fin = (finFromApi != null && Number.isFinite(finFromApi) && finFromApi < orig)
      ? finFromApi
      : Math.round(orig * (1 - pct / 100));

    const showDiscount = fin < orig;
    return { showDiscount, original: orig, final: fin, pct };
  }

  const openQuickView = (id: number) => setQvId(id);

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
              const outOfStock = isOutOfStock(p);

              return (
                <article
                  key={p.id}
                  className="ps-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openQuickView(Number(p.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openQuickView(Number(p.id));
                  }}
                >
                  <div className="ps-img" aria-label={p.name}>
                    {outOfStock && <div className="ps-oos">Out of stock</div>}

                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="ps-ph" aria-hidden="true" />
                    )}
                  </div>

                  <div className="ps-body" >
                    <div className="ps-title">{p.name}</div>

                    <div className="ps-row2">
                      {(() => {
                        const dv = getDiscountView(p);
                        if (!dv) return <div className="ps-price">{formatINR(Number(p.price ?? 0))}</div>;

                        if (!dv.showDiscount) {
                          return <div className="ps-price">{formatINR(dv.final)}</div>;
                        }

                        return (
                          <div className="ps-price ps-price-discount">
                            <span className="old">{formatINR(dv.original)}</span>
                            <span className="new">{formatINR(dv.final)}</span>
                            <span className="off">{dv.pct}% OFF</span>
                          </div>
                        );
                      })()}


                      <div className="ps-actions">
                        <button
                          className={"ps-btn" }


                        >
                          {outOfStock ? "View" : "Add to cart"}
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

      {qvId != null && <ProductQuickView productId={qvId} onClose={() => setQvId(null)} />}
    </section>
  );
}

/* ————————————— STYLES ————————————— */
const styles = `
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
.ps-head h2{
  margin:0; color: var(--bb-primary);
  font-size: clamp(16px, 2.1vw, 20px);
}
.ps-controls{ display:flex; align-items:center; gap: 8px; }
.ps-link{ font-weight: 900; color: var(--bb-primary); text-decoration: none; }
.ps-nav{
  width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-size: 18px; line-height: 1; color: var(--bb-primary);
}

/* lane */
.ps-lane{ overflow:hidden; }
.ps-lane::-webkit-scrollbar{ display:none; }
.ps-lane{ scrollbar-width: none; }

.ps-lane{
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
}

/* card sizing */
.ps-card{
  flex: 0 0 auto;
  width: clamp(200px, 70vw, 280px);
  scroll-snap-align: start;
  background:#fff; border-radius:16px; overflow:hidden; display:flex; flex-direction:column;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 12px 34px rgba(0,0,0,.10);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  outline: none;
}
@media (min-width: 560px){
  .ps-card{ width: clamp(220px, 28vw, 300px); }
}
@media (hover:hover){
  .ps-card:hover{ transform: translateY(-2px); box-shadow: 0 18px 44px rgba(0,0,0,.12); }
}

/* image */
.ps-img{ position:relative; display:block; background:#f3f3f3; cursor:pointer; }
.ps-img::after{ content:""; display:block; width:100%; padding-top: 66.6667%; }
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

/* Out of stock badge */
.ps-oos{
  position:absolute; left:10px; top:10px;
  z-index:2;
  padding:4px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  background: rgba(0,0,0,.72);
  color:#fff;
  backdrop-filter: blur(4px);
}

/* body */
.ps-body{ padding: 10px 12px; display:grid; gap:6px; }
.ps-title{
  font-weight:900; color: var(--bb-primary);
  font-size: clamp(13px, 3.2vw, 14px);
  line-height: 1.3;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.ps-row2{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.ps-price{ font-weight:900; }
.ps-actions{ display:flex; gap: 8px; }
.ps-btn{
  display:inline-flex; align-items:center; justify-content:center; padding:.5rem .85rem;
  border-radius:999px; border:none; cursor:pointer; background:var(--bb-accent); color:#fff; font-weight:900;
  font-size: 13px;
}
.ps-btn:active{ transform: translateY(1px); }
.ps-btn.disabled{ opacity:.55; cursor:not-allowed; }
.ps-btn.disabled:active{ transform:none; }

/* empty + skeleton + error */
.ps-empty{ color: var(--bb-primary); opacity:.75; padding: 12px 0; }
.sk{
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size:200% 100%; animation: sk 1.2s linear infinite; border-radius:8px;
}
.sk-title{ height:16px; width:70%; }
.sk-price{ height:14px; width:80px; }
.sk-btns{ height:26px; width:120px; border-radius:999px; }
@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.ps-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin: 8px clamp(8px, 3vw, 28px);
  padding: 8px 10px;
  border-radius: 12px;
}
.ps-price-discount{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:baseline;
}
.ps-price-discount .old{
  font-weight:800;
  opacity:.6;
  text-decoration: line-through;
  color:#444;
}
.ps-price-discount .new{
  font-weight:900;
  color: var(--bb-accent);
}
.ps-price-discount .off{
  font-size:11px;
  font-weight:900;
  padding:2px 6px;
  border-radius:999px;
  background: rgba(240,93,139,.12);
  border: 1px solid rgba(240,93,139,.22);
  color: var(--bb-accent);
}

`;
