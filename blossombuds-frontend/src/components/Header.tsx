import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../app/AuthProvider";
import { useCart } from "../app/CartProvider";
import Logo from "../assets/BB_Logo.svg";

/** Inline SVG icons */
function ProfileSVG(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20"
      fill="none" stroke="var(--bb-primary)" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CartSVG(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20"
      fill="none" stroke="var(--bb-primary)" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61H19a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

type LinkDef = { to: string; label: string; exact?: boolean };

export default function Header(){
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameOnly = location.pathname;
  const from = `${location.pathname}${location.search || ""}`;
  const { user } = useAuth();
  const { count } = useCart();


  const links: LinkDef[] = useMemo(()=>[
    { to:"/", label:"Home", exact:true },
    { to:"/featured", label:"Featured" },
    { to:"/categories", label:"Categories" },
    { to:"/reviews", label:"Reviews" }
  ], []);

  // Ink-bar underline animator (no big bubble)
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [bar, setBar] = useState({ left: 0, width: 0, visible: false });

  const moveBarTo = (key: string | null) => {
    const host = listRef.current;
    if (!host) return;
    const el = key ? itemRefs.current[key] : null;
    const hostRect = host.getBoundingClientRect();
    if (el) {
      const r = el.getBoundingClientRect();
      setBar({ left: r.left - hostRect.left, width: r.width, visible: true });
    } else {
      setBar(prev => ({ ...prev, visible: false }));
    }
  };

  useEffect(() => {
    const activeKey =
      links.find(l => (l.exact ? pathnameOnly === l.to : pathnameOnly.startsWith(l.to)))?.to || null;
    moveBarTo(activeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathnameOnly, links]);

  // Mobile state
  const [open, setOpen] = useState(false);
  const goProfile = () => {
    if (user?.id) {
      navigate("/profile");
    } else {
      navigate("/login", { state: { from } });
    }
    setOpen(false);
  };

  return (
    <header className="hx">
      <style>{`
        .hx{
          position:sticky; top:0; z-index:70;
          /* Warm glassy gradient that fits #FAF7E7 */
          background: linear-gradient(180deg, rgba(250,247,231,0.92), rgba(255,255,255,0.96));
          border-bottom: 1px solid rgba(0,0,0,.06);
          backdrop-filter: saturate(180%) blur(12px);
          box-shadow: 0 10px 28px rgba(0,0,0,.06);
        }
        .hx-shell{max-width:1200px; margin:0 auto; padding:0 12px;}

        .hx-row{
          display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; height:80px; gap:12px;
        }
        .hx-brand{ justify-self: start; }
        .hx-actions{ justify-self: end; }

        /* Brand (slightly left) */
        .hx-brand{display:flex; align-items:center; gap:10px; transform: translateX(-4px);}
        .hx-title{
          font-family: Georgia, "Times New Roman", serif;
          color: var(--bb-primary);
          font-weight: 800; letter-spacing:.2px; line-height:1.1;
        }

        /* Center menu (each item independent, with animated ink bar) */
        .hx-mid{ display:flex; justify-content:center; }
        .hx-nav{
          position:relative; display:flex; gap:6px; align-items:center;
          padding: 2px 2px 10px; /* bottom space for ink bar */
        }
        .hx-ink{
          position:absolute; bottom:0; height:3px; border-radius:3px;
          background: linear-gradient(90deg, var(--bb-accent-2), #ffe38a);
          box-shadow: 0 8px 18px rgba(246,195,32,.35);
          transform: translateX(var(--x, 0px));
          width: var(--w, 0px);
          opacity: var(--o, 0);
          transition:
            transform .32s cubic-bezier(.2,.8,.2,1),
            width .32s cubic-bezier(.2,.8,.2,1),
            opacity .2s ease;
          will-change: transform, width, opacity;
        }
        .hx-a{
          position:relative; padding: 12px 16px; border-radius:12px;
          font-weight:700; color: var(--bb-primary);
          transition: color .18s ease, letter-spacing .18s ease, transform .18s ease, background .18s ease;
        }
        .hx-a:hover{ letter-spacing:.3px; transform: translateY(-1px); background: rgba(246,195,32,.16); }
        .hx-a.active{ background: rgba(246,195,32,.26); }


        /* Right actions (Cart first, then Profile) */
        .hx-actions{ display:flex; align-items:center; gap:10px; }
        .hx-ico{
          display:inline-flex; align-items:center; justify-content:center;
          width:44px; height:44px; border-radius:12px; border:none; cursor:pointer;
          background:#fff; box-shadow: 0 10px 26px rgba(0,0,0,.10);
          transition: transform .14s ease, box-shadow .14s ease, background .14s ease;
        }
        .hx-ico:hover{ transform: translateY(-1px) scale(1.02); box-shadow: 0 14px 30px rgba(0,0,0,.14); background: #fff; }
        .hx-badge{
          position:absolute; top:-6px; right:-6px; background: var(--bb-accent); color:#fff;
          border-radius:999px; padding:2px 6px; font-size:12px; font-weight:700;
          box-shadow: 0 2px 12px rgba(240,93,139,.5);
        }

        /* Mobile */
        @media (max-width: 920px){
          .hx-row{ grid-template-columns:auto auto 1fr; }
          .hx-mid{ justify-content:flex-start; }
          .hx-nav{ display:none; }
          .hx-burger{ display:inline-flex; }
          .hx-panel{
            position:fixed; left:0; right:0; top:80px; z-index:69; background:#fff;
            border-bottom:1px solid rgba(0,0,0,.06);
            box-shadow: 0 18px 40px rgba(0,0,0,.12);
            padding: 12px 16px 16px; display:grid; gap:8px;
            animation: drop .24s cubic-bezier(.2,.8,.2,1) both;
          }
          .hx-mitem{
            padding:12px 14px; border-radius:12px; font-weight:700; color:var(--bb-primary);
            background: rgba(246,195,32,.10);
            opacity:.95; transform: translateY(2px);
            transition: transform .16s ease, background .16s ease, opacity .16s ease;
          }
          .hx-mitem:hover{ background: rgba(246,195,32,.22); transform: translateY(0); opacity:1; }
          .hx-mgrid{ display:grid; gap:8px; }
        }
        @media (min-width: 921px){ .hx-burger{ display:none; } }
        @keyframes drop{ from{opacity:0; transform: translateY(-6px);} to{opacity:1; transform:none;} }
      `}</style>

      <div className="hx-shell">
        <div className="hx-row">
          {/* LEFT: Brand (logo + title, slightly left) */}
          <Link to="/" className="hx-brand" aria-label="Blossom & Buds home">
            <img
              src={Logo}
              alt="Blossom & Buds logo"
              width={46}
              height={46}
              style={{ borderRadius:12, boxShadow:"0 4px 16px rgba(0,0,0,.10)" }}
            />
            <span className="hx-title">
              Blossom & Buds
              <br/><span style={{fontWeight:600, opacity:.9}}>Floral Artistry</span>
            </span>
          </Link>

          {/* CENTER: Independent items + animated ink bar */}
          <div className="hx-mid">
            <div
              className="hx-nav"
              ref={listRef}
              onMouseLeave={() => {
                const activeKey =
                  links.find(l => (l.exact ? pathnameOnly === l.to : pathnameOnly.startsWith(l.to)))?.to || null;
                moveBarTo(activeKey);
              }}
            >
              {/* Ink bar */}
              <div
                ref={barRef}
                className="hx-ink"
                style={{
                  // CSS vars used by transitions
                  // Fallbacks ensure no layout jump on first render
                  ["--x" as any]: `${bar.left}px`,
                  ["--w" as any]: `${bar.width}px`,
                  ["--o" as any]: bar.visible ? 1 : 0
                }}
              />
              {links.map(l => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={!!l.exact}
                  className={({isActive}) => "hx-a" + (isActive ? " active" : "")}
                  ref={(el)=> (itemRefs.current[l.to] = el)}
                  onMouseEnter={()=>moveBarTo(l.to)}
                  onFocus={()=>moveBarTo(l.to)}
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* RIGHT: Cart first, then Profile */}
          <div className="hx-actions">
            {/* Burger (mobile only) */}
            <button className="hx-ico hx-burger" aria-label="Menu" title="Menu" onClick={()=>setOpen(v=>!v)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--bb-primary)" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Cart */}
            <button
              className="hx-ico"
              aria-label="Cart"
              title="Cart"
              onClick={()=>navigate("/cart")}
              style={{ position:"relative" }}
            >
              <CartSVG/>
              {count>0 && <span className="hx-badge">{count}</span>}
            </button>

            {/* Profile */}
            <button
              className="hx-ico"
              aria-label="Profile"
              title={user ? "My profile" : "Login / Register"}
              onClick={() => {
                if (user?.id) {
                  navigate("/profile");
                } else {
                  // 👇 pass BOTH 'from' and 'background'
                  navigate("/login", { state: { from, background: location } });
                }
              }}
            >
              <ProfileSVG/>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE PANEL */}
      {open && (
        <div className="hx-panel">
          <div className="hx-mgrid">
            {links.map((l,i)=>(
              <NavLink
                key={l.to}
                to={l.to}
                end={!!l.exact}
                className="hx-mitem"
                onClick={()=>setOpen(false)}
                style={{ transitionDelay: `${i*30}ms` }}
              >
                {l.label}
              </NavLink>
            ))}
          </div>
          <div style={{display:"flex", gap:10, marginTop:10}}>
            <button className="hx-ico" aria-label="Cart" title="Cart" onClick={() => { navigate("/cart"); setOpen(false);  }} style={{position:"relative"}}>
              <CartSVG/>{count>0 && <span className="hx-badge">{count}</span>}
            </button>
            <button className="hx-ico" aria-label="Profile" title="Login / Profile" onClick={() => {
                                                                                      if (user?.id) {
                                                                                        navigate("/profile");
                                                                                      } else {
                                                                                        // 👇 pass BOTH 'from' and 'background'
                                                                                        navigate("/login", { state: { from, background: location } });
                                                                                      } ;setOpen(false);
                                                                                    }}>
              <ProfileSVG/>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
