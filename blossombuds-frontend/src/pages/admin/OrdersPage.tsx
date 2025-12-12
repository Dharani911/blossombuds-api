// src/pages/admin/OrdersPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatIstDateTime, formatIstDate } from "../../utils/dates";


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
const fmtDT = (d?: string | number | Date) =>
  d ? formatIstDateTime(d) : "—";


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

function printBlob(
  blob: Blob,
  fail: (msg?: string) => void,
  onDone?: () => void
) {
  // Create a blob URL for the PDF
  const url = URL.createObjectURL(blob);

  // Open in a new tab
  const win = window.open(url, "_blank");

  if (!win) {
    // Popup blocked
    fail("Popup blocked. Please allow popups to view/print the PDF.");
    return;
  }

  try {
    win.focus();
    // Try to trigger print; if browser ignores it, user can print manually
    win.print?.();
  } catch {
    // Even if print() throws, they still see the PDF in the new tab
  }

  if (onDone) onDone();

  // Clean up when that new tab closes
  const revoke = () => {
    URL.revokeObjectURL(url);
    win.removeEventListener("beforeunload", revoke);
  };
  win.addEventListener("beforeunload", revoke);
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
  const [printingBulk, setPrintingBulk] = useState(false); // 🔹 NEW


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
    if (fromDT) badges.push(`from ${formatIstDate(fromDT)}`);
    if (toDT) badges.push(`to ${formatIstDate(toDT)}`);
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
    setShowFilters(false);
  }

  // Quick date filter actions
  function setToday() {
    const from = startOfToday();
    const to = endOfToday();

    const fromStr = formatLocalDTForInput(from);
    const toStr = formatLocalDTForInput(to);

    setFromDT(fromStr);
    setToDT(toStr);
    setIsFiltered(true);
    setPage(0);

    void loadAll({
      useFilter: true,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  function setLast7() {
    const from = startOfToday();
    from.setDate(from.getDate() - 6); // today + previous 6 days = 7

    const to = endOfToday();

    const fromStr = formatLocalDTForInput(from);
    const toStr = formatLocalDTForInput(to);

    setFromDT(fromStr);
    setToDT(toStr);
    setIsFiltered(true);
    setPage(0);

    void loadAll({
      useFilter: true,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  function setThisMonth() {
    const from = startOfMonth();
    const to = endOfMonth();

    const fromStr = formatLocalDTForInput(from);
    const toStr = formatLocalDTForInput(to);

    setFromDT(fromStr);
    setToDT(toStr);
    setIsFiltered(true);
    setPage(0);

    void loadAll({
      useFilter: true,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  function clearDateFilter() {
    setFromDT("");
    setToDT("");
    setStatusFilter([]);
    setIsFiltered(false);
    setPage(0);

    // reload without filters
    void loadAll({ useFilter: false });
  }





  async function printPackingForCurrentResults() {
    try {
      const ids = (orders ?? []).map(o => Number(o.id)).filter(Boolean);
      if (!ids.length) {
        setToast({ kind: "bad", msg: "No orders to print." });
        return;
      }

      setPrintingBulk(true); // 🔹 show loading
      setToast({ kind: "ok", msg: `Generating ${ids.length} packing slip(s)…` });

      const pdfBlob = await fetchPackingSlipsBulk(ids);

      const fail = (msg?: string) => {
        setToast({ kind: "bad", msg: msg || "Print failed" });
        setPrintingBulk(false);          // 🔹 stop loading on failure
      };

      // 🔹 stop loading when print window / dialog is triggered
      printBlob(pdfBlob, fail, () => setPrintingBulk(false));
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Failed to generate packing slips";
      setToast({ kind: "bad", msg });
      setPrintingBulk(false);            // 🔹 fail-safe
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
                  {fromDT && <span className="mini">From {formatIstDate(fromDT)}</span>}
                  {toDT && <span className="mini">To {formatIstDate(toDT)}</span>}
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
                  disabled={loading || orders.length === 0 || printingBulk}
                >
                  {printingBulk ? "Preparing…" : "Packing slips"}
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
  const [printBusy, setPrintBusy] = useState<"invoice" | "packing" | null>(null); // 🔹 NEW

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
      const partner = await fetchJSON<any>(`/api/partners/${partnerId}`);

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

    const fail = (msg?: string) => {
      setToast({ kind: "bad", msg: msg || "Could not open printer dialog." });
      setPrintBusy(null);  // 🔹 stop loading on failure
    };

    try {
      setPrintBusy(kind);  // 🔹 mark which one is busy

      const blob =
        kind === "invoice"
          ? await fetchInvoicePdf(order.id)
          : await fetchPackingSlipPdf(order.id);

      // 🔹 stop loading when print dialog / new tab is triggered
      printBlob(blob, fail, () => setPrintBusy(null));
    } catch (e: any) {
      fail(e?.message);
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
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() => openPrint("invoice")}
                      disabled={printBusy !== null}
                    >
                      {printBusy === "invoice" ? "Opening…" : "Invoice PDF"}
                    </button>
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() => openPrint("packing")}
                      disabled={printBusy !== null}
                    >
                      {printBusy === "packing" ? "Opening…" : "Packing Slip"}
                    </button>
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
                      ? notes.split(/\r?\n/).map((line: string, i: number) => (
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
                          <div>{p.createdAt ? formatIstDateTime(p.createdAt) : "—"}</div>
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
                          <div className="when">
                            {ev.createdAt ? formatIstDateTime(ev.createdAt) : ""}
                          </div>

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
/* ═══════════════════════════ PREMIUM ORDERS PAGE STYLES ═══════════════════════════ */
.ord-wrap {
  padding: 20px;
  color: ${PRIMARY};
  max-width: 1500px;
  margin: 0 auto;
  min-height: 100vh;
}

.muted { opacity: 0.7; font-size: 12px; }
.tiny { font-size: 11px; }
.ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mono { font-family: "SF Mono", Monaco, Consolas, monospace; font-size: 13px; }
.right { text-align: right; }
.center { text-align: center; }

/* ═══════════════════════════ HEADER ═══════════════════════════ */
.hd {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid ${INK};
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,247,231,0.9) 100%);
  box-shadow: 0 8px 40px rgba(0,0,0,0.06);
}

.hd h2 {
  margin: 0;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.hd h2::after {
  content: "";
  height: 3px;
  width: 40px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD});
  border-radius: 2px;
}

.searchbar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;
}

.searchbar .box {
  position: relative;
}

.searchbar input {
  height: 42px;
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 0 36px 0 14px;
  background: #fff;
  outline: none;
  font-size: 14px;
  transition: all 0.2s ease;
}

.searchbar input:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,.15);
}

.clear-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: #eee;
  border: none;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: ${ACCENT};
  color: white;
}

.sep { opacity: 0.5; font-weight: 600; color: #999; }
.spacer { flex: 1; }

/* ═══════════════════════════ CARDS ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.06);
}

/* ═══════════════════════════ MAIN TABLE ═══════════════════════════ */
.tbl { width: 100%; }

.thead, .trow {
  display: grid;
  grid-template-columns: 140px minmax(200px, 2fr) minmax(100px, 0.8fr) minmax(130px, 1fr) minmax(160px, 1fr) 100px;
  gap: 14px;
  align-items: center;
  padding: 14px 20px;
}

.thead {
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid ${INK};
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
}

.trow {
  border-bottom: 1px solid ${INK};
  transition: all 0.2s ease;
}

.trow:last-child { border-bottom: none; }

.trow:hover {
  background: linear-gradient(90deg, rgba(246,195,32,0.06) 0%, rgba(255,255,255,0) 100%);
}

/* Customer cell styling */
.customer {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.customer .name {
  font-weight: 600;
  color: ${PRIMARY};
}

.customer .cidpill {
  font-size: 11px;
  color: #888;
}

.empty {
  text-align: center;
  padding: 50px 20px;
  color: #888;
}

.pad { padding: 16px; }

/* ═══════════════════════════ STATUS BADGES ═══════════════════════════ */
.bb-badge {
  min-width: 110px;
  height: 28px;
  padding: 0 14px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: ${PRIMARY};
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.bb-ordered {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  box-shadow: 0 4px 12px rgba(240,93,139,0.3);
}

.bb-dispatched {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(102,126,234,0.3);
}

.bb-delivered {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #065f46;
  box-shadow: 0 4px 12px rgba(67,233,123,0.3);
}

.bb-cancelled {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  box-shadow: 0 4px 12px rgba(255,107,107,0.3);
}

.bb-refunded {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  box-shadow: 0 4px 12px rgba(168,85,247,0.3);
}

.bb-returned_refunded {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  box-shadow: 0 4px 12px rgba(100,116,139,0.3);
}

.actions { display: flex; justify-content: flex-end; }

/* Column alignment */
.trow>:nth-child(3), .thead>:nth-child(3) { text-align: right; }
.trow>:nth-child(4), .thead>:nth-child(4) { text-align: center; }
.trow>:nth-child(5), .thead>:nth-child(5) { text-align: right; }

/* ═══════════════════════════ BUTTONS ═══════════════════════════ */
.btn {
  height: 42px;
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 6px 20px rgba(240,93,139,0.3);
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(240,93,139,0.4);
}

.btn:active { transform: translateY(0); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.btn.sm { height: 34px; padding: 0 14px; border-radius: 10px; font-size: 13px; }

.ghost {
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  color: ${PRIMARY};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ghost:hover {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74,79,65,0.2);
}

.ghost:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.ghost.sm { height: 32px; padding: 0 12px; font-size: 13px; }

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
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
  animation: toastIn 0.3s ease-out;
}

.toast.ok {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #065f46;
}

.toast.bad {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
}

@keyframes toastIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ═══════════════════════════ TOOLBAR ═══════════════════════════ */
.toolbar.glass {
  border-radius: 16px;
  padding: 12px 16px;
  border: 1px solid ${INK};
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
  margin-bottom: 16px;
}

.toolbar.sticky {
  position: sticky;
  top: 10px;
  z-index: 50;
}

.ctl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.side.mid {
  flex: 1;
  justify-content: center;
  min-width: 240px;
}

.dot { opacity: 0.4; font-size: 10px; }

/* Segmented controls */
.seg {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid ${INK};
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.seg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
}

.seg-label { font-size: 12px; opacity: 0.7; font-weight: 500; }

.seg-sel {
  border: none;
  outline: none;
  height: 26px;
  background: transparent;
  font-weight: 600;
  cursor: pointer;
}

.divider { width: 1px; height: 24px; background: ${INK}; }

/* ═══════════════════════════ FILTER BUTTON ═══════════════════════════ */
.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid ${INK};
  border-radius: 18px;
  background: #fff;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.pill-btn:hover {
  border-color: ${ACCENT};
  box-shadow: 0 4px 16px rgba(240,93,139,0.15);
  transform: translateY(-1px);
}

.pill-btn.on {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
}

.pill-btn .count {
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 10px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  background: ${GOLD};
  color: #000;
  text-align: center;
}

.pill-btn .caret { opacity: 0.6; font-size: 10px; }

/* ═══════════════════════════ INLINE FILTERS ═══════════════════════════ */
.inline-filters {
  max-height: clamp(220px, 40vh, 360px);
  overflow: auto;
  padding: 16px;
  margin-top: 12px;
  border-top: 1px dashed ${INK};
  background: #fafafa;
  border-radius: 12px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.if-grid { display: grid; gap: 14px; }

.if-sec {
  border: 1px solid ${INK};
  border-radius: 14px;
  background: #fff;
  padding: 14px;
}

.if-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 0 0 0;
  background: linear-gradient(to top, #fafafa, rgba(250,250,250,0.9) 60%, transparent);
}

.row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

.field {
  height: 38px;
  padding: 0 12px;
  border: 1px solid ${INK};
  border-radius: 10px;
  background: #fff;
  outline: none;
  min-width: 200px;
  transition: all 0.2s;
}

.field:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.to { opacity: 0.5; font-weight: 500; }
.sec-title { font-size: 12px; font-weight: 700; opacity: 0.8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }

/* Quick chips */
.chips { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

.chip {
  height: 30px;
  border: 1px solid ${INK};
  background: #fff;
  border-radius: 15px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chip:hover {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
  transform: translateY(-1px);
}

/* Status filter pills */
.status-sec { max-height: 200px; overflow: auto; }

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.status-pill {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: all 0.2s ease;
}

.status-pill:hover {
  border-color: ${ACCENT};
  background: rgba(240,93,139,0.05);
}

.status-pill.active {
  background: linear-gradient(135deg, rgba(240,93,139,0.1) 0%, rgba(255,139,167,0.1) 100%);
  border-color: ${ACCENT};
  color: ${ACCENT};
  font-weight: 600;
}

/* Mini badges */
.mini-badges { display: flex; gap: 6px; flex-wrap: wrap; }

.mini {
  height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px dashed ${INK};
  background: #fff;
  font-size: 12px;
  font-weight: 500;
}

/* ═══════════════════════════ ORDER NOTES ═══════════════════════════ */
.drawer .ord-notes {
  border: 1px dashed ${INK};
  border-radius: 12px;
  background: #fafafa;
  padding: 14px 16px;
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
  color: ${PRIMARY};
}

.drawer .ord-note-line {
  margin: 0;
  line-height: 1.6;
  padding-left: 20px;
  position: relative;
  word-break: break-word;
}

.drawer .ord-note-line::before {
  content: "•";
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 900;
  color: ${ACCENT};
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1280px) {
  .thead, .trow {
    grid-template-columns: 130px minmax(180px, 2fr) minmax(90px, 0.8fr) minmax(120px, 1fr) minmax(140px, 0.9fr) 90px;
  }
}

@media (max-width: 1100px) {
  .thead, .trow {
    grid-template-columns: 120px minmax(160px, 2fr) minmax(90px, 0.9fr) minmax(120px, 1fr) 0px 85px;
  }
  .thead>:nth-child(5), .trow>:nth-child(5) { display: none; }
  .ctl-row { flex-wrap: wrap; }
  .side.mid { order: 3; justify-content: flex-start; width: 100%; margin-top: 8px; }
}

@media (max-width: 768px) {
  .ord-wrap { padding: 12px; }
  .hd { padding: 16px; }
  .searchbar { flex-wrap: wrap; }
  .searchbar .box { width: 100%; }
  .searchbar input { width: 100%; }
  .status-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 640px) {
  .status-grid { grid-template-columns: 1fr; }
  .inline-filters { max-height: clamp(220px, 50vh, 400px); }
  .thead { display: none; }
  .trow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn, .ghost, .trow, .pill-btn, .chip, .status-pill, .toast { transition: none !important; animation: none !important; }
}
`;


/* Drawer styles */
const drawerCss = `
/* ═══════════════════════════ DRAWER SHELL ═══════════════════════════ */
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: none;
  z-index: 200;
}

.drawer-mask.show {
  display: block;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 780px;
  max-width: 95vw;
  background: #fff;
  border-left: 1px solid ${INK};
  box-shadow: -20px 0 80px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s ease-out;
  overflow: hidden;
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0.8; }
  to { transform: translateX(0); opacity: 1; }
}

/* ═══════════════════════════ DRAWER HEADER ═══════════════════════════ */
.drawer-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(135deg, rgba(246,195,32,0.08) 0%, #fff 100%);
  flex-shrink: 0;
}

.drawer-hd .code {
  font-weight: 800;
  font-size: 22px;
  font-family: "SF Mono", Monaco, monospace;
  color: ${PRIMARY};
}

.hdr-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hdr-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.print-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.print-group .ghost {
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

/* ═══════════════════════════ DRAWER BODY - SCROLLABLE ═══════════════════════════ */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ═══════════════════════════ FACTS STRIP ═══════════════════════════ */
.facts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid ${INK};
}

.facts > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.facts .lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.6;
}

.facts span:not(.lbl) {
  font-size: 14px;
  font-weight: 600;
  color: ${PRIMARY};
}

.facts .full {
  grid-column: 1 / -1;
}

/* ═══════════════════════════ ACTIONS SECTION (Status Update) ═══════════════════════════ */
.actions-wrap {
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Override block styles when combined */
.block.actions-wrap {
  overflow: visible;
}

.actions-wrap .bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.actions-wrap .bar .bar-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}

.actions-wrap .bar .bar-cell.grow {
  flex: 1;
  min-width: 200px;
}

/* Form controls */
.drawer .lbl {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.drawer .lbl.small {
  font-size: 11px;
}

.drawer .control {
  height: 40px;
  border: 1px solid ${INK};
  border-radius: 10px;
  padding: 0 12px;
  outline: 0;
  background: #fff;
  font-size: 14px;
  width: 100%;
}

.drawer .control:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.drawer select.control {
  cursor: pointer;
}

/* Apply button */
.actions-wrap .btn {
  height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.actions-wrap .btn:hover {
  opacity: 0.9;
}

.actions-wrap .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ═══════════════════════════ TRACKING ROW ═══════════════════════════ */
.drawer .trk-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  background: #f8f8f8;
  border: 1px solid ${INK};
  border-radius: 10px;
  margin-top: 8px;
}

.drawer .trk-row .l1,
.drawer .trk-row .l2 {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  display: flex;
  align-items: center;
  min-width: 120px;
}

.drawer .trk-row .c1,
.drawer .trk-row .c2 {
  flex: 1;
  min-width: 180px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid ${INK};
  border-radius: 10px;
  background: #fff;
  outline: 0;
  font-size: 14px;
}

.drawer .trk-row .c1:focus,
.drawer .trk-row .c2:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.drawer .trk-row .c1.mono {
  font-family: "SF Mono", Monaco, Consolas, monospace;
}

.drawer .trk-row .c2.readonly {
  background: #f0f0f0;
  color: #666;
  cursor: not-allowed;
}

.drawer .trk-row .req {
  color: #d32f2f;
  margin-left: 2px;
}

.drawer .trk-row .pill {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  background: #e8f5e9;
  color: #2e7d32;
}

.drawer .trk-row .h1,
.drawer .trk-row .h2 {
  width: 100%;
  font-size: 11px;
  color: #888;
  margin-top: -4px;
}

/* ═══════════════════════════ SECTION BLOCKS (Items, Payments, etc.) ═══════════════════════════ */
.block {
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 12px;
}

.block h4 {
  margin: 0;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #fafafa;
  border-bottom: 1px solid ${INK};
  color: #555;
}

/* ═══════════════════════════ TABLES (Items, Payments) ═══════════════════════════ */
.block .table {
  display: block;
}

.block .thead,
.block .trow {
  display: grid;
  grid-template-columns: 1fr 60px 90px 100px;
  gap: 10px;
  padding: 12px 16px;
  align-items: center;
}

.block .thead {
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: #fafafa;
  border-bottom: 1px solid ${INK};
  color: #888;
}

.block .trow {
  border-bottom: 1px solid #eee;
  font-size: 14px;
}

.block .trow:last-child {
  border-bottom: none;
}

/* ═══════════════════════════ ORDER NOTES ═══════════════════════════ */
.ord-notes {
  padding: 16px;
  max-height: 150px;
  overflow-y: auto;
}

.ord-note-line {
  margin: 0 0 8px 0;
  padding-left: 16px;
  position: relative;
  line-height: 1.5;
  font-size: 14px;
  color: ${PRIMARY};
}

.ord-note-line::before {
  content: "•";
  position: absolute;
  left: 0;
  color: ${ACCENT};
  font-weight: bold;
}

/* ═══════════════════════════ TIMELINE NOTE INPUT ═══════════════════════════ */
.note {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid ${INK};
}

.note input {
  flex: 1;
  height: 36px;
  border: 1px solid ${INK};
  border-radius: 8px;
  padding: 0 12px;
  outline: none;
  background: #fff;
  font-size: 14px;
}

.note input:focus {
  border-color: ${ACCENT};
}

/* ═══════════════════════════ TIMELINE ═══════════════════════════ */
.timeline {
  list-style: none;
  margin: 0;
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.timeline li {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed #eee;
}

.timeline li:last-child {
  border-bottom: none;
}

.timeline .when {
  font-size: 12px;
  color: #888;
  min-width: 140px;
  flex-shrink: 0;
}

.timeline .what {
  font-size: 14px;
  color: ${PRIMARY};
  line-height: 1.4;
}

.timeline .what b {
  color: ${ACCENT};
}

/* ═══════════════════════════ PAD / MUTED helpers ═══════════════════════════ */
.drawer .pad {
  padding: 16px;
}

.drawer .muted {
  color: #888;
  font-size: 13px;
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 768px) {
  .drawer {
    width: 100%;
    max-width: 100vw;
  }

  .facts {
    grid-template-columns: 1fr;
  }

  .actions-wrap .bar {
    flex-direction: column;
    align-items: stretch;
  }

  .actions-wrap .bar .bar-cell {
    width: 100%;
  }

  .drawer .trk-row {
    flex-direction: column;
  }

  .drawer .trk-row .l1,
  .drawer .trk-row .l2 {
    width: 100%;
  }

  .drawer .trk-row .c1,
  .drawer .trk-row .c2 {
    width: 100%;
  }

  .timeline li {
    flex-direction: column;
    gap: 4px;
  }

  .timeline .when {
    min-width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer,
  .drawer-mask {
    animation: none !important;
  }
}
`;

