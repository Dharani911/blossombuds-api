import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { adminLogout } from "../../api/adminAuth";
import Logo from "../../assets/BB_Logo.svg";

const PRIMARY = "#4A4F41";
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const BG     = "#FAF7E7";

type Item = { to: string; label: string; icon: React.ReactNode };

function IconAnalytics(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 13l3-3 2 2 4-4"/></svg>); }
function IconBox(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12l8.73-5.04M12 22V12"/></svg>); }
function IconTags(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>); }
function IconOrders(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15V8a2 2 0 0 0-2-2h-3l-2-2h-4L8 6H5a2 2 0 0 0-2 2v7"/><rect x="3" y="13" width="18" height="8" rx="2"/></svg>); }
function IconReviews(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>); }
function IconSettings(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0c.25.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.51 1z"/></svg>); }
function IconUsers(){ return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>); }
function IconLogout(){ return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>); }

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const nav = useNavigate();

  const items: Item[] = [
    { to: "/admin",            label: "Analytics",  icon: <IconAnalytics/> },
    { to: "/admin/products",   label: "Products",   icon: <IconBox/> },
    { to: "/admin/categories", label: "Categories", icon: <IconTags/> },
    { to: "/admin/orders",     label: "Orders",     icon: <IconOrders/> },
    { to: "/admin/reviews",    label: "Reviews",    icon: <IconReviews/> },
    { to: "/admin/settings",   label: "Settings",   icon: <IconSettings/> },
    { to: "/admin/customers",  label: "Customers",  icon: <IconUsers/> },
  ];

  return (
    <div
      className="adml"
      style={
        {
          // shared CSS vars for sticky offsets
          ["--admin-topbar-h" as any]: "64px",
          ["--admin-crumbs-h" as any]: "44px",
        } as React.CSSProperties
      }
    >
      <style>{css}</style>

      {/* Top bar */}
      <div className="adml-top">
        <button className="ghost burger" onClick={() => setOpen(true)} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="brand">
          <img src={Logo} width={36} height={36} alt="BB logo" />
          <div className="brand-name">
            <strong>Blossom Buds Floral Artistry</strong>
            <span>Admin</span>
          </div>
        </div>

        <div className="actions">
          <button
            className="logout"
            onClick={() => { adminLogout(); nav("/admin/login", { replace: true }); }}
            title="Logout"
          >
            <IconLogout/> <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={"adml-side" + (collapsed ? " collapsed" : "") + (open ? " open" : "")}>
        <div className="side-inner">
          <div className="side-head">
            <button className="ghost collapse" onClick={() => setCollapsed(v => !v)} aria-label="Collapse sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          </div>

          <nav className="menu">
            {items.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/admin"}
                className={({ isActive }) => "mi" + (isActive ? " active" : "")}
                onClick={() => setOpen(false)}
                title={collapsed ? it.label : undefined}
              >
                <span className="ico">{it.icon}</span>
                {!collapsed && <span className="label">{it.label}</span>}
                <span className="ink" />
              </NavLink>
            ))}
          </nav>
        </div>
        <button className="backdrop" onClick={() => setOpen(false)} aria-hidden={!open}/>
      </aside>

      {/* Main content */}
      <main className={"adml-main" + (collapsed ? " collapsed" : "")}>
        {/* <div className="crumbs">
          <div className="trail">
            {location.pathname.replace("/admin","").split("/").filter(Boolean).length === 0
              ? <span>Dashboard</span>
              : location.pathname.replace("/admin/","").split("/").map((p, i, arr) => (
                  <span key={i}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                    {i < arr.length - 1 ? " / " : ""}
                  </span>
                ))
            }
          </div>
        </div> */}

        <div className="adml-body">
          <Outlet/>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------- Styles ---------------------------------- */
const css = `
:root{
  --ad-primary: ${PRIMARY};
  --ad-accent: ${ACCENT};
  --ad-gold: ${GOLD};
  --ad-bg: ${BG};
  --ad-ink: rgba(0,0,0,.08);
}

.adml{
  display:grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: var(--admin-topbar-h) 1fr;
  grid-template-areas:
    "top top"
    "side main";
  min-height: 100vh;
  background: var(--ad-bg);
  color: var(--ad-primary);
}

/* Top bar */
.adml-top{
  grid-area: top;
  position: sticky; top:0; z-index: 100;
  height: var(--admin-topbar-h);
  display:flex; align-items:center; gap:12px;
  padding: 0 14px;
  background: linear-gradient(180deg, rgba(250,247,231,.92), rgba(255,255,255,.95));
  border-bottom:1px solid var(--ad-ink);
  backdrop-filter: saturate(160%) blur(10px);
}
.adml-top .actions{
  margin-left: auto;                 /* ← pin logout to the far right */
  display:flex; align-items:center; gap:8px;
}
.brand{ display:flex; align-items:center; gap:10px; }
.brand-name{ display:flex; flex-direction:column; line-height:1; }
.brand-name strong{ font-weight:900; letter-spacing:.2px; }
.brand-name span{ font-size:12px; opacity:.85; }
.ghost{ background:#fff; border:1px solid var(--ad-ink); border-radius:12px; height:40px; width:40px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.ghost:hover{ box-shadow:0 12px 28px rgba(0,0,0,.12); transform: translateY(-1px); }
.burger{ display:none; }
.logout{
  height:40px; display:inline-flex; align-items:center; gap:8px; padding:0 12px;
  border:none; border-radius:12px; cursor:pointer; background:var(--ad-accent); color:#fff; font-weight:900;
  box-shadow:0 12px 28px rgba(240,93,139,.35);
}
.logout:hover{ transform: translateY(-1px); box-shadow:0 14px 32px rgba(240,93,139,.42); }

/* Sidebar */
.adml-side{
  grid-area: side;
  position: relative;
  background: linear-gradient(135deg, rgba(246,195,32,.12), rgba(255,255,255,.9));
  border-right:1px solid var(--ad-ink);
}
.side-inner{ position: sticky; top: var(--admin-topbar-h); padding: 10px 10px 16px; height: calc(100vh - var(--admin-topbar-h)); overflow:auto; }
.side-head{ display:flex; align-items:center; justify-content:flex-end; padding: 6px; }

.menu{ display:grid; gap:6px; padding: 10px 4px; }
.mi{
  position:relative;
  display:flex; align-items:center; gap:12px; height:44px; padding:0 12px; border-radius:12px;
  color: var(--ad-primary); text-decoration:none; font-weight:800;
  background: #fff; border:1px solid var(--ad-ink);
  transition: transform .14s ease, box-shadow .14s ease, background .14s ease;
  overflow:hidden;
}
.mi:hover{ transform: translateY(-1px); box-shadow:0 12px 28px rgba(0,0,0,.1); }
.mi .ico{ display:inline-flex; align-items:center; justify-content:center; color: var(--ad-primary); }
.mi .label{ flex:1; }
.mi .ink{
  position:absolute; inset:auto 0 0 0; height:3px; background: linear-gradient(90deg, var(--ad-gold), #ffe38a);
  opacity:0; transform: translateY(3px);
  transition: transform .22s ease, opacity .22s ease;
}
.mi.active{
  background: linear-gradient(135deg, rgba(246,195,32,.18), rgba(255,255,255,.95));
  border-color: transparent;
  box-shadow: 0 16px 40px rgba(246,195,32,.28);
}
.mi.active .ink{ opacity:1; transform: translateY(0); }

/* Collapse behavior (desktop) */
.adml-side.collapsed{ width: 84px; }
.adml-main.collapsed{ grid-template-columns: 84px 1fr; }

/* Mobile overlay */
@media (max-width: 1100px){
  .adml{ grid-template-columns: 1fr; grid-template-areas:"top" "main"; }
  .adml-side{ position: fixed; top: var(--admin-topbar-h); bottom:0; left:0; width: 280px; transform: translateX(-100%); transition: transform .22s ease; z-index: 95; }
  .adml-side.open{ transform: translateX(0); }
  .backdrop{
    position: fixed; inset: var(--admin-topbar-h) 0 0 0; background: rgba(0,0,0,.32); backdrop-filter: blur(2px);
    opacity:1; pointer-events:auto; border:none;
  }
  .burger{ display:inline-flex; }
  .collapse{ display:none; }
}
@media (min-width: 1101px){ .backdrop{ display:none; } }

/* Main */
.adml-main{
  grid-area: main;
  min-width: 0;
}
.crumbs{
  display: none !important;
  height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  backdrop-filter: none;
}

.trail{ max-width: 1200px; margin:0 auto; font-size:12px; font-weight:800; opacity:.9; }
.adml-body{ max-width: 1200px; margin: 12px auto 24px; padding: 0 12px; }
`;
