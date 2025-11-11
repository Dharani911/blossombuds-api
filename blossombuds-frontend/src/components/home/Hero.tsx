// src/components/home/Hero.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { listFeatureImagesPublic, type FeatureImage } from "../../api/featureImages";

/** Fallback hero images if admin hasn't configured any yet */
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1400&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526045478516-99145907023c?w=1400&q=70&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1528892952291-009c663ce843?w=1400&q=70&auto=format&fit=crop",
];

export default function Hero() {
  const [urls, setUrls] = useState<string[] | null>(null); // null = loading, [] = none
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  // Load admin-managed carousel images once
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await listFeatureImagesPublic(); // [{ key, url, altText, sortOrder }]
        if (!live) return;
        const valid = (Array.isArray(list) ? list : [])
          .filter((x: FeatureImage) => !!x?.url)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setUrls(valid.length ? valid.map((x) => x.url) : []);
      } catch {
        if (!live) return;
        setUrls([]); // fall back to static set
      }
    })();
    return () => { live = false; };
  }, []);

  // Crossfade timer
  useEffect(() => {
    const images = urls && urls.length ? urls : FALLBACK_IMAGES;
    timer.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % images.length);
    }, 6000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [urls]);

  const images = urls === null
    ? FALLBACK_IMAGES // while loading, show fallback immediately to avoid blank hero
    : (urls.length ? urls : FALLBACK_IMAGES);

  return (
    <section className="hp-hero">
      <style>{styles}</style>
      <div className="stage">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className={`slide ${i === idx ? "on" : ""}`}>
            {/* Use <img> for native decoding + better perf */}
            <img src={src} alt="" loading="eager" decoding="async" />
          </div>
        ))}

        {/* Darker veil + text panel behind content for guaranteed readability */}
        <div className="veil" />
        <div className="content">
          <div className="panel">
            <h1>Floral accessories, crafted for you</h1>
            <p>
              Elevate weddings, festivals, and everyday looks with artisan-made, lightweight floral pieces.
            </p>
            <div className="actions">
              <Link to="/featured" className="btn">Shop Featured</Link>
              <Link to="/categories" className="btn secondary">Browse Categories</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = `
.hp-hero{
  padding: 0 0 20px;
  padding-left: max(0px, env(safe-area-inset-left, 0px));
  padding-right: max(0px, env(safe-area-inset-right, 0px));
}

/* Stage sizing: mobile-first, never overflows */
.stage{
  position:relative;
  height: clamp(48vh, 62vh, 680px);
  min-height: 320px;
  max-height: 720px;
  overflow:hidden;
  border-radius: 22px;
  margin: 10px auto 0;
  max-width: min(1200px, 100%);
  box-shadow: 0 18px 48px rgba(0,0,0,.14);
}

/* Prefer dvh on modern mobile for browser-UI-safe height */
@supports (height: 100dvh){
  .stage{ height: clamp(46dvh, 58dvh, 66dvh); }
}

/* Tighten on very small devices */
@media (max-width: 560px){
  .stage{
    height: clamp(44vh, 56vh, 60vh);
    min-height: 300px;
    border-radius: 14px;
    margin: 6px 8px 0;
    box-shadow: 0 12px 32px rgba(0,0,0,.12);
  }
}

.slide{ position:absolute; inset:0; opacity:0; transition: opacity .6s ease; }
.slide.on{ opacity:1; }
.slide img{
  width:100%; height:100%; object-fit:cover; object-position:center;
  transform: scale(1.04); transition: transform 5s ease;  /* gentler Ken Burns */
}
.slide.on img{ transform: scale(1.08); }

/* Veil adapts on mobile for stronger readability */
.veil{
  position:absolute; inset:0;
  background:
    linear-gradient(180deg, rgba(0,0,0,.32), rgba(0,0,0,.36));
  mix-blend-mode: multiply;
}
@media (max-width: 560px){
  .veil{
    background:
      linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.55));
  }
}

.content{
  position:absolute; inset:0; display:grid; place-items:center; padding: 0 16px;
}

/* Glass card scales fluidly */
.panel{
  max-width: 820px; width: min(92vw, 820px); text-align:center; color:#fff;
  background: radial-gradient(120% 120% at 50% 0%, rgba(0,0,0,.22), rgba(0,0,0,.45));
  border: 1px solid rgba(255,255,255,.14);
  backdrop-filter: blur(4px) saturate(120%);
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  border-radius: 20px; padding: 18px 20px;
  text-shadow: 0 1px 0 rgba(0,0,0,.35);
}
@media (max-width: 560px){
  .panel{ border-radius: 14px; padding: 14px 14px; }
}

.panel h1{
  margin:0 0 8px; font-weight:900; letter-spacing:.2px;
  font-size: clamp(24px, 6vw, 40px);
  color:#ffffff !important;
  text-shadow: 0 2px 8px rgba(0,0,0,.45);
}
.panel p{
  margin:0; opacity:1;
  font-size: clamp(14px, 3.8vw, 18px);
  line-height: 1.5;
  color:#ffffff !important;
  text-shadow: 0 1px 6px rgba(0,0,0,.45);
}

/* Actions: wrap nicely, big touch targets */
.actions{
  display:flex; gap:10px; margin-top: 14px; flex-wrap: wrap; justify-content:center;
}
.btn{
  display:inline-flex; align-items:center; justify-content:center;
  padding:.8rem 1.25rem; min-height: 44px; border-radius:999px; border:none; cursor:pointer;
  background: var(--bb-accent); color:#fff; font-weight:900; letter-spacing:.2px;
  box-shadow: 0 12px 28px rgba(240,93,139,.38);
  transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.btn:hover{ transform: translateY(-1px); box-shadow: 0 16px 34px rgba(240,93,139,.42); }
.btn:active{ transform: scale(.98); }
.btn.secondary{ background: var(--bb-accent-2); color:#2b2b2b; box-shadow: 0 12px 28px rgba(246,195,32,.28); }
.btn.secondary:hover{ box-shadow: 0 16px 34px rgba(246,195,32,.34); }

/* On narrow screens, let buttons fill rows neatly */
@media (max-width: 420px){
  .actions{ gap:8px; }
  .actions .btn{ flex:1 1 calc(50% - 8px); min-width: 140px; }
}

/* Motion safety */
@media (prefers-reduced-motion: reduce){
  .slide{ transition: none; }
  .slide img, .slide.on img{ transform: none !important; transition: none !important; }
}
`;
