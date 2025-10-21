// src/pages/ReviewsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { listReviews, type Review, type ReviewPage } from "../api/reviews";

const PRIMARY = "var(--bb-primary)";
const INK = "rgba(0,0,0,.08)";
const GOLD = "#F6C320";

function Star({ filled = false, half = false }: { filled?: boolean; half?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="rv-half">
          <stop offset="50%" stopColor={GOLD}/>
          <stop offset="50%" stopColor="transparent"/>
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
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} filled={i < full} half={i === full && half} />
      ))}
    </span>
  );
}

type SortKey = "new" | "rating";

/** Optional: accept a productId to switch to the per-product list endpoint */
export default function ReviewsPage({ productId }: { productId?: number }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [pendingQ, setPendingQ] = useState(""); // debounced UI text
  const [sort, setSort] = useState<SortKey>("new");

  // Debounce search input → q
  useEffect(() => {
    const t = setTimeout(() => setQ(pendingQ.trim()), 300);
    return () => clearTimeout(t);
  }, [pendingQ]);

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
          productId, // if provided, API switches to /product/{id}
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
    return () => { live = false; };
  }, [page, size, sort, q, productId]);

  const pageCount = Math.max(1, Math.ceil(total / size));

  // Aggregate (from current page only, for snappy UI)
  const avgRating = useMemo(() => {
    if (!rows?.length) return 0;
    const sum = rows.reduce((s, r) => s + (r.rating || 0), 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }, [rows]);

  return (
    <div className="rv-wrap">
      <style>{css}</style>

      <header className="hero">
        <div className="inner">
          <h1>{productId ? "Product Reviews" : "Customer Reviews"}</h1>
          <p>{productId ? "Approved reviews for this product." : "What customers are saying."}</p>
          <div className="kpis">
            <div className="k">
              <div className="n">{rows.length ? avgRating : "—"}</div>
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
                onChange={(e)=>{ setPendingQ(e.target.value); setPage(0); }}
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
                onChange={e=>{ setSort(e.target.value as SortKey); setPage(0); }}
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
          <div className="list">
            {Array.from({length: 6}).map((_,i)=>(<div className="card sk" key={i}/>))}
          </div>
        )}

        {!loading && err && (
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <h3>Couldn’t load reviews</h3>
            <p className="muted">{err}</p>
          </div>
        )}

        {!loading && !err && rows.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📝</div>
            <h3>No reviews found</h3>
            <p className="muted">Try a different search.</p>
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <div className="list">
            {rows.map(r=>(
              <article className="card" key={r.id}>
                <header className="h">
                  <div className="left">
                    <Stars rating={r.rating} />
                    <h3>{r.title || `Rated ${r.rating}★`}</h3>
                  </div>
                  <div className="right">
                    <time dateTime={r.createdAt}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                </header>
                <p className="txt">{r.content}</p>
                <footer className="f">
                  <span className="who">{r.authorName || "Customer"}</span>
                  {r.productName && <span className="prod">• {r.productName}</span>}
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* Pagination (server total) */}
        {!loading && !err && pageCount > 1 && (
          <nav className="pager" aria-label="Reviews pagination">
            <button disabled={page<=0} onClick={()=>setPage(p=>p-1)}>Prev</button>
            <span>Page {page+1} / {pageCount}</span>
            <button disabled={page>=pageCount-1} onClick={()=>setPage(p=>p+1)}>Next</button>
          </nav>
        )}
      </main>
    </div>
  );
}

const css = `
.rv-wrap{ background: var(--bb-bg); color: ${PRIMARY}; min-height: 60vh; }
.hero{
  background: linear-gradient(135deg, rgba(246,195,32,.18), rgba(240,93,139,.16));
  border-bottom:1px solid rgba(0,0,0,.06);
}
.hero .inner{ max-width:1200px; margin:0 auto; padding: 26px 16px 16px; }
.hero h1{ margin:0 0 6px; font-family:"DM Serif Display", Georgia, serif; font-size:30px; }
.hero p{ margin:0 0 12px; opacity:.9; }

.kpis{ display:flex; gap:14px; margin:8px 0 12px; }
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

.list{ display:grid; gap:12px; }
.card{
  border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(0,0,0,.08); padding:12px;
}
.card.sk{ height:110px; background:linear-gradient(90deg, #eee, #f8f8f8, #eee); background-size:200% 100%; animation: shimmer 1.2s linear infinite; border:none; }
@keyframes shimmer{ from{ background-position: 200% 0; } to{ background-position: -200% 0; } }

.h{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.h .left{ display:flex; align-items:center; gap:10px; }
.h h3{ margin:0; font-size:16px; }
.stars{ display:inline-flex; gap:2px; align-items:center; }

.txt{ margin:10px 0 6px; line-height:1.5; }
.f{ display:flex; gap:8px; font-size:13px; opacity:.85; }
.who{ font-weight:700; }
.prod{ opacity:.9; }

.empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  gap:8px; padding:36px 16px; color:${PRIMARY};
}
.empty-icon{ font-size:36px; opacity:.6; }

.pager{ display:flex; gap:10px; align-items:center; justify-content:center; margin-top:12px; }
.pager button{
  height:34px; padding:0 10px; border:1px solid ${INK}; border-radius:10px; background:#fff; cursor:pointer;
}
`;
