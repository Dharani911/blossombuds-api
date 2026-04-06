import React from "react";

const items = [
  {
    title: "Made to order",
    text: "Each piece is crafted around your brief, colours, flowers, and celebration style.",
    icon: "✦",
  },
  {
    title: "Shipped with care",
    text: "Protective packing and trackable delivery help every order arrive beautifully.",
    icon: "↗",
  },
  {
    title: "Lightweight elegance",
    text: "Designed for comfort, movement, and all-day wear without losing visual richness.",
    icon: "❋",
  },
];

export default function FeatureTiles() {
  return (
    <section className="ft-wrap" aria-label="Brand highlights">
      <style>{styles}</style>

      <div className="ft-shell">
        {items.map((item) => (
          <article key={item.title} className="ft-card">
            <div className="ft-mark" aria-hidden="true">
              <span>{item.icon}</span>
            </div>

            <div className="ft-copy">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles = `
.ft-wrap{
  width:100%;
  padding: clamp(16px, 2.8vw, 24px) 0 clamp(8px, 1.6vw, 14px);
}

.ft-shell{
  width:min(1220px, calc(100% - 14px));
  margin:0 auto;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap:14px;
}

.ft-card{
  position:relative;
  display:flex;
  align-items:flex-start;
  gap:14px;
  min-height:148px;
  padding:20px 18px;
  border-radius:24px;
  overflow:hidden;
  background:
    linear-gradient(180deg, rgba(255,255,255,.94), rgba(255,250,252,.82)),
    linear-gradient(135deg, rgba(255,255,255,.86), rgba(255,247,250,.72));
  border:1px solid rgba(74,79,65,.08);
  box-shadow:
    0 16px 34px rgba(33,28,23,.06),
    0 6px 16px rgba(33,28,23,.03),
    inset 0 1px 0 rgba(255,255,255,.92);
  backdrop-filter: blur(10px);
  transition:
    transform .28s cubic-bezier(.22,.61,.36,1),
    box-shadow .28s ease,
    border-color .28s ease;
}

.ft-card::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  background:
    linear-gradient(135deg, rgba(240,93,139,.07) 0%, rgba(246,195,32,.05) 42%, rgba(255,255,255,0) 78%);
  pointer-events:none;
}

.ft-card::after{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
  pointer-events:none;
}

@media (hover:hover){
  .ft-card:hover{
    transform: translateY(-4px);
    box-shadow:
      0 22px 44px rgba(33,28,23,.10),
      0 10px 22px rgba(33,28,23,.05),
      inset 0 1px 0 rgba(255,255,255,.96);
    border-color: rgba(240,93,139,.16);
  }

  .ft-card:hover .ft-mark{
    transform: translateY(-1px) scale(1.03);
    box-shadow:
      0 12px 26px rgba(240,93,139,.12),
      inset 0 1px 0 rgba(255,255,255,.92);
  }
}

.ft-mark{
  position:relative;
  z-index:1;
  width:46px;
  height:46px;
  flex:0 0 46px;
  display:grid;
  place-items:center;
  border-radius:15px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(249,245,242,.96));
  border:1px solid rgba(74,79,65,.06);
  color: var(--bb-accent);
  box-shadow:
    0 10px 22px rgba(33,28,23,.05),
    inset 0 1px 0 rgba(255,255,255,.92);
  transition: transform .28s ease, box-shadow .28s ease;
}

.ft-mark span{
  display:block;
  font-size:20px;
  font-weight:900;
  line-height:1;
  transform: translateY(-1px);
}

.ft-copy{
  position:relative;
  z-index:1;
  display:grid;
  align-content:start;
  gap:7px;
  min-width:0;
  flex:1;
}

.ft-copy h3{
  margin:0;
  color: var(--bb-primary);
  font-family:"Cinzel","DM Serif Display",Georgia,serif;
  font-size:18px;
  font-weight:700;
  line-height:1.18;
  letter-spacing:-.01em;
}

.ft-copy p{
  margin:0;
  color:#6f766b;
  font-size:14px;
  line-height:1. सात;
  line-height:1.68;
  max-width:34ch;
}

/* tablet */
@media (max-width: 980px){
  .ft-shell{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ft-card{
    min-height:140px;
  }
}

/* mobile */
@media (max-width: 640px){
  .ft-wrap{
    padding: 12px 0 8px;
  }

  .ft-shell{
    width: calc(100% - 10px);
    grid-template-columns: 1fr;
    gap:12px;
  }

  .ft-card{
    min-height:unset;
    padding:16px 14px;
    border-radius:20px;
    gap:12px;
  }

  .ft-mark{
    width:42px;
    height:42px;
    flex-basis:42px;
    border-radius:13px;
  }

  .ft-mark span{
    font-size:18px;
  }

  .ft-copy{
    gap:5px;
  }

  .ft-copy h3{
    font-size:16px;
    line-height:1.18;
  }

  .ft-copy p{
    max-width:none;
    font-size:13.5px;
    line-height:1.6;
  }
}

/* 360 x 800 focus */
@media (max-width: 390px){
  .ft-shell{
    width: calc(100% - 8px);
    gap:10px;
  }

  .ft-card{
    padding:14px 12px;
    gap:11px;
    border-radius:18px;
  }

  .ft-mark{
    width:40px;
    height:40px;
    flex-basis:40px;
    border-radius:12px;
  }

  .ft-mark span{
    font-size:17px;
  }

  .ft-copy h3{
    font-size:15.5px;
  }

  .ft-copy p{
    font-size:13px;
    line-height:1.56;
  }
}

@media (prefers-reduced-motion: reduce){
  .ft-card,
  .ft-mark{
    transition:none;
  }
}
`;