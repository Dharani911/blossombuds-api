// src/components/home/Hero.tsx
import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../api/base";
import { Link } from "react-router-dom";

/** Fallbacks if API returns nothing */
const FALLBACK_IMAGES: string[] = [];

type FeatureImageDto = {
  key: string;
  url: string;
  altText?: string | null;
  sortOrder?: number | null;
};

const ENDPOINT = "/api/settings/ui/feature-images";

export default function Hero() {
  const [slides, setSlides] = useState<{ url: string; alt: string }[] | null>(null);
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  // Load from settings (public)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          apiUrl(ENDPOINT),
          {
            method: "GET",
            //credentials: "include",
            headers: { Accept: "application/json" },
          }
        );

        if (!res.ok) {
          if (alive) setSlides([]);
          return;
        }

        const json = (await res.json()) as FeatureImageDto[];
        console.log("feature images JSON", json); // ← TEMP: see what backend returns

        const usable = (Array.isArray(json) ? json : [])
          .filter((x) => !!x?.url) // make sure backend is actually sending 'url'
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((x) => ({
            url: normalizeUrlForPhone(x.url),
            alt: (x.altText || "").trim(),
          }))
          .filter((x) => !!x.url);

        console.log("usable slides", usable);      // ← TEMP

        if (alive) setSlides(usable);
      } catch (e) {
        console.error("feature images load failed", e);
        if (alive) setSlides([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);


  // Crossfade every 6s
    useEffect(() => {
      const imgs =
        slides && slides.length
          ? slides
          : FALLBACK_IMAGES.map((u) => ({ url: u, alt: "" }));

      if (!imgs.length) return; // no images → no timer / no modulo 0

      timer.current = window.setInterval(() => {
        setIdx((i) => (i + 1) % imgs.length);
      }, 6000);
      return () => { if (timer.current) window.clearInterval(timer.current); };
    }, [slides]);


    const frames =
      slides && slides.length
        ? slides
        : FALLBACK_IMAGES.map((u) => ({ url: u, alt: "" }));


  const goto = (n: number) => setIdx(n % frames.length);

  return (
    <section className="hp-hero" aria-label="Showcase">
      <style>{styles}</style>

      {/* 16:9 stage */}
      <div className="stage" role="region" aria-roledescription="carousel">
        {frames.map((f, i) => (
          <div key={`${i}-${f.url}`} className={`slide ${i === idx ? "on" : ""}`}>
            <img
              src={f.url}
              alt={f.alt || ""}
              loading={i === idx ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </div>
        ))}

        {/* Dots */}
        {frames.length > 1 && (
          <div className="dots" role="tablist" aria-label="Hero slides">
            {frames.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Slide ${i + 1}`}
                className={`dot ${i === idx ? "on" : ""}`}
                onClick={() => goto(i)}
              />
            ))}
          </div>
        )}

        {/* DESKTOP/TABLET ONLY: overlay glass panel */}
        <div className="content overlay-only">
          <div className="panel">
            <h1>Blossom Buds Floral Artistry</h1>
            <p className="tag">Handcrafted floral accessories — lightweight, durable, made to order.</p>
            <div className="actions">
              <Link to="/featured" className="btn">Shop Featured</Link>
              <Link to="/categories" className="btn secondary">Browse Categories</Link>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE ONLY: glass panel BELOW carousel */}
      <div className="panel-below mobile-only">
        <div className="panel">
          <h1>Blossom Buds Floral Artistry</h1>
          <p className="tag">Handcrafted floral accessories — lightweight, durable, made to order.</p>
          <div className="actions">
            <Link to="/featured" className="btn">Shop Featured</Link>
            <Link to="/categories" className="btn secondary">Browse Categories</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Make localhost/127.* usable from phone via Vite proxy (strip origin). */
function normalizeUrlForPhone(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || host.endsWith(".lan");
    return isLocal ? u.pathname + (u.search || "") : raw;
  } catch {
    return /^https?:\/\//i.test(raw) ? raw : "/" + raw.replace(/^\/+/, "");
  }
}

const styles = `
.hp-hero{
  padding: 6px 0 14px;
  background: var(--bb-bg);
  padding-left: max(0px, env(safe-area-inset-left, 0px));
  padding-right: max(0px, env(safe-area-inset-right, 0px));
}

/* --- 16:9 COMPACT STAGE --- */
.stage{
  position: relative;
  width: min(1200px, 100%);
  margin: 8px auto 0;
  aspect-ratio: 16/7;      /* exact 16:9 */
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 12px 34px rgba(0,0,0,.12);
  background: var(--bb-bg); /* #FAF7E7 ivory yellow from your theme */

}
@media (min-width: 920px){
  .stage{ border-radius: 16px; box-shadow: 0 16px 42px rgba(0,0,0,.12); }
}

/* Slides (crossfade) */
.slide{ position:absolute; inset:0; opacity:0; transition: opacity .6s ease; }
.slide.on{ opacity:1; }
.slide img{
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit: cover; object-position: center;
  transform: translateZ(0);
}

/* Dots — tiny */
.dots{
  position:absolute; left:50%; transform: translateX(-50%);
  bottom: 8px; display:flex; gap:8px; padding:4px 6px;
  background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px; backdrop-filter: blur(4px) saturate(120%);
}
.dot{ width:8px; height:8px; border-radius:999px; border:none; cursor:pointer; background: rgba(255,255,255,.55); }
.dot.on{ background:#fff; width:16px; transition: width .15s ease; }

/* --- GLASS PANEL SHARED STYLES --- */
.panel{
  margin: 0 auto;
  width: min(920px, 100%);
  color:#fff; text-align:center;
  background: radial-gradient(120% 120% at 50% 0%, rgba(0,0,0,.18), rgba(0,0,0,.42));
  border: 1px solid rgba(255,255,255,.15);
  backdrop-filter: blur(4px) saturate(120%);
  box-shadow: 0 18px 48px rgba(0,0,0,.22);
  border-radius: 16px; padding: 16px 18px;
  text-shadow: 0 1px 0 rgba(0,0,0,.35);
}
.panel h1{
  margin:0 0 6px; font-weight:900; letter-spacing:.2px;
  font-size: clamp(20px, 5vw, 34px);
  color:#fff !important;
  text-shadow: 0 2px 8px rgba(0,0,0,.45);
}
.tag{
  margin: 0;
  opacity: .95;
  font-size: clamp(13px, 3.4vw, 16px);
  color:#fff !important;
}
.actions{
  display:flex; gap:10px; margin-top: 12px; flex-wrap: wrap; justify-content:center;
}
.btn{
  display:inline-flex; align-items:center; justify-content:center;
  min-height: 44px; padding:.7rem 1.1rem;
  border-radius:999px; border:none; cursor:pointer;
  background: var(--bb-accent); color:#fff; font-weight:900; letter-spacing:.2px;
  box-shadow: 0 12px 28px rgba(240,93,139,.28); text-decoration: none;
}
.btn.secondary{
  background: var(--bb-accent-2);
  color:#2b2b2b;
  box-shadow: 0 12px 28px rgba(246,195,32,.24);
}

/* --- VISIBILITY RULES --- */
/* By default (desktop/tablet): overlay is visible, below-panel hidden */
.overlay-only{ position:absolute; inset:0; display:grid; place-items:center; padding: 0 12px; }
.mobile-only{ display:none; }

/* On small screens: hide overlay, show panel below */
@media (max-width: 560px){
  .overlay-only{ display:none; }
  .mobile-only{ display:block; }

  .stage{ margin: 6px 8px 0; box-shadow: 0 12px 32px rgba(0,0,0,.12); }
  .panel-below{ width: min(1200px, 100%); margin: 10px auto 0; padding: 0 8px; }
  .panel{ padding: 12px 12px; border-radius: 12px; }

  /* bigger brand title on mobile, but safe */
  .panel h1{
    font-size: clamp(20px, 8.5vw, 25px);  /* ↑ was smaller; now more presence */
    line-height: 1;                    /* tighter for fewer lines */
    letter-spacing: .25px;
    margin-bottom: 10px;                  /* a bit more breathing room above buttons */
    text-wrap: balance;                   /* nicer breaks on supported browsers */
  }

  .actions{
    display:flex;
    gap:8px;
    flex-wrap: nowrap;          /* do not wrap */
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }
  .actions .btn{
    flex: 0 1 auto;             /* shrink if needed */
    min-width: auto;
    width: 250px;
    white-space: nowrap;
    padding: .6rem 1rem;
  }
}


/* Motion safety */
@media (prefers-reduced-motion: reduce){
  .slide{ transition: none; }
}

`;
