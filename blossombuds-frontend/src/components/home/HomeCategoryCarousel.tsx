import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories, type Category } from "../../api/catalog";

type Props = {
  title?: string;
  viewAllTo?: string;
};

export default function HomeCategoryCarousel({
  title = "Shop by category",
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
  const startXRef = useRef(0);
  const startTranslateRef = useRef(0);
  const pauseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

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
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load categories.");
      } finally {
        if (live) setLoading(false);
      }
    })();

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
    if (!track) return 180;

    const card = track.querySelector<HTMLElement>(".hcc-card");
    if (!card) return 180;

    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.gap || "12") || 12;

    return card.offsetWidth + gap;
  };

  const moveRibbonBy = (delta: number) => {
    xRef.current += delta;
    xRef.current = normalizeX(xRef.current);
    applyTransform(xRef.current);
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
    pausedRef.current = true;
    clearPauseTimeout();

    startXRef.current = e.clientX;
    startTranslateRef.current = xRef.current;

    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragActiveRef.current) return;

    const dx = e.clientX - startXRef.current;
    xRef.current = normalizeX(startTranslateRef.current + dx);
    applyTransform(xRef.current);
  };

  const onPointerUp = () => {
    dragActiveRef.current = false;
    pauseTemporarily(1800);
  };

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
            <h2 id="hcc-title">{title}</h2>
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

        {loading ? (
          <div className="hcc-skeletonRow" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-${i}`} className="hcc-card hcc-skel">
                <div className="hcc-media" />
                <div className="hcc-copy">
                  <div className="hcc-skLine" />
                </div>
              </div>
            ))}
          </div>
        ) : !items.length ? (
          <div className="hcc-empty">No categories available right now.</div>
        ) : (
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

                    <div className="hcc-mediaGlow" />
                    <div className="hcc-mediaShine" />
                  </div>

                  <div className="hcc-copy">
                    <span className="hcc-name">{cat.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const styles = `
.hcc-wrap{
  padding: clamp(12px, 2.8vw, 28px) 0 clamp(22px, 4vw, 40px);
  background:
    radial-gradient(circle at 10% 0%, rgba(255,255,255,.9), rgba(255,255,255,0) 28%),
    radial-gradient(circle at 88% 12%, rgba(240,93,139,.08), rgba(240,93,139,0) 24%),
    linear-gradient(180deg, #fffdfa 0%, #fbf7f1 100%);
}

.hcc-shell{
  width: min(1220px, calc(100% - 14px));
  margin: 0 auto;
}

.hcc-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:14px;
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
  background: linear-gradient(180deg, rgba(240,93,139,.10), rgba(240,93,139,.05));
  border:1px solid rgba(240,93,139,.12);
  color: var(--bb-accent);
  font-size:11px;
  font-weight:800;
  letter-spacing:.16em;
  text-transform:uppercase;
}

.hcc-titleBlock h2{
  margin:0 0 8px;
  font-family:"Cinzel","DM Serif Display",Georgia,serif;
  font-size: clamp(26px, 3.5vw, 40px);
  line-height:1.06;
  color: var(--bb-primary);
  font-weight:700;
  letter-spacing:-.02em;
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
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,244,240,.95));
  color: var(--bb-primary);
  box-shadow: 0 10px 22px rgba(33,28,23,.08);
  cursor:pointer;
  font-size:20px;
  transition: transform .24s ease, box-shadow .24s ease, background .24s ease, color .24s ease;
}

.hcc-nav:hover{
  transform: translateY(-1px);
  background: linear-gradient(180deg, #f26893, #e85484);
  color:#fff;
  box-shadow: 0 14px 28px rgba(240,93,139,.24);
}

.hcc-viewAll{
  height:42px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:0 16px;
  border-radius:999px;
  background: linear-gradient(180deg, #4d5245 0%, #3d4237 100%);
  color:#fff;
  text-decoration:none;
  font-size:13px;
  font-weight:800;
  letter-spacing:.02em;
  box-shadow: 0 12px 24px rgba(61,66,55,.18);
  transition: transform .24s ease, box-shadow .24s ease;
}

.hcc-viewAll:hover{
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(61,66,55,.24);
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
  color: var(--bb-primary);
  opacity:.75;
  padding:10px 2px;
}

.hcc-ribbonViewport{
  position:relative;
  overflow:hidden;
  border-radius:24px;
  padding: 4px 0 8px;
  touch-action: pan-y;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}

.hcc-ribbonTrack{
  display:flex;
  gap:12px;
  width:max-content;
  will-change: transform;
}

.hcc-card{
  flex:0 0 auto;
  width: clamp(146px, 20vw, 210px);
  border-radius:22px;
  overflow:hidden;
  text-decoration:none;
  color:inherit;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,250,252,.95));
  border:1px solid rgba(74,79,65,.06);
  box-shadow: 0 16px 34px rgba(33,28,23,.08);
  transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease;
}

.hcc-card:hover{
  transform: translateY(-4px);
  box-shadow: 0 22px 44px rgba(33,28,23,.12);
  border-color: rgba(240,93,139,.16);
}

.hcc-media{
  position:relative;
  aspect-ratio: 1 / 1;
  overflow:hidden;
  background:#f2efea;
}

.hcc-media img,
.hcc-ph{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
}

.hcc-media img{
  object-fit:cover;
  display:block;
  transition: transform .6s cubic-bezier(.22,.61,.36,1), filter .35s ease;
}

.hcc-card:hover .hcc-media img{
  transform: scale(1.05);
  filter: saturate(1.03);
}

.hcc-ph{
  background:
    radial-gradient(circle at 30% 30%, rgba(246,195,32,.36), transparent 28%),
    radial-gradient(circle at 75% 70%, rgba(240,93,139,.22), transparent 26%),
    linear-gradient(135deg, #fff7eb 0%, #ffeef5 100%);
}

.hcc-mediaGlow{
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(255,255,255,.02) 0%, rgba(0,0,0,.08) 100%);
  pointer-events:none;
}

.hcc-mediaShine{
  position:absolute;
  inset:0;
  background: linear-gradient(120deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 24%);
  pointer-events:none;
}

.hcc-copy{
  min-height:64px;
  padding: 12px 10px 14px;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  background: linear-gradient(180deg, #fff 0%, #fffafc 100%);
}

.hcc-name{
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  width:100%;
  min-height:38px;
  color:#3f463b;
  font-family:"Cormorant Garamond","DM Serif Display",Georgia,serif;
  font-size:18px;
  font-weight:600;
  line-height:1.08;
  letter-spacing:.01em;

  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  text-wrap:balance;
}

.hcc-skeletonRow{
  display:flex;
  gap:12px;
  overflow:hidden;
}

.hcc-skel{
  width: clamp(146px, 20vw, 210px);
}

.hcc-skel .hcc-media,
.hcc-skLine{
  background: linear-gradient(90deg,#eee7e4,#faf8f7,#eee7e4);
  background-size:200% 100%;
  animation: hccSk 1.15s linear infinite;
}

.hcc-skLine{
  height:14px;
  width:72%;
  border-radius:999px;
  margin: 0 auto;
}

@keyframes hccSk{
  from{ background-position:200% 0; }
  to{ background-position:-200% 0; }
}

@media (max-width: 640px){
  .hcc-wrap{
    padding: 10px 0 18px;
  }

  .hcc-shell{
    width: calc(100% - 10px);
  }

  .hcc-head{
    flex-direction:column;
    align-items:flex-start;
    gap:12px;
    margin-bottom:12px;
  }

  .hcc-titleBlock h2{
    font-size: clamp(22px, 7vw, 30px);
  }

  .hcc-sub{
    font-size:13px;
    line-height:1.56;
  }

  .hcc-actions{
    width:100%;
    justify-content:space-between;
  }

  .hcc-card,
  .hcc-skel{
    width: 148px;
    border-radius:20px;
  }

  .hcc-copy{
    min-height:60px;
    padding: 10px 8px 12px;
  }

  .hcc-name{
    min-height:36px;
    font-size:15px;
    line-height:1.08;
  }

  .hcc-nav,
  .hcc-viewAll{
    height:38px;
  }
}

@media (max-width: 390px){
  .hcc-shell{
    width: calc(100% - 8px);
  }

  .hcc-card,
  .hcc-skel{
    width: 142px;
  }

  .hcc-titleBlock h2{
    font-size:24px;
  }

  .hcc-sub{
    font-size:12.5px;
  }

  .hcc-name{
    min-height:34px;
    font-size:14.5px;
  }

  .hcc-nav{
    width:36px;
    height:36px;
    font-size:18px;
  }

  .hcc-viewAll{
    height:36px;
    padding:0 12px;
    font-size:12px;
  }
}

@media (prefers-reduced-motion: reduce){
  .hcc-card,
  .hcc-media img,
  .hcc-nav,
  .hcc-viewAll{
    transition:none;
  }
}
`;