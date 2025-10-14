import React from "react";

/** Replace with API later (latest approved) */
const DATA = [
  { id:"r1", name:"Ananya", rating:5, text:"Absolutely stunning! The detailing is so delicate." },
  { id:"r2", name:"Rhea",   rating:4, text:"Loved the custom color, arrived right on time." },
  { id:"r3", name:"Maya",   rating:5, text:"Beautiful craftsmanship. Got so many compliments!" },
  { id:"r4", name:"Ishita", rating:5, text:"Perfect for my sangeet—lightweight and gorgeous." },
];

export default function Testimonials() {
  return (
    <section className="ts">
      <style>{styles}</style>
      <div className="ts-row">
        <h2>What customers are saying</h2>
      </div>
      <div className="ts-grid">
        {DATA.map(r => (
          <article key={r.id} className="ts-card">
            <div className="ts-text">“{r.text}”</div>
            <div className="ts-meta">
              <div className="ts-avatar">{initials(r.name)}</div>
              <div className="ts-who">
                <div className="ts-name">{r.name}</div>
                <div className="ts-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function initials(n:string){ return n.split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase(); }

const styles = `
/* ————— Full-bleed section ————— */
.ts{
  padding: 8px 0 36px;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  padding-left: clamp(8px, 3vw, 28px);
  padding-right: clamp(8px, 3vw, 28px);
  background: var(--bb-bg);
}

/* Header row spans edge-to-edge with small gutters */
.ts-row{
  display:flex; justify-content:space-between; align-items:baseline; margin: 0 0 12px;
}
.ts-row h2{ margin:0; color: var(--bb-primary); }

/* Full-width, auto-fill grid */
.ts-grid{
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: clamp(12px, 2vw, 18px);
}
.ts-card{
  background:#fff; border-radius:18px; padding:16px;
  box-shadow: 0 14px 36px rgba(0,0,0,.08); display:grid; gap:12px;
}
.ts-text{ color: var(--bb-primary); font-weight:700; letter-spacing:.2px; line-height:1.45; }
.ts-meta{ display:flex; align-items:center; gap:10px; }
.ts-avatar{
  width:42px; height:42px; border-radius:999px; display:grid; place-items:center; font-weight:900; color:#2b2b2b;
  background: radial-gradient(120% 140% at 20% 0%, rgba(246,195,32,.38), rgba(240,93,139,.24));
}
.ts-name{ font-weight:900; color: var(--bb-primary); }
.ts-stars{ color:#f5b400; letter-spacing:1px; }
`;
