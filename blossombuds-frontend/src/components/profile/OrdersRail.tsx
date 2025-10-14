import React from "react";
import type { OrderLite } from "../../types/profile";

export default function OrdersRail({ loading, orders }: { loading: boolean; orders: OrderLite[]; }) {
  return (
    <div className="card glass">
      <style>{styles}</style>
      <div className="head">
        <h3>Orders</h3>
        {orders.length > 0 && <a href="/" className="link">Continue shopping</a>}
      </div>

      {loading && <div className="skeleton">Loading orders…</div>}

      {!loading && orders.length === 0 && (
        <div className="empty big">
          “No blooms yet — treat yourself to something lovely.”
          <div style={{marginTop:12}}>
            <a href="/" className="cta">Browse new arrivals</a>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="rail-wrap">
          <div className="rail" role="list">
            {orders.map((o, idx) => (
              <div className="oc" role="listitem" key={o.id} style={{ ["--i" as any]: idx }}>
                <div className={`dot ${statusDot(o.status)}`} />
                <div className="ocard">
                  <div className="orow"><span className="ok">Order</span><span className="ov">#{o.publicCode}</span></div>
                  <div className="orow"><span className="ok">Status</span><span className={`badge ${badgeClass(o.status)}`}>{o.status}</span></div>
                  <div className="orow"><span className="ok">Placed</span><span className="ov">{formatDate(o.createdAt)}</span></div>
                  <div className="orow"><span className="ok">Total</span><span className="ov">{formatCurrency(o.total)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers */
function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }); }
  catch { return "—"; }
}
function formatCurrency(n?: number) {
  if (typeof n !== "number") return "—";
  try { return new Intl.NumberFormat(undefined, { style:"currency", currency:"INR" }).format(n); }
  catch { return `₹${n.toFixed(2)}`; }
}
function badgeClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("paid") || s.includes("completed") || s.includes("delivered")) return "ok";
  if (s.includes("pending") || s.includes("processing")) return "warn";
  if (s.includes("cancel")) return "bad";
  return "muted";
}
function statusDot(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("paid") || s.includes("completed") || s.includes("delivered")) return "dot-ok";
  if (s.includes("pending") || s.includes("processing")) return "dot-warn";
  if (s.includes("cancel")) return "dot-bad";
  return "dot-muted";
}

const styles = `
.card.glass{ background: linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.98)); backdrop-filter: saturate(160%) blur(6px); }
.head{ display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.06); }
.link{ text-decoration: underline; font-weight: 800; color: var(--bb-primary); }
.rail-wrap{ padding: 14px 14px 16px; }
.rail{ position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: clamp(240px, 38vw, 360px); gap: 12px; overflow-x: auto; padding-bottom: 12px; scroll-snap-type: x mandatory; }
.rail::-webkit-scrollbar{ height: 8px; }
.rail::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.12); border-radius: 999px; }
.oc{ position:relative; scroll-snap-align: start; }
.dot{ position:absolute; left: 14px; top: -8px; width: 8px; height: 8px; border-radius: 999px; background:#bbb; box-shadow: 0 0 0 6px rgba(0,0,0,.04); }
.dot.dot-ok{ background: #2e7d32; }
.dot.dot-warn{ background: #f6c320; }
.dot.dot-bad{ background: #c62828; }
.dot.dot-muted{ background: #a0a0a0; }
.ocard{ border: 1px solid rgba(0,0,0,.08); border-radius: 14px; padding: 12px; background:#fff; box-shadow: 0 12px 28px rgba(0,0,0,.10); animation: cardIn .24s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i) * 30ms); }
@keyframes cardIn { from{opacity:0; transform: translateY(6px)} to{opacity:1; transform:none} }
.orow{ display:flex; align-items:center; justify-content:space-between; gap: 8px; }
.ok{ font-weight: 800; opacity:.85; }
.ov{ font-weight: 700; }
.badge{ display:inline-flex; align-items:center; height: 24px; padding: 0 8px; border-radius: 999px; font-weight: 800; font-size: 12px; color: #fff; background: #a0a0a0; }
.badge.ok{ background: #2e7d32; }
.badge.warn{ background: #f6c320; color: #4A4F41; }
.badge.bad{ background: #c62828; }
.empty{ padding: 18px 16px; text-align:center; color: var(--bb-primary); background:#fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; margin: 12px; }
.empty.big{ font-weight: 800; font-size: 16px; }
.cta{ display:inline-flex; align-items:center; justify-content:center; height: 40px; padding: 0 14px; border-radius: 12px; background: var(--bb-accent); color:#fff; font-weight: 900; box-shadow: 0 12px 32px rgba(240,93,139,.34); }
.skeleton{ padding: 14px 16px; color: var(--bb-primary); opacity:.9; background: linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04)); background-size: 300% 100%; animation: shimmer 1.1s linear infinite; }
@keyframes shimmer { 0%{background-position: 0% 0} 100%{background-position: -300% 0} }
`;
