// src/components/profile/OrdersSection.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import http from "../../api/http";
import { useAuth } from "../../app/AuthProvider";
import type { OrderLite } from "../../types/profile";
import ReviewModal from "./ReviewModal";

/** Minimal shape for an order line in the deep view */
type OrderLine = {
  productId: number;
  productName: string;
  url?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderItemId?: number;
  optionsText?: string; // added
};

type OrderDetail = {
  publicCode: string;
  status: string;
  itemsSubtotal?: number;
  shippingFee?: number;
  discountTotal?: number;
  couponCode?: string;
  total?: number;
  trackingNumber?: string;
  trackingUrl?: string;
  orderId?: number;
  items: OrderLine[];
};

const fmtCurrency = (amount: number, _code: any = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
      .format(Number(amount || 0));
  } catch {
    return `₹${Number(amount || 0).toFixed(2)}`;
  }
};

function currency(n?: number) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₹${Number(n).toFixed(2)}`;
  }
}

/* ---------- Normalizers (tweak if your DTO differs) ---------- */
function normLine(r: any): OrderLine {
  const qty = Number(r?.quantity ?? r?.qty ?? 1);
  const options = r?.optionsText ?? undefined;
  const price = Number(r?.unitPrice ?? r?.price ?? r?.unit_price ?? 0);
  const img =
    r?.url ??
    r?.image_url ??
    r?.product?.thumbnail ??
    r?.product?.url ??
    undefined;

  return {
    productId: Number(r?.productId ?? r?.product_id ?? r?.product?.id ?? 0),
    productName:
      r?.productName ?? r?.product_name ?? r?.product?.name ?? "Item",
    url: img,
    quantity: qty,
    unitPrice: price,
    optionsText: options,
    lineTotal: Number(r?.lineTotal ?? r?.line_total ?? qty * price),
    orderItemId: Number(r?.id ?? r?.orderItemId ?? r?.order_item_id ?? 0) || undefined,
  };
}

function normDetail(o: any): OrderDetail {
  const items: OrderLine[] = Array.isArray(o?.items) ? o.items.map(normLine) : [];
  const sub = Number(o?.itemsSubtotal ?? o?.items_SubTotal ?? 0);
  const ship = Number(o?.shippingFee ?? o?.shipping_fee ?? 0);
  const disc = Number(o?.discountTotal ?? o?.discount_Total ?? 0);
  const total = Number(o?.grandTotal ?? o?.grand_Total ?? 0);

  return {
    publicCode: o?.publicCode ?? o?.code ?? "",
    status: (o?.status ?? "ORDERED").toString(),
    itemsSubtotal: sub,
    shippingFee: ship,
    discountTotal: disc,
    couponCode: o?.couponCode ?? o?.coupon ?? undefined,
    grandTotal: total,
    trackingNumber: o?.trackingNumber ?? o?.tracking_no ?? undefined,
    trackingUrl: o?.trackingUrl ?? o?.tracking_url ?? undefined,
    orderId: Number(o?.id ?? o?.orderId ?? o?.order_id ?? 0) || undefined,
    items,
  };
}

/* ---------- Component ---------- */
export default function OrdersSection({ orders }: { orders: OrderLite[] }) {
  const { user } = useAuth() as any;
  const location = useLocation();

  const [q, setQ] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [reviewOn, setReviewOn] = useState<null | {
    productId: number;
    productName?: string;
    orderId?: number;
    orderItemId?: number;
    customerId: number;
  }>(null);

  // keep a pending deep-link target to open review after detail loads
  const pendingTargetRef = useRef<{ pid?: number; itemId?: number } | null>(null);

  useEffect(() => {
    // lock page scroll when the drawer is open
    const prev = document.body.style.overflow;
    if (openCode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev || "";
    }

    // cleanup on unmount or when openCode changes
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [openCode]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders || [];
    return (orders || []).filter(
      (o) =>
        (o.publicCode || "").toLowerCase().includes(needle) ||
        (o.status || "").toLowerCase().includes(needle)
    );
  }, [orders, q]);

  async function openOrder(publicCode: string) {
    setOpenCode(publicCode);
    setDetail(null);
    setLoading(true);
    try {
      const { data } = await http.get(`/api/orders/${publicCode}`);
      setDetail(normDetail(data));
    } catch (e: any) {
      alert(e?.response?.data?.message || "Could not load order details.");
      setOpenCode(null);
    } finally {
      setLoading(false);
    }
  }

  function copy(txt?: string) {
    if (!txt) return;
    navigator.clipboard.writeText(txt).catch(() => {});
  }

  const steps = ["ORDERED", "DISPATCHED", "DELIVERED"] as const;
  function stepIndex(status?: string) {
    const s = (status || "").toUpperCase();
    const i = steps.indexOf(s as any);
    if (i >= 0) return i;
    if (s === "CANCELLED") return 2; // place at end visually
    return 0;
  }

  const showTracking =
    detail?.status?.toUpperCase() === "DISPATCHED" ||
    detail?.status?.toUpperCase() === "DELIVERED";

  // --------- Deep link: parse ?code=&pid=&itemId= and open drawer ----------
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const code = sp.get("code")?.trim();
    const pid = sp.get("pid");
    const itemId = sp.get("itemId");

    pendingTargetRef.current = {
      pid: pid ? Number(pid) : undefined,
      itemId: itemId ? Number(itemId) : undefined,
    };

    if (code) {
      openOrder(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // --------- After detail loads, optionally auto-open review modal ----------
  useEffect(() => {
    if (!detail || !openCode) return;
    const pending = pendingTargetRef.current;
    if (!pending) return;

    const isDelivered = (detail.status || "").toUpperCase() === "DELIVERED";
    if (!isDelivered) {
      pendingTargetRef.current = null;
      return;
    }

    const match = detail.items.find((it) => {
      const byPid = pending.pid ? it.productId === pending.pid : true;
      const byItem = pending.itemId ? it.orderItemId === pending.itemId : true;
      return byPid && byItem;
    });

    if (match) {
      setReviewOn({
        productId: match.productId,
        productName: match.productName,
        customerId: user?.id!,
        orderId: detail.orderId,
        orderItemId: match.orderItemId,
      });
    }

    // consume once
    pendingTargetRef.current = null;
  }, [detail, openCode, user?.id]);

  return (
    <div className="card ords">
      <div className="ords-hd">
        <h4>Your orders</h4>
        <div className="search">
          <input
            placeholder="Find by code or status…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🧺</div>
          <h3>No orders yet</h3>
          <p className="muted">Your purchases will appear here.</p>
        </div>
      ) : (
        <ul className="olist">
          {filtered.map((o) => (
            <li key={o.publicCode} className="oline">
              <div className="left">
                <div className="code">#{o.publicCode}</div>
                <div className={"status " + (o.status || "ORDERED").toLowerCase()}>
                  {o.status}
                </div>
              </div>
              <div className="right">
                <div className="sum">
                  <span>Total</span>
                  <strong>{fmtCurrency(o.grandTotal, currency)}</strong>
                </div>
                <button className="ghost" onClick={() => openOrder(o.publicCode)}>
                  View
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Drawer: order details */}
      {openCode && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div className="panel">
            <div className="phd">
              <div className="ttl">
                <strong>Order #{openCode}</strong>
                {detail?.status && (
                  <span className={"tag " + detail.status.toLowerCase()}>
                    {detail.status}
                  </span>
                )}
              </div>
              <button
                className="x"
                onClick={() => {
                  setOpenCode(null);
                  setDetail(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="pbd">
              {loading && <div className="loading">Loading…</div>}
              {!loading && detail && (
                <>
                  {/* Status branch */}
                  <div className="branch">
                    {steps.map((s, i) => {
                      const done = i <= stepIndex(detail.status);
                      const cancelled = (detail.status || "").toUpperCase() === "CANCELLED";
                      const label = cancelled && s !== "ORDERED" ? "CANCELLED" : s;
                      const active = i === stepIndex(detail.status);
                      return (
                        <div
                          key={s}
                          className={"node " + (done ? "done" : "") + (active ? " active" : "")}
                        >
                          <div className="dot" />
                          <div className="lbl">{label}</div>
                          {i < steps.length - 1 && <div className="bar" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tracking (for DISPATCHED or DELIVERED) */}
                  {showTracking && (
                    <div className="track">
                      <div>
                        <strong>Tracking No:</strong> {detail.trackingNumber || "—"}
                      </div>
                      <div className="url">
                        <strong>URL:</strong>{" "}
                        {detail.trackingUrl ? (
                          <>
                            <a
                              href={detail.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {detail.trackingUrl}
                            </a>
                            <button
                              className="copy"
                              onClick={() => copy(detail.trackingUrl)}
                              title="Copy"
                            >
                              ⧉
                            </button>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div className="items">
                    {detail.items.map((it, idx) => (
                      <div key={idx} className="item">
                        {it.url ? (
                          <img
                            src={it.url}
                            alt={it.productName}
                            onError={(e: any) => {
                              e.currentTarget.style.visibility = "hidden";
                            }}
                          />
                        ) : (
                          <div style={{ width: 84, height: 84 }} />
                        )}
                        <div className="imeta">
                          <div className="pname">{it.productName}</div>
                          <div className="sub">
                            <span>Qty {it.quantity}</span>
                            <span>•</span>
                            <span>{it.optionsText}</span>
                            <span>•</span>
                            <span>{currency(it.unitPrice)} each</span>
                          </div>

                          {/* Review chip when delivered */}
                          {detail.status?.toUpperCase() === "DELIVERED" && (
                            <button
                              className="chip"
                              onClick={() =>
                                setReviewOn({
                                  productId: it.productId,
                                  productName: it.productName,
                                  customerId: user?.id!,
                                  orderId: detail.orderId,
                                  orderItemId: it.orderItemId,
                                })
                              }
                            >
                              Leave a review
                            </button>
                          )}
                        </div>
                        <div className="line">{currency(it.lineTotal)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="totals">
                    <div className="row">
                      <span>Sub-total</span>
                      <span>{currency(detail.itemsSubtotal)}</span>
                    </div>
                    <div className="row">
                      <span>Shipping</span>
                      <span>{currency(detail.shippingFee)}</span>
                    </div>
                    <div className="row">
                      <span>
                        Discount
                        {detail.couponCode ? ` (Coupon: ${detail.couponCode})` : ""}
                      </span>
                      <span>-{currency(detail.discountTotal)}</span>
                    </div>
                    <div className="row grand">
                      <span>Grand total</span>
                      <span>{currency(detail.grandTotal)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewOn && (
        <ReviewModal
          open={!!reviewOn}
          onClose={(submitted) => {
            setReviewOn(null);
            if (submitted) {
              // Optionally: show a toast outside this component
              // e.g., toasts.push("Thanks! Your review is pending moderation.", "ok");
            }
          }}
          productId={reviewOn.productId}
          productName={reviewOn.productName}
          customerId={reviewOn.customerId}
          orderId={reviewOn.orderId}
          orderItemId={reviewOn.orderItemId}
        />
      )}

      <style>{styles}</style>
    </div>
  );
}

/* ---------- styles ---------- */
const styles = `
:root{
  --bb-accent:#F05D8B;          /* timeline accent */
  --ink:rgba(0,0,0,.08);
}

/* scope */
.ords *{ box-sizing:border-box; }
.ords{ padding:10px; }

/* header */
.ords-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 6px 10px;
}
.ords-hd h4{ margin:0; }
.search{ position:relative; }
.search input{
  height:34px; border:1px solid rgba(0,0,0,.1);
  border-radius:10px; padding:0 36px 0 10px; min-width:240px; background:#fff;
}
.search svg{ position:absolute; right:10px; top:8px; opacity:.6; }

/* empty state */
.empty{ padding:16px; text-align:center; }
.empty-icon{ font-size:30px; opacity:.7; }
.muted{ opacity:.7; }

/* list */
.olist{ list-style:none; padding:0; margin:0; display:grid; gap:8px; }
.oline{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  border:1px solid var(--ink); border-radius:12px; padding:10px; background:#fff;
}
.left{ display:flex; align-items:center; gap:10px; min-width:0; }
.code{ font-weight:900; letter-spacing:.2px; white-space:nowrap; }
.status{
  padding:2px 8px; border-radius:999px; font-size:12px; font-weight:800;
  background:rgba(0,0,0,.05);
  text-transform:capitalize;
  white-space:nowrap;
}
.status.ordered{    background:rgba(89,178,107,.16);  color:#2e7d32; }
.status.dispatched{ background:rgba(33,150,243,.18);  color:#0d47a1; }
.status.delivered{  background:rgba(89,178,107,.18);  color:#1b5e20; }
.status.cancelled{  background:rgba(240,93,139,.18); color:#b0003a; }

.right{ display:flex; align-items:center; gap:12px; flex:0 0 auto; }
.sum{ display:flex; flex-direction:column; align-items:flex-end; line-height:1.1; }
.sum span{ font-size:12px; opacity:.75; }
.sum strong{ font-weight:900; }
.ghost{
  height:32px; padding:0 10px; border:1px solid rgba(0,0,0,.1);
  border-radius:10px; background:#fff; cursor:pointer;
}

/* drawer overlay */
.drawer{
  position:fixed; inset:0; background:rgba(0,0,0,.45);
  display:grid; place-items:center; z-index:120; padding:12px;
  overflow:auto; /* allow the grid container to size nicely */
}

/* panel (drawer content) */
.panel{
  width:980px; max-width:calc(100vw - 24px);
   /* fixed height so body can scroll independently */
  background:#fff; border:1px solid rgba(0,0,0,.1); border-radius:18px;
  box-shadow:0 24px 80px rgba(0,0,0,.28);
  display:flex; flex-direction:column;
  overflow:hidden;               /* keep scroll only in .pbd */
  touch-action:pan-y;
  min-height:0;                   /* mobile: allow vertical pan */
}

.phd{
  flex:0 0 auto;                /* <-- pin header height */
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:6px 10px;             /* compact */
  border-bottom:1px solid var(--ink);
  min-height:40px;
  height:auto;                  /* guard against any inherited height */
}
.ttl{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
  flex-wrap:nowrap;             /* keep single line in normal cases */
}
@media (max-width: 420px){
  .ttl{ flex-wrap:wrap; }       /* allow wrap only on very small phones */
}
.ttl strong{
  font-size:14px;
  font-weight:800;
  line-height:1;                /* compact line height */
}
.tag{
  padding:1px 6px;
  border-radius:999px;
  font-size:11px;
  font-weight:800;
  line-height:1.2;
  white-space:nowrap;
}
.tag.dispatched{ background:rgba(33,150,243,.18); color:#0d47a1; }
.tag.delivered{  background:rgba(89,178,107,.18);  color:#1b5e20; }
.tag.cancelled{  background:rgba(240,93,139,.18); color:#b0003a; }

.x{
  background:transparent;
  border:none;
  font-size:22px;
  line-height:1;
  padding:0 4px;
  cursor:pointer;
}

/* drawer body (independent scroll area) */
.pbd{
  flex:1 1 auto;
  min-height:0;                 /* critical so it doesn’t force header to grow */
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
  padding:10px;
}

/* timeline */
.branch{
  position:relative; display:flex; align-items:flex-start; gap:16px; padding:10px 6px;
  overflow-x:auto;
}
.node{ position:relative; display:flex; align-items:center; flex:0 0 auto; }
.node .dot{
  width:14px; height:14px; border-radius:999px; background:#ccc; border:2px solid #bbb;
  flex:0 0 auto;
}
.node.done .dot{ background:var(--bb-accent); border-color:var(--bb-accent); }
.node.active .dot{ box-shadow:0 0 0 4px rgba(240,93,139,.20); }
.node .lbl{ margin-left:8px; font-weight:800; font-size:12px; white-space:nowrap; }
.node .bar{
  width:80px; height:2px; background:rgba(0,0,0,.12); margin:0 10px; flex:0 0 auto;
}

/* tracking — perfect alignment & wrapping */
.track{
  display:grid; gap:8px;
  border:1px dashed rgba(0,0,0,.12); border-radius:12px;
  padding:10px; background:#fafafa;
}
.track > div{
  display:grid; align-items:center; column-gap:10px;
  grid-template-columns:140px 1fr;     /* label | value */
}
.track > div > strong{
  color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
/* URL row: add a 3rd column for the copy button */
.track .url{
  grid-template-columns:140px 1fr auto; /* label | link (flex) | copy */
  align-items:center; row-gap:6px;
}
.track .url a{
  display:inline-block; min-width:0; max-width:100%;
  word-break:break-all; overflow-wrap:anywhere;
}
.track .copy{
  margin-left:8px; height:26px; padding:0 10px;
  border-radius:8px; border:1px solid rgba(0,0,0,.1);
  background:#fff; cursor:pointer; white-space:nowrap;
}

/* items */
.items{ display:grid; gap:10px; }
.item{
  display:grid; grid-template-columns:84px 1fr auto; gap:12px; align-items:center;
  border:1px solid var(--ink); border-radius:12px; padding:8px; background:#fff;
}
.item img{
  width:84px; height:84px; object-fit:cover; border-radius:10px; background:#f6f6f6;
}
.imeta{ min-width:0; }
.pname{ font-weight:800; }
.sub{
  opacity:.75; display:flex; gap:6px; font-size:13px; margin-top:2px; flex-wrap:wrap;
}
.line{ font-weight:900; white-space:nowrap; }
.chip{
  margin-top:6px; height:28px; padding:0 10px; border:1px solid rgba(0,0,0,.1);
  border-radius:999px; background:#fff; font-weight:800; cursor:pointer;
}

/* totals */
.totals{
  margin-left:auto; width:min(420px, 100%);
  border:1px solid var(--ink); border-radius:12px; padding:10px; background:#fff;
  display:grid; gap:6px;
}
.totals .row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.totals .row span:first-child{ opacity:.85; }
.totals .grand{
  font-size:16px; font-weight:900; border-top:1px dashed rgba(0,0,0,.12); padding-top:6px;
}

/* focus rings */
.ghost:focus-visible,
.copy:focus-visible,
.chip:focus-visible,
.x:focus-visible{
  outline:3px solid rgba(122,162,227,.45);
  outline-offset:2px;
}

/* ---------- Mobile-first tweaks ---------- */
@media (max-width:760px){
  .search input{ min-width:180px; }
  .node .bar{ width:40px; }

  .item{ grid-template-columns:64px 1fr auto; }
  .item img{ width:64px; height:64px; }

  .panel{
    width:100%;
    max-width:calc(100vw - 16px);
    min-height:0;
    border-radius:14px;
  }
}

@media (max-width:560px){
  /* Drawer body height already controlled; tighten spacing a bit more */
  .panel{ min-height:0; }

  /* stack tracking rows */
  .track > div{ grid-template-columns:1fr; align-items:flex-start; }
  .track .url{ grid-template-columns:1fr; }
  .track .copy{ margin-left:0; }

  /* list row density */
  .oline{ gap:10px; padding:8px; }
  .sum span{ font-size:11px; }
  .ghost{ height:30px; padding:0 8px; }
}

/* fallback if 100dvh unsupported */
@supports not (height:100dvh){
  .panel{ height:min(720px, calc(100vh - 24px)); }
}

/* ---- Defensive SVG fix (prevents width/height="auto" layout issues) ---- */
.drawer svg[width="auto"], .drawer svg[height="auto"]{
  width:18px !important; height:18px !important;
}
`;
