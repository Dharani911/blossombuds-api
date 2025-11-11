import React, { useEffect, useMemo, useState } from "react";
import {
  listCustomers,
  listCustomerAddresses,
  listOrdersByCustomer,
  type Customer,
  type Address,
  type OrderSummary,
} from "../../api/adminCustomers";

const PRIMARY = "#4A4F41";
const INK     = "rgba(0,0,0,.08)";

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [ordLoading, setOrdLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  // load customers
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await listCustomers();
        if (!live) return;
        setRows(data);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.message || "Failed to load customers.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // NEW: lock page scroll when drawer is open
  useEffect(() => {
    if (detailOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [detailOpen]);

  // filter
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(r =>
      (r.name?.toLowerCase()?.includes(k)) ||
      (r.email?.toLowerCase()?.includes(k)) ||
      (r.phone?.toLowerCase()?.includes(k)) ||
      String(r.id).includes(k)
    );
  }, [rows, q]);

  // open detail + fetch addresses & orders
  async function openDetail(c: Customer) {
    setSelected(c);
    setDetailOpen(true);
    setAddresses([]);
    setOrders([]);
    setDetailErr(null);

    // addresses
    setAddrLoading(true);
    try {
      const addr = await listCustomerAddresses(c.id);
      setAddresses(addr);
    } catch (e: any) {
      setDetailErr(e?.message || "Failed to load addresses.");
    } finally {
      setAddrLoading(false);
    }

    // orders
    setOrdLoading(true);
    try {
      const ords = await listOrdersByCustomer(c.id);
      setOrders(Array.isArray(ords) ? ords.map(normOrderSummary) : []);
    } catch (e: any) {
      setDetailErr(prev => prev ?? (e?.message || "Failed to load orders."));
    } finally {
      setOrdLoading(false);
    }
  }
  function fmtMoney(n: number, ccy = "INR") {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n || 0);
    } catch {
      return `₹${Number(n || 0).toFixed(2)}`;
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelected(null);
    setAddresses([]);
    setOrders([]);
    setDetailErr(null);
  }
  function normOrderSummary(raw: any): OrderSummary {
    return {
      id: Number(raw?.id ?? 0),
      orderNumber: String(raw?.publicCode ?? `#${raw?.id ?? ""}`),
      status: String(raw?.status ?? "ORDERED"),
      totalAmount: Number(
        raw?.grandTotal ?? raw?.total ?? raw?.amount ?? 0
      ),
      currency: String(raw?.currency ?? "INR"),
      placedAt: raw?.createdDate ?? raw?.createdAt ?? raw?.created_at ?? null,
    };
  }

  return (
    <div className="cust-wrap">
      <style>{css}</style>

      <header className="hd">
        <div>
          <h2>Customers</h2>
          <p className="muted">View registered customers and their details.</p>
        </div>
        <div className="right">
          <div className="search">
            <input
              placeholder="Search by name / email / phone / id…"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="card">
        <div className="table">
          <div className="thead">
            <div>ID</div>
            <div>Name</div>
            <div>Email</div>
            <div>Phone</div>
            <div>Created</div>
            <div>Actions</div>
          </div>

        {loading && <div className="pad">Loading…</div>}
        {!loading && err && <div className="pad alert bad">{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div className="empty">
            <div className="emoji">🧑‍🤝‍🧑</div>
            <div className="ttl">No customers yet</div>
            <div className="sub">When customers sign up, they’ll appear here.</div>
          </div>
        )}

        {!loading && !err && filtered.map(c => (
          <div className="trow" key={c.id}>
            <div>#{c.id}</div>
            <div className="cell-name">{c.name || "—"}</div>
            <div className="cell-email" title={c.email || ""}>{c.email || "—"}</div>
            <div className="cell-phone">{c.phone || "—"}</div>
            <div>{c.createdAt ? new Date(c.createdAt).toLocaleString() : "—"}</div>
            <div className="cell-actions">
              <button className="ghost sm" onClick={() => openDetail(c)}>View</button>
            </div>
          </div>

        ))}
        </div>
      </div>

      {/* detail drawer */}
      {detailOpen && (
        <div className="drawer">
          <div className="drawer-panel">
            <div className="drawer-hd">
              <div>
                <div className="ttl">Customer #{selected?.id}</div>
                <div className="muted">{selected?.name || "—"} · {selected?.email || "—"} · {selected?.phone || "—"}</div>
              </div>
              <button className="ghost" onClick={closeDetail}>Close</button>
            </div>

            {/* NEW: scrollable content area */}
            <div className="drawer-content">
              {detailErr && <div className="pad alert bad">{detailErr}</div>}

              <section className="sec">
                <div className="sec-ttl">Addresses</div>
                {addrLoading && <div className="pad">Loading addresses…</div>}
                {!addrLoading && addresses.length === 0 && (
                  <div className="muted pad">No addresses found.</div>
                )}
                {!addrLoading && addresses.length > 0 && (
                  <div className="addr-list">
                    {addresses.map(a => (
                      <div className="addr" key={a.id}>
                        <div className="row1">
                          <span className="name">{a.name || "—"}</span>
                          {a.isDefault ? <span className="chip">Default</span> : null}
                          {!a.active ? <span className="chip off">Inactive</span> : null}
                        </div>
                        <div className="row2">
                          {[a.line1, a.line2, (a as any).districtName, (a as any).stateName, a.pincode, (a as any).countryName]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </div>
                        <div className="row3 muted">{a.phone || "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="sec">
                <div className="sec-ttl">Recent Orders</div>
                {ordLoading && <div className="pad">Loading orders…</div>}
                {!ordLoading && orders.length === 0 && (
                  <div className="muted pad">No orders found.</div>
                )}
                {!ordLoading && orders.length > 0 && (
                  <div className="orders">
                    <div className="orders-head">
                      <div>Order #</div>
                      <div>Status</div>
                      <div>Total</div>
                      <div>Placed</div>
                    </div>
                    {orders.map(o => (
                      <div className="orders-row" key={o.id}>
                        <div>BB{o.orderNumber}</div>
                        <div>{o.status || "—"}</div>
                        <div>{fmtMoney(o.totalAmount ?? 0, o.currency ?? "INR")}</div>
                        <div>{o.placedAt ? new Date(o.placedAt).toLocaleString() : "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
          <div className="drawer-backdrop" onClick={closeDetail} />
        </div>
      )}
    </div>
  );
}

const css = `
.cust-wrap{ padding:12px; color:${PRIMARY}; }
.hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; }
.hd h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.muted{ opacity:.75; font-size:12px; }
.right{ display:flex; align-items:center; gap:10px; }
.search input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 12px; background:#fff; outline:none; min-width:280px;
}
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }
.table{ display:grid; }
.thead, .trow{
  display:grid; grid-template-columns: 90px 1.6fr 2fr 1.3fr 1.6fr 120px;
  gap:10px; align-items:center; padding:10px 12px;
}

.thead{ font-weight:900; font-size:12px; background:linear-gradient(180deg, rgba(0,0,0,.03), rgba(255,255,255,.95)); border-bottom:1px solid ${INK}; }
.trow{ border-bottom:1px solid ${INK}; }
.trow:last-child{ border-bottom:none; }
.cell-name, .cell-email{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cell-actions{ display:flex; gap:6px; }
.ghost{
  height:32px; padding:0 10px; border-radius:10px; border:1px solid ${INK}; background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.sm{ height:28px; padding: 0 10px; border-radius:8px; font-size:12.5px; }

.pad{ padding:14px; }
.alert.bad{
  margin:10px; padding:10px 12px; border-radius:12px; background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039;
}

.empty{ padding:28px; text-align:center; }
.empty .emoji{ font-size:28px; margin-bottom:6px; }
.empty .ttl{ font-weight:900; }
.empty .sub{ opacity:.7; font-size:12px; }

/* Prevent background page scroll when drawer is open */
.no-scroll { overflow: hidden; }

/* Drawer */
.drawer{ position:fixed; inset:0; z-index:120; display:flex; justify-content:flex-end; }

/* Lighter dim; change .12 → 0 for no dim */
.drawer-backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.12); }

.drawer-panel{
  position:relative; width:min(680px, 92vw); height:100%;
  background:#fff; border-left:1px solid ${INK};
  box-shadow: -8px 0 36px rgba(0,0,0,.18);
  display:flex; flex-direction:column;
  animation: slideIn .18s ease both;
}
@keyframes slideIn{ from{ transform:translateX(12px); opacity:.6 } to{ transform:none; opacity:1 } }

/* Keep header visible while scrolling content */
.drawer-hd{
  position:sticky; top:0; z-index:1; background:#fff;
  display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-bottom:1px solid ${INK};
}
.drawer-hd .ttl{ font-weight:900; font-size:16px; }

/* NEW: scrollable content area inside drawer */
.drawer-content{
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  padding-bottom:12px;
}

.sec{ padding:12px; }
.sec-ttl{ font-weight:900; margin-bottom:8px; }

.addr-list{ display:grid; gap:10px; }
.addr{
  border:1px solid ${INK}; border-radius:12px; padding:10px 12px; background:#fff;
}
.addr .row1{ display:flex; align-items:center; gap:8px; font-weight:900; }
.addr .row2{ margin-top:2px; }
.addr .row3{ margin-top:2px; }
.chip{
  height:20px; padding:0 8px; border-radius:999px; background:#e8f5e9; color:#2e7d32; font-size:11px; font-weight:900; display:inline-flex; align-items:center;
}
.chip.off{ background:#eee; color:#666; }

/* Orders table in drawer */
.orders{ border:1px solid ${INK}; border-radius:12px; overflow:hidden; }
.orders-head, .orders-row{
  display:grid; grid-template-columns: 1.2fr 1fr 1fr 1.4fr; gap:10px; padding:10px 12px; align-items:center;
}
.orders-head{ font-weight:900; font-size:12px; background:linear-gradient(180deg, rgba(0,0,0,.03), rgba(255,255,255,.95)); border-bottom:1px solid ${INK}; }
.orders-row{ border-bottom:1px solid ${INK}; }
.orders-row:last-child{ border-bottom:none; }

/* Prevent long lines from breaking layout */
.addr .row2, .orders-row > div { word-break: break-word; }

@media (max-width: 1100px){
  .thead, .trow{ grid-template-columns: 70px 1.3fr 1.8fr 1.2fr 1.4fr 110px; }
}
@media (max-width: 820px){
  .thead, .trow{ grid-template-columns: 60px 1.2fr 1.6fr 1fr 1.2fr 100px; }
  .search input{ min-width: 200px; }
}
/* make the panel the top layer; keep backdrop behind it */
.drawer-panel{
  position: relative;
  z-index: 2;            /* ↑ above backdrop */
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.drawer-backdrop{
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.12); /* your dim level */
  z-index: 1;                  /* ↓ below panel */
}

/* the only scrollable area inside the panel */
.drawer-content{
  flex: 1 1 auto;
  min-height: 0;               /* critical for flex children */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

`;
