import React, { useEffect, useMemo, useState } from "react";
import http from "../../api/adminHttp";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

/* ---------------------------------------------------------------------------
   TYPES
--------------------------------------------------------------------------- */
type Section = {
  total: number; daily: number; weekly: number; monthly: number; yearly: number;
  prevDaily?: number; prevWeekly?: number; prevMonthly?: number; prevYearly?: number;
};

type Shipping = {
  total: number; daily: number; weekly: number; monthly: number; yearly: number;
  prevDaily?: number; prevWeekly?: number; prevMonthly?: number; prevYearly?: number;
  max: number;
};

type Products = { total: number };
type Customers = {
  total: number;
  daily: number; weekly: number; monthly: number; yearly: number;
  prevDaily?: number; prevWeekly?: number; prevMonthly?: number; prevYearly?: number;
  max: number;
};

type MetricsSummary = {
  orders: Section;
  revenue: Section;
  shipping: Shipping;
  products: Products;
  customers: Customers;
};

type TrendPoint = { label: string; orders: number; revenue: number };
type LabeledValue = { label: string; value: number };
type RangeKey = "daily" | "weekly" | "monthly" | "yearly";

/* ---------------------------------------------------------------------------
   THEME CONSTANTS (STRICT BRAND)
--------------------------------------------------------------------------- */
const BRAND = {
  bg: "#FAF7E7",
  text: "#4A4F41",
  textLight: "#8B9185",
  card: "#FFFFFF",
  accent: "#F05D8B",
  gold: "#F6C320",
  goldLight: "#FFF5D6",
  pinkLight: "#FFEBF2",
  green: "#9BB472",
  border: "rgba(74, 79, 65, 0.08)",
  shadow: "0 10px 40px -10px rgba(74, 79, 65, 0.08)",
  shadowHover: "0 16px 48px -12px rgba(74, 79, 65, 0.15)",
};

const PIE_COLORS = [BRAND.accent, BRAND.gold, BRAND.green, "#7AA2E3", "#C084FC", "#FF9F6E"];

/* ---------------------------------------------------------------------------
   UTILS
--------------------------------------------------------------------------- */
const fmtNum = (n: number) => new Intl.NumberFormat("en-IN").format(n ?? 0);
const fmtMoney = (n: number) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n ?? 0);

const getLabel = (r: RangeKey) => {
  switch (r) {
    case "daily": return "Today";
    case "weekly": return "This Week";
    case "monthly": return "This Month";
    case "yearly": return "This Year";
    default: return r;
  }
};
const fmtIstDateTime = (d: Date) => {
  // "11 Jan 2026, 16:32 IST" style
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmt.format(d)} IST`;
};


type RangeSection = {
  total: number;
  daily: number; weekly: number; monthly: number; yearly: number;
  prevDaily?: number; prevWeekly?: number; prevMonthly?: number; prevYearly?: number;
};

const pick = (s: RangeSection | null | undefined, r: RangeKey) => Number(s?.[r] ?? 0);
const pickPrev = (s: RangeSection | null | undefined, r: RangeKey) => {
  const key = ("prev" + r.charAt(0).toUpperCase() + r.slice(1)) as keyof RangeSection;
  return Number(s?.[key] ?? 0);
};

const calcGrowth = (curr: number, prev: number) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

/* ---------------------------------------------------------------------------
   MAIN COMPONENT (PROGRESSIVE LOADING)
--------------------------------------------------------------------------- */
export default function AdminDashboardPage() {
  const [range, setRange] = useState<RangeKey>("monthly");

  // global manual refresh
  const [tick, setTick] = useState(0);

  // KPI / Summary state (loads FIRST)
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiErr, setKpiErr] = useState<string | null>(null);

  // Trend (range-based)
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendErr, setTrendErr] = useState<string | null>(null);

  // Top lists (range-based)
  const [topProducts, setTopProducts] = useState<LabeledValue[]>([]);
  const [topCategories, setTopCategories] = useState<LabeledValue[]>([]);
  const [topsLoading, setTopsLoading] = useState(true);
  const [topsErr, setTopsErr] = useState<string | null>(null);

  // 12m charts (load once, independent)
  const [ship12m, setShip12m] = useState<LabeledValue[]>([]);
  const [cust12m, setCust12m] = useState<LabeledValue[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseErr, setBaseErr] = useState<string | null>(null);
const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

const markUpdated = () => setLastUpdatedAt(new Date());

  /* ---------------- KPI FIRST: Summary loads quickly ---------------- */
  useEffect(() => {
    let alive = true;
    setKpiLoading(true);
    setKpiErr(null);

    http.get<MetricsSummary>("/api/admin/metrics/summary")
      .then(res => {
        if (!alive) return;
        setSummary(res.data);
        markUpdated();
      })
      .catch((e) => {
        if (!alive) return;
        setKpiErr(e?.response?.data?.message || "Failed to load KPI summary.");
      })
      .finally(() => {
        if (!alive) return;
        setKpiLoading(false);
      });

    return () => { alive = false; };
  }, [tick]);

  /* ---------------- RANGE-BASED: Trend loads independent ---------------- */
  useEffect(() => {
    let alive = true;
    setTrendLoading(true);
    setTrendErr(null);

    http.get<TrendPoint[]>(`/api/admin/metrics/trend?range=${range}`)
      .then(res => {
        if (!alive) return;
        setTrend(res.data || []);
      })
      .catch((e) => {
        if (!alive) return;
        setTrendErr(e?.response?.data?.message || "Failed to load trend.");
        setTrend([]);
      })
      .finally(() => {
        if (!alive) return;
        setTrendLoading(false);
      });

    return () => { alive = false; };
  }, [range, tick]);

  /* ---------------- RANGE-BASED: Tops load independent ---------------- */
  useEffect(() => {
    let alive = true;
    setTopsLoading(true);
    setTopsErr(null);

    // Fire both calls, but update UI as each completes (no Promise.all blocking)
    const p1 = http.get<LabeledValue[]>(`/api/admin/metrics/top-products?range=${range}&limit=5`)
      .then(res => {
        if (!alive) return;
        setTopProducts(res.data || []);
      });

    const p2 = http.get<LabeledValue[]>(`/api/admin/metrics/top-categories?range=${range}&limit=5`)
      .then(res => {
        if (!alive) return;
        setTopCategories(res.data || []);
      });

    Promise.allSettled([p1, p2])
      .catch(() => { /* ignore */ })
      .finally(() => {
        if (!alive) return;
        // If either failed, we still show what we got
        setTopsLoading(false);
      });

    // Track errors individually
    p1.catch((e) => {
      if (!alive) return;
      setTopsErr(e?.response?.data?.message || "Some top lists failed to load.");
      setTopProducts([]);
    });
    p2.catch((e) => {
      if (!alive) return;
      setTopsErr(e?.response?.data?.message || "Some top lists failed to load.");
      setTopCategories([]);
    });

    return () => { alive = false; };
  }, [range, tick]);

  /* ---------------- 12M BASE: loads once (or on refresh) ---------------- */
  useEffect(() => {
    let alive = true;
    setBaseLoading(true);
    setBaseErr(null);

    const s1 = http.get<LabeledValue[]>("/api/admin/metrics/shipping/12m")
      .then(res => {
        if (!alive) return;
        setShip12m(res.data || []);
      });

    const s2 = http.get<LabeledValue[]>("/api/admin/metrics/customers/12m")
      .then(res => {
        if (!alive) return;
        setCust12m(res.data || []);
      });

    Promise.allSettled([s1, s2])
      .catch(() => { /* ignore */ })
      .finally(() => {
        if (!alive) return;
        setBaseLoading(false);
      });

    s1.catch((e) => {
      if (!alive) return;
      setBaseErr(e?.response?.data?.message || "Failed to load base charts.");
      setShip12m([]);
    });
    s2.catch((e) => {
      if (!alive) return;
      setBaseErr(e?.response?.data?.message || "Failed to load base charts.");
      setCust12m([]);
    });

    return () => { alive = false; };
  }, [tick]);

  const metrics = useMemo(() => {
    if (!summary) return null;

    const rev = pick(summary.revenue, range);
    const revPrev = pickPrev(summary.revenue, range);

    const ord = pick(summary.orders, range);
    const ordPrev = pickPrev(summary.orders, range);

    const cust = pick(summary.customers, range);
    const custPrev = pickPrev(summary.customers, range);

    const aov = ord > 0 ? rev / ord : 0;

    return {
      revenue: { val: rev, growth: calcGrowth(rev, revPrev), total: summary.revenue.total },
      orders: { val: ord, growth: calcGrowth(ord, ordPrev), total: summary.orders.total },
      customers: { val: cust, growth: calcGrowth(cust, custPrev), total: summary.customers.total },
      shipping: { val: pick(summary.shipping, range) },
      products: summary.products.total,
    };
  }, [summary, range]);

  const categoryTotal = useMemo(() => {
    return (topCategories || []).reduce((a, x) => a + (x.value || 0), 0);
  }, [topCategories]);

  return (
    <div className="analytics-page">
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="page-header">
        <div className="header-content">
          <div className="titles">
            <h1>Dashboard</h1>
            <p>Overview & Performance Insights</p>
          </div>


          <div className="actions">
            <div className="range-toggle">
              {(["daily", "weekly", "monthly", "yearly"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`toggle-btn ${range === r ? "active" : ""}`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <button className="refresh-btn" onClick={() => setTick(t => t + 1)} title="Refresh everything">
              ↻
            </button>
            <div className="updated-at">
                        {lastUpdatedAt ? (
                          <>Last updated: <b>{fmtIstDateTime(lastUpdatedAt)}</b></>
                        ) : (
                          <>Last updated: <span className="muted">—</span></>
                        )}
                      </div>
          </div>


        </div>
      </header>

      <main className="main-grid">
        {/* KPI ROW (FAST) */}
        <section className="kpi-row">
          {kpiLoading || !summary || !metrics ? (
            <>
              <div className="card sk-kpi" />
              <div className="card sk-kpi" />
              <div className="card sk-kpi" />
              <div className="card sk-kpi" />
            </>
          ) : (
            <>
              <KpiCard
                title="Total Revenue"
                rangeLabel={getLabel(range)}
                value={fmtMoney(metrics.revenue.val)}
                growth={metrics.revenue.growth}
                footer={`Lifetime: ${fmtMoney(metrics.revenue.total)}`}
                accent={BRAND.gold}
                icon="💰"
              />
              <KpiCard
                title="Total Orders"
                rangeLabel={getLabel(range)}
                value={fmtNum(metrics.orders.val)}
                growth={metrics.orders.growth}
                footer={`Lifetime: ${fmtNum(metrics.orders.total)}`}
                accent={BRAND.accent}
                icon="🛍️"
              />
              <KpiCard
                title="New Customers"
                rangeLabel={getLabel(range)}
                value={fmtNum(metrics.customers.val)}
                growth={metrics.customers.growth}
                footer={`Total Base: ${fmtNum(metrics.customers.total)}`}
                accent={BRAND.green}
                icon="👥"
              />
              <KpiCard
                title="Total Products"
                rangeLabel="Catalog Size"
                value={fmtNum(metrics.products)}
                footer="Active products in store"
                accent="#7AA2E3"
                icon="🪷"
              />
            </>
          )}
        </section>

        {kpiErr && (
          <div className="card soft-alert">
            <div className="soft-alert-row">
              <span>⚠️ {kpiErr}</span>
              <button className="mini-btn" onClick={() => setTick(t => t + 1)}>Retry</button>
            </div>
          </div>
        )}

        {/* CHARTS ROW 1: Trend + Category Mix (independent loaders) */}
        <section className="charts-row">
          <div className="card chart-box trend-box">
            <div className="card-head">
              <div className="card-icon" style={{ background: BRAND.goldLight }}>📈</div>
              <div>
                <h3>Market Trend</h3>
                <span>Revenue vs Orders over time</span>
              </div>
            </div>

            <div className="chart-canvas">
              {trendLoading ? (
                <div className="sk-chart" />
              ) : trendErr ? (
                <InlineError msg={trendErr} onRetry={() => setTick(t => t + 1)} />
              ) : trend.length === 0 ? (
                <div className="empty-msg">No trend data for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={trend} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND.gold} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={BRAND.gold} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOrd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND.accent} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={BRAND.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BRAND.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: BRAND.textLight }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis
                      yAxisId="L"
                      tick={{ fontSize: 11, fill: BRAND.textLight }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`}
                    />
                    <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 11, fill: BRAND.textLight }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                    <Area isAnimationActive={false} yAxisId="L" type="monotone" dataKey="revenue" stroke={BRAND.gold} strokeWidth={3} fill="url(#gradRev)" name="Revenue" />
                    <Area isAnimationActive={false} yAxisId="R" type="monotone" dataKey="orders" stroke={BRAND.accent} strokeWidth={3} fill="url(#gradOrd)" name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card chart-box pie-box">
            <div className="card-head">
              <div className="card-icon" style={{ background: BRAND.pinkLight }}>🌸</div>
              <div>
                <h3>Category Mix</h3>
                <span>Top performing collections</span>
              </div>
            </div>

            <div className="chart-canvas flex-center">
              {topsLoading ? (
                <div className="sk-chart small" />
              ) : topsErr ? (
                <InlineError msg={topsErr} onRetry={() => setTick(t => t + 1)} />
              ) : topCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={topCategories}
                      dataKey="value"
                      nameKey="label"         // ✅ FIX: Use label as category name
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      isAnimationActive={false}
                    >
                      {topCategories.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip total={categoryTotal} />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", marginTop: "10px" }}
                      formatter={(name: any) => <span style={{ color: BRAND.text }}>{name}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-msg">No sales data yet</div>
              )}
            </div>
          </div>
        </section>

        {/* CHARTS ROW 2: Shipping & Customers 12M (independent) */}
        <section className="charts-row">
          <div className="card chart-box">
            <div className="card-head">
              <div className="card-icon" style={{ background: "#E0F2F1" }}>🚚</div>
              <div>
                <h3>Shipping Costs</h3>
                <span>Last 12 Month Analysis</span>
              </div>
            </div>

            <div className="chart-canvas">
              {baseLoading ? (
                <div className="sk-chart" />
              ) : baseErr ? (
                <InlineError msg={baseErr} onRetry={() => setTick(t => t + 1)} />
              ) : ship12m.length === 0 ? (
                <div className="empty-msg">No shipping data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ship12m} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BRAND.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: BRAND.textLight }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis
                      tick={{ fontSize: 11, fill: BRAND.textLight }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                    <Bar isAnimationActive={false} dataKey="value" name="Shipping" fill={BRAND.green} radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card chart-box">
            <div className="card-head">
              <div className="card-icon" style={{ background: "#F3E5F5" }}>👥</div>
              <div>
                <h3>Customer Growth</h3>
                <span>New signups (Last 12M)</span>
              </div>
            </div>

            <div className="chart-canvas">
              {baseLoading ? (
                <div className="sk-chart" />
              ) : baseErr ? (
                <InlineError msg={baseErr} onRetry={() => setTick(t => t + 1)} />
              ) : cust12m.length === 0 ? (
                <div className="empty-msg">No customer data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={cust12m} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BRAND.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: BRAND.textLight }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: BRAND.textLight }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                    <Bar isAnimationActive={false} dataKey="value" name="New Customers" fill={BRAND.accent} radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* LISTS ROW: independent */}
        <section className="lists-row">
          <div className="card list-box">
            <div className="card-head between">
              <h3>Top Products</h3>
              <Link to="/admin/products" className="link-btn">View Catalog →</Link>
            </div>

            <div className="list-content">
              {topsLoading ? (
                <>
                  <div className="sk-line" />
                  <div className="sk-line" />
                  <div className="sk-line" />
                </>
              ) : topProducts.length > 0 ? (
                topProducts.map((p, i) => (
                  <div className="list-item" key={i}>
                    <div className={`rank r-${i + 1}`}>{i + 1}</div>
                    <div className="item-details">
                      <span className="name">{p.label}</span>
                      <span className="qty">{fmtNum(p.value)} units sold</span>
                    </div>

                    <div className="bar-visual" aria-hidden="true">
                      <div
                        className="fill"
                        style={{ width: `${Math.min((p.value / (topProducts[0]?.value || 1)) * 100, 100)}%` }}
                      />
                    </div>

                  </div>
                ))
              ) : (
                <div className="empty-msg">No products sold in this period</div>
              )}
            </div>
          </div>

          <div className="card insights-box">
            <div className="card-head">
              <div className="card-icon" style={{ background: "#E0F2F1" }}>💡</div>
              <h3>Smart Insights</h3>
            </div>

            <div className="insights-list">
              {!metrics ? (
                <>
                  <div className="sk-line" />
                  <div className="sk-line" />
                  <div className="sk-line" />
                </>
              ) : (
                <>
                  <InsightRow
                    icon="📈"
                    title="Performance"
                    text={metrics.revenue.growth >= 0
                      ? `Revenue is up ${metrics.revenue.growth.toFixed(1)}% compared to last period.`
                      : `Revenue dipped by ${Math.abs(metrics.revenue.growth).toFixed(1)}%. Consider a promotion to boost sales.`
                    }
                  />
                  <InsightRow
                    icon="🚚"
                    title="Logistics"
                    text={`Shipping spend in this period: ${fmtMoney(metrics.shipping.val)}.`}
                  />
                  <InsightRow
                    icon="✨"
                    title="Catalog"
                    text={`You have ${metrics.products} active products. Keep inventory fresh & featured products updated!`}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SUB-COMPONENTS
--------------------------------------------------------------------------- */
function KpiCard({ title, rangeLabel, value, growth, footer, accent, icon }: any) {
  const isPos = growth >= 0;
  return (
    <div className="card kpi-card">
      <div className="kpi-top">
        <div className="kpi-title">
          <span className="icon-badge" style={{ color: accent, background: accent + "15" }}>{icon}</span>
          <span className="lbl">{title}</span>
        </div>
        {growth !== undefined && (
          <div className={`growth-pill ${isPos ? "pos" : "neg"}`}>
            {isPos ? "↑" : "↓"} {Math.abs(growth).toFixed(0)}%
          </div>
        )}
      </div>
      <div className="kpi-main">
        <div className="val" style={{ color: BRAND.text }}>{value}</div>
        <div className="sub">{rangeLabel}</div>
      </div>
      <div className="kpi-foot">
        {footer}
      </div>
    </div>
  );
}

function InsightRow({ icon, title, text }: any) {
  return (
    <div className="insight-row">
      <div className="i-icon">{icon}</div>
      <div className="i-body">
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function InlineError({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="inline-err">
      <span>⚠️ {msg}</span>
      <button className="mini-btn" onClick={onRetry}>Retry</button>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-tooltip">
        <div className="tt-head">{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} className="tt-row">
            <span className="dot" style={{ background: p.stroke || p.fill }} />
            <span className="nm">{p.name}:</span>
            <span className="vl">
              {p.name === "Revenue" || p.name === "Shipping" ? fmtMoney(p.value) : fmtNum(p.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload, total }: any) => {
  if (active && payload?.[0]) {
    const d = payload[0];
    const label = d?.name ?? d?.payload?.label ?? "Category";
    const color = d?.fill ?? d?.payload?.fill ?? d?.color;
    const val = Number(d?.value ?? 0);
    const share = total ? Math.round((val / total) * 100) : 0;

    return (
      <div className="glass-tooltip">
        <div className="tt-row">
          <span className="dot" style={{ background: color }} />
          <span className="nm">{label}</span>
        </div>
        <div className="tt-big">{fmtNum(val)}</div>
        <div className="tt-sub">{share}% share</div>
      </div>
    );
  }
  return null;
};

/* ---------------------------------------------------------------------------
   STYLES (CSS-IN-JS)
--------------------------------------------------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;800&display=swap');

:root { --anim: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

.analytics-page {
  min-height: 100vh;
  background-color: ${BRAND.bg};
  color: ${BRAND.text};
  font-family: 'Outfit', sans-serif;
  padding: 32px;
}

/* HEADER */
.page-header { margin-bottom: 28px; }
.header-content {
  display: flex; justify-content: space-between; align-items: flex-end;
  flex-wrap: wrap; gap: 20px;
}
.titles h1 {
  font-size: 36px; font-weight: 800; margin: 0;
  background: linear-gradient(135deg, ${BRAND.text} 0%, #686e5c 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}
.titles p { margin: 4px 0 0; color: ${BRAND.textLight}; font-size: 15px; }

/* CONTROLS */
.actions { display: flex; align-items: center; gap: 16px; }
.range-toggle {
  background: white; padding: 5px; border-radius: 50px; display: flex;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  border: 1px solid ${BRAND.border};
}
.toggle-btn {
  background: transparent; border: none; padding: 8px 20px;
  font-family: 'Outfit', sans-serif;
  font-size: 13px; font-weight: 600; color: ${BRAND.textLight};
  cursor: pointer; transition: all 0.2s; border-radius: 40px;
}
.toggle-btn:hover { color: ${BRAND.text}; }
.toggle-btn.active {
  background: ${BRAND.text}; color: #fff;
  box-shadow: 0 4px 12px rgba(74,79,65,0.3);
}
.refresh-btn {
  width: 42px; height: 42px; border-radius: 50%;
  border: 1px solid ${BRAND.border}; background: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: ${BRAND.textLight};
  transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.03);
}
.refresh-btn:hover { color: ${BRAND.text}; transform: rotate(180deg); border-color: ${BRAND.text}; }

/* GRID LAYOUTS */
.main-grid { display: flex; flex-direction: column; gap: 24px; }
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}
.charts-row { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
.lists-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }

@media (max-width: 1100px) {
  .charts-row, .lists-row { grid-template-columns: 1fr; }
}

/* CARDS COMMON */
.card {
  background: ${BRAND.card};
  border-radius: 24px;
  border: 1px solid ${BRAND.border};
  box-shadow: ${BRAND.shadow};
  transition: var(--anim);
  padding: 24px;
  position: relative;
  overflow: hidden;
}
.card:hover { transform: translateY(-4px); box-shadow: ${BRAND.shadowHover}; }

/* KPI CARDS */
.kpi-card { display: flex; flex-direction: column; justify-content: space-between; min-height: 180px; }
.kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
.kpi-title { display: flex; align-items: center; gap: 10px; }
.icon-badge {
  width: 48px; height: 48px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.lbl {
  font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;
  font-weight: 700; color: ${BRAND.textLight};
}
.growth-pill { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
.growth-pill.pos { background: #E6F4EA; color: #1E8E3E; }
.growth-pill.neg { background: #FCE8E6; color: #D93025; }
.kpi-main { margin-top: 16px; }
.kpi-main .val { font-size: 32px; font-weight: 800; line-height: 1.1; letter-spacing: -1px; }
.kpi-main .sub { font-size: 13px; color: ${BRAND.gold}; font-weight: 600; margin-top: 4px; }
.kpi-foot {
  margin-top: auto;
  padding-top: 16px;
  font-size: 12px;
  color: ${BRAND.textLight};
  font-weight: 500;
  border-top: 1px solid ${BRAND.border};
}

/* CHART BOXES */
.chart-box { min-height: 360px; display: flex; flex-direction: column; }
.card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.card-head.between { justify-content: space-between; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.card-head h3 { margin: 0; font-size: 18px; font-weight: 700; }
.card-head span { font-size: 13px; color: ${BRAND.textLight}; }
.chart-canvas { flex: 1; }
.chart-canvas.flex-center { display: flex; align-items: center; justify-content: center; }

/* LISTS */
.link-btn { font-size: 13px; font-weight: 700; color: ${BRAND.accent}; text-decoration: none; transition: opacity 0.2s; }
.link-btn:hover { opacity: 0.7; }
.list-content { display: flex; flex-direction: column; gap: 16px; }
.list-item { display: flex; align-items: center; gap: 14px; position: relative; }
.rank {
  width: 28px; height: 28px; border-radius: 8px;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  background: ${BRAND.bg}; color: ${BRAND.textLight};
}
.rank.r-1 { background: ${BRAND.gold}; color: white; box-shadow: 0 4px 10px ${BRAND.gold}66; }
.rank.r-2 { background: ${BRAND.textLight}; color: white; }
.rank.r-3 { background: ${BRAND.border}; color: ${BRAND.text}; }

.item-details { flex: 1; z-index: 1; }
.item-details .name { display: block; font-weight: 600; font-size: 14px; margin-bottom: 2px; }
.item-details .qty { display: block; font-size: 12px; color: ${BRAND.textLight}; }

.bar-visual {
  position: absolute;
  bottom: 0; left: 42px; right: 0;
  height: 3px;
  background: ${BRAND.bg};
  border-radius: 2px;
  overflow: hidden;
}
.bar-visual .fill { background: ${BRAND.accent}; height: 100%; border-radius: 2px; }

/* INSIGHTS */
.insights-list { display: flex; flex-direction: column; gap: 16px; }
.insight-row {
  display: flex; gap: 14px; padding: 16px;
  background: ${BRAND.bg};
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.02);
}
.i-icon { font-size: 20px; line-height: 1; margin-top: 2px; }
.i-body strong { display: block; font-size: 14px; margin-bottom: 4px; color: ${BRAND.text}; }
.i-body p { margin: 0; font-size: 13px; color: ${BRAND.textLight}; line-height: 1.4; }

/* TOOLTIP */
.glass-tooltip {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid white;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}
.tt-head {
  font-size: 12px;
  font-weight: 700;
  color: ${BRAND.textLight};
  text-transform: uppercase;
  margin-bottom: 8px;
}
.tt-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.nm { color: ${BRAND.textLight}; }
.vl { font-weight: 700; margin-left: auto; color: ${BRAND.text}; }
.tt-big { font-size: 16px; font-weight: 800; color: ${BRAND.text}; margin-top: 4px; }
.tt-sub { font-size: 12px; color: ${BRAND.textLight}; margin-top: 2px; }

/* EMPTY / ERROR / SKELETON */
.empty-msg { color: ${BRAND.textLight}; font-weight: 600; font-size: 13px; padding: 18px; text-align: center; }

.inline-err {
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  background: ${BRAND.bg};
  border: 1px solid ${BRAND.border};
  border-radius: 16px;
  padding: 14px 16px;
  color: ${BRAND.text};
  font-weight: 600;
}
.mini-btn {
  border: 1px solid ${BRAND.border};
  background: #fff;
  color: ${BRAND.text};
  font-weight: 700;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
}
.mini-btn:hover { opacity: 0.85; }

.soft-alert { padding: 16px 18px; }
.soft-alert-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }

.sk-kpi { height: 180px; }
.sk-chart {
  height: 320px;
  border-radius: 18px;
  background: linear-gradient(90deg, #fff, #f3f3f3, #fff);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  border: 1px solid ${BRAND.border};
}
.sk-chart.small { height: 260px; }

.sk-line {
  height: 14px;
  border-radius: 10px;
  background: linear-gradient(90deg, #fff, #f3f3f3, #fff);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  border: 1px solid ${BRAND.border};
}
.updated-at {
  font-size: 12px;
  color: ${BRAND.textLight};
  white-space: nowrap;
}
.updated-at b {
  color: ${BRAND.text};
  font-weight: 800;
}
.muted {
  opacity: 0.6;
}
.list-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  grid-template-rows: auto auto;
  column-gap: 14px;
  row-gap: 8px;
  align-items: start;
  position: relative;
}

.item-details {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.item-details .name {
  display: block;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.item-details .qty {
  display: block;
  font-size: 12px;
  color: ${BRAND.textLight};
  line-height: 1.2;
  white-space: nowrap;
  flex-shrink: 0;
}

.bar-visual {
  grid-column: 2;
  grid-row: 2;
  height: 6px;
  background: ${BRAND.bg};
  border-radius: 999px;
  overflow: hidden;
}

.bar-visual .fill {
  height: 100%;
  background: ${BRAND.accent};
  border-radius: 999px;
}


@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
