import React, { useEffect, useMemo, useState } from "react";
import http from "../../api/adminHttp";
import { Link } from "react-router-dom";
import { formatIstDateTime } from "../../utils/dates";

import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

/* ------------------------- Types (your API) ------------------------- */
type Section = { total: number; daily: number; weekly: number; monthly: number; yearly: number };
type Shipping = { monthly: number; yearly: number; max: number };
type Products = { total: number };
type Customers = { total: number; monthly: number; max: number };
type MetricsSummary = { orders: Section; revenue: Section; shipping: Shipping; products: Products; customers: Customers };

type TrendPoint = { label: string; orders: number; revenue: number };
type LabeledValue = { label: string; value: number };
type RangeKey = "daily" | "weekly" | "monthly" | "yearly";

/* ------------------------------ Theme palette (unchanged) --------------------------- */
const ACCENT = "#F05D8B";   // Pink
const GOLD = "#F6C320";   // Gold
const PRIMARY = "#4A4F41";   // Text
const BG = "#FAF7E7";   // Background
const INK = "rgba(0,0,0,.08)";
const donutColors = ["#F05D8B", "#F6C320", "#9BB472", "#7AA2E3", "#C084FC", "#FF9F6E"];

/* ------------------------------ Utils -------------------------------- */
const fmtNum = (n: number) => new Intl.NumberFormat("en-IN").format(n ?? 0);
const fmtMoney = (n: number) => "₹" + new Intl.NumberFormat("en-IN").format(n ?? 0);
const labelOf = (r: RangeKey) => r[0].toUpperCase() + r.slice(1);

/* ------------------------------ Page -------------------------------- */
export default function AdminAnalyticsSimple() {
  const [range, setRange] = useState<RangeKey>("monthly");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [ship12m, setShip12m] = useState<LabeledValue[]>([]);
  const [cust12m, setCust12m] = useState<LabeledValue[]>([]);
  const [topProducts, setTopProducts] = useState<LabeledValue[]>([]);
  const [topCategories, setTopCategories] = useState<LabeledValue[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true); setErr(null);
      try {
        const [sum, tr, sh, cu, tp, tc] = await Promise.all([
          http.get<MetricsSummary>("/api/admin/metrics/summary").then(r => r.data),
          http.get<TrendPoint[]>(`/api/admin/metrics/trend?range=${range}`).then(r => r.data),
          http.get<LabeledValue[]>("/api/admin/metrics/shipping/12m").then(r => r.data),
          http.get<LabeledValue[]>("/api/admin/metrics/customers/12m").then(r => r.data),
          http.get<LabeledValue[]>(`/api/admin/metrics/top-products?range=${range}&limit=6`).then(r => r.data),
          http.get<LabeledValue[]>(`/api/admin/metrics/top-categories?range=${range}&limit=6`).then(r => r.data),
        ]);
        setSummary(sum);
        setTrend(tr);
        setShip12m(sh);
        setCust12m(cu);
        setTopProducts(tp);
        setTopCategories(tc);
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  const ordersSpark = useMemo(() => trend.map(t => ({ x: t.label, y: t.orders })), [trend]);
  const revenueSpark = useMemo(() => trend.map(t => ({ x: t.label, y: t.revenue })), [trend]);

  return (
    <div className="analytics-wrap">
      <style>{styles}</style>

      {/* Header */}
      <div className="header">
        <div className="tit">
          <h1>Analytics</h1>
          <p>Clear metrics for orders, revenue, shipping & customers.</p>
        </div>
        <div className="controls">
          <div className="seg">
            {(["daily", "weekly", "monthly", "yearly"] as RangeKey[]).map(k => (
              <button key={k} className={"seg-btn" + (range === k ? " active" : "")} onClick={() => setRange(k)}>
                {labelOf(k)}
              </button>
            ))}
          </div>
          <div className="meta">
            Updated {formatIstDateTime(new Date())}
          </div>

        </div>
      </div>

      {/* Error / Loading */}
      {err && <div className="alert">{err} <button onClick={() => setRange(range)}>Retry</button></div>}
      {loading && <Skeleton />}

      {!loading && summary && (
        <>
          {/* KPIs */}
          <section className="kpis">
            <MetricCard title="Orders" value={fmtNum(summary.orders.total)} hint={`M: ${fmtNum(summary.orders.monthly)} • Y: ${fmtNum(summary.orders.yearly)}`}>
              <TinyLine data={ordersSpark} color={ACCENT} />
            </MetricCard>
            <MetricCard title="Revenue" value={fmtMoney(summary.revenue.total)} hint={`M: ${fmtMoney(summary.revenue.monthly)} • Y: ${fmtMoney(summary.revenue.yearly)}`}>
              <TinyLine data={revenueSpark} color={GOLD} />
            </MetricCard>
            <MiniCard title="Products" value={fmtNum(summary.products.total)} link={{ label: "Manage", to: "/admin/products" }} />
            <MiniCard title="Customers" value={fmtNum(summary.customers.total)} link={{ label: "View", to: "/admin/customers" }} />
          </section>

          {/* Trend */}
          <section className="grid">
            <ChartCard title={`Trend • ${labelOf(range)}`} subtitle="Orders vs Revenue">
              {trend.length === 0 ? <Empty msg="No data in this range." /> : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" hide />
                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const ord = payload.find((p: any) => p.dataKey === "orders")?.value ?? 0;
                      const rev = payload.find((p: any) => p.dataKey === "revenue")?.value ?? 0;
                      return (
                        <Tip>
                          <b>{label}</b>
                          <span><Dot c={ACCENT} /> Orders: <b>{fmtNum(ord)}</b></span>
                          <span><Dot c={GOLD} /> Revenue: <b>{fmtMoney(rev)}</b></span>
                        </Tip>
                      );
                    }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="orders" name="Orders" stroke={ACCENT} strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Category mix */}
            <ChartCard title="Category mix" subtitle={`Top categories • ${labelOf(range)}`}>
              {topCategories.length === 0 ? <Empty msg="No category sales yet." /> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0];
                      return <Tip><b>{p?.name}</b><span><Dot c={p?.fill} /> {fmtNum(p?.value)}</span></Tip>;
                    }} />
                    <Legend />
                    <Pie data={topCategories} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} startAngle={90} endAngle={-270} paddingAngle={2}>
                      {topCategories.map((_, i) => <Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Shipping */}
            <ChartCard title="Shipping cost" subtitle="Last 12 months">
              {ship12m.length === 0 ? <Empty msg="No shipping data yet." /> : (
                <ResponsiveContainer>
                  <BarChart data={ship12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <YAxis tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const v = payload[0]?.value ?? 0;
                      return <Tip><b>{label}</b><span><Dot c={GOLD} /> {fmtMoney(v)}</span></Tip>;
                    }} />
                    <Legend />
                    <Bar dataKey="value" name="Cost" fill={GOLD} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Customers */}
            <ChartCard title="New customers" subtitle="Last 12 months">
              {cust12m.length === 0 ? <Empty msg="No customer data yet." /> : (
                <ResponsiveContainer>
                  <BarChart data={cust12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <YAxis tick={{ fill: PRIMARY, fontSize: 12 }} />
                    <Tooltip content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const v = payload[0]?.value ?? 0;
                      return <Tip><b>{label}</b><span><Dot c={ACCENT} /> {fmtNum(v)}</span></Tip>;
                    }} />
                    <Legend />
                    <Bar dataKey="value" name="New" fill={ACCENT} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Top lists */}
            <ListCard title={`Top products • ${labelOf(range)}`} items={topProducts} empty="No product sales yet." />
            <ListCard title={`Top categories • ${labelOf(range)}`} items={topCategories} empty="No category sales yet." />
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Small components ------------------------------ */

function MetricCard({
  title, value, hint, children
}: { title: string; value: string | number; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="card metric">
      <div className="metric-head">
        <div className="t">{title}</div>
        <div className="v">{value}</div>
      </div>
      {children && <div className="spark">{children}</div>}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function MiniCard({ title, value, link }: {
  title: string; value: string | number; link?: { label: string; to: string }
}) {
  return (
    <div className="card mini">
      <div className="mini-t">{title}</div>
      <div className="mini-v">{value}</div>
      {link && <Link to={link.to} className="mini-a">{link.label} →</Link>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="card block">
      <div className="card-hd">
        <div className="card-title">{title}</div>
        {subtitle && <div className="card-sub">{subtitle}</div>}
      </div>
      <div className="card-bd">
        <div className="chart">{children}</div>
      </div>
    </div>
  );
}

function ListCard({ title, items, empty }: {
  title: string; items: LabeledValue[]; empty: string;
}) {
  return (
    <div className="card list">
      <div className="card-hd">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-bd">
        {(!items || items.length === 0) ? (
          <div className="muted">{empty}</div>
        ) : (
          <ul className="rows">
            {items.map((x, i) => (
              <li key={i} className="row">
                <span className="rank">{i + 1}</span>
                <span className="name" title={x.label}>{x.label}</span>
                <span className="val">{fmtNum(x.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TinyLine({ data, color }: { data: { x: string; y: number }[]; color: string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="x" hide />
        <YAxis hide />
        <Tooltip content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
          if (!active || !payload || !payload.length) return null;
          return (
            <Tip>
              <b>{payload[0].payload.x}</b>
              <span><Dot c={color} /> {fmtNum(payload[0].payload.y)}</span>
            </Tip>
          );
        }} />
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="empty">
      <div className="icon">🌸</div>
      <div className="txt">{msg}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="tip">{children}</div>;
}
function Dot({ c }: { c: string }) {
  return <span className="dot" style={{ backgroundColor: c }} />;
}

function Skeleton() {
  return (
    <div className="skel">
      <div className="row">
        <div className="sh"></div><div className="sh"></div><div className="sh"></div><div className="sh"></div>
      </div>
      <div className="row2">
        <div className="sh tall"></div><div className="sh tall"></div>
      </div>
      <div className="row2">
        <div className="sh tall"></div><div className="sh tall"></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ PREMIUM ADMIN DASHBOARD STYLES ═══════════════════════════ */
const styles = `
.analytics-wrap {
  background: linear-gradient(135deg, ${BG} 0%, #fff 100%);
  color: ${PRIMARY};
  min-height: 100vh;
  padding: 24px;
}

/* ═══════════════════════════ HEADER ═══════════════════════════ */
.header {
  max-width: 1280px;
  margin: 0 auto 24px;
  padding: 24px 28px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 24px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  position: relative;
}

.header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 28px;
  right: 28px;
  height: 3px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD}, #9BB472);
  border-radius: 3px 3px 0 0;
}

.tit h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tit h1::before {
  content: "📊 ";
  -webkit-text-fill-color: initial;
}

.tit p {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.7;
}

.controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.seg {
  display: flex;
  gap: 6px;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 16px;
}

.seg-btn {
  height: 36px;
  padding: 0 18px;
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
  box-shadow: 0 4px 12px rgba(246,195,32,0.3);
}

.meta {
  font-size: 12px;
  opacity: 0.6;
  text-align: right;
}

/* ═══════════════════════════ ALERT ═══════════════════════════ */
.alert {
  max-width: 1280px;
  margin: 0 auto 20px;
  padding: 16px 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
  border: 1px solid rgba(198,40,40,0.2);
  color: #b71c1c;
  display: flex;
  align-items: center;
  gap: 12px;
}

.alert button {
  margin-left: auto;
  height: 32px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  cursor: pointer;
  font-weight: 600;
}

/* ═══════════════════════════ KPIs ═══════════════════════════ */
.kpis {
  max-width: 1280px;
  margin: 0 auto 24px;
  display: grid;
  grid-template-columns: 1.5fr 1.5fr 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1200px) {
  .kpis { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 768px) {
  .kpis { grid-template-columns: 1fr; }
}

/* ═══════════════════════════ CARDS ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0,0,0,0.06);
  overflow: hidden;
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 16px 50px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

/* Metric Card (Orders, Revenue) */
.card.metric {
  padding: 20px;
  display: grid;
  gap: 12px;
  background: linear-gradient(135deg, rgba(240,93,139,0.04) 0%, rgba(246,195,32,0.04) 100%);
  position: relative;
}

.card.metric::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 3px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD});
  border-radius: 0 0 3px 3px;
}

.metric-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.metric .t {
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
}

.metric .v {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.metric .spark {
  height: 50px;
  margin: 0 -8px;
}

.metric .hint {
  font-size: 12px;
  opacity: 0.6;
  padding: 10px 14px;
  background: rgba(0,0,0,0.02);
  border-radius: 10px;
  margin-top: 4px;
}

/* Mini Card (Products, Customers) */
.card.mini {
  padding: 20px;
  display: grid;
  gap: 8px;
  position: relative;
}

.mini-t {
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
}

.mini-v {
  font-size: 28px;
  font-weight: 800;
}

.mini-a {
  margin-top: auto;
  font-weight: 700;
  font-size: 13px;
  color: ${ACCENT};
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.mini-a:hover {
  color: #d4466e;
  gap: 8px;
}

/* ═══════════════════════════ CHART GRID ═══════════════════════════ */
.grid {
  max-width: 1280px;
  margin: 0 auto 24px;
  display: grid;
  gap: 20px;
  grid-template-columns: 1.3fr 0.7fr;
}

@media (max-width: 1200px) {
  .grid { grid-template-columns: 1fr; }
}

/* ═══════════════════════════ CHART CARD ═══════════════════════════ */
.card.block .card-hd {
  padding: 16px 20px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-weight: 800;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, ${ACCENT}, ${GOLD});
  border-radius: 2px;
}

.card-sub {
  font-size: 12px;
  opacity: 0.6;
}

.card-bd {
  padding: 16px 20px;
}

.chart {
  height: 300px;
}

/* ═══════════════════════════ LIST CARD ═══════════════════════════ */
.card.list .rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.card.list .row {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 14px;
  align-items: center;
  background: #fafafa;
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 12px 14px;
  transition: all 0.15s ease;
}

.card.list .row:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  transform: translateX(4px);
}

.rank {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(240,93,139,0.3);
}

.card.list .row:nth-child(1) .rank {
  background: linear-gradient(135deg, ${GOLD} 0%, #ffe066 100%);
  color: #5d4800;
  box-shadow: 0 4px 12px rgba(246,195,32,0.3);
}

.card.list .row:nth-child(2) .rank {
  background: linear-gradient(135deg, #9BB472 0%, #b8d390 100%);
  color: #2f4b12;
  box-shadow: 0 4px 12px rgba(155,180,114,0.3);
}

.name {
  font-weight: 700;
  color: ${PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.val {
  font-weight: 800;
  font-size: 15px;
  color: ${PRIMARY};
}

.muted {
  font-size: 13px;
  opacity: 0.6;
  text-align: center;
  padding: 20px;
}

/* ═══════════════════════════ TOOLTIP ═══════════════════════════ */
.tip {
  display: grid;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid ${INK};
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(0,0,0,0.15);
  font-size: 13px;
  color: ${PRIMARY};
}

.tip b {
  font-size: 14px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
  vertical-align: -1px;
}

/* ═══════════════════════════ EMPTY STATE ═══════════════════════════ */
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 2px dashed ${INK};
  border-radius: 14px;
  background: linear-gradient(135deg, #fafafa 0%, #fff 100%);
  padding: 40px;
}

.empty .icon {
  font-size: 36px;
}

.empty .txt {
  font-size: 14px;
  opacity: 0.6;
  text-align: center;
}

/* ═══════════════════════════ SKELETON ═══════════════════════════ */
.skel {
  max-width: 1280px;
  margin: 0 auto;
}

.skel .row {
  display: grid;
  grid-template-columns: 1.5fr 1.5fr 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.skel .row2 {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr;
  gap: 20px;
  margin-bottom: 20px;
}

.skel .sh {
  height: 140px;
  border-radius: 20px;
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size: 200% 100%;
  animation: wave 1.2s linear infinite;
  border: 1px solid ${INK};
}

.skel .tall {
  height: 340px;
}

@keyframes wave {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1080px) {
  .analytics-wrap {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .controls {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .skel .row {
    grid-template-columns: 1fr 1fr;
  }

  .skel .row2 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .tit h1 {
    font-size: 24px;
  }

  .seg {
    flex-wrap: wrap;
  }

  .seg-btn {
    flex: 1;
    text-align: center;
  }

  .chart {
    height: 240px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .skel .sh,
  .card.list .row {
    animation: none !important;
    transition: none !important;
  }
}
`;
