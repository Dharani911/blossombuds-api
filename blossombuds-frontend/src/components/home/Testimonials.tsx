// src/components/Testimonials.tsx
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
        img: r.images?.[0]?.url || null, // still used for the top thumbnail only
        when: r.createdAt,
      })),
    [rows]
  );

  return (
    <section className="bb-ts" aria-labelledby="bb-ts-heading">
      <style>{styles}</style>

      <div className="bb-ts-head">
        <h2 id="bb-ts-heading">{title}</h2>
        {!!ctaHref && (
          <a className="bb-ts-cta" href={ctaHref} aria-label={ctaLabel}>
            {ctaLabel} →
          </a>
        )}
      </div>

      <div className="bb-ts-grid" role="list">
        {loading &&
          Array.from({ length: Math.min(5, limit) }).map((_, i) => (
            <article key={`sk-${i}`} className="bb-ts-card" aria-busy="true" aria-live="polite">
              <div className="bb-ts-thumb sk" />
              <div className="bb-ts-text sk block" />
              <div className="bb-ts-meta">
                <div className="bb-ts-avatar sk" />
                <div className="bb-ts-who">
                  <div className="sk line" />
                  <div className="sk line sm" />
                </div>
              </div>
            </article>
          ))}

        {!loading && !err && cards.length === 0 && (
          <article className="bb-ts-card" role="listitem">
            <div className="bb-ts-text">
              “No testimonials yet — your feedback could be the first!”
            </div>
            <div className="bb-ts-meta">
              <div className="bb-ts-avatar">🙂</div>
              <div className="bb-ts-who">
                <div className="bb-ts-name">Blossom Buds</div>
                <Stars value={0} ariaLabel="No ratings yet" />
              </div>
            </div>
          </article>
        )}

        {!loading && !err &&
          cards.slice(0, limit).map((r) => (
            <article key={r.id} className="bb-ts-card" role="listitem" aria-label={`Review by ${r.name}`}>
              {r.img && (
                <div className="bb-ts-thumb">
                  <img
                    src={r.img}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={480}
                    height={240}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <blockquote className="bb-ts-text">
                <span aria-hidden>“</span>
                {truncate(r.text, 320)}
                <span aria-hidden>”</span>
              </blockquote>

              <div className="bb-ts-meta">
                {/* ALWAYS show initials avatar — do not use review image here */}
                <div className="bb-ts-avatar" aria-hidden>
                  {initials(r.name)}
                </div>

                <div className="bb-ts-who">
                  <div className="bb-ts-name">{r.name}</div>
                  <Stars value={r.rating} />
                </div>
              </div>
            </article>
          ))}

        {!loading && !!err && (
          <article className="bb-ts-card" role="alert">
            <div className="bb-ts-text">“{err}”</div>
            <div className="bb-ts-meta">
              <div className="bb-ts-avatar">!</div>
              <div className="bb-ts-who">
                <div className="bb-ts-name">System</div>
                <Stars value={0} ariaLabel="Error" />
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

/* ---------------- helpers ---------------- */

function Stars({ value, ariaLabel }: { value: number; ariaLabel?: string }) {
  const v = clamp(Math.round(value), 0, 5);
  return (
    <div className="bb-ts-stars" aria-label={ariaLabel ?? `${v} out of 5 stars`} role="img">
      {"★".repeat(v)}
      {"☆".repeat(5 - v)}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function truncate(s: string, max: number) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
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

/* ---------------- styles ---------------- */

const styles = `
.bb-ts{
  padding: 8px 0 36px;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding-left: clamp(8px, 3vw, 28px);
  padding-right: clamp(8px, 3vw, 28px);
  background: var(--bb-bg, #fff7fb);
}
.bb-ts-head{
  display:flex; justify-content:space-between; align-items:baseline;
  margin: 0 0 12px;
}
.bb-ts-head h2{
  margin:0; color: var(--bb-primary, #4A4F41);
  font-size: clamp(18px, 2.2vw, 24px);
}
.bb-ts-cta{
  color: var(--bb-accent, #F05D8B);
  text-decoration: none;
  font-weight: 700;
}
.bb-ts-cta:hover{ text-decoration: underline; }

.bb-ts-grid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: clamp(12px, 2vw, 18px);
}

.bb-ts-card{
  background:#fff; border-radius:18px; padding:16px;
  box-shadow: 0 14px 36px rgba(0,0,0,.08);
  display:grid; gap:12px;
  border: 1px solid rgba(0,0,0,.06);
  transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
}
.bb-ts-card:hover{
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(0,0,0,.11);
  border-color: rgba(240,93,139,.18);
}

.bb-ts-thumb{
  width:100%; height: 120px; border-radius: 12px; overflow:hidden;
  background: #fafafa; border: 1px solid rgba(0,0,0,.06);
}
.bb-ts-thumb img{ width:100%; height:100%; object-fit: cover; display:block; }

.bb-ts-text{
  color: var(--bb-primary, #4A4F41);
  font-weight:700; letter-spacing:.2px; line-height:1.45;
  display:-webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow:hidden;
  margin: 0;
}

.bb-ts-meta{ display:flex; align-items:center; gap:10px; }

.bb-ts-avatar{
  width:42px; height:42px; border-radius:999px; display:grid; place-items:center;
  font-weight:900; color:#2b2b2b;
  background: radial-gradient(120% 140% at 20% 0%, rgba(246,195,32,.38), rgba(240,93,139,.24));
  border:1px solid rgba(0,0,0,.06);
  overflow:hidden;
}

.bb-ts-name{ font-weight:900; color: var(--bb-primary, #4A4F41); }
.bb-ts-stars{ color:#f5b400; letter-spacing:1px; font-size: 14px; }

/* skeletons */
.sk{
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size:200% 100%;
  animation: sk 1.2s linear infinite; border-radius:8px;
}
.sk.block{ height: 64px; }
.sk.line{ height:14px; width:120px; margin-bottom:6px; }
.sk.line.sm{ height:12px; width:90px; }

@keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
`;
