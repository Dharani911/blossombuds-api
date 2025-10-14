// src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import http from "../../api/adminHttp";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

/* ------------------------- Types (from your API) ------------------------- */
type Section = { total: number; daily: number; weekly: number; monthly: number; yearly: number };
type Shipping = { monthly: number; yearly: number; max: number };
type Products = { total: number };
type Customers = { total: number; monthly: number; max: number };
type MetricsSummary = { orders: Section; revenue: Section; shipping: Shipping; products: Products; customers: Customers };

type TrendPoint = { label: string; orders: number; revenue: number };
type LabeledValue = { label: string; value: number };
type RangeKey = "daily" | "weekly" | "monthly" | "yearly";

/* ------------------------------ Brand palette --------------------------- */
const ACCENT = "#F05D8B";   // Pink
const GOLD   = "#F6C320";   // Gold
const PRIMARY= "#4A4F41";   // Text
const BG     = "#FAF7E7";   // Background
const INK    = "rgba(0,0,0,.08)";

/* ------------------------------ Utilities -------------------------------- */
const fmtNum   = (n:number) => new Intl.NumberFormat("en-IN").format(n ?? 0);
const fmtMoney = (n:number) => "₹" + new Intl.NumberFormat("en-IN").format(n ?? 0);
const labelOf = (r: RangeKey) => r[0].toUpperCase() + r.slice(1);

const donutColors = ["#F05D8B", "#F6C320", "#9BB472", "#7AA2E3", "#C084FC", "#FF9F6E"];

/* ------------------------------- Page ------------------------------------ */
export default function AdminDashboardPage() {
  const [range, setRange] = useState<RangeKey>("monthly");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [ship12m, setShip12m] = useState<LabeledValue[]>([]);
  const [cust12m, setCust12m] = useState<LabeledValue[]>([]);
  const [topProducts, setTopProducts] = useState<LabeledValue[]>([]);
  const [topCategories, setTopCategories] = useState<LabeledValue[]>([]);

  // small arrays for sparklines
  const ordersSpark = useMemo(()=> trend.map(t=>({ x:t.label, y:t.orders })), [trend]);
  const revenueSpark= useMemo(()=> trend.map(t=>({ x:t.label, y:t.revenue })), [trend]);

  // quick % change helper from trend (last vs prev)
  const changes = useMemo(()=>{
    if (trend.length < 2) return { orders: 0, revenue: 0 };
    const a = trend[trend.length-2], b = trend[trend.length-1];
    const pct = (prev:number, curr:number) => prev === 0 ? (curr>0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    return { orders: pct(a.orders, b.orders), revenue: pct(a.revenue, b.revenue) };
  }, [trend]);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const [sum, tr, sh, cu, tp, tc] = await Promise.all([
        http.get<MetricsSummary>("/api/admin/metrics/summary").then(r=>r.data),
        http.get<TrendPoint[]>(`/api/admin/metrics/trend?range=${range}`).then(r=>r.data),
        http.get<LabeledValue[]>("/api/admin/metrics/shipping/12m").then(r=>r.data),
        http.get<LabeledValue[]>("/api/admin/metrics/customers/12m").then(r=>r.data),
        http.get<LabeledValue[]>(`/api/admin/metrics/top-products?range=${range}&limit=6`).then(r=>r.data),
        http.get<LabeledValue[]>(`/api/admin/metrics/top-categories?range=${range}&limit=6`).then(r=>r.data),
      ]);
      setSummary(sum);
      setTrend(tr);
      setShip12m(sh);
      setCust12m(cu);
      setTopProducts(tp);
      setTopCategories(tc);
    } catch (e:any) {
      setErr(e?.response?.data?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll(); // initialize
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="admfx">
      <style>{styles}</style>

      {/* Sticky glass header */}

      <div className={"hero" + (stuck ? " stuck" : "")}>

        <div className="hero-left">
          <h1>Analytics</h1>
          <p>See what’s blooming across orders, revenue, shipping, products & customers.</p>
        </div>
        <div className="hero-right">
          <div className="seg" role="tablist" aria-label="Time range">
            {(["daily","weekly","monthly","yearly"] as RangeKey[]).map(k=>(
              <button
                key={k}
                className={"seg-btn"+(range===k?" active":"")}
                onClick={()=>setRange(k)}
                role="tab"
                aria-selected={range===k}
              >{labelOf(k)}</button>
            ))}
          </div>
          <div className="meta">Updated {new Intl.DateTimeFormat("en-IN", { dateStyle:"medium", timeStyle:"short" }).format(new Date())}</div>
        </div>
      </div>

      {err && (
        <div className="alert bad">
          {err}
          <button className="retry" onClick={load}>Retry</button>
        </div>
      )}
      {loading && <Shimmer/>}

      {!loading && summary && (
        <>
          {/* KPI tiles w/ sparklines + mini deltas */}
          <section className="kpi-grid">
            <KpiTile
              title="Orders"
              value={fmtNum(summary.orders.total)}
              accent="pink"
              delta={changes.orders}
              footItems={[
                ["Day", summary.orders.daily],
                ["Week", summary.orders.weekly],
                ["Month", summary.orders.monthly],
                ["Year", summary.orders.yearly],
              ]}
            >
              <SparkLine data={ordersSpark} color={ACCENT} />
            </KpiTile>

            <KpiTile
              title="Revenue"
              value={fmtMoney(summary.revenue.total)}
              accent="gold"
              delta={changes.revenue}
              footItems={[
                ["Day", summary.revenue.daily],
                ["Week", summary.revenue.weekly],
                ["Month", summary.revenue.monthly],
                ["Year", summary.revenue.yearly],
              ]}
            >
              <SparkLine data={revenueSpark} color={GOLD} />
            </KpiTile>

            <MiniTile
              title="Products"
              value={fmtNum(summary.products.total)}
              action={{ label: "Manage", to: "/admin/products" }}
            />
            <MiniTile
              title="Customers"
              value={fmtNum(summary.customers.total)}
              action={{ label: "View", to: "/admin/customers" }}
            />
          </section>

          {/* Main charts */}
          <section className="chart-grid">
            <Card title={`Trend • ${labelOf(range)}`} subtitle="Orders & revenue">
              <div className="chart-toolbar">
                <span className="hint">Hover the chart for details</span>
              </div>
              <div className="chart-box">
                {trend.length === 0 ? (
                  <ChartEmpty msg="No data available for the selected range." />
                ) : (
                  <ResponsiveContainer>
                    <TrendCombo data={trend}/>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="Category mix" subtitle={`Top categories • ${labelOf(range)}`}>
              <div className="chart-box">
                {topCategories.length === 0 ? (
                  <ChartEmpty msg="No category sales yet." />
                ) : (
                  <ResponsiveContainer>
                    <Donut data={topCategories} />
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="Shipping cost" subtitle="Last 12 months">
              <div className="chart-box">
                {ship12m.length === 0 ? (
                  <ChartEmpty msg="No shipping data yet." />
                ) : (
                  <ResponsiveContainer>
                    <Bars data={ship12m} color={GOLD} valueFmt={fmtMoney} />
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card title="New customers" subtitle="Last 12 months">
              <div className="chart-box">
                {cust12m.length === 0 ? (
                  <ChartEmpty msg="No customer data yet." />
                ) : (
                  <ResponsiveContainer>
                    <Bars data={cust12m} color={ACCENT} valueFmt={fmtNum} />
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </section>

          {/* Top lists */}
          <section className="list-grid">
            <RankedList
              title={`Top products • ${labelOf(range)}`}
              items={topProducts}
              empty="No product sales yet."
            />
            <RankedList
              title={`Top categories • ${labelOf(range)}`}
              items={topCategories}
              empty="No category sales yet."
            />
          </section>
        </>
      )}
    </div>
  );
}

/* --------------------------- Recharts widgets ---------------------------- */

function TrendCombo({ data }: { data: TrendPoint[] }) {
  return (
    <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={INK} vertical={false} />
      <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }} />
      <YAxis yAxisId="left" tick={{ fill: PRIMARY, fontSize: 12 }} />
      <YAxis yAxisId="right" orientation="right" hide />
      <Tooltip content={({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const ord = payload.find((p:any)=>p.dataKey==="orders")?.value ?? 0;
        const rev = payload.find((p:any)=>p.dataKey==="revenue")?.value ?? 0;
        return (
          <Tip>
            <b>{label}</b>
            <span><Dot c={ACCENT}/> Orders: <b>{fmtNum(ord)}</b></span>
            <span><Dot c={GOLD}/> Revenue: <b>{fmtMoney(rev)}</b></span>
          </Tip>
        );
      }} />
      <Legend />
      <Area yAxisId="right" dataKey="revenue" name="Revenue" type="monotone" stroke={GOLD} fill="url(#revArea)" strokeWidth={2} />
      <Line yAxisId="left" dataKey="orders"  name="Orders"  type="monotone" stroke={ACCENT} strokeWidth={2} dot={false} />
    </AreaChart>
  );
}

function Bars({ data, color, valueFmt }:{ data:LabeledValue[]; color:string; valueFmt:(n:number)=>string }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
      <CartesianGrid stroke={INK} vertical={false}/>
      <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }} />
      <YAxis tick={{ fill: PRIMARY, fontSize: 12 }} />
      <Tooltip content={({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const val = payload[0].value ?? 0;
        return (
          <Tip>
            <b>{label}</b>
            <span><Dot c={color}/> <b>{valueFmt(val)}</b></span>
          </Tip>
        );
      }}/>
      <Legend />
      <Bar dataKey="value" name="Value" fill={color} radius={[8,8,0,0]} />
    </BarChart>
  );
}

function Donut({ data }: { data: LabeledValue[] }) {
  const total = (data||[]).reduce((s, x)=>s + (x.value||0), 0);
  const percentage = (v:number) => total ? Math.round((v/total)*100) : 0;
  return (
    <PieChart>
      <Tooltip content={({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const p = payload[0];
        return (
          <Tip>
            <b>{p?.name}</b>
            <span><Dot c={p?.fill}/> {fmtNum(p?.value)} • {percentage(p?.value)}%</span>
          </Tip>
        );
      }}/>
      <Legend />
      <Pie
        data={data}
        dataKey="value"
        nameKey="label"
        innerRadius={60}
        outerRadius={90}
        startAngle={90}
        endAngle={-270}
        paddingAngle={2}
      >
        {(data||[]).map((entry, i) => (
          <Cell key={`c-${i}`} fill={donutColors[i % donutColors.length]} />
        ))}
      </Pie>
    </PieChart>
  );
}

/* ------------------------------ UI widgets ------------------------------- */

function KpiTile(props: {
  title: string;
  value: string | number;
  footItems: [string, number | null | undefined][];
  accent?: "pink" | "gold";
  children?: React.ReactNode;
}) {
  const renderMiniVal = (v: number | null | undefined) =>
    v == null || v === 0 ? "—" : new Intl.NumberFormat("en-IN").format(v);

  return (
    <div className={"card kpi " + (props.accent || "")}>
      <div className="kpi-head">
        <div className="kpi-title">{props.title}</div>
        <div className="kpi-value">{props.value}</div>
      </div>
      <div className="kpi-spark">{props.children}</div>
      <div className="kpi-foot">
        {props.footItems.map(([label, v]) => (
          <div className="mini" key={label}>
            <div className="mini-label">{label}</div>
            <div className="mini-value">{renderMiniVal(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function MiniTile({ title, value, action }:{
  title:string; value:string|number; action?:{label:string; to:string}
}) {
  return (
    <div className="card mini">
      <div className="mini-title">{title}</div>
      <div className="mini-value">{value}</div>
      {action && <Link to={action.to} className="mini-link">{action.label} →</Link>}
    </div>
  );
}

function Card({ title, subtitle, children }:{ title:string; subtitle?:string; children:React.ReactNode }) {
  return (
    <div className="card block">
      <div className="card-hd">
        <div className="card-title">{title}</div>
        {subtitle && <div className="card-sub">{subtitle}</div>}
      </div>
      <div className="card-bd">{children}</div>
    </div>
  );
}

function RankedList({ title, items, empty }:{
  title:string; items:LabeledValue[]; empty:string;
}) {
  return (
    <div className="card list">
      <div className="card-hd">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-bd">
        {(!items || items.length===0) && <div className="muted">{empty}</div>}
        {items && items.length>0 && (
          <ul className="rows">
            {items.map((x,i)=>(
              <li key={i} className="row">
                <span className="badge">{i+1}</span>
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

/* Sparkline (tiny) */
function SparkLine({ data, color }:{ data:{x:string;y:number}[]; color:string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="x" hide />
        <YAxis hide />
        <Tooltip content={({active, payload}:{active?:boolean;payload?:any[]})=>{
          if (!active || !payload || !payload.length) return null;
          return <Tip><b>{payload[0].payload.x}</b><span><Dot c={color}/> {fmtNum(payload[0].payload.y)}</span></Tip>;
        }}/>
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* Empty chart placeholder */
function ChartEmpty({ msg }:{ msg:string }) {
  return (
    <div className="chart-empty">
      <div className="emoji">🌸</div>
      <div className="t">{msg}</div>
    </div>
  );
}

/* Tooltip box + dot */
function Tip({ children }:{ children:React.ReactNode }) {
  return <div style={tipBox}>{children}</div>;
}
function Dot({ c }:{ c:string }) {
  return <span style={{...dot, backgroundColor:c}}/>;
}

/* ------------------------------ Shimmer ---------------------------------- */
function Shimmer(){
  return (
    <div className="shimmer">
      <style>{`
        .shimmer{ padding: 10px 0 20px; }
        .sh{ height: 120px; border-radius: 16px; background: linear-gradient(90deg,#eee,#f5f5f5,#eee);
             background-size: 200% 100%; animation: wave 1.2s linear infinite; border:1px solid rgba(0,0,0,.06); }
        .row{ display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .row2{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @keyframes wave { 0% {background-position: 200% 0;} 100% {background-position: -200% 0;} }
        @media (max-width: 1080px){ .row{ grid-template-columns: 1fr 1fr; } .row2{ grid-template-columns: 1fr; } }
      `}</style>
      <div className="row"><div className="sh"></div><div className="sh"></div><div className="sh"></div><div className="sh"></div></div>
      <div className="row2"><div className="sh" style={{height:280}}></div><div className="sh" style={{height:280}}></div></div>
      <div className="row2" style={{marginTop:14}}><div className="sh" style={{height:280}}></div><div className="sh" style={{height:280}}></div></div>
    </div>
  );
}

/* ------------------------------- Styles ---------------------------------- */
const styles = `
:root{
  /* optional: hero height if you want a fixed height */
  --hero-h: 76px;
}

.admfx{
  background:#FAF7E7; color:#4A4F41; min-height:100%;
  --admin-crumbs-h: 0px;
  /* keep your page padding — does not affect sticky */
  /* padding: var(--admin-topbar-h, 64px) 16px 28px; */
}

/* HERO: make it sticky under topbar + crumbs from AdminLayout */
.hero{
  position: sticky;
  top: var(--admin-topbar-h, 64px);
  z-index: 80; /* below crumbs (90/100), above content */
  max-width:1200px; margin:0 auto 14px; padding:12px 14px;

  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;

  border:1px solid rgba(0,0,0,.06); border-radius:18px;
  background: linear-gradient(135deg, rgba(246,195,32,.14), rgba(255,255,255,.97));
  backdrop-filter: blur(6px) saturate(120%);
  box-shadow:0 18px 60px rgba(0,0,0,.10);
}

/* keep the rest as you had */
.hero-left h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; font-size:28px; letter-spacing:.2px; }
.hero-left p{ margin:6px 0 0; opacity:.95; }
.meta{ font-size:12px; opacity:.85; text-align:right; }
.seg{ display:flex; gap:8px; }
.seg-btn{
  height:34px; padding:0 12px; border-radius:999px; border:1px solid rgba(0,0,0,.06); background:#fff; cursor:pointer;
  font-weight:900; color:${PRIMARY}; transition:all .18s ease;
}
.seg-btn:hover{ transform: translateY(-1px); box-shadow:0 10px 24px rgba(0,0,0,.08); }
.seg-btn.active{ background:${GOLD}; color:#2a2200; box-shadow:0 8px 22px rgba(246,195,32,.35); border-color:transparent; }

.alert.bad{
  max-width:1200px; margin:10px auto; padding:10px 12px; border-radius:12px;
  background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039;
}

/* KPI grid */
.kpi-grid{ max-width:1200px; margin:0 auto 14px; display:grid; grid-template-columns:2fr 2fr 1fr 1fr; gap:14px; }
@media (max-width:1200px){ .kpi-grid{ grid-template-columns: 1fr 1fr; } }

.card{
  border:1px solid rgba(0,0,0,.06); border-radius:18px; background:#fff;
  box-shadow:0 18px 60px rgba(0,0,0,.10); overflow:hidden;
  transition: transform .14s ease, box-shadow .14s ease;
}
.card:hover{ transform: translateY(-2px); box-shadow:0 22px 72px rgba(0,0,0,.12); }

/* KPI tiles */
.kpi{ padding:12px; background:linear-gradient(135deg, rgba(240,93,139,.05), rgba(246,195,32,.05)); }
.kpi.pink{ background:linear-gradient(135deg, rgba(240,93,139,.12), rgba(240,93,139,.02)); }
.kpi.gold{ background:linear-gradient(135deg, rgba(246,195,32,.16), rgba(246,195,32,.03)); }
.kpi-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; }
.kpi-title{ font-weight:900; }
.kpi-value{ font-size:26px; font-weight:900; letter-spacing:.2px; }
.kpi-spark{ height:44px; margin:4px 0 8px; }
.kpi-foot{ display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; }
.kpi-foot .mini{ background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:8px; text-align:center; }
.mini-label{ font-size:12px; opacity:.85; }
.mini-value{ font-weight:900; }

/* Mini tiles */
.card.mini{ padding:12px; display:flex; flex-direction:column; gap:6px; background:linear-gradient(135deg, rgba(250,247,231,.85), #fff); }
.card.mini .mini-title{ font-weight:900; }
.card.mini .mini-value{ font-size:24px; font-weight:900; }
.card.mini .mini-link{ margin-top:auto; font-weight:800; color:${ACCENT}; }

/* Main chart grid */
.chart-grid{ max-width:1200px; margin:0 auto 14px; display:grid; grid-template-columns:1.2fr .8fr; gap:14px; }
.chart-grid > .card.block:nth-child(3),
.chart-grid > .card.block:nth-child(4){ grid-column: span 1; }
@media (max-width:1200px){ .chart-grid{ grid-template-columns:1fr; } }

.card-hd{ padding:12px 14px; border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.85)); }
.card-title{ font-weight:900; }
.card-sub{ font-size:12px; opacity:.9; margin-top:2px; }
.card-bd{ padding:10px 12px; }
.chart-box{ width:100%; height:280px; }

/* Ranked lists */
.list-grid{ max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
@media (max-width:1200px){ .list-grid{ grid-template-columns:1fr; } }
.rows{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.row{
  display:grid; grid-template-columns:40px 1fr auto; gap:10px; align-items:center;
  background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:8px 10px;
}
.badge{
  width:28px; height:28px; border-radius:999px; background:${ACCENT}; color:#fff;
  display:inline-flex; align-items:center; justify-content:center; font-weight:900;
}
.name{ font-weight:800; color:${PRIMARY}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.val{ font-weight:900; }

/* Recharts tooltips */
.recharts-default-tooltip{
  border-radius:10px !important; border:1px solid rgba(0,0,0,.08) !important;
  background:#fff !important; box-shadow:0 10px 26px rgba(0,0,0,.12) !important;
}

/* Shimmer (unchanged) */
`;
