import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories, type Category } from "../../api/catalog";

type Props = {
  title?: string;
  viewAllTo?: string;
};

export default function HomeCategoryCarousel({
  viewAllTo = "/categories",
}: Props) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const animationFrameRef = useRef<number | null>(null);
  const xRef = useRef(0);
  const pausedRef = useRef(false);
  const dragActiveRef = useRef(false);
  const didDragRef = useRef(false);
  const startXRef = useRef(0);
  const startTranslateRef = useRef(0);
  const pauseTimeoutRef = useRef<number | null>(null);

  const DRAG_THRESHOLD = 4;

  useEffect(() => {
    let live = true;

    const load = async (attempt: number) => {
      try {
        if (attempt === 0) {
          setLoading(true);
          setErr(null);
        }

        const all = await getCategories();
        if (!live) return;

        const parents = (all || [])
          .filter((c) => c?.active !== false && c.parentId == null)
          .sort(
            (a, b) =>
              (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
              String(a.name || "").localeCompare(String(b.name || ""))
          );

        setItems(parents);
        setLoading(false);
      } catch (e: any) {
        if (!live) return;
        if (attempt < 2) {
          // Silently retry — keeps skeleton visible during transient failures (e.g. cold start)
          setTimeout(() => { if (live) load(attempt + 1); }, 1500);
        } else {
          setErr(e?.response?.data?.message || "Could not load categories.");
          setLoading(false);
        }
      }
    };

    load(0);

    return () => {
      live = false;
    };
  }, []);

  const ribbonItems = useMemo(() => {
    if (!items.length) return [];
    return [...items, ...items, ...items];
  }, [items]);

  const clearPauseTimeout = () => {
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  const pauseTemporarily = (ms = 2200) => {
    pausedRef.current = true;
    clearPauseTimeout();

    pauseTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, ms);
  };

  const applyTransform = (x: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const getSingleSetWidth = () => {
    const track = trackRef.current;
    if (!track || !items.length) return 0;
    return track.scrollWidth / 3;
  };

  const normalizeX = (nextX: number) => {
    const setWidth = getSingleSetWidth();
    if (!setWidth) return nextX;

    if (nextX <= -setWidth * 2) {
      return nextX + setWidth;
    }
    if (nextX >= -setWidth) {
      return nextX - setWidth;
    }
    return nextX;
  };

  useEffect(() => {
    if (!items.length) return;

    const setWidthReady = () => {
      const setWidth = getSingleSetWidth();
      if (!setWidth) return false;

      xRef.current = -setWidth;
      applyTransform(xRef.current);
      return true;
    };

    let tries = 0;
    const init = () => {
      const ok = setWidthReady();
      if (!ok && tries < 20) {
        tries += 1;
        window.requestAnimationFrame(init);
      }
    };

    init();
  }, [items]);

  useEffect(() => {
    if (!items.length) return;

    const SPEED = 0.28;

    const tick = () => {
      if (!pausedRef.current && !dragActiveRef.current) {
        xRef.current -= SPEED;
        xRef.current = normalizeX(xRef.current);
        applyTransform(xRef.current);
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [items]);

  const getCardStep = () => {
    const track = trackRef.current;
    if (!track) return 264;

    const card = track.querySelector<HTMLElement>(".hcc-card");
    if (!card) return 264;

    const computedStyles = window.getComputedStyle(track);
    const gap = parseFloat(computedStyles.gap || "16") || 16;

    return card.offsetWidth + gap;
  };

  const handleArrow = (dir: "left" | "right") => {
    pauseTemporarily(2600);

    const step = getCardStep();
    const shift = dir === "left" ? step : -step;

    const duration = 420;
    const start = performance.now();
    const from = xRef.current;
    const to = normalizeX(from + shift);

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;

      xRef.current = current;
      applyTransform(current);

      if (t < 1) {
        window.requestAnimationFrame(animate);
      } else {
        xRef.current = normalizeX(to);
        applyTransform(xRef.current);
      }
    };

    window.requestAnimationFrame(animate);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragActiveRef.current = true;
    didDragRef.current = false;
    pausedRef.current = true;
    clearPauseTimeout();

    startXRef.current = e.clientX;
    startTranslateRef.current = xRef.current;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;

    const dx = e.clientX - startXRef.current;

    if (!didDragRef.current && Math.abs(dx) < DRAG_THRESHOLD) return;
    didDragRef.current = true;

    xRef.current = normalizeX(startTranslateRef.current + dx);
    applyTransform(xRef.current);
  };

  const onPointerUp = () => {
    dragActiveRef.current = false;
    pauseTemporarily(1800);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  };

  useEffect(() => {
    const reset = () => {
      if (dragActiveRef.current) {
        dragActiveRef.current = false;
        pauseTemporarily(1800);
      }
    };
    document.addEventListener("pointerup", reset, { capture: true });
    document.addEventListener("pointercancel", reset, { capture: true });
    return () => {
      document.removeEventListener("pointerup", reset, { capture: true });
      document.removeEventListener("pointercancel", reset, { capture: true });
    };
  }, []);

  useEffect(() => {
    return () => {
      clearPauseTimeout();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <section className="hcc-wrap" aria-labelledby="hcc-title">
      <style>{styles}</style>

      <div className="hcc-shell">
        <div className="hcc-head">
          <div className="hcc-titleBlock">
            <span className="hcc-eyebrow">Curated Collections</span>
            <h2 id="hcc-title">Shop by category</h2>
            <p className="hcc-sub">
              Explore your floral styles through a smooth flowing ribbon of collections.
            </p>
          </div>

          <div className="hcc-actions">
            <button
              type="button"
              className="hcc-nav"
              aria-label="Move left"
              onClick={() => handleArrow("left")}
            >
              ‹
            </button>

            <button
              type="button"
              className="hcc-nav"
              aria-label="Move right"
              onClick={() => handleArrow("right")}
            >
              ›
            </button>

            <Link to={viewAllTo} className="hcc-viewAll">
              View all
            </Link>
          </div>
        </div>

        {err && <div className="hcc-error">{err}</div>}

        {loading && (
          <div className="hcc-skeletonRow" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-${i}`} className="hcc-card hcc-skel" />
            ))}
          </div>
        )}

        {!loading && !items.length && (
          <div className="hcc-empty">No categories available right now.</div>
        )}
      </div>

      {/* Ribbon sits outside constrained shell — full viewport width */}
      {!loading && items.length > 0 && (
        <div
          className="hcc-ribbonViewport"
          ref={viewportRef}
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
          onTouchStart={() => pauseTemporarily(2400)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
        >
          <div className="hcc-ribbonTrack" ref={trackRef}>
            {ribbonItems.map((cat, index) => (
              <Link
                key={`${cat.id}-${index}`}
                to={`/categories/${cat.id}`}
                className="hcc-card"
              >
                <div className="hcc-media">
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.imageAltText || cat.name}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="hcc-ph" aria-hidden="true" />
                  )}
                </div>

                <div className="hcc-card-overlay" aria-hidden="true" />

                <div className="hcc-copy">
                  <span className="hcc-name">{cat.name}</span>
                  <span className="hcc-shop">Shop →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const styles = `
.hcc-wrap{
  padding-top:clamp(28px,4vw,52px);
  padding-bottom:clamp(32px,5vw,56px);
  background:var(--bb-bg,#FAF7E7);
}

/* Shell constrains heading only */
.hcc-shell{
  width:min(1220px,calc(100% - 28px));
  margin:0 auto;
  margin-bottom:20px;
}

.hcc-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:20px;
}

.hcc-titleBlock{
  max-width:620px;
  min-width:0;
}

.hcc-eyebrow{
  display:inline-flex;
  align-items:center;
  min-height:28px;
  padding:0 12px;
  margin-bottom:8px;
  border-radius:999px;
  background:linear-gradient(180deg,rgba(240,93,139,.10),rgba(240,93,139,.05));
  border:1px solid rgba(240,93,139,.12);
  color:var(--bb-accent);
  font-size:11px;
  font-weight:800;
  letter-spacing:.16em;
  text-transform:uppercase;
}

.hcc-titleBlock h2{
  margin:0 0 8px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(26px,3.5vw,40px);
  line-height:1.06;
  color:var(--bb-primary);
  font-weight:400;
  letter-spacing:-.01em;
}

.hcc-sub{
  margin:0;
  color:#757d72;
  font-size:14px;
  line-height:1.68;
  max-width:540px;
}

.hcc-actions{
  display:flex;
  align-items:center;
  gap:8px;
  flex-shrink:0;
}

.hcc-nav{
  width:42px;
  height:42px;
  border:none;
  border-radius:999px;
  display:grid;
  place-items:center;
  background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,244,240,.95));
  color:var(--bb-primary);
  box-shadow:0 10px 22px rgba(33,28,23,.08);
  cursor:pointer;
  font-size:20px;
  transition:transform .24s ease,box-shadow .24s ease,background .24s ease,color .24s ease;
}

.hcc-nav:hover{
  transform:translateY(-1px);
  background:linear-gradient(180deg,#f26893,#e85484);
  color:#fff;
  box-shadow:0 14px 28px rgba(240,93,139,.24);
}

.hcc-viewAll{
  height:42px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:0 16px;
  border-radius:999px;
  background:linear-gradient(180deg,#4d5245 0%,#3d4237 100%);
  color:#fff;
  text-decoration:none;
  font-size:13px;
  font-weight:800;
  letter-spacing:.02em;
  box-shadow:0 12px 24px rgba(61,66,55,.18);
  transition:transform .24s ease,box-shadow .24s ease;
}

.hcc-viewAll:hover{
  transform:translateY(-1px);
  box-shadow:0 16px 28px rgba(61,66,55,.24);
}

.hcc-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin-bottom:14px;
  padding:10px 12px;
  border-radius:14px;
}

.hcc-empty{
  color:var(--bb-primary);
  opacity:.75;
  padding:10px 2px;
}

.hcc-ribbonViewport{
  position:relative;
  overflow:hidden;
  padding:4px 0 8px;
  width:100%;
  touch-action:pan-y;
  /* fade at edges so first/last card doesn't hard-cut */
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%);
          mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%);
}

.hcc-ribbonTrack{
  display:flex;
  gap:16px;
  padding:0 24px; /* left/right breathing room inside full-width viewport */
  width:max-content;
  will-change:transform;
}

.hcc-card{
  flex:0 0 auto;
  width:248px;
  height:460px;
  border-radius:18px;
  overflow:hidden;
  text-decoration:none;
  color:inherit;
  position:relative;
  background:#2a2a2a;
  transition:transform .28s ease,box-shadow .28s ease;
  box-shadow:0 16px 34px rgba(33,28,23,.12);
  display:block;
}

.hcc-card:hover{
  transform:translateY(-4px);
  box-shadow:0 24px 48px rgba(33,28,23,.18);
}

.hcc-media{
  position:absolute;
  inset:0;
  overflow:hidden;
}

.hcc-media img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  transition:transform .6s cubic-bezier(.22,.61,.36,1);
}

.hcc-card:hover .hcc-media img{
  transform:scale(1.06);
}

.hcc-ph{
  position:absolute;
  inset:0;
  background:
    radial-gradient(circle at 30% 30%,rgba(246,195,32,.36),transparent 28%),
    radial-gradient(circle at 75% 70%,rgba(240,93,139,.22),transparent 26%),
    linear-gradient(135deg,#fff7eb 0%,#ffeef5 100%);
}

.hcc-card-overlay{
  position:absolute;
  inset:0;
  background:linear-gradient(to top,rgba(26,22,16,.88) 0%,rgba(26,22,16,.42) 34%,rgba(26,22,16,0) 60%);
  pointer-events:none;
}

.hcc-copy{
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:12px 16px 18px;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  gap:10px;
  z-index:2;
}

.hcc-name{
  font-family:'DM Serif Display',Georgia,serif;
  font-style:italic;
  font-size:20px;
  color:#fff;
  line-height:1.15;
  letter-spacing:.01em;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  width:100%;
}

.hcc-shop{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  height:32px;
  padding:0 14px;
  border-radius:999px;
  background:rgba(255,255,255,.14);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.22);
  color:#fff;
  font-size:12px;
  font-weight:600;
  white-space:nowrap;
  transition:background .2s ease;
}

.hcc-card:hover .hcc-shop{
  background:rgba(255,255,255,.28);
}

.hcc-skeletonRow{
  display:flex;
  gap:16px;
  overflow:hidden;
  padding:4px 0 8px;
}

.hcc-skel{
  flex:0 0 248px;
  height:460px;
  border-radius:18px;
  background:linear-gradient(90deg,#eee7e4,#faf8f7,#eee7e4);
  background-size:200% 100%;
  animation:hccSk 1.15s linear infinite;
}

@keyframes hccSk{
  from{ background-position:200% 0; }
  to{ background-position:-200% 0; }
}

@media (max-width:640px){
  .hcc-wrap{
    padding-top:16px;
    padding-bottom:20px;
  }

  .hcc-shell{
    width:calc(100% - 24px);
    margin-bottom:14px;
  }

  .hcc-head{
    flex-direction:column;
    align-items:flex-start;
    gap:10px;
  }

  .hcc-titleBlock h2{
    font-size:clamp(20px,6.5vw,28px);
  }

  .hcc-sub{
    display:none;
  }

  .hcc-actions{
    width:100%;
    justify-content:space-between;
  }

  .hcc-card,
  .hcc-skel{
    width:160px;
    height:280px;
    border-radius:14px;
  }

  .hcc-name{
    font-size:15px;
  }

  .hcc-shop{
    height:28px;
    padding:0 10px;
    font-size:11px;
  }

  .hcc-nav,
  .hcc-viewAll{
    height:36px;
  }
}

@media (prefers-reduced-motion:reduce){
  .hcc-card,
  .hcc-media img,
  .hcc-nav,
  .hcc-viewAll,
  .hcc-shop{
    transition:none;
  }
}
`;
