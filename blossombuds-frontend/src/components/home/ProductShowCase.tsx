import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function isVisibleForCustomer(p: Partial<ProductLite> | any): boolean {
  const v = p?.visible ?? p?.isVisible ?? null;
  return v === true || v == null;
}

function isOutOfStock(p: Partial<ProductLite> | any): boolean {
  return p?.inStock === false;
}

function chunkItems<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function ProductShowcase({
  products,
  title = "New Arrivals",
  viewAllTo = "/featured",
  limit = 12,
}: Props) {
  const initial = (products || []).filter(
    (p) => p.active !== false && isVisibleForCustomer(p)
  );

  const [items, setItems] = useState<ProductLite[]>(initial);
  const [loading, setLoading] = useState(!products);
  const [err, setErr] = useState<string | null>(null);
  const [qvId, setQvId] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardsPerSlide, setCardsPerSlide] = useState(1);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const updateCardsPerSlide = () => {
      const w = window.innerWidth;
      if (w >= 1200) setCardsPerSlide(4);
      else if (w >= 900) setCardsPerSlide(3);
      else if (w >= 640) setCardsPerSlide(2);
      else setCardsPerSlide(1);
    };

    updateCardsPerSlide();
    window.addEventListener("resize", updateCardsPerSlide);
    return () => window.removeEventListener("resize", updateCardsPerSlide);
  }, []);
useEffect(() => {
  console.log("qvId changed:", qvId);
}, [qvId]);
  useEffect(() => {
    let live = true;

    if (products && products.length) {
      const next = products.filter(
        (p) => p.active !== false && isVisibleForCustomer(p)
      );
      setItems(next);
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
          excludeFromGlobalDiscount:
            p.excludeFromGlobalDiscount ?? p.excludedFromDiscount ?? false,
          discountPercentOff:
            typeof p.discountPercentOff === "number"
              ? p.discountPercentOff
              : null,
          originalPrice:
            typeof p.originalPrice === "number" ? p.originalPrice : null,
          finalPrice: typeof p.finalPrice === "number" ? p.finalPrice : null,
        }));

        setItems(
          mapped.filter((p) => p.active !== false && isVisibleForCustomer(p))
        );
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
                (imgs as any)?.find((i: any) => (i?.sortOrder ?? 9999) === 0)
                  ?.url ||
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
        // ignore
      }
    })();

    return () => {
      live = false;
    };
  }, [items]);

  const slides = useMemo(() => chunkItems(items, cardsPerSlide), [items, cardsPerSlide]);

  useEffect(() => {
    setIndex((prev) => {
      if (!slides.length) return 0;
      return Math.min(prev, slides.length - 1);
    });
  }, [slides.length]);

  useEffect(() => {
    if (loading || paused || slides.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4200);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [loading, paused, slides.length]);

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

    const orig = Number(p.originalPrice ?? base);
    const finFromApi = p.finalPrice != null ? Number(p.finalPrice) : null;

    let pct = Number(p.discountPercentOff ?? 0);
    if (!Number.isFinite(pct) || pct < 0) pct = 0;
    pct = Math.min(95, pct);

    if (isExcluded || pct <= 0) {
      return { showDiscount: false, original: orig, final: orig, pct: 0 };
    }

    const fin =
      finFromApi != null && Number.isFinite(finFromApi) && finFromApi < orig
        ? finFromApi
        : Math.round(orig * (1 - pct / 100));

    const showDiscount = fin < orig;
    return { showDiscount, original: orig, final: fin, pct };
  }

  const goTo = (next: number) => {
    if (!slides.length) return;
    const normalized = ((next % slides.length) + slides.length) % slides.length;
    setIndex(normalized);
  };

  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  const openQuickView = (id: number) => {
    console.log("Opening quick view for:", id);
    setQvId(id);
  };

  return (
    <section className="ps-wrap" aria-labelledby="ps-heading">
      <style>{styles}</style>

      <div className="ps-shell">
        <div className="ps-head">
          <div className="ps-head-copy">
            <span className="ps-eyebrow">Latest picks</span>
            <h2 id="ps-heading">{title}</h2>
            <p>
              Fresh arrivals chosen to help customers discover what’s new at a
              glance.
            </p>
          </div>


        </div>

        {err && <div className="ps-error">{err}</div>}

        <div
          className="ps-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="ps-viewport" aria-busy={loading}>
            {loading ? (
              <div className="ps-track">
                {Array.from({ length: 3 }).map((_, i) => (
                  <article key={`sk-slide-${i}`} className="ps-slide">
                    <div className="ps-grid">
                      {Array.from({ length: cardsPerSlide }).map((__, j) => (
                        <div key={`sk-${i}-${j}`} className="ps-card skel" aria-hidden="true">
                          <div className="ps-img sk-img" />
                          <div className="ps-body">
                            <div className="sk sk-title" />
                            <div className="sk sk-line" />
                            <div className="ps-row2">
                              <div className="sk sk-price" />
                              <div className="sk sk-btn" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : slides.length > 0 ? (
              <div
                className="ps-track"
                style={{ transform: `translateX(-${index * 100}%)` }}
              >
                {slides.map((group, slideIdx) => (
                  <article key={`slide-${slideIdx}`} className="ps-slide">
                    <div className="ps-grid">
                      {group.map((p) => {
                        const outOfStock = isOutOfStock(p);
                        const dv = getDiscountView(p);

                        return (
                          <article
                            key={p.id}
                            className="ps-card"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openQuickView(Number(p.id));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openQuickView(Number(p.id));
                              }
                            }}
                            aria-label={p.name}
                          >
                            <div className="ps-img">
                              {outOfStock && (
                                <div className="ps-badge ps-badge-oos">
                                  Out of stock
                                </div>
                              )}

                              {dv?.showDiscount && !outOfStock && (
                                <div className="ps-badge ps-badge-sale">
                                  {dv.pct}% OFF
                                </div>
                              )}

                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className="ps-ph" aria-hidden="true" />
                              )}
                            </div>

                            <div className="ps-body">
                              <div className="ps-title" title={p.name}>
                                {p.name}
                              </div>

                              <div className="ps-price-block">
                                {!dv ? (
                                  <div className="ps-price">
                                    {formatINR(Number(p.price ?? 0))}
                                  </div>
                                ) : dv.showDiscount ? (
                                  <div className="ps-price-wrap">
                                    <span className="ps-price-old">
                                      {formatINR(dv.original)}
                                    </span>
                                    <span className="ps-price-new">
                                      {formatINR(dv.final)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="ps-price">
                                    {formatINR(dv.final)}
                                  </div>
                                )}
                              </div>

                              <div className="ps-row2">
                                <button
                                  type="button"
                                  className="ps-btn"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openQuickView(Number(p.id));
                                  }}
                                >
                                  {outOfStock ? "View product" : "Add to Cart"}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ps-empty">
                No new arrivals right now. Check back soon.
              </div>
            )}

            {!loading && slides.length > 1 && (
              <>
                <button
                  className="ps-nav ps-nav-overlay ps-nav-prev"
                  aria-label="Previous"
                  onClick={goPrev}
                >
                  ‹
                </button>
                <button
                  className="ps-nav ps-nav-overlay ps-nav-next"
                  aria-label="Next"
                  onClick={goNext}
                >
                  ›
                </button>
              </>
            )}
          </div>

          {!loading && slides.length > 1 && (
            <div className="ps-dots" role="tablist" aria-label="Product navigation">
              {slides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`ps-dot ${i === index ? "is-active" : ""}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {qvId != null && (
        <ProductQuickView productId={qvId} onClose={() => setQvId(null)} />
      )}
    </section>
  );
}

const styles = `
.ps-wrap{
  width:100%;
  padding: clamp(30px, 5vw, 56px) 0;
  background: var(--bb-bg);
}

.ps-shell{
  width:min(var(--bb-page-max, 1180px), calc(100% - (var(--bb-page-pad, 14px) * 2)));
  margin:0 auto;
}

.ps-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:20px;
}

.ps-head-copy{
  max-width:560px;
}

.ps-eyebrow{
  display:inline-flex;
  margin-bottom:6px;
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
  color: var(--bb-accent);
}

.ps-head h2{
  margin:0 0 8px;
  color: var(--bb-primary);
  font-family: "Cinzel", "DM Serif Display", Georgia, serif;
  font-size: clamp(24px, 3.8vw, 38px);
  font-weight:700;
  line-height:1.1;
}

.ps-head p{
  margin:0;
  color:#8a9087;
  font-size:15px;
  line-height:1.7;
}

.ps-controls{
  display:flex;
  align-items:center;
  gap:8px;
  flex-shrink:0;
}

.ps-link{
  display:inline-flex;
  align-items:center;
  height:38px;
  padding:0 14px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  text-decoration:none;
  color: var(--bb-primary);
  font-weight:800;
  font-size:13px;
  transition: all .18s ease;
}

.ps-link:hover{
  background:#4A4F41;
  color:#fff;
}

.ps-nav{
  width:38px;
  height:38px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  cursor:pointer;
  font-size:20px;
  line-height:1;
  color: var(--bb-primary);
  transition: all .18s ease;
}

.ps-nav:hover{
  background:#F05D8B;
  color:#fff;
  border-color:#F05D8B;
  transform: scale(1.04);
}

.ps-stage{
  position:relative;
}

.ps-viewport{
  position:relative;
  overflow:hidden;
  border-radius:30px;
}

.ps-track{
  display:flex;
  transition: transform .85s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}

.ps-slide{
  min-width:100%;
  padding: 4px;
}

.ps-grid{
  display:grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap:16px;
}

.ps-card{
  width:100%;
  border-radius:24px;
  overflow:hidden;
  background:#fff;
  border:1px solid rgba(0,0,0,.06);
  box-shadow: 0 16px 36px rgba(0,0,0,.08);
  display:flex;
  flex-direction:column;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  outline:none;
}

@media (hover:hover){
  .ps-card:hover{
    transform: translateY(-4px);
    box-shadow: 0 22px 48px rgba(0,0,0,.12);
    border-color: rgba(240,93,139,.20);
  }
}

.ps-img{
  position:relative;
  background:#f3efe8;
  aspect-ratio: 4 / 4.8;
  overflow:hidden;
}

.ps-img img,
.ps-ph{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
}

.ps-img img{
  object-fit:cover;
  display:block;
  transition: transform .45s ease;
}

.ps-card:hover .ps-img img{
  transform: scale(1.05);
}

.ps-ph{
  background: radial-gradient(1000px 180px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff);
}

.ps-badge{
  position:absolute;
  z-index:2;
  top:12px;
  left:12px;
  height:28px;
  display:inline-flex;
  align-items:center;
  padding:0 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  letter-spacing:.04em;
  backdrop-filter: blur(8px);
}

.ps-badge-oos{
  background: rgba(0,0,0,.72);
  color:#fff;
}

.ps-badge-sale{
  background: rgba(240,93,139,.92);
  color:#fff;
}

.ps-body{
  min-height: 168px;
  padding:16px;
  display:grid;
  grid-template-rows:auto auto 1fr auto;
  gap:10px;
}

.ps-title{
  color: var(--bb-primary);
  font-size:15px;
  font-weight:800;
  line-height:1.4;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  min-height:2.8em;
}

.ps-price-block{
  min-height:26px;
}

.ps-price{
  color: var(--bb-primary);
  font-size:16px;
  font-weight:900;
}

.ps-price-wrap{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  align-items:baseline;
}

.ps-price-old{
  color:#7a7a7a;
  font-size:13px;
  font-weight:700;
  text-decoration:line-through;
}

.ps-price-new{
  color: var(--bb-accent);
  font-size:17px;
  font-weight:900;
}

.ps-row2{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  margin-top:auto;
}

.ps-btn{
  height:40px;
  padding:0 16px;
  border:none;
  border-radius:999px;
  background: var(--bb-accent);
  color:#fff;
  font-size:13px;
  font-weight:800;
  cursor:pointer;
  box-shadow: 0 10px 22px rgba(240,93,139,.22);
}

.ps-empty{
  padding:18px 0;
  color: var(--bb-primary);
  opacity:.76;
  text-align:center;
}

.ps-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 14px;
}

.ps-nav-overlay{
  position:absolute;
  top:50%;
  transform:translateY(-50%);
  z-index:4;
  width:48px;
  height:48px;
  box-shadow:
    0 16px 34px rgba(26,28,24,.14),
    inset 0 1px 0 rgba(255,255,255,.85);
}

.ps-nav-overlay:hover{
  transform:translateY(-50%) scale(1.04);
}

.ps-nav-prev{
  left:12px;
}

.ps-nav-next{
  right:12px;
}

.ps-dots{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding-top:16px;
}

.ps-dot{
  width:10px;
  height:10px;
  border-radius:999px;
  border:0;
  padding:0;
  cursor:pointer;
  background: rgba(74,79,65,.18);
  transition: width .25s ease, background .25s ease;
}

.ps-dot.is-active{
  width:30px;
  background: var(--bb-accent);
}

.skel{
  overflow:hidden;
}

.sk,
.sk-img{
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee);
  background-size:200% 100%;
  animation: psSk 1.15s linear infinite;
}

.sk-title{
  height:16px;
  width:72%;
  border-radius:8px;
}

.sk-line{
  height:12px;
  width:54%;
  border-radius:8px;
}

.sk-price{
  height:14px;
  width:84px;
  border-radius:8px;
}

.sk-btn{
  height:40px;
  width:116px;
  border-radius:999px;
}

@keyframes psSk{
  from{ background-position:200% 0; }
  to{ background-position:-200% 0; }
}

@media (max-width: 1199px){
  .ps-grid{
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 899px){
  .ps-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px){
  .ps-head{
    flex-direction:column;
    align-items:flex-start;
  }

  .ps-controls{
    width:100%;
    justify-content:flex-start;
  }

  .ps-grid{
    grid-template-columns: 1fr;
  }

  .ps-body{
    min-height:160px;
    padding:14px;
  }

  .ps-title{
    font-size:14px;
  }

  .ps-price{
    font-size:15px;
  }

  .ps-price-new{
    font-size:16px;
  }

  .ps-btn{
    width:100%;
    justify-content:center;
  }

  .ps-row2{
    justify-content:stretch;
  }

  .ps-nav-overlay{
    width:42px;
    height:42px;
    font-size:24px;
  }

  .ps-nav-prev{
    left:8px;
  }

  .ps-nav-next{
    right:8px;
  }

  .ps-dots{
    gap:8px;
    padding-top:14px;
  }
}

@media (prefers-reduced-motion: reduce){
  .ps-card,
  .ps-img img,
  .ps-link,
  .ps-nav,
  .ps-dot,
  .ps-track{
    transition:none;
  }
}
`;