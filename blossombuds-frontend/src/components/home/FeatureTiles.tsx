// src/components/home/FeatureTiles.tsx
import React from "react";

export default function FeatureTiles() {
  return (
    <section className="ft">
      <style>{styles}</style>
      <div className="container">
        <header className="hdr" aria-hidden="true">
          <span className="dot" />
          <span className="rule" />
        </header>

        <div className="grid" role="list">
          <Tile
            title="Made to Order"
            text="Crafted fresh for your brief — pick the color, vibe, and occasion."
            icon={<SparkIcon />}
          />
          <Tile
            title="Ship Nationwide"
            text="Trackable delivery across India. Protective, eco-minded packing."
            icon={<ArrowIcon />}
          />
          <Tile
            title="Light & Durable"
            text="All-day comfort with reinforced build and skin-friendly finishes."
            icon={<StarIcon />}
          />
        </div>
      </div>
    </section>
  );
}

function Tile({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="tile" role="listitem" tabIndex={0}>
      <div className="ic" aria-hidden="true">
        {icon}
      </div>
      <div className="copy">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <span className="hover-ring" aria-hidden="true" />
    </article>
  );
}

/* Minimal line icons (no external deps) */
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4 12H0M24 12h-4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2l3.2 6.5 7.1 1-5.1 5 1.2 7L12 18l-6.4 3.5 1.2-7-5.1-5 7.1-1L12 2z" />
    </svg>
  );
}

const styles = `
:root{
  --ft-ink: #313131;
  --ft-ink-2: #5a5a5a;
  --ft-ink-soft: rgba(0,0,0,.06);
  --ft-bg: #fff;
  --ft-shadow: 0 10px 28px rgba(0,0,0,.08);
  --ft-accent: var(--bb-accent, #F05D8B);
  --ft-accent-2: var(--bb-accent-2, #F6C320);
}

.ft{
  padding: 18px 0 28px;
  color: var(--ft-ink);
  -webkit-tap-highlight-color: transparent;
  padding-left: max(0px, env(safe-area-inset-left, 0px));
  padding-right: max(0px, env(safe-area-inset-right, 0px));
}
.container{
  max-width:1200px; margin:0 auto;
  padding-left: clamp(12px, 4vw, 16px);
  padding-right: clamp(12px, 4vw, 16px);
}

/* Heading rule */
.hdr{ display:flex; align-items:center; gap:10px; margin: 2px 0 12px; }
.hdr .dot{
  width:8px; height:8px; border-radius:999px; background: var(--ft-accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--ft-accent), transparent 80%);
}
.hdr .rule{
  height:2px; flex:1;
  background: linear-gradient(90deg,
    color-mix(in oklab, var(--ft-accent), #fff 75%),
    color-mix(in oklab, var(--ft-accent-2), #fff 70%));
  border-radius:2px;
}

/* Grid — mobile first */
.grid{
  display:grid;
  grid-template-columns: 1fr;
  gap:12px;
}
@media (min-width: 520px){
  .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; }
}
@media (min-width: 900px){
  .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); gap:14px; }
}

/* Tile card */
.tile{
  position:relative;
  display:flex; align-items:flex-start; gap:12px;
  background: var(--ft-bg); border-radius: 16px; padding: 14px;
  box-shadow: var(--ft-shadow);
  border: 1px solid var(--ft-ink-soft);
  outline:none;
  min-height: 72px;
  touch-action: manipulation;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
}
.tile:active{ transform: scale(.995); }
.tile:hover{ transform: translateY(-2px); box-shadow: 0 14px 34px rgba(0,0,0,.12); }
.tile:focus-visible{
  border-color: color-mix(in oklab, var(--ft-accent), transparent 50%);
  box-shadow: 0 14px 34px rgba(0,0,0,.12), 0 0 0 4px color-mix(in oklab, var(--ft-accent), transparent 85%);
}

/* Icon puck */
.ic{
  flex:0 0 auto;
  width:44px; height:44px; border-radius:12px;
  background: #fff; display:grid; place-items:center;
  color: var(--ft-accent);
  box-shadow: 0 6px 16px rgba(0,0,0,.08), inset 0 0 0 1px var(--ft-ink-soft);
}

/* Copy */
.copy h3{
  margin:0 0 4px;
  color: var(--bb-primary, #4A4F41);
  font-weight:900; letter-spacing:.2px;
  font-size: clamp(15px, 3.4vw, 18px);
  line-height: 1.2;
}
.copy p{
  margin:0;
  color: var(--ft-ink-2);
  line-height: 1.45;
  font-size: clamp(13px, 3.2vw, 15.5px);
}

/* Subtle hover ring (desktop only) */
.hover-ring{
  position:absolute; inset:-2px; border-radius:16px; pointer-events:none;
  background: radial-gradient(120% 200% at 0% 0%, color-mix(in oklab, var(--ft-accent), transparent 92%), transparent 60%);
  opacity:0; transition: opacity .16s ease;
}
@media (hover:hover){
  .tile:hover .hover-ring{ opacity:1; }
}

/* XS phones: tighten padding & icon a bit */
@media (max-width: 380px){
  .tile{ padding: 12px; gap:10px; }
  .ic{ width:40px; height:40px; border-radius:10px; }
}

/* Motion safety */
@media (prefers-reduced-motion: reduce){
  .tile{ transition: none; }
}
`;
