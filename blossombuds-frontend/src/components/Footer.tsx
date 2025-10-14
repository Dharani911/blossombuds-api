import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
//import { getSetting } from "../api/settings";


/** Fetch a setting by key directly (robust to JSON or plain text) */
async function fetchSettingValue(key: string): Promise<string> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json === "string") return json;
      if (typeof (json as any)?.value === "string") return (json as any).value;
      if (typeof (json as any)?.url === "string") return (json as any).url;
      if (typeof (json as any)?.link === "string") return (json as any).link;
      return "";
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

/** Normalize a URL; if missing protocol, add https:// */
function normalizeUrl(u: string) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

export default function Footer() {
  const [ig, setIg] = useState<string>("");
//const ENV_IG = import.meta.env.VITE_BRAND_INSTAGRAM || "";
useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const url = await getSetting<string>("brand.instagram");
      if (alive) setInstagram(url || ENV_IG || "");
    } catch (e:any) {
      // Ignore 401/403 (admin-only), use env fallback or hide
      setInstagram(ENV_IG || "");
    }
  })();
  return () => { alive = false; };
}, []);

  const year = new Date().getFullYear();

  return (
    <footer className="bb-footer" role="contentinfo">
      <style>{styles}</style>

      {/* Top */}
      <div className="ft-wrap">
        {/* Brand */}
        <div className="ft-col brand">
          <div className="ft-logo">
            <img src="/src/assets/BB_logo.svg" alt="" className="ft-logo-img" />
            <div className="ft-name">
              <strong>Blossom Buds</strong>
              <span>Floral Artistry</span>
            </div>
          </div>
          <p className="ft-tag">
            Handcrafted floral accessories for weddings, festivals, and everyday elegance.
          </p>

          <div className="ft-social">
            {ig && (
              <a className="soc-btn" href={ig} target="_blank" rel="noreferrer" aria-label="Instagram">
                <InstagramIcon />
              </a>
            )}
          </div>
        </div>

        {/* Explore */}
        <div className="ft-col">
          <div className="ft-head">Explore</div>
          <nav className="ft-nav">
            <Link to="/">Home</Link>
            <Link to="/featured">Featured</Link>
            <Link to="/categories">Categories</Link>
            <Link to="/reviews">Reviews</Link>
          </nav>
        </div>

        {/* Company / Policies */}
        <div className="ft-col">
          <div className="ft-head">Company</div>
          <nav className="ft-nav">
            <Link to="/pages/about">About Us</Link>
            <Link to="/pages/terms">Terms &amp; Conditions</Link>
            <Link to="/pages/privacy">Privacy Policy</Link>
            <Link to="/pages/disclaimer">Disclaimer</Link>
          </nav>
        </div>
      </div>

      {/* Bottom */}
      <div className="ft-bottom">
        <div className="ft-bottom-wrap">
          <div className="ft-copy">© {year} Blossom Buds Floral Artistry. All rights reserved.</div>
          <div className="ft-bottom-links">
            <Link to="/pages/privacy">Privacy</Link>
            <Link to="/pages/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.3 2.4.6.6.3 1 .6 1.5 1.1.5.5.8.9 1.1 1.5.3.5.5 1.2.6 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.9-.6 2.4-.3.6-.6 1-1.1 1.5-.5.5-.9.8-1.5 1.1-.5.3-1.2.5-2.4.6-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.3-2.4-.6-.6-.3-1-.6-1.5-1.1-.5-.5-.8-.9-1.1-1.5-.3-.5-.5-1.2-.6-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.9.6-2.4.3-.6.6-1 1.1-1.5.5-.5.9-.8 1.5-1.1.5-.3 1.2-.5 2.4-.6C8.4 2.2 8.8 2.2 12 2.2m0-2.2C8.8 0 8.4 0 7 0 5.7.1 4.8.3 4 .7 3.1 1.2 2.4 1.9 1.9 2.8c-.4.8-.6 1.7-.7 3C1.1 7.1 1.1 7.5 1.1 12s0 4.9.1 6.2c.1 1.3.3 2.2.7 3 .5.9 1.2 1.6 2.1 2.1.8.4 1.7.6 3 .7 1.3.1 1.7.1 6.2.1s4.9 0 6.2-.1c1.3-.1 2.2-.3 3-.7.9-.5 1.6-1.2 2.1-2.1.4-.8.6-1.7.7-3 .1-1.3.1-1.7.1-6.2s0-4.9-.1-6.2c-.1-1.3-.3-2.2-.7-3-.5-.9-1.2-1.6-2.1-2.1-.8-.4-1.7-.6-3-.7C15.1.1 14.7 0 12 0z"
      />
      <path
        fill="currentColor"
        d="M12 5.8A6.2 6.2 0 1 0 12 18.2 6.2 6.2 0 1 0 12 5.8m0 10.2A4 4 0 1 1 12 8a4 4 0 0 1 0 8zM18.4 4.9a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 1 0 0-2.8z"
      />
    </svg>
  );
}

const styles = `
.bb-footer{
  color: var(--bb-primary);
  background:
    linear-gradient(180deg, rgba(74,79,65,.06), rgba(74,79,65,.12)),
    #F3ECD4; /* slightly deeper than #FAF7E7 for separation */
  border-top: 1px solid rgba(0,0,0,.06);
}

/* Top area */
.ft-wrap{
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
  display: grid;
  gap: 18px;
  grid-template-columns: 2fr 1fr 1fr; /* brand, explore, company */
}
.ft-col .ft-head{
  font-weight: 900;
  margin-bottom: 8px;
  letter-spacing: .2px;
}
.brand .ft-logo{
  display: flex; align-items: center; gap: 10px;
}
.ft-logo-img{ width: 40px; height: 40px; object-fit: contain; }
.ft-name{ display: grid; line-height: 1.05; }
.ft-name strong{ font-weight: 900; }
.ft-name span{ font-size: 12px; opacity: .95; }

.ft-tag{
  margin: 8px 0 10px;
  opacity: .92;
  max-width: 42ch;
}

.ft-social{ display: flex; gap: 10px; }
.soc-btn{
  width: 38px; height: 38px; border-radius: 12px;
  display: grid; place-items: center;
  color: #fff; background: radial-gradient(120% 140% at 30% 0%, #F05D8B, #F6C320);
  text-decoration: none;
}

/* Links */
.ft-nav{ display: grid; gap: 6px; }
.ft-nav a{
  color: var(--bb-primary); text-decoration: none; opacity: .95;
}
.ft-nav a:hover{ text-decoration: underline; }

/* Bottom bar */
.ft-bottom{
  border-top: 1px solid rgba(0,0,0,.06);
  background: rgba(74,79,65,.04);
}
.ft-bottom-wrap{
  max-width: 1200px; margin: 0 auto; padding: 10px 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 13px;
}
.ft-bottom-links{ display: flex; gap: 12px; }
.ft-bottom a{ color: var(--bb-primary); text-decoration: none; }
.ft-bottom a:hover{ text-decoration: underline; }

/* Responsive */
@media (max-width: 960px){
  .ft-wrap{ grid-template-columns: 1fr 1fr; }
  .brand{ order: -1; }
}
@media (max-width: 560px){
  .ft-wrap{ grid-template-columns: 1fr; }
  .ft-bottom-wrap{ flex-direction: column; align-items: flex-start; gap: 6px; }
}
`;
