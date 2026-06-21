import React from "react";

/* ── Icons ─────────────────────────────────────────────────── */
function IconScissors() {
  return (
    <svg className="ft-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="14" cy="28" r="6" stroke="#F05D8B" strokeWidth="1.4"/>
      <circle cx="14" cy="16" r="6" stroke="#F05D8B" strokeWidth="1.4"/>
      <path d="M19 27L38 10" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M19 17L38 34" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconPackage() {
  return (
    <svg className="ft-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="7" y="18" width="30" height="20" rx="2" stroke="#F05D8B" strokeWidth="1.4"/>
      <path d="M7 24H37" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M16 18C16 18 16 10 22 10C28 10 28 18 28 18" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 30L21 32L25 28" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconFeather() {
  return (
    <svg className="ft-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M9 37C13 33 30 12 38 7C38 7 40 20 32 28C24 36 9 37 9 37Z" stroke="#F05D8B" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9 37L22 23" stroke="#F05D8B" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M16 16L13 19" stroke="#F05D8B" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M21 13L17 20" stroke="#F05D8B" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M27 11L22 21" stroke="#F05D8B" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M33 13L27 24" stroke="#F05D8B" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

/* ── Data ──────────────────────────────────────────────────── */
const items = [
  {
    title: "Made to order",
    text: "Each piece is crafted around your brief, colours, flowers, and celebration style.",
    Icon: IconScissors,
  },
  {
    title: "Shipped with care",
    text: "Protective packing and trackable delivery help every order arrive beautifully.",
    Icon: IconPackage,
  },
  {
    title: "Lightweight elegance",
    text: "Designed for comfort, movement, and all-day wear without losing visual richness.",
    Icon: IconFeather,
  },
];

/* ── Component ─────────────────────────────────────────────── */
export default function FeatureTiles() {
  return (
    <section className="ft-wrap" aria-label="Brand highlights">
      <style>{styles}</style>

      <div className="ft-accent-bar" aria-hidden="true" />

      <div className="ft-shell">
        {items.map(({ title, text, Icon }) => (
          <div key={title} className="ft-tile">
            <Icon />
            <div className="ft-pip" aria-hidden="true" />
            <h3 className="ft-title">{title}</h3>
            <p className="ft-body">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const styles = `
.ft-wrap{
  width:100%;
  background:linear-gradient(160deg,#1E1C10 0%,#252318 55%,#1A1810 100%);
  position:relative;
  overflow:hidden;
}

/* Top gradient accent line */
.ft-accent-bar{
  height:2px;
  background:linear-gradient(
    90deg,
    transparent 0%,
    #F05D8B 25%,
    #F9BDD0 50%,
    #F05D8B 75%,
    transparent 100%
  );
}

.ft-shell{
  display:flex;
  max-width:1280px;
  margin:0 auto;
}

/* ── Tile ── */
.ft-tile{
  flex:1;
  padding:clamp(44px,6.5vw,80px) clamp(28px,4vw,56px);
  border-left:1px solid rgba(255,255,255,.07);
  position:relative;
  overflow:hidden;
  transition:background .35s ease;
}

.ft-tile:first-child{
  border-left:none;
}

.ft-tile:hover{
  background:rgba(255,255,255,.026);
}

/* Radial pink glow on hover */
.ft-tile::after{
  content:'';
  position:absolute;
  inset:0;
  background:radial-gradient(
    ellipse at 24% 65%,
    rgba(240,93,139,.10) 0%,
    transparent 65%
  );
  opacity:0;
  transition:opacity .4s ease;
  pointer-events:none;
}

.ft-tile:hover::after{
  opacity:1;
}

/* ── Icon ── */
.ft-icon{
  display:block;
  width:44px;
  height:44px;
  margin-bottom:22px;
  flex-shrink:0;
}

/* Small pink dot separator between icon and heading */
.ft-pip{
  width:28px;
  height:2px;
  background:linear-gradient(90deg, #F05D8B, rgba(240,93,139,.3));
  border-radius:2px;
  margin-bottom:20px;
}

/* ── Heading ── */
.ft-title{
  margin:0 0 14px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(20px,2.2vw,28px);
  font-weight:400;
  color:#F5F0E4;
  line-height:1.18;
}

/* ── Body ── */
.ft-body{
  margin:0;
  font-size:14px;
  line-height:1.8;
  color:rgba(245,240,228,.50);
  max-width:26ch;
}

/* ── Mobile ── */
@media (max-width:720px){
  .ft-shell{
    flex-direction:column;
    padding:0 clamp(20px,6vw,32px);
  }

  .ft-tile{
    border-left:none;
    border-top:1px solid rgba(255,255,255,.07);
    padding:clamp(28px,6vw,44px) 0;
    display:flex;
    flex-direction:row;
    align-items:flex-start;
    gap:18px;
  }

  .ft-tile:first-child{
    border-top:none;
  }

  /* On mobile: icon on the left, text block on the right */
  .ft-icon{
    width:36px;
    height:36px;
    flex-shrink:0;
    margin-bottom:0;
    margin-top:4px;
  }

  .ft-pip{
    display:none;
  }

  .ft-body{
    max-width:none;
  }
}

@media (prefers-reduced-motion:reduce){
  .ft-tile,
  .ft-tile::after{
    transition:none;
  }
}
`;
