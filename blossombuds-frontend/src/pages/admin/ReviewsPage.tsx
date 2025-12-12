// src/pages/admin/ReviewsPage.tsx
import React, { useEffect, useState } from "react";
import { formatIstDateTime } from "../../utils/dates";

import {
  listAdminReviews,
  moderateReview,
  deleteReviewById,
  type ProductReview,
  type ReviewStatus,
  type Page,
} from "../../api/adminReviews";
import ReviewViewModal from "../../components/admin/ReviewViewModal"; // <-- adjust path if needed

const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const INK = "rgba(0,0,0,.08)";

type Tab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type ConsentFilter = "ALL" | "WITH" | "WITHOUT";

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [consent, setConsent] = useState<ConsentFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Page<ProductReview> | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // NEW: modal state
  const [viewId, setViewId] = useState<number | null>(null);

  // 🔹 NEW: reload key to force refetch
  const [reloadKey, setReloadKey] = useState(0);

  const statusFilter: ReviewStatus | undefined =
    tab === "ALL" ? undefined : (tab as ReviewStatus);

  const concernParam = consent === "ALL" ? undefined : (consent === "WITH" ? true : false);

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
          concern: concernParam,
        });
        if (!live) return;
        setData(res);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Failed to load reviews.");
        setData(null);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, page, size, consent, reloadKey]);


  function refreshSamePage() {
    // bump the key → triggers useEffect → refetch listAdminReviews
    setReloadKey(k => k + 1);
  }

  async function doModerate(
    r: ProductReview,
    next: Exclude<ReviewStatus, "PENDING">,
    override = false
  ) {
    try {
      await moderateReview(r.id!, next, override);
      setToast({ kind: "ok", msg: `Marked as ${next}.` });
      refreshSamePage();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Moderation failed." });
    }
  }

  async function doDelete(r: ProductReview) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReviewById(r.id!);
      setToast({ kind: "ok", msg: "Review deleted." });
      if ((data?.content?.length || 0) === 1 && page > 0) {
        setPage(p => p - 1);
      } else {
        refreshSamePage();
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Delete failed." });
    }
  }

  const total = data?.totalElements ?? 0;
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <div className="rev-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
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
            {(["ALL", "PENDING", "APPROVED", "REJECTED"] as Tab[]).map(t => (
              <button key={t} className={"seg-btn" + (tab === t ? " active" : "")} onClick={() => { setTab(t); setPage(0); }}>
                {t}
              </button>
            ))}
          </div>

          <select
            value={consent}
            onChange={e => { setConsent(e.target.value as ConsentFilter); setPage(0); }}
            title="Filter by customer consent"
          >
            <option value="ALL">All</option>
            <option value="WITH">With consent</option>
            <option value="WITHOUT">Without consent</option>
          </select>

          <div className="search">
            <input
              placeholder="Search by product/customer/title/comment…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
            />
          </div>
        </div>
      </header>

      <div className="card">
        <div className="table">
          <div className="thead">
            <div>Product</div>
            <div>Rating</div>
            <div>Title</div>
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

          {(!loading && !err && (data?.content?.length || 0) === 0) && (
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
              </div>
              <div className="cell-cust">
                {r.customerName ? r.customerName : (r.customerId ? `#${r.customerId}` : "—")}
              </div>
              <div className="cell-when">
                {r.createdAt ? formatIstDateTime(r.createdAt) : "—"}
              </div>

              <div className="cell-status">
                <span className={"badge s-" + (r.status || "PENDING").toLowerCase()}>
                  {r.status}
                </span>
                <span className="consent-badge">{r.concern ? "consent✓" : "no consent"}</span>
              </div>
              <div className="cell-actions">
                <button className="ghost sm" onClick={() => setViewId(r.id!)}>View</button>

                {r.status !== "APPROVED" && r.concern !== false && (
                  <button className="ghost sm ok" onClick={() => doModerate(r, "APPROVED")}>Approve</button>
                )}

                {r.status !== "APPROVED" && r.concern === false && (
                  <>

                    <button
                      className="ghost sm warn"
                      onClick={() => {
                        if (confirm("Approve without customer consent? This will override policy.")) {
                          doModerate(r, "APPROVED", true);
                        }
                      }}

                      title="Approve (override)"
                    >
                      Approve (override)
                    </button>
                  </>
                )}


                {r.status !== "REJECTED" && (
                  <button className="ghost sm warn" onClick={() => doModerate(r, "REJECTED")}>Reject</button>
                )}
                <button className="ghost sm bad" onClick={() => doDelete(r)}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="pager">
          <div className="muted">{fmtRange(from, to, total)}</div>
          <div className="pgbtns">
            <button className="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="ghost" disabled={data ? (page + 1) >= data.totalPages : true} onClick={() => setPage(p => p + 1)}>Next</button>
            <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
              {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}/page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* VIEW MODAL */}
      {viewId != null && (
        <ReviewViewModal
          open
          reviewId={viewId}
          onClose={() => setViewId(null)}
        />
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function Stars(n?: number) {
  const v = Math.max(0, Math.min(5, Math.round(n || 0)));
  return "★★★★★☆☆☆☆☆".slice(5 - v, 10 - v);
}
function fmtRange(from: number, to: number, total: number) {
  if (total === 0) return "0 results";
  return `${from}–${to} of ${new Intl.NumberFormat("en-IN").format(total)}`;
}

/* ═══════════════════════════ PREMIUM REVIEWS PAGE STYLES ═══════════════════════════ */
const css = `
.rev-wrap {
  padding: 24px;
  color: ${PRIMARY};
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100vh;
}

/* ═══════════════════════════ HEADER ═══════════════════════════ */
.hd {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  position: relative;
}

.hd::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD}, #9BB472);
  border-radius: 3px 3px 0 0;
}

.hd h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hd h2::before {
  content: "⭐ ";
  -webkit-text-fill-color: initial;
}

.muted {
  opacity: 0.6;
  font-size: 13px;
  margin-top: 6px;
}

.tiny {
  font-size: 11px;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* ═══════════════════════════ TABS ═══════════════════════════ */
.seg {
  display: flex;
  gap: 6px;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 16px;
}

.seg-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  color: ${PRIMARY};
  transition: all 0.2s ease;
}

.seg-btn:hover {
  background: rgba(255,255,255,0.8);
}

.seg-btn.active {
  background: linear-gradient(135deg, ${GOLD} 0%, #ffe066 100%);
  color: #5d4800;
  box-shadow: 0 4px 16px rgba(246,195,32,0.35);
}

/* ═══════════════════════════ SEARCH ═══════════════════════════ */
.search input {
  height: 44px;
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 0 16px;
  background: #fff;
  outline: none;
  min-width: 280px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search input:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

select {
  height: 44px;
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 0 14px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

select:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

/* ═══════════════════════════ CARD ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  overflow: hidden;
}

/* ═══════════════════════════ TABLE ═══════════════════════════ */
.table {
  display: grid;
  min-height: 200px;
}

.thead,
.trow {
  display: grid;
  grid-template-columns:
    minmax(120px, 1.3fr)
    90px
    minmax(160px, 2fr)
    minmax(100px, 1fr)
    130px
    160px
    260px;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
}

.thead {
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid ${INK};
  position: sticky;
  top: 0;
  z-index: 1;
}

.trow {
  border-bottom: 1px solid ${INK};
  transition: background 0.15s ease;
}

.trow:last-child {
  border-bottom: none;
}

.trow:hover {
  background: linear-gradient(90deg, rgba(246,195,32,0.04) 0%, rgba(255,255,255,0) 100%);
}

/* ═══════════════════════════ CELLS ═══════════════════════════ */
.cell-prod .pname,
.cell-text .ttl,
.cell-cust {
  font-weight: 700;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
  white-space: normal;
  line-height: 1.4;
  color: ${PRIMARY};
}

.cell-rating {
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 2px;
  color: ${GOLD};
  text-shadow: 0 0 4px rgba(246,195,32,0.3);
}

.cell-when {
  font-size: 12px;
  color: #666;
}

/* ═══════════════════════════ STATUS BADGES ═══════════════════════════ */
.cell-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.badge {
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #fff;
}

.badge.s-pending {
  background: linear-gradient(135deg, #7aa2e3 0%, #5c8bd6 100%);
  box-shadow: 0 4px 12px rgba(122,162,227,0.3);
}

.badge.s-approved {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #065f46;
  box-shadow: 0 4px 12px rgba(67,233,123,0.3);
}

.badge.s-rejected {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 12px rgba(240,147,251,0.3);
}

.consent-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(0,0,0,0.04);
  color: #666;
}

/* ═══════════════════════════ ACTIONS ═══════════════════════════ */
.cell-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn {
  height: 38px;
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(240,93,139,0.3);
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(240,93,139,0.4);
}

.ghost {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  color: ${PRIMARY};
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.15s ease;
}

.ghost:hover {
  background: #fafafa;
  border-color: rgba(0,0,0,0.15);
}

.ghost.sm {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
}

.ghost.ok {
  border-color: rgba(67,233,123,0.4);
  color: #065f46;
}

.ghost.ok:hover {
  background: rgba(67,233,123,0.08);
}

.ghost.warn {
  border-color: rgba(246,195,32,0.5);
  color: #92400e;
}

.ghost.warn:hover {
  background: rgba(246,195,32,0.08);
}

.ghost.bad {
  border-color: rgba(198,40,40,0.3);
  color: #c62828;
}

.ghost.bad:hover {
  background: rgba(198,40,40,0.06);
}

/* ═══════════════════════════ EMPTY STATE ═══════════════════════════ */
.empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 24px;
  text-align: center;
  color: ${PRIMARY};
}

.empty-icon {
  font-size: 48px;
  opacity: 0.6;
  line-height: 1;
}

.empty h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

/* ═══════════════════════════ PAGINATION ═══════════════════════════ */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid ${INK};
  background: #fafafa;
}

.pgbtns {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pager select {
  height: 36px;
}

/* ═══════════════════════════ ALERTS ═══════════════════════════ */
.alert.bad {
  margin: 12px;
  padding: 14px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
  border: 1px solid rgba(198,40,40,0.2);
  color: #b71c1c;
}

/* ═══════════════════════════ TOAST ═══════════════════════════ */
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 200;
  padding: 14px 20px;
  border-radius: 14px;
  color: #fff;
  font-weight: 600;
  animation: toastSlide 2.8s ease forwards;
}

.toast.ok {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  box-shadow: 0 10px 32px rgba(240,93,139,0.4);
}

.toast.bad {
  background: linear-gradient(135deg, #c62828 0%, #e53935 100%);
  box-shadow: 0 10px 32px rgba(198,40,40,0.35);
}

@keyframes toastSlide {
  0% { transform: translateY(24px); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  85% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(12px); opacity: 0; }
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1400px) {
  .thead,
  .trow {
    grid-template-columns:
      minmax(100px, 1.2fr)
      80px
      minmax(140px, 1.8fr)
      minmax(90px, 1fr)
      120px
      140px
      220px;
    gap: 12px;
  }
}

@media (max-width: 1100px) {
  .rev-wrap {
    padding: 16px;
  }

  .hd {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .right {
    justify-content: flex-start;
  }

  .seg {
    flex-wrap: wrap;
  }

  .search input {
    min-width: 100%;
    max-width: 100%;
  }

  .thead,
  .trow {
    grid-template-columns:
      minmax(90px, 1fr)
      70px
      minmax(120px, 1.5fr)
      minmax(80px, 1fr)
      100px
      130px
      200px;
    gap: 10px;
    padding: 12px 16px;
  }
}

@media (max-width: 900px) {
  .thead,
  .trow {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 16px;
  }

  .thead {
    display: none;
  }

  .trow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .cell-prod {
    grid-column: 1 / -1;
  }

  .cell-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    padding-top: 8px;
    border-top: 1px dashed ${INK};
    margin-top: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .ghost,
  .btn,
  .trow {
    animation: none !important;
    transition: none !important;
  }
}
`;
