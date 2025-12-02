// src/components/Footer.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../assets/BB_logo.svg";
import {apiUrl} from "../api/base";

/** Fetch a setting by key directly (robust to JSON or plain text) */
async function fetchSettingValue(key: string): Promise<string> {
  try {
    const res = await fetch(apiUrl(`/api/settings/${encodeURIComponent(key)}`), {
      //credentials: "include",
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

  useEffect(() => {
    let alive = true;
    (async () => {
      const envIg = (import.meta as any)?.env?.VITE_BRAND_INSTAGRAM || "";
      const v = await fetchSettingValue("brand.instagram");
      if (!alive) return;
      setIg(normalizeUrl(v || envIg || ""));
    })();
    return () => { alive = false; };
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className="bb-footer-classic" role="contentinfo">
      <style>{styles}</style>

      <div className="bbf-wrap">
        {/* Brand / Social (spans full width on mobile) */}
        <section className="bbf-col brand" aria-labelledby="bbf-brand-head">
          <h2 id="bbf-brand-head" className="sr-only">About Blossom Buds</h2>

          <div className="bbf-brandRow">
            <img src={Logo} alt="Blossom Buds logo" className="bbf-logo" />
            <div className="bbf-brandText">
              {/* single-line, single-style brand name */}
              <div className="bbf-name">Blossom Buds Floral Artistry</div>
            </div>
          </div>

          <p className="bbf-tag">
            Handcrafted floral accessories for weddings, festivals, and everyday elegance.
          </p>

          {ig && (
            <div className="bbf-socialRow">
              <a
                className="bbf-socBtn"
                href={ig}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Instagram"
                title="Open Instagram"
              >
                <InstagramIcon />
              </a>
              {/* separate text link; not inside the icon */}
              <a
                className="bbf-socLink"
                href={ig}
                target="_blank"
                rel="noreferrer"
              >
                Follow us on Instagram for more updates
              </a>
            </div>
          )}
        </section>

        {/* Explore (left on mobile) */}
        <nav className="bbf-col explore" aria-labelledby="bbf-explore-head">
          <div id="bbf-explore-head" className="bbf-head">Explore</div>
          <div className="bbf-links">
            <FooterLink to="/">Home</FooterLink>
            <FooterLink to="/featured">Featured</FooterLink>
            <FooterLink to="/categories">Categories</FooterLink>
            <FooterLink to="/reviews">Reviews</FooterLink>
          </div>
        </nav>

        {/* Company (right on mobile) */}
        <nav className="bbf-col company" aria-labelledby="bbf-company-head">
          <div id="bbf-company-head" className="bbf-head">Company</div>
          <div className="bbf-links">
            <FooterLink to="/pages/about">About Us</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
            <FooterLink to="/policies">Policies</FooterLink>
            <FooterLink to="/pages/terms">Terms &amp; Conditions</FooterLink>
            <FooterLink to="/pages/disclaimer">Disclaimer</FooterLink>
          </div>
        </nav>

      </div>

      <div className="bbf-bottom">
        <div className="bbf-bottomWrap">
          <div className="bbf-copy">
            © {year} Blossom Buds Floral Artistry
            <br />
            <span className="bbf-credit">Crafted &amp; built by Dharani Perumal Samy</span>
          </div>
          <div className="bbf-bottomLinks">
            <FooterLink to="/pages/privacy">Privacy</FooterLink>
            <FooterLink to="/pages/terms">Terms</FooterLink>
          </div>
        </div>
      </div>

    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="bbf-link">
      {children}
    </Link>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
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
:root{
  --bb-pink:#F05D8B;
  --bb-gold:#F6C320;
  --bb-ink:rgba(0,0,0,.08);
  --bb-text:#4A4F41;
}

/* Visually-hidden utility for accessible headings */
.sr-only{
  position:absolute !important;
  width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}

/* Links */
.bbf-link{
  color: var(--bb-text);
  text-decoration: none;
  opacity:.95;
  outline: none;
}
.bbf-link:hover{ text-decoration: underline; }
.bbf-link:focus-visible{
  outline: 2px solid color-mix(in oklab, var(--bb-gold), #000 20%);
  outline-offset: 2px;
  border-radius: 6px;
}

/* --- Classic footer skeleton --- */
.bb-footer-classic{
  color: var(--bb-text);
  background: #F7F2E2;                   /* soft parchment */
  border-top: 1px solid var(--bb-ink);
  font-size: clamp(13px, 3.2vw, 14px);
  width: 100%;
  overflow: clip;                         /* prevent bleed on small screens */
}

/* Top grid */
.bbf-wrap{
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px max(16px, env(safe-area-inset-left, 0px))
           18px max(16px, env(safe-area-inset-right, 0px));
  display: grid;
  gap: 12px 24px;
  grid-template-columns: 1.6fr 1fr 1fr;  /* Desktop: Brand / Explore / Company */
}

/* Section heads */
.bbf-col .bbf-head{
  font-weight: 900;
  font-size: 13px;
  letter-spacing:.2px;
  margin: 2px 0 8px;
  color: #2c2c2c;
}

/* Brand block */
.bbf-brandRow{
  display:flex; align-items:center; gap:10px; min-width:0;
}
.bbf-logo{ width:36px; height:36px; object-fit:contain; flex:0 0 auto; }
.bbf-brandText{ line-height:1.05; min-width:0; }
.bbf-name{
  font-weight:900; font-size:16px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; /* single line */
}

.bbf-tag{
  margin: 8px 0 10px;
  opacity: .92;
  max-width: 52ch;
  line-height: 1.45;
}

/* Social row: icon + separate text link (both visible on all sizes) */
.bbf-socialRow{
  display:flex; align-items:center; gap:10px; flex-wrap: wrap;
}
.bbf-socBtn{
  width:44px; height:44px; border-radius:12px;
  display:grid; place-items:center;
  color:#fff; text-decoration:none;
  background: radial-gradient(120% 140% at 30% 0%, var(--bb-pink), var(--bb-gold));
  box-shadow: 0 6px 16px rgba(240,93,139,.18);
  outline: none;
}
.bbf-socBtn:hover{ transform: translateY(-1px); box-shadow: 0 8px 20px rgba(240,93,139,.24); }
.bbf-socBtn:focus-visible{
  outline: 2px solid color-mix(in oklab, var(--bb-pink), #000 25%);
  outline-offset: 2px;
}
.bbf-socLink{
  font-weight:900;
  letter-spacing:.2px;
  color: var(--bb-text);
  text-decoration: none;
}
.bbf-socLink:hover{ text-decoration: underline; }

/* Links list */
.bbf-links{ display:grid; gap:8px; }

/* Bottom bar */
.bbf-bottom{
  border-top: 1px solid var(--bb-ink);
  background: #F3ECD4;
}
.bbf-bottomWrap{
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px max(16px, env(safe-area-inset-left, 0px))
           max(10px, calc(10px + env(safe-area-inset-bottom, 0px)))
           max(16px, env(safe-area-inset-right, 0px));
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  font-size: 13px;
}
.bbf-bottomLinks{ display:flex; gap:12px; flex-wrap: wrap; }
.bbf-copy{ opacity:.95; }

/* Tablet */
@media (max-width: 960px){
  .bbf-wrap{ grid-template-columns: 1fr 1fr; }
  .bbf-col.brand{ grid-column: 1 / -1; }
}

/* Mobile: Brand (full width) above Explore + Company side-by-side */
@media (max-width: 560px){
  .bbf-wrap{
    grid-template-columns: 1fr 1fr;   /* two columns on mobile */
    gap: 16px 16px;
  }
  .bbf-col.brand{
    grid-column: 1 / -1;              /* brand spans both columns */
    text-align: center;
  }
  .bbf-brandRow{
    justify-content: center;
    gap: 12px;
  }
  .bbf-logo{
    width:48px; height:48px;
  }
  .bbf-name{ font-size:18px; }

  /* keep Explore (left) & Company (right) */
  .bbf-col.explore{ grid-column: 1 / 2; }
  .bbf-col.company{ grid-column: 2 / 3; }

  /* center their headings + links for balance */
  .bbf-col:not(.brand) .bbf-head{ text-align:center; }
  .bbf-links{ justify-items:center; }

  .bbf-bottomWrap{
    flex-direction: column;
    align-items: center;
    gap:8px;
    text-align: center;
  }
}

/* Motion preferences */
@media (prefers-reduced-motion: reduce){
  .bbf-socBtn:hover{ transform:none; }
}
`;
