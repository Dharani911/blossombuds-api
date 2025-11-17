// src/components/home/Testimonials.tsx
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
    const gap = 12;
    const step = card ? card.offsetWidth + gap : 260;
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
        const page = await listReviews({ page: 0, size: Math.max(1, limit), sort: "new" });
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
        text: r.content?.trim() || r.title?.trim() || "Rated without comment.",
        img: r.images?.[0]?.url || null,
        when: r.createdAt,
      })),
    [rows]
  );

  return (
    <section className="ts" aria-labelledby="ts-heading">
      <style>{styles}</style>

      <div className="ts-head">
        <h2 id="ts-heading">{title}</h2>
        <div className="ts-controls">
          <button className="ts-nav" aria-label="Previous" onClick={() => scrollByCards("left")}>‹</button>
          <button className="ts-nav" aria-label="Next" onClick={() => scrollByCards("right")}>›</button>
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
              <article key={`sk-${i}`} className="ts-card skel" aria-busy="true" aria-live="polite">
                <div className="ts-img sk" />
                <div className="sk sk-line" />
                <div className="sk sk-line sm" />
                <div className="ts-meta">
                  <div className="ts-avatar sk" />
                  <div className="ts-who">
                    <div className="sk sk-line xs" />
                    <div className="sk sk-line xs" />
                  </div>
                </div>
              </article>
            ))
          : cards.slice(0, limit).map((r) => (
              <article key={r.id} className="ts-card" role="listitem" aria-label={`Review by ${r.name}`}>
                {r.img ? (
                  <div className="ts-img" aria-label="review image">
                    <img
                      src={r.img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="ts-img noimg" aria-label="review text">
                    <div className="ts-imgText">
                      <span aria-hidden>“</span>
                      {r.text}
                      <span aria-hidden>”</span>
                    </div>
                  </div>
                )}

                {r.img && (
                  <blockquote className="ts-text">
                    <span aria-hidden>“</span>
                    {r.text}
                    <span aria-hidden>”</span>
                  </blockquote>
                )}

                <div className="ts-meta">
                  <div className="ts-avatar" aria-hidden>
                    {initials(r.name)}
                  </div>
                  <div className="ts-who">
                    <div className="ts-name">{r.name}</div>
                    <Stars value={r.rating} />
                  </div>
                </div>
              </article>
            ))}

        {!loading && !err && cards.length === 0 && (
          <div className="ts-empty">No testimonials yet — your feedback could be the first!</div>
        )}
      </div>
    </section>
  );
}

/* helpers */
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

/* styles */
const styles = `
.ts{
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  width: 100vw;
  background: var(--bb-bg, #fff7fb);
  padding-top: 8px;
  padding-bottom: 24px;
}

/* head */
.ts-head,
.ts-lane {
  padding-left: clamp(8px, 3vw, 28px);
  padding-right: clamp(8px, 3vw, 28px);
}
.ts-head{
  display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 8px;
}
.ts-head h2{
  margin:0; color: var(--bb-primary, #4A4F41);
  font-size: clamp(16px, 2.1vw, 20px);
}
.ts-controls{ display:flex; align-items:center; gap:8px; }
.ts-link{ font-weight:900; color: var(--bb-primary); text-decoration:none; }
.ts-nav{
  width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-size: 18px; line-height: 1; color: var(--bb-primary);
}

/* horizontal lane */
.ts-lane{
  display:flex; gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
}
.ts-lane::-webkit-scrollbar{ display:none; }

/* compact cards (like ProductShowcase cadence) */
.ts-card{
  flex: 0 0 auto;
  width: clamp(200px, 70vw, 280px);
  scroll-snap-align: start;
  background:#fff; border-radius:16px; overflow:hidden;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 12px 34px rgba(0,0,0,.10);
  display:grid; gap:8px;
  padding-bottom: 10px;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
@media (min-width: 560px){
  .ts-card{ width: clamp(220px, 28vw, 300px); }
}
@media (hover:hover){
  .ts-card:hover{
    transform: translateY(-2px);
    box-shadow: 0 18px 44px rgba(0,0,0,.12);
    border-color: rgba(240,93,139,.18);
  }
}

/* IMAGE like New Arrivals (3:2, cover, full bleed) */
.ts-img{
  position: relative;
  background: #f3f3f3;
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.ts-img::after{
  content:""; display:block; width:100%; padding-top: 66.6667%; /* 3:2 ratio */
}
.ts-img img{
  position:absolute; inset:0; width:100%; height:100%;
  object-fit: cover; display:block;
}

/* No-image mode:
   - Fixed height box, centered content, no overflow
   - Responsive font and gentle line clamp to ensure fit */
.ts-img.noimg{
  background: linear-gradient(135deg, #f6f6f6, #fafafa);
  border-bottom: 1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:center;
  text-align:center;
  padding: 10px 12px;
  height: 150px;             /* fixed box to match visual rhythm */
}
@media (min-width:560px){
  .ts-img.noimg{ height: 160px; }
}
.ts-img.noimg::after{
  content: none;            /* remove the 3:2 spacer */
}
.ts-img.noimg .ts-imgText{
  display: -webkit-box;
  -webkit-line-clamp: 6;    /* keep inside box */
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;

  max-width: 92%;
  margin: 0 auto;

  color: var(--bb-primary, #4A4F41);
  font-weight: 700;
  letter-spacing: .2px;
  line-height: 1.45;
  font-size: clamp(12px, 2.9vw, 14px);
  word-wrap: break-word;
  overflow-wrap: anywhere;
  hyphens: auto;
}

/* Full review body shown only when there is an image (unclamped) */
.ts-text{
  margin: 8px 10px 0;
  color: var(--bb-primary, #4A4F41);
  font-weight:700; letter-spacing:.2px; line-height:1.45;
  font-size: 13.5px;
  white-space: normal; word-wrap: break-word; overflow-wrap: anywhere;
}
@media (min-width:560px){ .ts-text{ font-size: 14px; } }

/* meta row */
.ts-meta{ display:flex; align-items:center; gap:8px; padding: 6px 10px 0; }
.ts-avatar{
  width:30px; height:30px; border-radius:999px; display:grid; place-items:center;
  font-weight:900; color:#2b2b2b; font-size:12px;
  background: radial-gradient(120% 140% at 20% 0%, rgba(246,195,32,.32), rgba(240,93,139,.18));
  border:1px solid rgba(0,0,0,.06);
}
.ts-who{ display:grid; gap:2px; }
.ts-name{ font-weight:900; color: var(--bb-primary); font-size: 12.5px; }
.ts-stars{ color:#f5b400; letter-spacing:.4px; font-size: 12px; }
@media (min-width:560px){
  .ts-avatar{ width:36px; height:36px; font-size:13px; }
  .ts-name{ font-size: 13.5px; }
}

/* empty + error */
.ts-empty{ color: var(--bb-primary); opacity:.8; padding: 10px 0; }
.ts-error{
  color:#8a0024;
  background:#fff3f5;
  border:1px solid rgba(240,93,139,.25);
  margin: 8px clamp(8px, 3vw, 28px);
  padding: 8px 10px;
  border-radius: 12px;
}

/* skeletons */
.skel{ overflow:hidden; }
.sk{
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee);
  background-size:200% 100%;
  animation: sk 1.1s linear infinite;
  border-radius:6px;
}
.sk-line{ height: 12px; }
.sk-line.sm{ height: 10px; width: 70%; }
.sk-line.xs{ height: 9px; width: 60%; }
@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
`;
