import React, { useEffect, useState } from "react";
import {
  listAdminReviews,
  moderateReview,
  deleteReviewById,
  type ProductReview,
  type ReviewStatus,
  type Page,
} from "../../api/adminReviews";

const PRIMARY = "#4A4F41";
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const INK     = "rgba(0,0,0,.08)";

type Tab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Page<ProductReview> | null>(null);
  const [toast, setToast] = useState<{kind:"ok"|"bad"; msg:string} | null>(null);

  const statusFilter: ReviewStatus | undefined =
    tab === "ALL" ? undefined : (tab as ReviewStatus);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await listAdminReviews({
          status: statusFilter,
          q: q.trim() || undefined,
          page,
          size,
        });
        if (!live) return;
        setData(res);
      } catch (e:any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Failed to load reviews.");
        setData(null);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, page, size]);

  function refreshSamePage() {
    setPage(p => p);
  }

  async function doModerate(r: ProductReview, next: Exclude<ReviewStatus, "PENDING">) {
    try {
      await moderateReview(r.id!, next);
      setToast({ kind: "ok", msg: `Marked as ${next}.` });
      refreshSamePage();
    } catch (e:any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Moderation failed." });
    }
  }

  async function doDelete(r: ProductReview) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReviewById(r.id!);
      setToast({ kind: "ok", msg: "Review deleted." });
      if ((data?.content?.length || 0) === 1 && page > 0) {
        setPage(p => p-1);
      } else {
        refreshSamePage();
      }
    } catch (e:any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Delete failed." });
    }
  }

  const total = data?.totalElements ?? 0;
  const from = total === 0 ? 0 : page*size + 1;
  const to   = Math.min((page+1)*size, total);

  return (
    <div className="rev-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={()=>setToast(null)}>
          {toast.msg}
        </div>
      )}

      <header className="hd">
        <div>
          <h2>Reviews</h2>
          <p className="muted">Moderate product reviews, search, and manage visibility.</p>
        </div>
        <div className="right">
          <div className="seg">
            {(["ALL","PENDING","APPROVED","REJECTED"] as Tab[]).map(t=>(
              <button key={t} className={"seg-btn"+(tab===t?" active":"")} onClick={()=>{ setTab(t); setPage(0); }}>
                {t}
              </button>
            ))}
          </div>
          <div className="search">
            <input
              placeholder="Search by product/customer/title/comment…"
              value={q}
              onChange={(e)=>{ setQ(e.target.value); setPage(0); }}
            />
          </div>
        </div>
      </header>

      <div className="card">
        <div className="table">
          <div className="thead">
            <div>Product</div>
            <div>Rating</div>
            <div>Title & Comment</div>
            <div>Customer</div>
            <div>When</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {loading && (
            <div className="empty">
              <div className="empty-icon">⏳</div>
              <h3>Loading…</h3>
            </div>
          )}

          {(!loading && err) && (
            <div className="empty">
              <div className="empty-icon">⚠️</div>
              <h3>Couldn’t load reviews</h3>
              <p className="muted">{err}</p>
            </div>
          )}

          {(!loading && !err && (data?.content?.length||0)===0) && (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <h3>No reviews yet</h3>
            </div>
          )}

          {(!loading && !err && data?.content) && data.content.map(r => (
            <div className="trow" key={r.id}>
              <div className="cell-prod">
                <div className="pname" title={r.productName || ""}>{r.productName || `#${r.productId}`}</div>
                <div className="muted tiny">#{r.productId}</div>
              </div>
              <div className="cell-rating">{Stars(r.rating)}</div>
              <div className="cell-text">
                <div className="ttl" title={r.title || ""}>{r.title || "—"}</div>
                <div className="cmt" title={r.comment || ""}>{r.comment || "—"}</div>
              </div>
              <div className="cell-cust">
                {r.customerName ? r.customerName : (r.customerId ? `#${r.customerId}` : "—")}
              </div>
              <div className="cell-when">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</div>
              <div className="cell-status">
                <span className={"badge s-"+(r.status||"PENDING").toLowerCase()}>
                  {r.status}
                </span>
              </div>
              <div className="cell-actions">
                {r.status !== "APPROVED" && (
                  <button className="ghost sm ok" onClick={()=>doModerate(r,"APPROVED")}>Approve</button>
                )}
                {r.status !== "REJECTED" && (
                  <button className="ghost sm warn" onClick={()=>doModerate(r,"REJECTED")}>Reject</button>
                )}
                <button className="ghost sm bad" onClick={()=>doDelete(r)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="pager">
          <div className="muted">{fmtRange(from,to,total)}</div>
          <div className="pgbtns">
            <button className="ghost" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Prev</button>
            <button className="ghost" disabled={data ? (page+1)>=data.totalPages : true} onClick={()=>setPage(p=>p+1)}>Next</button>
            <select value={size} onChange={(e)=>{ setSize(Number(e.target.value)); setPage(0); }}>
              {[10,20,50,100].map(s=> <option key={s} value={s}>{s}/page</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Stars(n?: number){
  const v = Math.max(0, Math.min(5, Math.round(n || 0)));
  return "★★★★★☆☆☆☆☆".slice(5 - v, 10 - v);
}
function fmtRange(from:number, to:number, total:number){
  if (total===0) return "0 results";
  return `${from}–${to} of ${new Intl.NumberFormat("en-IN").format(total)}`;
}

/* ---------- styles ---------- */
const css = `
.rev-wrap{ padding:12px; color:${PRIMARY}; }

.hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; }
.hd h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.muted{ opacity:.75; font-size:12px; }
.tiny{ font-size:11px; }

.right{ display:flex; align-items:center; gap:10px; }
.seg{ display:flex; gap:8px; }
.seg-btn{
  height:34px; padding:0 12px; border-radius:999px; border:1px solid ${INK}; background:#fff; cursor:pointer;
  font-weight:900; color:${PRIMARY}; transition:all .18s ease;
}
.seg-btn.active{ background:${GOLD}; color:#2a2200; border-color:transparent; box-shadow:0 8px 22px rgba(246,195,32,.35); }

.search input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 12px; background:#fff; outline:none; min-width:280px;
}

.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }

/* table */
.table{ display:grid; min-height:260px; }
.thead, .trow{
  display:grid; grid-template-columns: 1.2fr 100px 2.2fr 1.2fr 1.2fr 110px 220px; gap:10px; align-items:center; padding:10px 12px;
}
.thead{ font-weight:900; font-size:12px; background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); border-bottom:1px solid ${INK}; }
.trow{ border-bottom:1px solid ${INK}; }
.trow:last-child{ border-bottom:none; }

.cell-prod .pname{ font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cell-text .ttl{ font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cell-text .cmt{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:.9; }
.cell-rating{ font-weight:900; letter-spacing:1px; }

.badge{
  height:22px; display:inline-flex; align-items:center; justify-content:center; padding:0 8px; border-radius:999px;
  font-size:11px; font-weight:900; color:#fff;
}
.badge.s-pending{ background:#7aa2e3; }
.badge.s-approved{ background:#59b26b; }
.badge.s-rejected{ background:#e57373; }

.cell-actions{ display:flex; gap:6px; }
.btn{
  height:38px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:${ACCENT}; color:#fff; font-weight:900; box-shadow: 0 10px 28px rgba(240,93,139,.35);
}
.ghost{
  height:32px; padding:0 10px; border-radius:10px; border:1px solid ${INK}; background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.sm{ height:28px; padding: 0 10px; border-radius:8px; font-size:12.5px; }
.ghost.ok{ border-color: rgba(89,178,107,.4); }
.ghost.warn{ border-color: rgba(246,195,32,.5); }
.ghost.bad{ border-color: rgba(240,93,139,.5); color:#b0003a; }

/* empty state */
.empty{
  grid-column: 1 / -1;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; padding:36px 16px; text-align:center; color:${PRIMARY};
}
.empty-icon{ font-size:34px; opacity:.6; line-height:1; }
.empty h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; }

/* pager */
.pager{
  display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border-top:1px solid ${INK};
}
.pgbtns{ display:flex; align-items:center; gap:8px; }
select{ height:32px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; background:#fff; }

/* alerts */
.alert.bad{
  margin:10px; padding:10px 12px; border-radius:12px; background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039;
}

/* toast */
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

/* responsive */
@media (max-width: 1200px){
  .thead, .trow{ grid-template-columns: 1.2fr 90px 2fr 1fr 1fr 100px 200px; }
}
@media (max-width: 900px){
  .thead, .trow{ grid-template-columns: 1.2fr 80px 1.8fr 1fr 1fr 90px 170px; }
  .search input{ min-width: 200px; }
}
`;
