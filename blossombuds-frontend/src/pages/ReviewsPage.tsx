// src/pages/ReviewsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { listReviews, type Review, type ReviewPage } from "../api/reviews";

const PRIMARY = "var(--bb-primary)";
const INK = "rgba(0,0,0,.08)";
const GOLD = "#F6C320";

/* ---------------- Stars ---------------- */
function Star({ filled = false, half = false }: { filled?: boolean; half?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="rv-half">
          <stop offset="50%" stopColor={GOLD} />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 17.27 18.18 21l-1.63-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.45 4.73L5.82 21z"
        fill={filled ? GOLD : half ? "url(#rv-half)" : "none"}
        stroke={GOLD}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating || 0);
  const half = (rating || 0) - full >= 0.5;
  return (
    <span className="stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} filled={i < full} half={i === full && half} />
      ))}
    </span>
  );
}

/* ---------------- Page ---------------- */

type SortKey = "new" | "rating";

export default function ReviewsPage({ productId }: { productId?: number }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [size] = useState(12);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [pendingQ, setPendingQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(pendingQ.trim()), 300);
    return () => clearTimeout(t);
  }, [pendingQ]);

  // Fetch
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const out: ReviewPage = await listReviews({
          page,
          size,
          sort,
          q: q || undefined,
          productId,
        });
        if (!live) return;
        setRows(out.rows || []);
        setTotal(out.total || 0);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.message || "Could not load reviews.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [page, size, sort, q, productId]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  const items = useMemo(
    () =>
      rows.map((r) => {
        const firstImageUrl =
          (r.images && r.images[0]?.url) || (r as any).firstImageUrl || null;
        return {
          id: r.id,
          when: r.createdAt,
          title: r.title?.trim() || undefined,
          text: (r.content ?? r.title ?? "").toString().trim() || "Rated without comment.",
          rating: Number(r.rating || 0),
          author: (r.authorName || "").trim() || "Customer",
          productName: r.productName?.trim() || undefined,
          img: firstImageUrl,
        };
      }),
    [rows]
  );

  const avgRating = useMemo(() => {
    if (!items.length) return 0;
    const sum = items.reduce((s, it) => s + (it.rating || 0), 0);
    return Math.round((sum / items.length) * 10) / 10;
  }, [items]);
  function ReviewText({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 240;
    const preview = text.slice(0, 240);
    const renderedText = insertSoftHyphens(expanded || !isLong ? text : preview + "…");
    return (
      <div className="txt-wrap" lang="en">
        <p
                className={`txt ${expanded ? "" : "clamp"}`}
                dangerouslySetInnerHTML={{ __html: renderedText }}
              />
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="readmore-btn"
            aria-label={expanded ? "Read less" : "Read more"}
          >
            {expanded ? "Read less ▲" : "Read more ▼"}
          </button>
        )}
      </div>
    );
  }
function insertSoftHyphens(text: string, interval = 8): string {
  return text.replace(new RegExp(`(\\w{${interval}})(?=\\w)`, 'g'), '$1\u00AD');
}


  return (
    <div className="rv-wrap" lang="en">
      <style>{css}</style>

      <header className="hero">
        <div className="inner">
          <h1>{productId ? "Product Reviews" : "Customer Reviews"}</h1>
          <p>{productId ? "Approved reviews for this product." : "What customers are saying."}</p>

          <div className="kpis">
            <div className="k">
              <div className="n">{items.length ? avgRating : "—"}</div>
              <div className="l">Avg rating (this page)</div>
            </div>
            <div className="k">
              <div className="n">{total || "—"}</div>
              <div className="l">Total reviews</div>
            </div>
          </div>

          <div className="filters">
            <div className="search">
              <input
                value={pendingQ}
                onChange={(e) => {
                  setPendingQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Search title, comment or product…"
                aria-label="Search reviews"
              />
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="sort">
              <label>Sort</label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortKey);
                  setPage(0);
                }}
              >
                <option value="new">Newest</option>
                <option value="rating">Highest rated</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="body">
        {loading && (
          <div className="grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="card sk" key={i} />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <h3>Couldn’t load reviews</h3>
            <p className="muted">{err}</p>
          </div>
        )}

        {!loading && !err && items.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📝</div>
            <h3>No reviews found</h3>
            <p className="muted">Try a different search.</p>
          </div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="grid">
            {items.map((r) => (
              <article className="card" key={r.id}>
                {/* 1. Image */}
                {r.img && (
                  <div className="thumb">
                    <img
                      src={r.img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* 2. Stars and Date */}
                <div className="meta">
                  <Stars rating={r.rating} />
                  <time dateTime={r.when}>{new Date(r.when).toLocaleDateString()}</time>
                </div>

                {/* 3. Title */}
                <h3 className="title" dangerouslySetInnerHTML={{ __html: insertSoftHyphens(r.title || `Rated ${r.rating}★`) }} />


                {/* 4. Body with Read More */}
                <ReviewText text={r.text} />

                {/* 5. Customer */}
                <div className="author">{r.author}</div>
              </article>

            ))}
          </div>
        )}

        {!loading && !err && pageCount > 1 && (
          <nav className="pager" aria-label="Reviews pagination">
            <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span>
              Page {page + 1} / {pageCount}
            </span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}

/* ---------------- styles ---------------- */
const css = `
.rv-wrap{ background: var(--bb-bg); color: ${PRIMARY}; min-height: 60vh; }
.hero{
  background: linear-gradient(135deg, rgba(246,195,32,.18), rgba(240,93,139,.16));
  border-bottom:1px solid rgba(0,0,0,.06);
}
.hero .inner{ max-width:1200px; margin:0 auto; padding: 26px 16px 16px; }
.hero h1{ margin:0 0 6px; font-family:"DM Serif Display", Georgia, serif; font-size:30px; }
.hero p{ margin:0 0 12px; opacity:.9; }

.kpis{ display:flex; flex-wrap: wrap; gap:14px; margin:8px 0 12px; }
.k{ background:#fff; border:1px solid ${INK}; border-radius:12px; padding:10px 12px; box-shadow:0 10px 26px rgba(0,0,0,.08); }
.k .n{ font-size:18px; font-weight:900; }
.k .l{ font-size:12px; opacity:.75; }

.filters{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.search{ position:relative; width:min(360px, 100%); }
.search input{
  width:100%; height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 36px 0 12px; background:#fff; outline:none;
}
.search svg{ position:absolute; right:10px; top:10px; opacity:.65; }

.sort{ display:flex; align-items:center; gap:6px; }
.sort select{ height:38px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; background:#fff; }

.body{ max-width:1100px; margin:14px auto 40px; padding: 0 16px; }

/* responsive grid for cards */
.grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); /* ✅ Responsive */
  align-items: start;
}

/* cards */
.card{
  border:1px solid ${INK};
  border-radius:14px;
  background:#fff;
  box-shadow:0 10px 28px rgba(0,0,0,.08);
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:10px;
  min-width:0; /* prevent overflow in grid cells */
}

/* consistent image box */
.thumb{
  width:100%;
  aspect-ratio: 4 / 3; /* consistent crop */
  border-radius: 10px;
  overflow:hidden;
  background:#fafafa;
  border:1px solid ${INK};
}
.thumb img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
}

/* skeleton card */
.card.sk{
  height:220px;
  background:linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size:200% 100%;
  animation: shimmer 1.2s linear infinite;
  border:none;
}
@keyframes shimmer{ from{ background-position: 200% 0; } to{ background-position: -200% 0; } }

/* header */
.h{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.h .left{ display:flex; align-items:center; gap:10px; min-width:0; }
.h h3{ margin:0; font-size:16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stars{ display:inline-flex; gap:2px; align-items:center; flex-shrink:0; }

/* text */
.txt{ margin:2px 0 4px; line-height:1.5; color:${PRIMARY}; }
.txt.clamp{
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* footer */
.f{ display:flex; gap:8px; font-size:13px; opacity:.85; align-items:center; }
.who{ font-weight:700; }
.prod{ opacity:.9; }

/* empty + pager */
.empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  gap:8px; padding:36px 16px; color:${PRIMARY};
}
.empty-icon{ font-size:36px; opacity:.6; }

.pager{ display:flex; gap:10px; align-items:center; justify-content:center; margin-top:16px; }
.pager button{
  height:34px; padding:0 10px; border:1px solid ${INK}; border-radius:10px; background:#fff; cursor:pointer;
}
@media (max-width: 520px) {
  .hero .inner {
    padding: 20px 12px 10px;
  }

  .hero h1 {
    font-size: 22px;
  }

  .hero p {
    font-size: 14px;
    margin-bottom: 8px;
  }

  .k {
    padding: 8px 10px;
  }

  .k .n {
    font-size: 16px;
  }

  .k .l {
    font-size: 11px;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .search input,
  .sort select {
    height: 34px;
    font-size: 14px;
  }

  .sort {
    justify-content: space-between;
    margin-top: 6px;
  }

  .body {
    padding: 0 12px;
  }

  .card {
    padding: 10px;
    gap: 8px;
    border-radius: 12px;
  }

  .thumb {
    aspect-ratio: 5 / 4;
    border-radius: 8px;
  }

  .h h3 {
    font-size: 15px;
  }

  .stars svg {
    width: 14px;
    height: 14px;
  }

  .txt.clamp {
    -webkit-line-clamp: 4;
  }

  .f {
    font-size: 12px;
    gap: 6px;
  }

  .pager button {
    height: 30px;
    font-size: 13px;
    padding: 0 8px;
  }
}
@media (max-width: 520px) {
  .hero .inner {
    padding: 18px 12px 12px;
  }

  .hero h1 {
    font-size: 20px;
  }

  .hero p {
    font-size: 13px;
    margin-bottom: 6px;
  }

  .kpis {
    gap: 10px;
    margin: 6px 0 10px;
  }

  .k {
    padding: 6px 10px;
    border-radius: 10px;
  }

  .k .n {
    font-size: 15px;
  }

  .k .l {
    font-size: 11px;
  }

  .filters {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }

  .search input,
  .sort select {
    height: 34px;
    font-size: 14px;
  }

  .body {
    padding: 0 12px;
  }

  .grid {
      grid-template-columns: repeat(2, 1fr); /* 👈 fallback to 1 per row on very small phones */
    }


  .card {
    padding: 10px;
    gap: 6px;
    border-radius: 10px;
  }

  .thumb {
    aspect-ratio: 4 / 3;
    border-radius: 8px;
  }

  .h h3 {
    font-size: 14px;
  }

  .stars svg {
    width: 14px;
    height: 14px;
  }

  .txt.clamp {
    font-size: 13px;
    -webkit-line-clamp: 3;
  }

  .f {
    font-size: 12px;
    gap: 4px;
  }

  .pager button {
    height: 30px;
    padding: 0 8px;
    font-size: 13px;
  }

  .empty-icon {
    font-size: 30px;
  }
  .title {
      font-size: 14px;
      line-height: 1.3;
    }
    .txt {
      font-size: 13px;
    }

    .readmore-btn {
      font-size: 12px;
    }
}
/* 1. Image box */
.thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  overflow: hidden;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 2. Stars and Date row */
.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  color: #555;
}
.stars {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}

/* 3. Title */
.title {
  font-size: 16px;
  font-weight: 600;
  margin: 6px 0;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;           /* ✅ Soft hyphenation */
  white-space: normal;
}



/* 4. Body text with Read More */
.txt-wrap {
  position: relative;
}
.txt {
  font-size: 14px;
  line-height: 1.5;
  color: var(--bb-primary);
  margin: 0;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;           /* ✅ Soft hyphenation for long words */
  white-space: normal;
}

.txt.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.readmore-btn {
  margin-top: 4px;
  background: none;
  border: none;
  color: var(--bb-accent, #E94C7A);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.readmore-btn:hover {
  text-decoration: underline;
}

/* 5. Author */
.author {
  margin-top: 8px;
  font-weight: 700;
  font-size: 13px;
  opacity: 0.85;
}

/* Card layout */
.card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
  padding: 12px;
  gap: 6px;
}
.title, .txt {
  font-family: system-ui, sans-serif;
}
`;
