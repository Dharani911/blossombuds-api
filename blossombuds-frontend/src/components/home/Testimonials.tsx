import React, { useEffect, useMemo, useRef, useState } from "react";
import { listReviews, type Review } from "../../api/reviews";

type Props = {
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
  limit?: number;
};

export default function Testimonials({
  title = "What customers are saying",
  ctaHref,
  ctaLabel = "See all reviews",
  limit = 5,
}: Props) {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const laneRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (dir: "left" | "right") => {
    const el = laneRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ts-card");
    const gap = 16;
    const step = card ? card.offsetWidth + gap : 280;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const page = await listReviews({
          page: 0,
          size: Math.max(1, limit),
          sort: "new",
        });
        if (ctrl.signal.aborted) return;
        setRows(page.rows ?? []);
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setErr(e?.message || "We couldn't load testimonials at the moment.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [limit]);

  const cards = useMemo(
    () =>
      rows.map((r) => ({
        id: String(r.id),
        name: (r.authorName || "").trim() || "Customer",
        rating: clamp(Math.round(Number(r.rating || 0)), 1, 5),
        text:
          r.content?.trim() ||
          r.title?.trim() ||
          "Rated without comment.",
        img: r.images?.[0]?.url || null,
      })),
    [rows]
  );

  return (
    <section className="ts-wrap" aria-labelledby="ts-heading">
      <style>{styles}</style>

      <div className="ts-head">
        <div className="ts-head-copy">
          <span className="ts-eyebrow">Customer love</span>
          <h2 id="ts-heading">{title}</h2>
          <p>
            Real feedback from customers who styled Blossom Buds for their
            special moments.
          </p>
        </div>

        <div className="ts-controls">
          <button
            className="ts-nav"
            aria-label="Previous"
            onClick={() => scrollByCards("left")}
          >
            ‹
          </button>
          <button
            className="ts-nav"
            aria-label="Next"
            onClick={() => scrollByCards("right")}
          >
            ›
          </button>
          {!!ctaHref && (
            <a className="ts-link" href={ctaHref} aria-label={ctaLabel}>
              {ctaLabel} ↗
            </a>
          )}
        </div>
      </div>

      {err && (
        <div className="ts-error" role="alert">
          {err}
        </div>
      )}

      <div className="ts-lane" ref={laneRef} aria-busy={loading}>
        {loading
          ? Array.from({ length: Math.min(6, Math.max(3, limit)) }).map((_, i) => (
              <article key={`sk-${i}`} className="ts-card skel" aria-hidden="true">
                <div className="ts-media sk-media" />
                <div className="ts-body">
                  <div className="sk sk-line w70" />
                  <div className="sk sk-line w90" />
                  <div className="sk sk-line w55" />
                  <div className="ts-meta">
                    <div className="ts-avatar sk-avatar" />
                    <div className="ts-who">
                      <div className="sk sk-line w40" />
                      <div className="sk sk-line w30" />
                    </div>
                  </div>
                </div>
              </article>
            ))
          : cards.slice(0, limit).map((r) => {
              const hasImage = !!r.img;

              return (
                <article
                  key={r.id}
                  className={`ts-card ${!hasImage ? "no-media" : ""}`}
                  role="listitem"
                  aria-label={`Review by ${r.name}`}
                >
                  {hasImage && (
                    <div className="ts-media">
                      <img
                        src={r.img!}
                        alt={r.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div className="ts-body">
                    <div className="ts-stars-wrap">
                      <Stars value={r.rating} />
                    </div>

                    <blockquote className="ts-text">{r.text}</blockquote>

                    <div className="ts-meta">
                      <div className="ts-avatar" aria-hidden>
                        {initials(r.name)}
                      </div>
                      <div className="ts-who">
                        <div className="ts-name">{r.name}</div>
                        <div className="ts-role">Verified customer</div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

        {!loading && !err && cards.length === 0 && (
          <div className="ts-empty">
            No testimonials yet — your feedback could be the first.
          </div>
        )}
      </div>
    </section>
  );
}

function Stars({ value, ariaLabel }: { value: number; ariaLabel?: string }) {
  const v = clamp(Math.round(value), 0, 5);
  return (
    <div className="ts-stars" aria-label={ariaLabel ?? `${v} out of 5 stars`} role="img">
      {"★".repeat(v)}
      {"☆".repeat(5 - v)}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function initials(n: string) {
  return n
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const styles = `
.ts-wrap{
  width:100%;
  padding: clamp(30px, 5vw, 56px) 0;
  background: var(--bb-bg, #FAF7E7);
}

.ts-head,
.ts-lane{
  padding-left: clamp(14px, 5vw, 48px);
  padding-right: clamp(14px, 5vw, 48px);
}

.ts-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  margin-bottom:20px;
}

.ts-head-copy{
  max-width:560px;
}

.ts-eyebrow{
  display:inline-flex;
  margin-bottom:6px;
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
  color: var(--bb-accent);
}

.ts-head h2{
  margin:0 0 8px;
  color: var(--bb-primary, #4A4F41);
  font-family: "Cinzel", "DM Serif Display", Georgia, serif;
  font-size: clamp(24px, 3.8vw, 38px);
  font-weight:700;
  line-height:1.1;
}

.ts-head p{
  margin:0;
  color:#8a9087;
  font-size:15px;
  line-height:1.7;
}

.ts-controls{
  display:flex;
  align-items:center;
  gap:8px;
  flex-shrink:0;
}

.ts-link{
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

.ts-link:hover{
  background:#4A4F41;
  color:#fff;
}

.ts-nav{
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

.ts-nav:hover{
  background:#F05D8B;
  color:#fff;
  border-color:#F05D8B;
  transform: scale(1.04);
}

.ts-lane{
  display:flex;
  gap:16px;
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  scroll-snap-type:x proximity;
  scrollbar-width:none;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
}

.ts-lane::-webkit-scrollbar{
  display:none;
}

.ts-card{
  flex:0 0 auto;
  width: clamp(240px, 30vw, 340px);
  scroll-snap-align:start;
  background:#fff;
  border-radius:24px;
  overflow:hidden;
  border:1px solid rgba(0,0,0,.06);
  box-shadow: 0 16px 36px rgba(0,0,0,.08);
  display:flex;
  flex-direction:column;
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

@media (hover:hover){
  .ts-card:hover{
    transform: translateY(-4px);
    box-shadow: 0 22px 48px rgba(0,0,0,.12);
    border-color: rgba(240,93,139,.18);
  }
}

.ts-media{
  position:relative;
  aspect-ratio: 4 / 3;
  background:#f3efe8;
  overflow:hidden;
}

.ts-media img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}

.ts-body{
  padding:18px 18px 16px;
  display:grid;
  grid-template-rows:auto 1fr auto;
  gap:12px;
  min-height:210px;
}

.ts-card.no-media .ts-body{
  min-height:auto;
  padding-top:20px;
}

.ts-stars-wrap{
  display:flex;
  align-items:center;
}

.ts-stars{
  color:#f5b400;
  letter-spacing:.26em;
  font-size:13px;
}

.ts-text{
  margin:0;
  color: var(--bb-primary, #4A4F41);
  font-size:14px;
  line-height:1.72;
  font-weight:500;
  align-self:start;
  display:-webkit-box;
  -webkit-line-clamp:5;
  -webkit-box-orient:vertical;
  overflow:hidden;
}

.ts-card.no-media .ts-text{
  -webkit-line-clamp:6;
}

.ts-meta{
  display:flex;
  align-items:center;
  gap:10px;
  margin-top:2px;
}

.ts-avatar{
  width:40px;
  height:40px;
  flex:0 0 40px;
  border-radius:999px;
  display:grid;
  place-items:center;
  font-size:13px;
  font-weight:900;
  color:#2b2b2b;
  background: radial-gradient(120% 140% at 20% 0%, rgba(246,195,32,.32), rgba(240,93,139,.18));
  border:1px solid rgba(0,0,0,.06);
}

.ts-who{
  display:grid;
  gap:2px;
}

.ts-name{
  color: var(--bb-primary);
  font-size:14px;
  font-weight:800;
}

.ts-role{
  color:#8a9087;
  font-size:12px;
  font-weight:600;
}

.ts-empty{
  padding:10px 0;
  color: var(--bb-primary);
  opacity:.78;
}

.ts-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin: 0 clamp(14px, 5vw, 48px) 14px;
  padding: 10px 12px;
  border-radius: 14px;
}

.skel{
  overflow:hidden;
}

.sk,
.sk-media,
.sk-avatar{
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee);
  background-size:200% 100%;
  animation: tsSk 1.15s linear infinite;
}

.sk-media{
  aspect-ratio: 4 / 3;
}

.sk-avatar{
  width:40px;
  height:40px;
  border-radius:999px;
}

.sk-line{
  height:12px;
  border-radius:8px;
}

.w30{ width:30%; }
.w40{ width:40%; }
.w55{ width:55%; }
.w70{ width:70%; }
.w90{ width:90%; }

@keyframes tsSk{
  from{ background-position:200% 0; }
  to{ background-position:-200% 0; }
}

@media (max-width: 720px){
  .ts-head{
    flex-direction:column;
    align-items:flex-start;
  }

  .ts-controls{
    width:100%;
    justify-content:flex-start;
  }

  .ts-card{
    width: clamp(240px, 84vw, 300px);
  }

  .ts-body{
    padding:16px 14px 14px;
    min-height:190px;
  }

  .ts-card.no-media .ts-body{
    min-height:auto;
    padding-top:18px;
  }

  .ts-text{
    font-size:13.5px;
    -webkit-line-clamp:6;
  }

  .ts-avatar{
    width:36px;
    height:36px;
    flex-basis:36px;
    font-size:12px;
  }

  .ts-name{
    font-size:13px;
  }

  .ts-role{
    font-size:11px;
  }
}

@media (prefers-reduced-motion: reduce){
  .ts-card,
  .ts-link,
  .ts-nav{
    transition:none;
  }
}
`;