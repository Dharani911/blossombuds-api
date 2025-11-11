import React, { useEffect, useMemo, useState } from "react";
import http from "../../api/adminHttp";
import { Link } from "react-router-dom";
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
const GOLD   = "#F6C320";   // Gold
const PRIMARY= "#4A4F41";   // Text
const BG     = "#FAF7E7";   // Background
const INK    = "rgba(0,0,0,.08)";
const donutColors = ["#F05D8B", "#F6C320", "#9BB472", "#7AA2E3", "#C084FC", "#FF9F6E"];

/* ------------------------------ Utils -------------------------------- */
const fmtNum   = (n:number) => new Intl.NumberFormat("en-IN").format(n ?? 0);
const fmtMoney = (n:number) => "₹" + new Intl.NumberFormat("en-IN").format(n ?? 0);
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
    load();
  }, [range]);

  const ordersSpark = useMemo(()=> trend.map(t=>({ x:t.label, y:t.orders })), [trend]);
  const revenueSpark= useMemo(()=> trend.map(t=>({ x:t.label, y:t.revenue })), [trend]);

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
            {(["daily","weekly","monthly","yearly"] as RangeKey[]).map(k=>(
              <button key={k} className={"seg-btn"+(range===k?" active":"")} onClick={()=>setRange(k)}>
                {labelOf(k)}
              </button>
            ))}
          </div>
          <div className="meta">
            Updated {new Intl.DateTimeFormat("en-IN", { dateStyle:"medium", timeStyle:"short" }).format(new Date())}
          </div>
        </div>
      </div>

      {/* Error / Loading */}
      {err && <div className="alert">{err} <button onClick={()=>setRange(range)}>Retry</button></div>}
      {loading && <Skeleton />}

      {!loading && summary && (
        <>
          {/* KPIs */}
          <section className="kpis">
            <MetricCard title="Orders"    value={fmtNum(summary.orders.total)}  hint={`M: ${fmtNum(summary.orders.monthly)} • Y: ${fmtNum(summary.orders.yearly)}`}>
              <TinyLine data={ordersSpark} color={ACCENT} />
            </MetricCard>
            <MetricCard title="Revenue"   value={fmtMoney(summary.revenue.total)} hint={`M: ${fmtMoney(summary.revenue.monthly)} • Y: ${fmtMoney(summary.revenue.yearly)}`}>
              <TinyLine data={revenueSpark} color={GOLD} />
            </MetricCard>
            <MiniCard title="Products"    value={fmtNum(summary.products.total)} link={{label:"Manage", to:"/admin/products"}} />
            <MiniCard title="Customers"   value={fmtNum(summary.customers.total)} link={{label:"View",   to:"/admin/customers"}} />
          </section>

          {/* Trend */}
          <section className="grid">
            <ChartCard title={`Trend • ${labelOf(range)}`} subtitle="Orders vs Revenue">
              {trend.length===0 ? <Empty msg="No data in this range."/> : (
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <YAxis yAxisId="left" tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <YAxis yAxisId="right" orientation="right" hide />
                    <Tooltip content={({active, payload, label}:any)=>{
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
                    }}/>
                    <Legend />
                    <Line yAxisId="left"  type="monotone" dataKey="orders"  name="Orders"  stroke={ACCENT} strokeWidth={2} dot={false}/>
                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke={GOLD}   strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Category mix */}
            <ChartCard title="Category mix" subtitle={`Top categories • ${labelOf(range)}`}>
              {topCategories.length===0 ? <Empty msg="No category sales yet."/> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip content={({active, payload}:any)=>{
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0];
                      return <Tip><b>{p?.name}</b><span><Dot c={p?.fill}/> {fmtNum(p?.value)}</span></Tip>;
                    }}/>
                    <Legend />
                    <Pie data={topCategories} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} startAngle={90} endAngle={-270} paddingAngle={2}>
                      {topCategories.map((_, i)=><Cell key={i} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Shipping */}
            <ChartCard title="Shipping cost" subtitle="Last 12 months">
              {ship12m.length===0 ? <Empty msg="No shipping data yet."/> : (
                <ResponsiveContainer>
                  <BarChart data={ship12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <YAxis tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <Tooltip content={({active, payload, label}:any)=>{
                      if (!active || !payload || !payload.length) return null;
                      const v = payload[0]?.value ?? 0;
                      return <Tip><b>{label}</b><span><Dot c={GOLD}/> {fmtMoney(v)}</span></Tip>;
                    }}/>
                    <Legend />
                    <Bar dataKey="value" name="Cost" fill={GOLD} radius={[8,8,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Customers */}
            <ChartCard title="New customers" subtitle="Last 12 months">
              {cust12m.length===0 ? <Empty msg="No customer data yet."/> : (
                <ResponsiveContainer>
                  <BarChart data={cust12m} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={INK} vertical={false}/>
                    <XAxis dataKey="label" tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <YAxis tick={{ fill: PRIMARY, fontSize: 12 }}/>
                    <Tooltip content={({active, payload, label}:any)=>{
                      if (!active || !payload || !payload.length) return null;
                      const v = payload[0]?.value ?? 0;
                      return <Tip><b>{label}</b><span><Dot c={ACCENT}/> {fmtNum(v)}</span></Tip>;
                    }}/>
                    <Legend />
                    <Bar dataKey="value" name="New" fill={ACCENT} radius={[8,8,0,0]}/>
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
}: { title:string; value:string|number; hint?:string; children?:React.ReactNode }) {
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

function MiniCard({ title, value, link }:{
  title:string; value:string|number; link?:{label:string; to:string}
}) {
  return (
    <div className="card mini">
      <div className="mini-t">{title}</div>
      <div className="mini-v">{value}</div>
      {link && <Link to={link.to} className="mini-a">{link.label} →</Link>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }:{
  title:string; subtitle?:string; children:React.ReactNode
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

function ListCard({ title, items, empty }:{
  title:string; items:LabeledValue[]; empty:string;
}) {
  return (
    <div className="card list">
      <div className="card-hd">
        <div className="card-title">{title}</div>
      </div>
      <div className="card-bd">
        {(!items || items.length===0) ? (
          <div className="muted">{empty}</div>
        ) : (
          <ul className="rows">
            {items.map((x,i)=>(
              <li key={i} className="row">
                <span className="rank">{i+1}</span>
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

function TinyLine({ data, color }:{ data:{x:string;y:number}[]; color:string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="x" hide />
        <YAxis hide />
        <Tooltip content={({active, payload}:{active?:boolean; payload?:any[]})=>{
          if (!active || !payload || !payload.length) return null;
          return (
            <Tip>
              <b>{payload[0].payload.x}</b>
              <span><Dot c={color}/> {fmtNum(payload[0].payload.y)}</span>
            </Tip>
          );
        }} />
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false}/>
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty({ msg }:{ msg:string }) {
  return (
    <div className="empty">
      <div className="icon">🌸</div>
      <div className="txt">{msg}</div>
    </div>
  );
}

function Tip({ children }:{ children:React.ReactNode }) {
  return <div className="tip">{children}</div>;
}
function Dot({ c }:{ c:string }) {
  return <span className="dot" style={{ backgroundColor:c }}/>;
}

function Skeleton(){
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

/* ------------------------------ Styles (keeps your theme) ------------------------------ */
const styles = `
.analytics-wrap{ background:${BG}; color:${PRIMARY}; min-height:100%; }
.header{
  max-width:1200px; margin:10px auto 14px; padding:10px 12px;
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
}
.tit h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; font-size:28px; }
.tit p{ margin:6px 0 0; opacity:.95; }
.controls{ display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
.seg{ display:flex; gap:8px; }
.seg-btn{
  height:34px; padding:0 12px; border-radius:999px; border:1px solid rgba(0,0,0,.06); background:#fff; cursor:pointer;
  font-weight:900; color:${PRIMARY};
}
.seg-btn.active{ background:${GOLD}; color:#2a2200; border-color:transparent; }
.meta{ font-size:12px; opacity:.85; text-align:right; }

.alert{
  max-width:1200px; margin:10px auto; padding:10px 12px; border-radius:12px;
  background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039;
}
.alert button{
  margin-left:8px; height:28px; padding:0 10px; border-radius:8px; border:1px solid ${INK}; background:#fff; cursor:pointer;
}

/* KPIs */
.kpis{
  max-width:1200px; margin:0 auto 14px; display:grid; grid-template-columns:2fr 2fr 1fr 1fr; gap:14px;
}
@media (max-width:1200px){ .kpis{ grid-template-columns:1fr 1fr; } }

.card{
  border:1px solid rgba(0,0,0,.06); border-radius:16px; background:#fff;
  box-shadow:0 12px 40px rgba(0,0,0,.08); overflow:hidden;
}

.card.metric{ padding:12px; display:grid; gap:6px; background:linear-gradient(135deg, rgba(240,93,139,.04), rgba(246,195,32,.04)); }
.metric-head{ display:flex; align-items:flex-end; justify-content:space-between; }
.metric .t{ font-weight:900; }
.metric .v{ font-size:26px; font-weight:900; }
.metric .spark{ height:40px; }
.metric .hint{ font-size:12px; opacity:.8; }

.card.mini{ padding:12px; display:grid; gap:6px; }
.mini-t{ font-weight:900; }
.mini-v{ font-size:24px; font-weight:900; }
.mini-a{ margin-top:auto; font-weight:800; color:${ACCENT}; }

/* Grid for charts + lists */
.grid{
  max-width:1200px; margin:0 auto 14px; display:grid; gap:14px;
  grid-template-columns: 1.2fr .8fr;
}
@media (max-width:1200px){ .grid{ grid-template-columns:1fr; } }

.card.block .card-hd{
  padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.85));
}
.card-title{ font-weight:900; }
.card-sub{ font-size:12px; opacity:.9; margin-top:2px; }
.card-bd{ padding:10px 12px; }
.chart{ height:280px; }

/* Lists */
.card.list .rows{ list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.card.list .row{
  display:grid; grid-template-columns: 36px 1fr auto; gap:10px; align-items:center;
  background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:10px; padding:8px 10px;
}
.rank{
  width:28px; height:28px; border-radius:999px; background:${ACCENT}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:900;
}
.name{ font-weight:800; color:${PRIMARY}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.val{ font-weight:900; }
.muted{ font-size:12px; opacity:.85; }

/* Tooltip */
.tip{
  display:grid; gap:4px; padding:8px 10px;
  border:1px solid rgba(0,0,0,.08); border-radius:10px; background:#fff;
  box-shadow:0 8px 24px rgba(0,0,0,.12); font-size:12px; color:${PRIMARY};
}
.dot{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-right:6px; vertical-align:-1px; }

/* Empty */
.empty{
  height:100%; display:grid; place-items:center; gap:6px;
  border:1px dashed rgba(0,0,0,.06); border-radius:10px; background:#fff;
}
.empty .icon{ font-size:22px; }
.empty .txt{ font-size:12px; opacity:.85; }

/* Skeleton */
.skel{ max-width:1200px; margin:0 auto; }
.skel .row{ display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:14px; margin-bottom:14px; }
.skel .row2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.skel .sh{
  height:120px; border-radius:14px; background:linear-gradient(90deg,#eee,#f5f5f5,#eee);
  background-size:200% 100%; animation: wave 1.2s linear infinite; border:1px solid rgba(0,0,0,.06);
}
.skel .tall{ height:280px; }
@keyframes wave{ 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
@media (max-width:1080px){ .skel .row{ grid-template-columns:1fr 1fr; } .skel .row2{ grid-template-columns:1fr; } }
`;
