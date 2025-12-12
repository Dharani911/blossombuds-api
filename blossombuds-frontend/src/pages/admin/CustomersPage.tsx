import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  listCustomers,
  listCustomerAddresses,
  listOrdersByCustomer,
  type Customer,
  type Address,
  type OrderSummary,
} from "../../api/adminCustomers";
import { formatIstDateTime } from "../../utils/dates";

/* ═══════════════════════════ BRAND PALETTE ═══════════════════════════ */
const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const SUCCESS = "#2e7d32";
const INK = "rgba(0,0,0,.08)";

/* ═══════════════════════════ HELPERS ═══════════════════════════ */
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(id: number): string {
  const colors = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  ];
  return colors[id % colors.length];
}

function fmtMoney(n: number, ccy = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `₹${Number(n || 0).toFixed(2)}`;
  }
}

function downloadCsv(data: Customer[], filename: string) {
  const headers = ["ID", "Name", "Email", "Phone", "Status", "Created At"];
  const rows = data.map(c => [
    c.id,
    c.name || "",
    c.email || "",
    c.phone || "",
    c.active !== false ? "Active" : "Inactive",
    c.createdAt ? formatIstDateTime(c.createdAt as any) : ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════ TYPES ═══════════════════════════ */
type SortField = "id" | "name" | "email" | "createdAt";
type SortDir = "asc" | "desc";

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */
export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);

  // Filters
  const [showFilters, setShowFilters] = useState(false);

  // Drawer state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [ordLoading, setOrdLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"info" | "addresses" | "orders">("info");

  // Load customers
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setErr(null);
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

  // Lock page scroll when drawer is open
  useEffect(() => {
    if (detailOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [detailOpen]);

  // Filter + Sort + Paginate
  const { filtered, totalFiltered, pageData, totalPages, stats } = useMemo(() => {
    // Filter by search
    const k = q.trim().toLowerCase();
    let data = rows;
    if (k) {
      data = data.filter(r =>
        (r.name?.toLowerCase()?.includes(k)) ||
        (r.email?.toLowerCase()?.includes(k)) ||
        (r.phone?.toLowerCase()?.includes(k)) ||
        String(r.id).includes(k)
      );
    }

    // Sort
    const sorted = [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "id":
          cmp = a.id - b.id;
          break;
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "email":
          cmp = (a.email || "").localeCompare(b.email || "");
          break;
        case "createdAt":
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    // Stats
    const total = rows.length;
    const thisMonth = rows.filter(r => {
      if (!r.createdAt) return false;
      const d = new Date(r.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    // Paginate
    const start = page * pageSize;
    const pageData = sorted.slice(start, start + pageSize);
    const totalPages = Math.ceil(sorted.length / pageSize);

    return {
      filtered: sorted,
      totalFiltered: sorted.length,
      pageData,
      totalPages,
      stats: { total, thisMonth }
    };
  }, [rows, q, sortField, sortDir, page, pageSize]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [q, sortField, sortDir, pageSize]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  // Open detail + fetch addresses & orders
  async function openDetail(c: Customer) {
    setSelected(c);
    setDetailOpen(true);
    setDrawerTab("info");
    setAddresses([]);
    setOrders([]);
    setDetailErr(null);

    // Addresses
    setAddrLoading(true);
    try {
      const addr = await listCustomerAddresses(c.id);
      setAddresses(addr);
    } catch (e: any) {
      setDetailErr(e?.message || "Failed to load addresses.");
    } finally {
      setAddrLoading(false);
    }

    // Orders
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
      totalAmount: Number(raw?.grandTotal ?? raw?.total ?? raw?.amount ?? 0),
      currency: String(raw?.currency ?? "INR"),
      placedAt: raw?.createdDate ?? raw?.createdAt ?? raw?.created_at ?? null,
    };
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className={`sort-icon ${sortField === field ? "active" : ""}`}>
      {sortField === field ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  return (
    <div className="cust-wrap">
      <style>{css}</style>

      {/* ═══════════════════════════ HEADER ═══════════════════════════ */}
      <header className="hd">
        <div className="hd-left">
          <h2>
            Customers
            <span className="count-badge">{stats.total}</span>
          </h2>
          <p className="muted">Manage your customer base and view their details.</p>
        </div>
        <div className="hd-right">
          <button
            className="btn-icon"
            onClick={() => downloadCsv(filtered, `customers-${new Date().toISOString().slice(0, 10)}.csv`)}
            title="Export to CSV"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* ═══════════════════════════ STATS CARDS ═══════════════════════════ */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon total">👥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Customers</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon new">🌟</div>
          <div className="stat-info">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">New This Month</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════ TOOLBAR ═══════════════════════════ */}
      <div className="toolbar glass">
        <div className="toolbar-left">
          <div className="search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search by name, email, phone, or ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="clear-btn" onClick={() => setQ("")}>×</button>
            )}
          </div>
        </div>


        <div className="toolbar-right">
          <div className="page-size">
            <span>Show</span>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ←
            </button>
            <span className="page-info">
              {page + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              className="page-btn"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              →
            </button>
          </div>
        </div>
      </div>



      {/* ═══════════════════════════ TABLE ═══════════════════════════ */}
      <div className="card">
        <div className="table">
          <div className="thead">
            <div className="th sortable" onClick={() => handleSort("id")}>
              ID <SortIcon field="id" />
            </div>
            <div className="th sortable" onClick={() => handleSort("name")}>
              Customer <SortIcon field="name" />
            </div>
            <div className="th sortable" onClick={() => handleSort("email")}>
              Email <SortIcon field="email" />
            </div>
            <div className="th">Phone</div>
            <div className="th sortable" onClick={() => handleSort("createdAt")}>
              Joined <SortIcon field="createdAt" />
            </div>
            <div className="th">Actions</div>
          </div>

          {loading && (
            <div className="loading-row">
              <div className="spinner" />
              <span>Loading customers…</span>
            </div>
          )}

          {!loading && err && <div className="pad alert bad">{err}</div>}

          {!loading && !err && pageData.length === 0 && (
            <div className="empty">
              <div className="empty-icon">🧑‍🤝‍🧑</div>
              <div className="empty-title">
                {q ? "No matching customers" : "No customers yet"}
              </div>
              <div className="empty-sub">
                {q
                  ? "Try adjusting your search."
                  : "When customers sign up, they'll appear here."}
              </div>
            </div>
          )}

          {!loading && !err && pageData.map(c => (
            <div className="trow" key={c.id}>
              <div className="cell-id">#{c.id}</div>
              <div className="cell-customer">
                <div className="avatar" style={{ background: getAvatarColor(c.id) }}>
                  {getInitials(c.name)}
                </div>
                <span className="name">{c.name || "—"}</span>
              </div>
              <div className="cell-email" title={c.email || ""}>
                {c.email || <span className="muted">—</span>}
              </div>
              <div className="cell-phone">
                {c.phone || <span className="muted">—</span>}
              </div>
              <div className="cell-date">
                {c.createdAt ? formatIstDateTime(c.createdAt as any) : "—"}
              </div>
              <div className="cell-actions">
                <button className="action-btn view" onClick={() => openDetail(c)} title="View Details">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom pagination info */}
        {!loading && !err && pageData.length > 0 && (
          <div className="table-footer">
            <span className="showing">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalFiltered)} of {totalFiltered} customers
            </span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════ DRAWER ═══════════════════════════ */}
      {detailOpen && selected && (
        <div className="drawer-overlay" onClick={closeDetail}>
          <div className="drawer-panel animate-slide-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="drawer-header">
              <div className="drawer-avatar" style={{ background: getAvatarColor(selected.id) }}>
                {getInitials(selected.name)}
              </div>
              <div className="drawer-title">
                <h3>{selected.name || "Unknown Customer"}</h3>
                <span className="drawer-id">Customer #{selected.id}</span>
              </div>
              <button className="close-btn" onClick={closeDetail}>×</button>
            </div>

            {/* Tabs */}
            <div className="drawer-tabs">
              {(["info", "addresses", "orders"] as const).map(tab => (
                <button
                  key={tab}
                  className={`tab ${drawerTab === tab ? "active" : ""}`}
                  onClick={() => setDrawerTab(tab)}
                >
                  {tab === "info" ? "Info" : tab === "addresses" ? `Addresses (${addresses.length})` : `Orders (${orders.length})`}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="drawer-content">
              {detailErr && <div className="alert bad">{detailErr}</div>}

              {/* Info Tab */}
              {drawerTab === "info" && (
                <div className="info-tab">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Email</label>
                      <span>{selected.email || "—"}</span>
                    </div>
                    <div className="info-item">
                      <label>Phone</label>
                      <span>{selected.phone || "—"}</span>
                    </div>
                    <div className="info-item">
                      <label>Customer Since</label>
                      <span>{selected.createdAt ? formatIstDateTime(selected.createdAt as any) : "—"}</span>
                    </div>
                    <div className="info-item full">
                      <label>Total Orders</label>
                      <span className="big-stat">{orders.length}</span>
                    </div>
                    <div className="info-item full">
                      <label>Lifetime Value</label>
                      <span className="big-stat highlight">
                        {fmtMoney(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Addresses Tab */}
              {drawerTab === "addresses" && (
                <div className="addresses-tab">
                  {addrLoading && <div className="loading-inline"><div className="spinner" /> Loading…</div>}
                  {!addrLoading && addresses.length === 0 && (
                    <div className="empty-tab">No addresses found.</div>
                  )}
                  {!addrLoading && addresses.map(a => (
                    <div className="address-card" key={a.id}>
                      <div className="addr-header">
                        <span className="addr-name">{a.name || "—"}</span>
                        {a.isDefault && <span className="chip default">Default</span>}
                        {!a.active && <span className="chip inactive">Inactive</span>}
                      </div>
                      <div className="addr-body">
                        {[a.line1, a.line2, (a as any).districtName, (a as any).stateName, a.pincode, (a as any).countryName]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                      <div className="addr-phone">{a.phone || "—"}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Orders Tab */}
              {drawerTab === "orders" && (
                <div className="orders-tab">
                  {ordLoading && <div className="loading-inline"><div className="spinner" /> Loading…</div>}
                  {!ordLoading && orders.length === 0 && (
                    <div className="empty-tab">No orders found.</div>
                  )}
                  {!ordLoading && orders.length > 0 && (
                    <div className="orders-list">
                      {orders.map(o => (
                        <div className="order-card" key={o.id}>
                          <div className="order-header">
                            <span className="order-num">BB{o.orderNumber}</span>
                            <span className={`order-status ${(o.status || "ordered").toLowerCase()}`}>
                              {o.status || "Ordered"}
                            </span>
                          </div>
                          <div className="order-details">
                            <span className="order-total">{fmtMoney(o.totalAmount ?? 0, o.currency ?? "INR")}</span>
                            <span className="order-date">{o.placedAt ? formatIstDateTime(o.placedAt as any) : "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ STYLES ═══════════════════════════ */
const css = `
/* Base */
.cust-wrap {
  padding: 20px;
  color: ${PRIMARY};
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.hd-left h2 {
  margin: 0;
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 28px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-badge {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: white;
  font-size: 14px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 20px;
  font-family: system-ui, sans-serif;
}

.muted {
  opacity: 0.7;
  font-size: 13px;
  margin-top: 4px;
}

.hd-right {
  display: flex;
  gap: 10px;
}

.btn-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: white;
  color: ${PRIMARY};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: linear-gradient(135deg, #f8f8f8 0%, #fff 100%);
  border-color: ${ACCENT};
  color: ${ACCENT};
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(240, 93, 139, 0.15);
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border: 1px solid ${INK};
  border-radius: 16px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.stat-icon.total { background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%); }
.stat-icon.active { background: linear-gradient(135deg, #43e97b20 0%, #38f9d720 100%); }
.stat-icon.inactive { background: linear-gradient(135deg, #ff9a9e20 0%, #fad0c420 100%); }
.stat-icon.new { background: linear-gradient(135deg, #f6c32020 0%, #f093fb20 100%); }

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border: 1px solid ${INK};
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  opacity: 0.5;
  pointer-events: none;
}

.search-box input {
  height: 40px;
  border: 1px solid ${INK};
  border-radius: 10px;
  padding: 0 36px 0 38px;
  background: white;
  outline: none;
  min-width: 300px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search-box input:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240, 93, 139, 0.1);
}

.clear-btn {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: #eee;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: ${ACCENT};
  color: white;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;
}

.filter-btn:hover, .filter-btn.active {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
}

.filter-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: ${ACCENT};
  border-radius: 50%;
}

.page-size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.page-size select {
  height: 36px;
  border: 1px solid ${INK};
  border-radius: 8px;
  padding: 0 8px;
  background: white;
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  width: 36px;
  height: 36px;
  border: 1px solid ${INK};
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  font-weight: 600;
  min-width: 60px;
  text-align: center;
}

/* Filter Panel */
.filter-panel {
  background: white;
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}

.filter-group label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  display: block;
  margin-bottom: 8px;
}

.status-pills {
  display: flex;
  gap: 8px;
}

.status-pill {
  height: 34px;
  padding: 0 14px;
  border-radius: 17px;
  border: 1px solid ${INK};
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.status-pill:hover {
  border-color: ${PRIMARY};
}

.status-pill.selected {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
}

.clear-filters {
  margin-left: auto;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #888;
  transition: all 0.2s;
}

.clear-filters:hover {
  background: #f5f5f5;
  color: ${PRIMARY};
}

/* Table */
.card {
  border: 1px solid ${INK};
  border-radius: 16px;
  background: white;
  box-shadow: 0 8px 40px rgba(0,0,0,0.06);
  overflow: hidden;
}

.table {
  display: grid;
}

.thead {
  display: grid;
  grid-template-columns: 80px 1.8fr 2fr 1.2fr 1.4fr 80px;
  gap: 12px;
  align-items: center;
  padding: 14px 18px;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid ${INK};
  color: #666;
}

.th.sortable {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.2s;
}

.th.sortable:hover {
  color: ${ACCENT};
}

.sort-icon {
  font-size: 10px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.sort-icon.active {
  opacity: 1;
  color: ${ACCENT};
}

.trow {
  display: grid;
  grid-template-columns: 80px 1.8fr 2fr 1.2fr 1.4fr 80px;
  gap: 12px;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid ${INK};
  transition: all 0.2s ease;
}

.trow:last-child {
  border-bottom: none;
}

.trow:hover {
  background: linear-gradient(90deg, rgba(240,93,139,0.03) 0%, rgba(255,255,255,0) 100%);
}

.cell-id {
  font-family: "SF Mono", Monaco, monospace;
  font-size: 13px;
  color: #888;
}

.cell-customer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  flex-shrink: 0;
}

.cell-customer .name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-email {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.cell-phone {
  font-size: 13px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.status-badge.active {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: ${SUCCESS};
}

.status-badge.inactive {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
  color: #c2185b;
}

.cell-date {
  font-size: 13px;
  color: #666;
}

.cell-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${INK};
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: ${PRIMARY};
  color: white;
  border-color: ${PRIMARY};
  transform: scale(1.05);
}

/* Loading state */
.loading-row {
  padding: 40px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #888;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid ${INK};
  border-top-color: ${ACCENT};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.empty {
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  filter: grayscale(0.3);
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.empty-sub {
  opacity: 0.6;
  font-size: 14px;
}

.alert.bad {
  margin: 16px;
  padding: 14px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
  border: 1px solid rgba(240, 93, 139, 0.3);
  color: #c53030;
}

.table-footer {
  padding: 14px 18px;
  border-top: 1px solid ${INK};
  background: #fafafa;
}

.showing {
  font-size: 13px;
  color: #888;
}

/* Drawer */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: min(560px, 95vw);
  height: 100%;
  background: white;
  box-shadow: -10px 0 50px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.animate-slide-in {
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0.5; }
  to { transform: translateX(0); opacity: 1; }
}

.drawer-header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
}

.drawer-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.drawer-title {
  flex: 1;
}

.drawer-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.drawer-id {
  font-size: 13px;
  color: #888;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: white;
  cursor: pointer;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  transform: rotate(90deg);
}

.drawer-tabs {
  display: flex;
  border-bottom: 1px solid ${INK};
}

.tab {
  flex: 1;
  padding: 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  color: #888;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab:hover {
  color: ${PRIMARY};
  background: #fafafa;
}

.tab.active {
  color: ${ACCENT};
  border-bottom-color: ${ACCENT};
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Info Tab */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-item {
  background: #fafafa;
  border-radius: 12px;
  padding: 14px;
}

.info-item.full {
  grid-column: span 2;
}

.info-item label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 6px;
}

.info-item span {
  font-size: 15px;
  font-weight: 500;
}

.big-stat {
  font-size: 28px;
  font-weight: 700;
}

.big-stat.highlight {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Addresses Tab */
.address-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid ${INK};
  transition: all 0.2s;
}

.address-card:hover {
  border-color: ${ACCENT};
  box-shadow: 0 4px 12px rgba(240, 93, 139, 0.1);
}

.addr-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.addr-name {
  font-weight: 700;
}

.chip {
  height: 22px;
  padding: 0 10px;
  border-radius: 11px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
}

.chip.default {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: ${SUCCESS};
}

.chip.inactive {
  background: #eee;
  color: #888;
}

.addr-body {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 6px;
}

.addr-phone {
  font-size: 13px;
  color: #888;
}

/* Orders Tab */
.order-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid ${INK};
  transition: all 0.2s;
}

.order-card:hover {
  border-color: ${ACCENT};
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.order-num {
  font-weight: 700;
  font-family: "SF Mono", Monaco, monospace;
}

.order-status {
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
}

.order-status.ordered { background: #fff3cd; color: #856404; }
.order-status.dispatched { background: #cce5ff; color: #004085; }
.order-status.delivered { background: #d4edda; color: #155724; }
.order-status.cancelled { background: #f8d7da; color: #721c24; }
.order-status.refunded { background: #e2e3e5; color: #383d41; }

.order-details {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.order-total {
  font-weight: 600;
}

.order-date {
  color: #888;
}

.loading-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #888;
}

.empty-tab {
  text-align: center;
  padding: 40px;
  color: #888;
}

/* Animations */
.animate-slide {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* No scroll */
.no-scroll {
  overflow: hidden;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .thead, .trow {
    grid-template-columns: 60px 1.5fr 1.8fr 1fr 1.2fr 70px;
    font-size: 12px;
  }
  
  .search-box input {
    min-width: 200px;
  }
  
  .toolbar {
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .cust-wrap {
    padding: 12px;
  }
  
  .stats-row {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  
  .stat-card {
    padding: 14px;
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }
  
  .stat-value {
    font-size: 20px;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 12px;
  }
  
  .toolbar-left, .toolbar-right {
    width: 100%;
    justify-content: space-between;
  }
  
  .search-box {
    flex: 1;
  }
  
  .search-box input {
    width: 100%;
    min-width: auto;
  }
  
  .thead {
    display: none;
  }
  
  .trow {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
  }
  
  .cell-id {
    order: 1;
    width: auto;
  }
  
  .cell-customer {
    order: 2;
    flex: 1;
  }
  
  .cell-actions {
    order: 3;
  }
  
  .cell-email, .cell-phone {
    width: 50%;
    font-size: 12px;
  }
  
  .cell-status, .cell-date {
    width: 50%;
    font-size: 12px;
  }
  
  .filter-panel {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .clear-filters {
    margin-left: 0;
    margin-top: 12px;
  }
}
`;
