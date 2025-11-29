// src/pages/admin/OrdersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  listAllOrders,
  getByPublicCode,
  getByCustomer,
  listItems,
  listPayments,
  listEvents,
  patchStatus,
  fetchInvoicePdf,
  fetchPackingSlipPdf,
  fetchPackingSlipsBulk,
  type Page as PageResp,
  type OrderLite,
  type OrderItem,
  type Payment,
  type OrderEvent,
  type OrderStatus,
} from "../../api/adminOrders";

/* Brand palette */
const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const BG = "#FAF7E7";
const INK = "rgba(0,0,0,.08)";

/* Status helpers */
const STATUS_LABEL: Record<string, string> = {
  ORDERED: "Ordered",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED_REFUNDED: "Returned & Refunded",
};

const statuses: OrderStatus[] = [
  "ORDERED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED_REFUNDED",
];

const STATUS_BY_INDEX = [
  "ORDERED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED_REFUNDED",
] as const;

/** Normalize ANY backend status shape into a non-empty UPPER_CASE key. */
function getStatus(o: any): string {
  const raw =
    o?.status ??
    o?.orderStatus ??
    o?.state ??
    o?.order_state ??
    o?.status_name ??
    o?.statusText ??
    null;

  if (raw == null) return "ORDERED";

  if (typeof raw === "string") {
    const t = raw.trim();
    return t ? t.toUpperCase() : "ORDERED";
  }
  if (typeof raw === "number") {
    return (STATUS_BY_INDEX[raw] as string) || "ORDERED";
  }
  if (typeof raw === "object") {
    const cand =
      (raw as any).name ??
      (raw as any).value ??
      (raw as any).code ??
      (raw as any).key ??
      (raw as any).id;
    const t = cand != null ? String(cand).trim() : "";
    return t ? t.toUpperCase() : "ORDERED";
  }
  return "ORDERED";
}

/** Find a created timestamp across common field names and shapes. */
function getCreatedISO(o: any) {
  const v =
    o?.createdDate ??         // supports your /orders/all response
    o?.createdAt ??
    o?.created_at ??
    o?.created ??
    o?.modifiedAt ??
    o?.modified_at ??
    undefined;
  if (typeof v === "number") return v < 2_000_000_000 ? v * 1000 : v;
  if (typeof v === "string") return v;
  return undefined;
}

const statusClass = (s: string) => `bb-badge ${"bb-" + (s || "ORDERED").toLowerCase()}`;
type StatusKey = keyof typeof STATUS_LABEL;
const fmtMoneyINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n || 0);
const fmtDT = (d?: string | number | Date) => (d ? new Date(d).toLocaleString() : "—");

// ── NEW: UI helpers ───────────────────────────────────────────────
function formatLocalDTForInput(d: Date) {
  // "YYYY-MM-DDTHH:mm" for <input type=datetime-local>
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function printBlob(blob: Blob, fail: (msg?: string) => void) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  const cleanup = () => {
    setTimeout(() => {
      try { URL.revokeObjectURL(url); iframe.parentNode?.removeChild(iframe); } catch { }
    }, 1500);
  };
  iframe.onload = () => {
    try {
      setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); cleanup(); }
        catch { const w = window.open(url, "_blank"); if (!w) fail("Popup blocked. Allow popups to print."); cleanup(); }
      }, 250);
    } catch {
      const w = window.open(url, "_blank");
      if (!w) fail("Popup blocked. Allow popups to print.");
      cleanup();
    }
  };
  document.body.appendChild(iframe);
}

function openPdfBlob(blob: Blob, filename = "packing-slips.pdf") {
  // Fallback if print fails or user wants to download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** ────────────────────────── Main Page ────────────────────────── **/
export default function OrdersPage() {
  const location = useLocation();
  const nav = useNavigate();

  // search fields
  const [code, setCode] = useState("");
  const [custId, setCustId] = useState<string>("");

  // list/paging
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<number>(0);
  const [size, setSize] = useState<number>(20);
  const [sort, setSort] = useState<string>("id");
  const [dir, setDir] = useState<"ASC" | "DESC">("DESC");


  // NEW: status filter state
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const toggleStatus = (s: StatusKey) =>
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);
  const [fromDT, setFromDT] = useState<string>(""); // assuming you already have these
  const [toDT, setToDT] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // data
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // drawer
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<OrderLite | null>(null);

  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // Pick up toast / focusCustomerId passed from /admin/orders/new
  useEffect(() => {
    const st = (location.state as any) || {};
    if (st.toast) setToast({ kind: "ok", msg: st.toast });
    if (st.focusCustomerId) {
      setCustId(String(st.focusCustomerId));
      setCode("");
      setTimeout(() => { void search(); }, 0);
    }
    if (st.toast || st.focusCustomerId) {
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load ALL orders by default (and whenever paging/sort changes) IF not searching
  useEffect(() => {
    if (code.trim() || custId.trim()) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size, sort, dir]);

  async function loadAll(force?: {
    useFilter?: boolean;
    from?: string;
    to?: string;
    status?: string[]; // NEW
  }) {
    setLoading(true);
    try {
      const useFilter = force?.useFilter ?? isFiltered;

      const fromIso = force?.from ?? (fromDT ? new Date(fromDT).toISOString() : undefined);
      const toIso = force?.to ?? (toDT ? new Date(toDT).toISOString() : undefined);

      // Normalize status: either from force override or current state
      const statusParam = (force?.status ?? statusFilter);
      const haveStatus = Array.isArray(statusParam) && statusParam.length > 0;

      const resp = await listAllOrders({
        page, size, sort, dir,
        from: useFilter ? fromIso : undefined,
        to: useFilter ? toIso : undefined,
        status: useFilter && haveStatus ? statusParam : undefined, // NEW
      });

      setOrders(resp.content || []);
      setTotal(resp.totalElements || 0);
      setTotalPages(resp.totalPages || 0);
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to load orders" });
      setOrders([]); setTotal(0); setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }
  function activeFilterBadges() {
    const badges: string[] = [];
    if (statusFilter.length) badges.push(`${statusFilter.length} status`);
    if (fromDT) badges.push(`from ${new Date(fromDT).toLocaleDateString()}`);
    if (toDT) badges.push(`to ${new Date(toDT).toLocaleDateString()}`);
    return badges;
  }

  function applyAllFilters() {
    setIsFiltered(!!(statusFilter.length || fromDT || toDT));
    setPage(0);
    void loadAll({
      useFilter: !!(statusFilter.length || fromDT || toDT),
      from: fromDT ? new Date(fromDT).toISOString() : undefined,
      to: toDT ? new Date(toDT).toISOString() : undefined,
    });
    setFiltersOpen(false);
  }






  async function printPackingForCurrentResults() {
    try {
      const ids = (orders ?? []).map(o => Number(o.id)).filter(Boolean);
      if (!ids.length) {
        setToast({ kind: "bad", msg: "No orders to print." });
        return;
      }
      setToast({ kind: "ok", msg: `Generating ${ids.length} packing slip(s)…` });

      const pdfBlob = await fetchPackingSlipsBulk(ids);
      printBlob(pdfBlob, (msg) => setToast({ kind: "bad", msg: msg || "Print failed" }));
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Failed to generate packing slips";
      setToast({ kind: "bad", msg });
    }
  }




  async function search() {
    const byCode = code.trim();
    const byCust = custId.trim();
    if (!byCode && !byCust) {
      setPage(0);
      await loadAll();
      return;
    }
    setLoading(true);
    try {
      if (byCode) {
        const one = await getByPublicCode(byCode);
        setOrders(one ? [one] : []);
        setTotal(one ? 1 : 0);
        setTotalPages(1);
      } else if (byCust) {
        const list = await getByCustomer(Number(byCust));
        setOrders(list || []);
        setTotal(list?.length || 0);
        setTotalPages(1);
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Search failed" });
      setOrders([]); setTotal(0); setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setCode("");
    setCustId("");
    setPage(0);
    void loadAll();
  }

  const openDrawer = (o: OrderLite) => { setActive(o); setOpen(true); };
  const closeDrawer = () => setOpen(false);

  return (
    <div className="ord-wrap">
      <style>{css}</style>

      {toast && (
        <div className={`toast ${toast.kind}`} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <header className="hd">
        <div className="tit">
          <h2>Orders</h2>
          <p className="muted">Browse all orders or search by public code / customer ID.</p>
        </div>

        <div className="searchbar" onKeyDown={(e) => { if (e.key === 'Enter') search(); }}>
          <div className="box">
            <input
              placeholder="Public code (e.g. BBAB12)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {code && (
              <button className="clear-btn" onClick={() => { setCode(""); if (!custId) { setPage(0); void loadAll(); } }}>×</button>
            )}
          </div>
          <div className="sep">or</div>
          <div className="box">
            <input
              placeholder="Customer ID"
              value={custId}
              onChange={(e) => setCustId(e.target.value.replace(/\D/g, ""))}
            />
            {custId && (
              <button className="clear-btn" onClick={() => { setCustId(""); if (!code) { setPage(0); void loadAll(); } }}>×</button>
            )}
          </div>
          <button type="button" className="btn" onClick={search} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
          {(code.trim() || custId.trim()) && (
            <button type="button" className="ghost" onClick={clearSearch} disabled={loading} title="Show all orders">
              Clear
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="btn" onClick={() => nav("/admin/orders/new")} title="Create a new order">
            New Order
          </button>
        </div>
      </header>

      {!code.trim() && !custId.trim() && (
        <>
          {/* ── Compact sticky toolbar with inline filters ── */}
          <div className="toolbar glass sticky card">
            <div className="ctl-row">
              {/* Left: totals + page size + sort */}
              <div className="side">
                <div className="muted">
                  Total: <b>{total}</b>
                </div>
                <span className="dot">•</span>

                <div className="seg" role="group" aria-label="Page size and sort">
                  {/* Segment: Page size */}
                  <div className="seg-item">
                    <span className="seg-label">Page</span>
                    <select
                      className="seg-sel"
                      value={size}
                      onChange={(e) => {
                        setSize(Number(e.target.value));
                        setPage(0);
                      }}
                    >
                      {[10, 20, 30, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="divider" />

                  {/* Segment: Sort */}
                  <div className="seg-item">
                    <span className="seg-label">Sort</span>
                    <select
                      className="seg-sel"
                      value={`${sort}:${dir}`}
                      onChange={(e) => {
                        const [s, d] = e.target.value.split(":") as [string, "ASC" | "DESC"];
                        setSort(s);
                        setDir(d);
                        setPage(0);
                      }}
                    >
                      <option value="id:DESC">Newest (id)</option>
                      <option value="id:ASC">Oldest (id)</option>
                      <option value="createdAt:DESC">Newest (created)</option>
                      <option value="createdAt:ASC">Oldest (created)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Middle: inline filter summary + toggle */}
              <div className="side mid">
                <button
                  type="button"
                  className={`pill-btn ${showFilters ? "on" : ""}`}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  aria-controls="inline-filters"
                >
                  <span>Filters</span>
                  {(isFiltered || statusFilter.length > 0) && (
                    <span className="count">
                      {(fromDT ? 1 : 0) + (toDT ? 1 : 0) + statusFilter.length}
                    </span>
                  )}
                  <span className="caret">▾</span>
                </button>

                {/* live summary badges */}
                <div className="mini-badges" style={{ marginLeft: 8 }}>
                  {fromDT && <span className="mini">From {new Date(fromDT).toLocaleDateString()}</span>}
                  {toDT && <span className="mini">To {new Date(toDT).toLocaleDateString()}</span>}
                  {statusFilter.map((s) => (
                    <span key={s} className="mini">
                      {STATUS_LABEL[s] ?? s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: paging + batch action */}
              <div className="side">
                <button
                  className="ghost sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={loading || page <= 0}
                >
                  Prev
                </button>
                <div className="muted">
                  Page <b>{page + 1}</b> / {Math.max(1, totalPages)}
                </div>
                <button
                  className="ghost sm"
                  onClick={() => setPage((p) => (totalPages ? Math.min(totalPages - 1, p + 1) : p + 1))}
                  disabled={loading || !totalPages || page >= totalPages - 1}
                >
                  Next
                </button>
                <button
                  className="btn sm"
                  onClick={printPackingForCurrentResults}
                  disabled={loading || orders.length === 0}
                >
                  Packing slips
                </button>
              </div>
            </div>

            {/* Inline collapsible filter row */}
            {showFilters && (
              <div id="inline-filters" className="inline-filters">
                <div className="if-grid">
                  {/* Date range */}
                  <div className="if-sec">
                    <div className="sec-title">Date range</div>
                    <div className="row">
                      <input
                        className="field"
                        type="datetime-local"
                        value={fromDT}
                        onChange={(e) => setFromDT(e.target.value)}
                      />
                      <span className="to">to</span>
                      <input
                        className="field"
                        type="datetime-local"
                        value={toDT}
                        onChange={(e) => setToDT(e.target.value)}
                      />
                    </div>
                    <div className="chips">
                      <button className="chip" onClick={setToday}>
                        Today
                      </button>
                      <button className="chip" onClick={setLast7}>
                        Last 7d
                      </button>
                      <button className="chip" onClick={setThisMonth}>
                        This month
                      </button>
                    </div>
                  </div>

                  {/* Status multi-select (pretty pills) */}
                  <div className="if-sec status-sec">
                    <div className="sec-title">Status</div>
                    <div className="status-grid">
                      {statuses.map((s) => {
                        const active = statusFilter.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`status-pill ${active ? "active" : ""}`}
                            onClick={() => {
                              setStatusFilter((prev) =>
                                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                              );
                            }}
                          >
                            {STATUS_LABEL[s] ?? s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="if-actions">
                    <button className="ghost sm" onClick={clearDateFilter}>
                      Clear
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => {
                        const using = Boolean(fromDT || toDT || statusFilter.length > 0);
                        setIsFiltered(using);
                        setPage(0);
                        void loadAll({
                          useFilter: using,
                          from: fromDT ? new Date(fromDT).toISOString() : undefined,
                          to: toDT ? new Date(toDT).toISOString() : undefined,
                        });
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}



      {/* List */}
      <div className="card">
        <div className="tbl">
          <div className="thead">
            <div>Order ID</div>
            <div>Customer</div>
            <div>Total</div>
            <div>Status</div>
            <div>Created</div>
            <div></div>
          </div>

          {loading ? (
            <div className="empty pad">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="empty pad">
              {code.trim() || custId.trim() ? "No orders found." : "No orders yet."}
            </div>
          ) : (
            orders.map((o) => {
              const any = o as any;
              const name = any.shipName || any.customerName || "—";

              const sKey = getStatus(any);
              const sText = (STATUS_LABEL[sKey] ?? sKey ?? "").trim();
              const safeText = sText || "Ordered";

              const created = o?.createdAt ?? getCreatedISO(any);

              return (
                <div className="trow" key={o.id}>
                  <div className="mono">BB{o.publicCode || `#${o.id}`}</div>
                  <div className="customer" title={name}>
                    <span className="name ellipsis">{name}</span>
                    <span className="cidpill"> (ID: {any.customerId ?? "—"})</span>
                  </div>
                  <div><b>{fmtMoneyINR(any.grandTotal ?? any.grand_total ?? 0)}</b></div>
                  <div>
                    <span className={statusClass(sKey)}>
                      {safeText}
                    </span>
                  </div>
                  <div className="muted">{fmtDT(created)}</div>
                  <div className="actions">
                    <button className="ghost" onClick={() => openDrawer(o)}>View</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <OrderDrawer open={open} order={active} onClose={closeDrawer} setToast={setToast} />
    </div>
  );
}

/** ────────────────────────── Drawer Component ────────────────────────── **/
function OrderDrawer({
  open, order, onClose, setToast,
}: {
  open: boolean;
  order: OrderLite | null;
  onClose: () => void;
  setToast: (t: { kind: "ok" | "bad"; msg: string } | null) => void;
}) {
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [events, setEvents] = useState<OrderEvent[] | null>(null);

  const [updBusy, setUpdBusy] = useState(false);
  const [selStatus, setSelStatus] = useState<OrderStatus>((order?.status as OrderStatus) || "ORDERED");
  const [statusNote, setStatusNote] = useState("");
  const [note, setNote] = useState("");

  // Tracking fields (UI only; we insert into note for the status change)
  const [trackingNo, setTrackingNo] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [partnerUrlTemplate, setPartnerUrlTemplate] = useState<string>("");
  const [hasPartner, setHasPartner] = useState<boolean>(false);
  const [lockUrl, setLockUrl] = useState<boolean>(false); // lock URL input if partner controls it
  const [pdfLoading, setPdfLoading] = useState(false);
  const notes =
    ((order as any)?.orderNotes ??
      (order as any)?.notes ??
      (order as any)?.note ??
      "").toString().trim();
  useEffect(() => {
    if (!open || !order) return;
    let live = true;
    (async () => {
      try {
        const [it, pay, ev] = await Promise.all([
          listItems(order.id),
          listPayments(order.id),
          listEvents(order.id),
        ]);
        if (!live) return;
        setItems(it || []);
        setPayments(pay || []);
        setEvents(ev || []);
      } catch {
        setItems([]); setPayments([]); setEvents([]);
      }
    })();

    // reset state on open
    setSelStatus((order?.status as OrderStatus) || "ORDERED");
    setStatusNote("");

    // prefill from server (if present)
    setTrackingNo(((order as any)?.trackingNumber ?? "").toString());
    setTrackingUrl(((order as any)?.trackingUrl ?? "").toString());

    setPartnerUrlTemplate("");
    setHasPartner(false);
    setLockUrl(false);

    return () => { live = false; };
  }, [open, order]);

  // tiny helper to read partner (read-only)
  async function fetchJSON<T = any>(url: string): Promise<T | null> {
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) return null;
      return (await r.json()) as T;
    } catch {
      return null;
    }
  }

  // When status = DISPATCHED, check partner and prefill rules
  useEffect(() => {
    (async () => {
      if (!order || selStatus !== "DISPATCHED") return;

      const any = order as any;
      const partnerId = any.deliveryPartnerId ?? any.partnerId ?? any.courierId ?? null;

      if (!partnerId) {
        // No partner: admin must type URL manually
        setHasPartner(false);
        setPartnerUrlTemplate("");
        setLockUrl(false);
        return;
      }

      setHasPartner(true);
      const partner = await fetchJSON<any>(`/api/delivery-partners/${partnerId}`);

      const directUrl = (partner?.trackingUrl ?? partner?.tracking_url ?? partner?.url ?? "").trim?.() || "";
      const template =
        (partner?.trackingUrlTemplate ??
          partner?.urlTemplate ??
          partner?.tracking_url_template ??
          partner?.template ??
          "")?.trim?.() || "";

      if (directUrl) {
        // Fixed URL controlled by partner (no need to edit)
        setTrackingUrl(directUrl);
        setPartnerUrlTemplate("");
        setLockUrl(true);
        return;
      }

      if (template) {
        // We'll build URL from tracking number; keep URL read-only
        setPartnerUrlTemplate(template);
        setLockUrl(true);
        // If user already typed a number, refresh URL
        if (trackingNo?.trim()) {
          const built = template
            .replace("{tracking}", trackingNo.trim())
            .replace("${tracking}", trackingNo.trim())
            .replace(":tracking", trackingNo.trim())
            .replace("<tracking>", trackingNo.trim());
          setTrackingUrl(built);
        }
        return;
      }

      // Partner exists but no usable fields → fall back to manual URL
      setHasPartner(true);
      setPartnerUrlTemplate("");
      setLockUrl(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selStatus, order]);

  // Recompute URL when template + tracking number available
  useEffect(() => {
    if (!partnerUrlTemplate || !trackingNo.trim()) return;
    const built = partnerUrlTemplate
      .replace("{tracking}", trackingNo.trim())
      .replace("${tracking}", trackingNo.trim())
      .replace(":tracking", trackingNo.trim())
      .replace("<tracking>", trackingNo.trim());
    setTrackingUrl(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingNo, partnerUrlTemplate]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  async function applyStatus() {
    if (!order) return;

    // Validate before sending
    if (selStatus === "DISPATCHED") {
      const tn = trackingNo.trim();
      const tu = trackingUrl.trim();
      if (!tn) {
        setToast({ kind: "bad", msg: "Enter Tracking Number for DISPATCHED." });
        return;
      }
      if (!tu) {
        setToast({ kind: "bad", msg: "Enter Tracking URL for DISPATCHED." });
        return;
      }
    }

    setUpdBusy(true);
    try {
      // Build the customer-facing note
      let noteToSend = statusNote?.trim() || "";
      const tn = trackingNo.trim();
      const tu = trackingUrl.trim();
      if (selStatus === "DISPATCHED") {
        const trackBlock = `Tracking Number: ${tn}\nTracking URL: ${tu}`;
        noteToSend = noteToSend ? `${noteToSend}\n\n${trackBlock}` : trackBlock;
      }

      // 🔴 SINGLE PATCH ONLY — include tracking fields when DISPATCHED
      if (selStatus === "DISPATCHED") {
        await patchStatus(order.id, {
          status: "DISPATCHED",
          note: noteToSend || undefined,
          trackingNumber: tn,
          trackingURL: tu,
        });
      } else {
        await patchStatus(order.id, { status: selStatus, note: noteToSend || undefined });
      }

      // Refresh timeline
      const ev = await listEvents(order.id);
      setEvents(ev);

      setToast({ kind: "ok", msg: "Status updated" });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Status update failed" });
    } finally {
      setUpdBusy(false);
    }
  }


  async function addNote() {
    // NOTE: your server does not allow POST /api/orders/{id}/events
    // We keep this as a no-op to avoid 405/500s.
    if (!order) return;
    const msg = note.trim();
    if (!msg) return;
    setToast({ kind: "bad", msg: "Adding manual events is not supported by the server." });
  }

  // print: fetch blob → iframe → print/open
  async function openPrint(kind: "invoice" | "packing") {
    if (!order) return;
    const fail = (msg?: string) =>
      setToast({ kind: "bad", msg: msg || "Could not open printer dialog." });

    setPdfLoading(true);
    try {
      const blob = kind === "invoice" ? await fetchInvoicePdf(order.id) : await fetchPackingSlipPdf(order.id);
      printBlob(blob, fail);
    } catch (e: any) {
      fail(e?.message);
    } finally {
      setPdfLoading(false);
    }
  }

  const shipAddress = useMemo(() => {
    if (!order) return "";
    const o: any = order;
    const parts: string[] = [];
    if (o.shipName) parts.push(o.shipName);
    if (o.shipPhone) parts.push(o.shipPhone);
    if (o.shipLine1) parts.push(o.shipLine1);
    if (o.shipLine2) parts.push(o.shipLine2);
    if (o.shipPincode) parts.push(o.shipPincode);
    if (o.shipDistrictName) parts.push(o.shipDistrictName);
    if (o.shipStateName) parts.push(o.shipStateName);
    if (o.shipCountryName) parts.push(o.shipCountryName);
    return parts.join(" · ");
  }, [order]);

  return (
    <>
      <style>{drawerCss}</style>
      <div className={"drawer-mask" + (open ? " show" : "")} onClick={onClose}>
        <aside className="drawer" onClick={stop}>
          {!order ? (
            <div className="pad">—</div>
          ) : (
            <>
              <header className="drawer-hd">
                <div className="hdr-left">
                  <div className="code">{order.publicCode || `#${order.id}`}</div>
                  <div className="muted">Order #{order.id}</div>
                </div>
                <div className="hdr-right">
                  <div className="print-group">
                    <button type="button" className="ghost sm" onClick={() => openPrint("invoice")}>Invoice PDF</button>
                    <button type="button" className="ghost sm" onClick={() => openPrint("packing")}>Packing Slip</button>
                  </div>
                  <button className="ghost" onClick={onClose} aria-label="Close">Close</button>
                </div>
              </header>


              <div className="drawer-body">
                <section className="facts">
                  <div><span className="lbl">Customer</span><span>{(order as any).shipName || (order as any).customerName || (order as any).customerId || "—"}</span></div>
                  <div><span className="lbl">Total</span><span>{fmtMoneyINR((order as any).grandTotal ?? 0)}</span></div>
                  <div><span className="lbl">Shipping</span><span>{fmtMoneyINR((order as any).shippingFee ?? 0)}</span></div>
                  <div><span className="lbl">Discount</span><span>{fmtMoneyINR((order as any).discountTotal ?? 0)}</span></div>
                  <div><span className="lbl">Coupon</span><span>{(order as any).couponCode || "—"}</span></div>
                  <div className="full"><span className="lbl">Ship to</span><span>{shipAddress || "—"}</span></div>
                </section>

                <section className="block actions-wrap">
                  {/* Row 1: never moves */}
                  <div className="bar">
                    <div className="bar-cell">
                      <label className="lbl small">Status</label>
                      <select
                        className="control"
                        disabled={updBusy}
                        value={selStatus}
                        onChange={(e) => setSelStatus(e.target.value as OrderStatus)}
                        title="Change status"
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
                        ))}
                      </select>
                    </div>

                    <div className="bar-cell grow">
                      <label className="lbl small">Add note (optional)</label>
                      <input
                        className="control"
                        placeholder="(optional) note to timeline…"
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                      />
                    </div>

                    <div className="bar-cell">
                      <label className="lbl small">&nbsp;</label>
                      <button type="button" className="btn sm" disabled={updBusy} onClick={applyStatus}>
                        {updBusy ? "Updating…" : "Apply"}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: appears only for DISPATCHED */}
                  {/* Row 2: appears only for DISPATCHED */}
                  {selStatus === "DISPATCHED" && (
                    <div className="trk-row" role="group" aria-label="Tracking details">
                      {/* Tracking Number */}
                      <label htmlFor="trkNo" className="l1 lbl">
                        Tracking Number <span className="req">*</span>
                      </label>
                      <input
                        id="trkNo"
                        className="c1 control mono slim"
                        placeholder="e.g., AWB123456789"
                        value={trackingNo}
                        onChange={(e) => setTrackingNo(e.target.value)}
                      />


                      {/* Tracking URL */}
                      <label htmlFor="trkUrl" className="l2 lbl">
                        Tracking URL {(!hasPartner || !lockUrl) && <span className="req">*</span>}
                        {hasPartner && lockUrl && <span className="pill">from partner</span>}
                      </label>
                      <input
                        id="trkUrl"
                        className={`c2 control ${lockUrl ? "readonly" : ""}`}
                        placeholder={hasPartner ? "Auto from delivery partner" : "https://…"}
                        value={trackingUrl}
                        onChange={(e) => !lockUrl && setTrackingUrl(e.target.value)}
                        readOnly={lockUrl}
                        title={lockUrl ? "Controlled by delivery partner" : "Enter a full tracking URL"}
                      />
                      {hasPartner && partnerUrlTemplate && (
                        <div className="h2 hint">
                          Using partner template: <code>{partnerUrlTemplate}</code>
                        </div>
                      )}
                      <div className="h1 hint">Shown in customer email/timeline.</div>
                    </div>

                  )}

                </section>

                <section className="block">
                  <h4>Items</h4>
                  {!items ? (
                    <div className="pad">Loading…</div>
                  ) : items.length === 0 ? (
                    <div className="pad muted">No items</div>
                  ) : (
                    <div className="table">
                      <div className="thead">
                        <div>Product</div>
                        <div>Qty</div>
                        <div>Unit</div>
                        <div>Total</div>
                      </div>
                      {items.map((it) => (
                        <div className="trow" key={it.id}>
                          <div>
                            <div>{it.productName}</div>
                            {it.optionsText && <div className="muted" style={{ fontSize: 12 }}>{it.optionsText}</div>}
                          </div>
                          <div>{it.quantity}</div>
                          <div>{fmtMoneyINR(it.unitPrice || 0)}</div>
                          <div>{fmtMoneyINR(it.lineTotal || 0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="block">
                  <h4>Order notes</h4>
                  <div className="ord-notes">
                    {notes
                      ? notes.split(/\r?\n/).map((line, i) => (
                        <p key={i} className="ord-note-line">{line}</p>
                      ))
                      : <div className="muted">No notes added by the customer.</div>}
                  </div>
                </section>

                <section className="block">
                  <h4>Payments</h4>
                  {!payments ? (
                    <div className="pad">Loading…</div>
                  ) : payments.length === 0 ? (
                    <div className="pad muted">No payments</div>
                  ) : (
                    <div className="table">
                      <div className="thead">

                        <div>Ref</div>
                        <div>Amount</div>
                        <div>When</div>
                      </div>
                      {payments.map((p) => (
                        <div className="trow" key={p.id}>

                          <div>{p.ref || "—"}</div>
                          <div>{fmtMoneyINR(p.amount || 0)}</div>
                          <div>{p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>


                <section className="block">
                  <div className="note">
                    <input
                      placeholder="Add admin note to timeline…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                    />
                  </div>
                  <h4>Timeline</h4>
                  {!events ? (
                    <div className="pad">Loading…</div>
                  ) : events.length === 0 ? (
                    <div className="pad muted">No events</div>
                  ) : (
                    <ul className="timeline">
                      {events.map((ev) => (
                        <li key={ev.id}>
                          <div className="when">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""}</div>
                          <div className="what"><b>{ev.type}</b> — {ev.message}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

const css = `
/* ------------------------------ Styles ------------------------------ */
.ord-wrap{ padding:12px; color:${PRIMARY}; background:${BG}; }
.muted{ opacity:.75; font-size:12px; }
.tiny{ font-size:11px; }
.ellipsis{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
.right{ text-align:right; }
.center{ text-align:center; }

/* Header */
.hd{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
  margin-bottom:12px; padding:10px 12px;
  border:1px solid ${INK}; border-radius:14px; background:#fff;
  box-shadow:0 12px 36px rgba(0,0,0,.08);
}
.hd h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.searchbar{ display:flex; align-items:center; gap:8px; width:100%; }
.searchbar .box{ position:relative; }
.searchbar input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 12px; background:#fff; outline:none; padding-right: 30px;
}
.searchbar input:focus-visible{ box-shadow:0 0 0 3px rgba(240,93,139,.18); }
.clear-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; font-size: 18px; color: #999; cursor: pointer;
  padding: 0; line-height: 1;
}
.clear-btn:hover { color: #333; }
.sep{ opacity:.7; font-weight:800; }
.spacer{ flex:1; }

/* Selects & inputs */
.sel{
  height:34px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.sel:focus-visible{ box-shadow:0 0 0 3px rgba(240,93,139,.18); }
.sel[multiple]{ min-height:68px; padding:6px 8px; }
.pad{ padding:12px; }

/* Cards */
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,.08); }

/* Table */
.tbl{ width:100%; }
.thead,.trow{
  display:grid;
  grid-template-columns:
    160px
    minmax(220px,2fr)
    minmax(110px,.8fr)
    minmax(140px,.9fr)
    minmax(170px,1fr)
    110px;
  gap:12px; align-items:center; padding:12px 14px;
}
.thead{ background:#fafafa; border-bottom:1px solid ${INK}; font-weight:900; font-size:12px; }
.trow{ border-top:1px solid ${INK}; transition:background .12s ease; }
.trow:hover{ background:rgba(246,195,32,.06); }
.empty{ text-align:center; padding:16px; }

/* Status badges */
.bb-badge{
  min-width:108px; height:24px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:900;
  display:inline-grid; place-items:center; color:#fff; background:${PRIMARY};
}
.bb-ordered{ background:${ACCENT}; }
.bb-dispatched{ background:#7AA2E3; }
.bb-delivered{ background:#4caf50; }
.bb-cancelled{ background:#d32f2f; }
.bb-refunded{ background:#9c27b0; }
.bb-returned_refunded{ background:${PRIMARY}; }

.actions{ display:flex; justify-content:flex-end; }

/* Column alignment */
.trow>:nth-child(3), .thead>:nth-child(3){ text-align:right; }  /* Total   */
.trow>:nth-child(4), .thead>:nth-child(4){ text-align:center; } /* Status  */
.trow>:nth-child(5), .thead>:nth-child(5){ text-align:right; }  /* Created */

/* Buttons */
.btn{
  height:38px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:${ACCENT}; color:#fff; font-weight:900; box-shadow:0 10px 28px rgba(240,93,139,.35);
  transition:transform .06s ease, box-shadow .12s ease;
}
.btn:hover{ transform:translateY(-1px); box-shadow:0 12px 32px rgba(240,93,139,.42); }
.btn:active{ transform:translateY(0); }
.btn:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(240,93,139,.28); }
.btn.sm{ height:30px; padding:0 12px; border-radius:8px; }

.ghost{
  height:34px; padding:0 12px; border-radius:10px; border:1px solid ${INK};
  background:#fff; color:${PRIMARY}; cursor:pointer; transition:box-shadow .12s ease, transform .06s ease;
}
.ghost:hover{ box-shadow:0 8px 20px rgba(0,0,0,.08); transform:translateY(-1px); }
.ghost:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(74,79,65,.18); }
.ghost.sm{ height:30px; padding:0 10px; border-radius:8px; }

/* Toast */
.toast{
  position:fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation:toast .22s ease both;
}
.toast.ok{ background:#4caf50; }
.toast.bad{ background:#d32f2f; }
@keyframes toast{ from{ transform:translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

/* ── Compact / Premium Toolbar ───────────────────────────────────── */
.toolbar.glass{
  border-radius:14px; padding:8px 10px; border:1px solid ${INK}; background:rgba(255,255,255,.72);
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  box-shadow:0 10px 30px rgba(0,0,0,.08);
}
.toolbar.sticky{ position:sticky; top:8px; z-index:30; }
.ctl-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.side{ display:flex; align-items:center; gap:10px; }
.side.mid{ flex:1; justify-content:center; min-width:240px; }
.dot{ opacity:.6; }

/* Segmented controls */
.seg{
  display:flex; align-items:center; gap:0; border:1px solid ${INK}; border-radius:10px; background:#fff; overflow:hidden;
}
.seg-item{ display:flex; align-items:center; gap:6px; padding:4px 8px; }           /* tighter */
.seg-label{ font-size:12px; opacity:.75; }
.seg-sel{ border:none; outline:none; height:24px; background:transparent; }        /* shorter */
.seg-sel:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(240,93,139,.18); }
.divider{ width:1px; height:20px; background:${INK}; }
                /* shorter */
/* ── Order notes (customer notes) ─────────────────────────────── */
.drawer .ord-notes{
  border:1px dashed ${INK};
  border-radius:12px;
  background:#fff;
  padding:10px 12px;
  display:grid;
  gap:6px;
  max-height:240px;                /* scroll if long */
  overflow:auto;
  color:${PRIMARY};
}

/* each line (you split by \n in JSX) */
.drawer .ord-note-line{
  margin:0;
  line-height:1.5;
  padding-left:18px;               /* room for marker */
  position:relative;
  word-break:break-word;
  overflow-wrap:anywhere;
}

/* subtle bullet/marker */
.drawer .ord-note-line::before{
  content:"•";
  position:absolute;
  left:0;
  top:0.1em;
  font-weight:900;
  color:${ACCENT};
}

/* links inside notes (if users paste URLs) */
.drawer .ord-notes a{
  color:#0d47a1;
  text-decoration:underline;
  word-break:break-word;
}

/* muted fallback text inside the box */
.drawer .ord-notes .muted{
  opacity:.75;
  font-size:12px;
}

/* mobile polish */
@media (max-width:520px){
  .drawer .ord-notes{
    padding:8px 10px;
    max-height:200px;
  }
}

/* Filters pill + summary */
.pill-btn{
  display:inline-flex; align-items:center; gap:8px; height:30px; padding:0 10px;   /* smaller */
  border:1px solid ${INK}; border-radius:999px; background:#fff; cursor:pointer;
  transition:box-shadow .12s ease, transform .06s ease;
}
.pill-btn:hover{ box-shadow:0 8px 22px rgba(0,0,0,.08); transform:translateY(-1px); }
.pill-btn:focus-visible{ outline:none; box-shadow:0 0 0 3px rgba(240,93,139,.18); }
.pill-btn.on{ box-shadow:0 0 0 4px rgba(240,93,139,.12); }
.pill-btn .count{
  min-width:18px; height:18px; line-height:18px; border-radius:9px; padding:0 6px; font-size:11px; font-weight:800;
  background:${GOLD}; color:#000; display:inline-block; text-align:center;
}
.pill-btn .caret{ opacity:.7; }

/* Inline filter section (collapsible inside toolbar) */
.inline-filters{
  max-height: clamp(220px, 36vh, 340px);
  overflow: auto;
  padding: 8px 10px 12px;
  border-top: 1px dashed ${INK};
  background:#fff;
  border-radius: 12px;
}
.if-grid{ display:grid; gap:10px; }
.if-sec{
  border:1px solid ${INK}; border-radius:12px; background:#fff; padding:10px;
}
.if-actions{
  position: sticky; bottom: 0;
  display:flex; align-items:center; justify-content:flex-end; gap:8px;
  padding:8px 0 0 0;
  background: linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,.9) 60%, rgba(255,255,255,0));
}

/* Rows / fields */
.row{ display:flex; align-items:center; gap:20px; }
.field{
  height:30px; padding:0 10px; border:1px solid ${INK}; border-radius:10px; background:#fff; outline:none; min-width:200px;
}
.field:focus-visible{ box-shadow:0 0 0 3px rgba(240,93,139,.18); }
.to{ opacity:.6; }

.sec-title{ font-size:12px; font-weight:800; opacity:.75; margin-bottom:6px; }

/* Quick chips */
.chips{ display:flex; gap:6px; margin-top:6px; }
.chip{
  height:24px; border:1px solid ${INK}; background:#fff; border-radius:999px; padding:0 8px; font-size:12px; cursor:pointer;
  transition:box-shadow .12s ease, transform .06s ease;
}
.chip:hover{ box-shadow:0 6px 18px rgba(0,0,0,.06); transform:translateY(-1px); }

/* Status chooser pills — compact & scrollable section */
.status-sec{
  max-height: 200px;            /* keeps room for actions */
  overflow: auto;
  padding-right: 4px;
}
.status-grid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));  /* tighter */
  gap:6px;
}
.status-pill{
  padding:6px 10px; border-radius:999px; border:1px solid ${INK}; background:#fff; cursor:pointer; font-size:12px; text-align:left;
  transition:box-shadow .12s ease, background .12s ease;
  white-space:nowrap;
}
.status-pill:hover{ box-shadow:0 6px 18px rgba(0,0,0,.06); }
.status-pill.active{
  background:rgba(64,160,255,.10); border-color:rgba(64,160,255,.35); box-shadow:inset 0 0 0 1px rgba(64,160,255,.2);
}

/* Inline mini filter badges */
.mini-badges{ display:flex; gap:6px; flex-wrap:wrap; }
.mini{
  height:22px; display:inline-flex; align-items:center; padding:0 8px; border-radius:999px;
  border:1px dashed ${INK}; background:#fff; font-size:12px;
}

/* Responsive */
@media (max-width:1280px){
  .thead,.trow{
    grid-template-columns:
      150px
      minmax(200px,2fr)
      minmax(100px,.8fr)
      minmax(130px,.9fr)
      minmax(150px,.9fr)
      100px;
  }
}
@media (max-width:1100px){
  .thead,.trow{
    grid-template-columns:
      140px
      minmax(160px,2fr)
      minmax(100px,.9fr)
      minmax(130px,.9fr)
      0px
      94px;
  }
  .thead>:nth-child(5), .trow>:nth-child(5){ display:none; } /* hide Created */

  .ctl-row{ flex-wrap:wrap; }
  .side.mid{ order:3; justify-content:flex-start; }
  .status-grid{ grid-template-columns: repeat(2, minmax(120px,1fr)); }
}
@media (max-width:640px){
  .status-grid{ grid-template-columns: 1fr; }
  .inline-filters{ max-height: clamp(220px, 42vh, 360px); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce){
  .btn,.ghost,.trow,.pill-btn,.chip,.status-pill{ transition:none !important; }
}
`;

/* Drawer styles */
const drawerCss = `
/* ───────────────────────── Drawer Shell ───────────────────────── */
.drawer-mask{
  position: fixed; inset: 0; background: rgba(0,0,0,.25);
  display:none; z-index: 120;
}
.drawer-mask.show{ display:block; }

.drawer{
  position:absolute; right:0; top:0; bottom:0; width:720px; max-width:92vw;
  background:#fff; border-left:1px solid ${INK}; box-shadow:-18px 0 60px rgba(0,0,0,.18);
  display:flex; flex-direction:column; animation: slideIn .18s ease both;
}
@keyframes slideIn{ from { transform: translateX(12px); opacity:.98 } to { transform:none; opacity:1 } }

.drawer-hd{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 14px; border-bottom:1px solid ${INK};
  background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.92));
}
.drawer-hd .code{ font-weight:900; font-size:18px; }
.hdr-left{ display:flex; flex-direction:column; gap:20px; }
.hdr-right{ display:flex; align-items:center; gap:8px; }

.drawer-body{
  padding:12px 14px; overflow:auto; display:grid; gap:12px;
}

/* ───────────────────── Order Facts strip ───────────────────── */
.facts{
  display:grid; grid-template-columns:1fr 1fr; gap:10px;
  border:1px solid ${INK}; border-radius:12px; padding:10px 12px; background:#fafafa;
}
.facts .lbl{ font-size:12px; opacity:.8; display:block; }
.facts .full{ grid-column: 1 / -1; }

/* ───────────────────── Actions: status / tracking ───────────────────── */
.actions-wrap{
  border:1px solid ${INK}; border-radius:12px; padding:12px; background:#fff;
  display:grid; gap:12px;
}

/* Row 1: Status | Note | Apply (fixed, even heights) */
.actions-wrap .bar{
  display:grid; grid-template-columns: minmax(180px, 220px) 1fr auto;
  gap:12px; align-items:end;
}
.actions-wrap .bar .bar-cell{ display:flex; flex-direction:column; gap:6px; min-width:0; }
.actions-wrap .bar .grow{ width:100%; min-width:0; }

/* Row 2: Tracking fields (label → control, hint under control) */
.trk-fields{
  display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start;
}

/* IMPORTANT: neutralize page-level .field leakage */
.trk-fields .field{
  height:auto; padding:0; border:0; border-radius:0; background:transparent; min-width:0;
  display:grid;
  grid-template-columns: 140px 1fr;
  grid-template-rows: 40px auto;
  grid-template-areas:
    "label control"
    ".     hint";
  column-gap:10px; row-gap:6px; align-items:center; position:relative;
}

.trk-fields .field .lbl{
  grid-area: label; font-size:12px; font-weight:700; opacity:.9; white-space:nowrap;
}
.trk-fields .field .req{ color:#d32f2f; margin-left:4px; }

.trk-fields .field .control{
  grid-area: control; height:40px;
  border:1px solid ${INK}; border-radius:10px; padding:0 12px; outline:0; background:#fff;
  transition: box-shadow .15s ease, border-color .15s ease, background-color .15s ease;
  min-width:0; /* long URLs won’t blow the grid */
}
.trk-fields .field .control:focus{
  border-color:${ACCENT}; box-shadow:0 0 0 3px rgba(240,93,139,.18);
}

/* Long URL behavior: keep single-line normally; on focus allow wrap to inspect */
.trk-fields .field .control{
  white-space:nowrap; text-overflow:ellipsis; overflow:hidden;
}
.trk-fields .field .control:focus{
  white-space:normal; overflow:visible;
}

/* Readonly look (partner-controlled URL) */
.trk-fields .field .control[readonly],
.trk-fields .field .control.readonly{
  background:#fafafa; color:#555; cursor:not-allowed;
}

.trk-fields .field .hint{
  grid-area: hint; font-size:11.5px; opacity:.7; margin-top:0;
  margin-left: 140px; /* lines up under control column */
}

/* Any tooltip/popover elements inside field: don’t block typing */
.trk-fields .field .tooltip,
.trk-fields .field .popover,
.trk-fields .field .bubble{
  position:absolute; left:140px; top:44px; z-index:2;
  max-width: calc(100% - 140px); pointer-events:none;
}

/* Shared form bits (scoped to drawer to avoid page bleed) */
.drawer .lbl{ font-size:12px; font-weight:700; opacity:.9; }
.drawer .lbl.small{ font-weight:600; opacity:.8; }
.drawer .hint{ font-size:11.5px; opacity:.75; }
.drawer .control{
  height:36px; border:1px solid ${INK}; border-radius:10px; padding:0 12px; outline:0; background:#fff;
  transition: box-shadow .15s ease, border-color .15s ease, background-color .15s ease;
}
.drawer .control:focus{ border-color:${ACCENT}; box-shadow:0 0 0 3px rgba(240,93,139,.18); }

/* Apply button */
.actions-wrap .apply-btn,
.actions-wrap .btn{
  height:40px; padding:0 18px; border:none; border-radius:12px;
  background: linear-gradient(135deg, ${ACCENT}, #ff8fb0);
  color:#fff; font-weight:900; cursor:pointer; box-shadow:0 8px 24px rgba(240,93,139,.28);
}
.actions-wrap .apply-btn:active, .actions-wrap .btn:active{ transform: translateY(1px); }

/* Print group */
.print-group{ display:flex; align-items:center; gap:6px; }

/* ───────────────────── Items / Payments tables ───────────────────── */
.block .table{ display:grid; }
.block .thead, .block .trow{
  display:grid; grid-template-columns: 1fr 80px 100px 120px; gap:8px;
  padding:8px 12px; align-items:center;
}
.block .thead{ font-weight:900; font-size:12px; background:#fafafa; border-bottom:1px solid ${INK}; }
.block .trow{ border-bottom:1px solid ${INK}; }

/* Note chip */
.note{ display:flex; align-items:center; gap:8px; padding:10px 12px; border:1px dashed ${INK}; border-radius:10px; }
.note input{ flex:1; height:34px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff; }

/* Timeline */
.timeline{ list-style:none; margin:0; padding:8px 0; display:grid; gap:8px; }
.timeline li{ display:grid; grid-template-columns: 180px 1fr; gap:10px; }
.timeline .when{ font-size:12px; opacity:.85; }
.timeline .what{ font-size:14px; }

/* ───────────────────── Responsive ───────────────────── */
@media (max-width: 900px){
  .actions-wrap .bar{ grid-template-columns: 1fr; }
  .trk-fields{ grid-template-columns: 1fr; }
  .trk-fields .field{ grid-template-columns: 120px 1fr; }
  .trk-fields .field .hint{ margin-left:120px; }
}
@media (max-width: 520px){
  .trk-fields .field{
    grid-template-columns: 1fr;
    grid-template-rows: auto 40px auto;
    grid-template-areas:
      "label"
      "control"
      "hint";
  }
/* ── Tracking row: 4-column grid [L1][C1][L2][C2] with hint lines under each control ── */
.drawer .trk-row{
  display:grid;
  grid-template-columns: 140px minmax(240px,1fr) 140px minmax(240px,1fr);
  grid-auto-rows: 40px;                 /* first line height (controls) */
  column-gap:12px;
  row-gap:6px;
  align-items:center;
}

/* placement */
.drawer .trk-row .l1{ grid-column:1; grid-row:1; white-space:nowrap; }
.drawer .trk-row .c1{ grid-column:2; grid-row:1; }
.drawer .trk-row .h1{ grid-column:2; grid-row:2; }

.drawer .trk-row .l2{ grid-column:3; grid-row:1; white-space:nowrap; }
.drawer .trk-row .c2{ grid-column:4; grid-row:1; }
.drawer .trk-row .h2{ grid-column:4; grid-row:2; }

/* inputs */
.drawer .trk-row .control{
  height:40px;
  padding:0 10px;                       /* tighter default padding */
  border:1px solid ${INK};
  border-radius:10px;
  background:#fff;
  min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  outline:0;
  transition: box-shadow .15s ease, border-color .15s ease;
}
.drawer .trk-row .control:focus{
  border-color:${ACCENT};
  box-shadow:0 0 0 3px rgba(240,93,139,.18);
  white-space:normal; overflow:visible; /* allow long URL to wrap while focused */
}
.drawer .trk-row .control.readonly,
.drawer .trk-row .control[readonly]{ background:#fafafa; color:#555; cursor:not-allowed; }

/* specifically slim down Tracking Number padding as requested */
.drawer .trk-row .c1.slim{ padding-left:8px; padding-right:8px; }

/* labels / hint */
.drawer .trk-row .lbl{ font-size:12px; font-weight:700; opacity:.9; }
.drawer .trk-row .req{ color:#d32f2f; margin-left:4px; }
.drawer .trk-row .pill{ margin-left:8px; padding:1px 8px; border-radius:999px; font-size:11px; font-weight:700; background:rgba(0,0,0,.06); }
.drawer .trk-row .hint{ font-size:11.5px; opacity:.75; }

/* keep random helper bubbles from overlapping neighbors */
.drawer .trk-row [class*="tooltip"],
.drawer .trk-row [class*="popover"],
.drawer .trk-row [class*="bubble"],
.drawer .trk-row [role="tooltip"]{
  position:absolute; z-index:2; pointer-events:none;
}

/* responsive */
@media (max-width: 900px){
  .drawer .trk-row{
    grid-template-columns: 120px 1fr;
  }
  .drawer .trk-row .l1,.drawer .trk-row .l2{ grid-column:1; }
  .drawer .trk-row .c1,.drawer .trk-row .c2{ grid-column:2; }
  .drawer .trk-row .h1,.drawer .trk-row .h2{ grid-column:2; }
}
@media (max-width: 520px){
  .drawer .trk-row{
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
  .drawer .trk-row .l1,.drawer .trk-row .c1,.drawer .trk-row .h1,
  .drawer .trk-row .l2,.drawer .trk-row .c2,.drawer .trk-row .h2{
    grid-column:1; grid-row:auto;
  }
}
/* ── FORCE Tracking Number & Tracking URL to stay on the same line ── */
.drawer .trk-row{
  display: flex !important;
  grid-template-columns: 140px minmax(280px,1fr) 140px minmax(280px,1fr) !important;
  column-gap: 14px !important;
  row-gap: 6px !important;
  gap:20px
  align-items: center !important;
}

/* place items: both controls on row 1; hints on row 2 under their control */
.drawer .trk-row .l1{ grid-column:1; grid-row:1; white-space:nowrap; }
.drawer .trk-row .c1{ grid-column:2; grid-row:1; }
.drawer .trk-row .h1{ grid-column:2; grid-row:2; }

.drawer .trk-row .l2{ grid-column:3; grid-row:1; white-space:nowrap; }
.drawer .trk-row .c2{ grid-column:4; grid-row:1; }
.drawer .trk-row .h2{ grid-column:4; grid-row:2; }

/* inputs — compact padding for Tracking Number as requested */
.drawer .trk-row .control{
  height: 40px; padding: 0 10px; border:1px solid ${INK}; border-radius:10px;
  background:#fff; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  outline:0; transition: box-shadow .15s, border-color .15s;
}
.drawer .trk-row .c1{ padding-left: 8px; padding-right: 8px; }
.drawer .trk-row .control:focus{ border-color:${ACCENT}; box-shadow:0 0 0 3px rgba(240,93,139,.18); white-space:normal; overflow:visible; }
.drawer .trk-row .control.readonly, .drawer .trk-row .control[readonly]{ background:#fafafa; color:#555; cursor:not-allowed; }

/* label/hint styling */
.drawer .trk-row .lbl{ font-size:12px; font-weight:700; opacity:.9; }
.drawer .trk-row .req{ color:#d32f2f; margin-left:4px; }
.drawer .trk-row .hint{ font-size:11.5px; opacity:.75; }

/* kill any earlier responsive rule that stacked them too early */
@media (max-width: 760px){
  .drawer .trk-row{
    grid-template-columns: 120px 1fr !important;
  }
  .drawer .trk-row .l1, .drawer .trk-row .l2{ grid-column:1; }
  .drawer .trk-row .c1, .drawer .trk-row .c2{ grid-column:2; }
  .drawer .trk-row .h1, .drawer .trk-row .h2{ grid-column:2; }
}
@media (max-width: 520px){
  .drawer .trk-row{
    grid-template-columns: 1fr !important;
  }
  .drawer .trk-row .l1,.drawer .trk-row .c1,.drawer .trk-row .h1,
  .drawer .trk-row .l2,.drawer .trk-row .c2,.drawer .trk-row .h2{
    grid-column:1; grid-row:auto;
  }
}


`;
