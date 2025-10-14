import React, { useRef } from "react";
import { Link } from "react-router-dom";

/** TODO: replace with your API data */
const MOCK = [
  { id:"p1", name:"Peony Hair Pin", price:899,  img:"https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=70&auto=format&fit=crop" },
  { id:"p2", name:"Rose Maang Tikka", price:1099, img:"https://images.unsplash.com/photo-1528892952291-009c663ce843?w=900&q=70&auto=format&fit=crop" },
  { id:"p3", name:"Jasmine Bracelet", price:749,  img:"https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&q=70&auto=format&fit=crop" },
  { id:"p4", name:"Marigold Earrings", price:1299, img:"https://images.unsplash.com/photo-1526045478516-99145907023c?w=900&q=70&auto=format&fit=crop" },
  { id:"p5", name:"Orchid Choker", price:1999, img:"https://images.unsplash.com/photo-1520975922284-88c8fc132a14?w=900&q=70&auto=format&fit=crop" },
  { id:"p6", name:"Lotus Hair Vine", price:1699, img:"https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=70&auto=format&fit=crop" },
];

export default function ProductShowcase() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCards = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ps-card");
    const gap = 16;
    const step = card ? card.offsetWidth + gap : 300;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  return (
    <section className="ps" aria-label="New arrivals">
      <style>{styles}</style>

      {/* Full-bleed header (edge-to-edge, with safe gutters) */}
      <div className="ps-head">
        <h2>New Arrivals</h2>
        <div className="ps-controls">
          <button className="ps-nav" aria-label="Previous" onClick={()=>scrollByCards("left")}>‹</button>
          <button className="ps-nav" aria-label="Next" onClick={()=>scrollByCards("right")}>›</button>
          <Link to="/products" className="ps-link">View all ↗</Link>
        </div>
      </div>

      {/* Full-bleed carousel lane */}
      <div className="ps-lane" ref={trackRef}>
        {[...MOCK, ...MOCK].map((p, i) => (
          <article key={p.id + "-" + i} className="ps-card">
            <Link to={`/products/${p.id}`} className="ps-img" aria-label={p.name}>
              <img src={p.img} alt="" loading="lazy" decoding="async" />
            </Link>
            <div className="ps-body">
              <div className="ps-title">{p.name}</div>
              <div className="ps-row2">
                <div className="ps-price">₹{p.price}</div>
                <div className="ps-actions">
                  <Link to={`/products/${p.id}`} className="ps-btn secondary">View</Link>
                  <button className="ps-btn">Add</button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ————————————— STYLES ————————————— */
const styles = `
/* Force TRUE full-bleed: take over the viewport width regardless of parent containers. */
.ps{
  position: relative;
  left: 50%;              /* center reference */
  right: 50%;
  margin-left: -50vw;     /* pull to left edge of viewport */
  margin-right: -50vw;    /* pull to right edge */
  width: 100vw;           /* exactly full viewport width */
  background: var(--bb-bg);
  padding-top: 8px;
  padding-bottom: 24px;
}

/* Safe side gutters for header and lane content */
.ps-head,
.ps-lane {
  padding-left: clamp(8px, 3vw, 28px);
  padding-right: clamp(8px, 3vw, 28px);
}

/* Header row */
.ps-head{
  display:flex; align-items:center; justify-content:space-between;
  gap: 12px; margin-bottom: 10px;
}
.ps-head h2{ margin:0; color: var(--bb-primary); }
.ps-controls{ display:flex; align-items:center; gap: 8px; }
.ps-link{ font-weight: 900; color: var(--bb-primary); }
.ps-nav{
  width: 38px; height: 38px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-size: 18px; line-height: 1; color: var(--bb-primary);
}

/* Carousel lane: strictly horizontal — no grid fallback */
.ps-lane{
  overflow: hidden;                /* hide scrollbar track */
}
.ps-lane::-webkit-scrollbar{ display:none; } /* hide on webkit */
.ps-lane {
  scrollbar-width: none;           /* hide on Firefox */
}

/* use an inner flex track to enable snap and gaps */
.ps-lane{
  display: flex;
  gap: 16px;
  overflow-x: auto;                /* scrolling only on X */
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* edge fade for polish */
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
}

/* Cards: a fixed-ish min width that adapts by viewport */
.ps-card{
  flex: 0 0 auto;                                /* don't shrink; side by side */
  width: clamp(220px, 24vw, 300px);              /* responsive card width */
  scroll-snap-align: start;
  background:#fff; border-radius:16px; overflow:hidden; display:flex; flex-direction:column;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 12px 34px rgba(0,0,0,.10);
}

/* Media */
.ps-img{ position:relative; display:block; }
.ps-img::after{
  content:""; display:block; width:100%; padding-top: 66.6667%; background:#eee; /* 3:2 ratio placeholder */
}
.ps-img img{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  border-bottom: 1px solid rgba(0,0,0,.06);
}

/* Body */
.ps-body{ padding: 12px 14px; display:grid; gap:6px; }
.ps-title{ font-weight:900; color: var(--bb-primary); }
.ps-row2{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.ps-price{ font-weight:900; }
.ps-actions{ display:flex; gap: 8px; }
.ps-btn{
  display:inline-flex; align-items:center; justify-content:center; padding:.55rem .9rem;
  border-radius:999px; border:none; cursor:pointer; background:var(--bb-accent); color:#fff; font-weight:900;
}
.ps-btn.secondary{
  background: var(--bb-accent-2); color:#2b2b2b;
}
`;
