import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type StoryItem = {
  src: string;
  alt: string;
  title: string;
  text: string;
  to?: string;
  cta?: string;
};

type Props = {
  items: StoryItem[];
};

export default function HomeStoryEditorial({ items }: Props) {
  const safeItems = useMemo(() => items ?? [], [items]);
  const [colCount, setColCount] = useState(4);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1200) setColCount(4); // 8 items ÷ 4 cols = 2 per col, perfectly even
      else if (w >= 900) setColCount(4);
      else if (w >= 600) setColCount(3);
      else setColCount(2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const columns = useMemo(() => {
    const cols: StoryItem[][] = Array.from({ length: colCount }, () => []);
    safeItems.forEach((item, i) => cols[i % colCount].push(item));
    return cols;
  }, [safeItems, colCount]);

  if (!safeItems.length) return null;

  return (
    <section className="hse-wrap" aria-labelledby="hse-title">
      <style>{styles}</style>

      <div className="hse-shell">
        <div className="hse-head">
          <span className="hse-eyebrow">Our story</span>
          <h2 id="hse-title">
            A floral journey that unfolds one beautiful moment at a time
          </h2>
          <p>
            From bridal styling and devotional florals to handcrafted garlands
            and festive colours, every piece carries its own emotion.
          </p>
        </div>

        <div className="hse-masonry">
          {columns.map((col, ci) => (
            <div key={ci} className="hse-col">
              {col.map((item, ri) => (
                <article key={`${item.title}-${ci}-${ri}`} className="hse-card">
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading={ci < 2 && ri === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <div className="hse-card-overlay" aria-hidden="true" />
                  <div className="hse-card-copy">
                    <h3>{item.title}</h3>
                    {item.to && (
                      <Link to={item.to} className="hse-cta">
                        {item.cta || "Explore collection"}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles = `
.hse-wrap{
  width:100%;
  background:#F5F0E8;
  padding:clamp(40px,6vw,80px) 0 clamp(40px,6vw,64px);
}

.hse-shell{
  width:100%;
  padding:0 clamp(12px,2vw,20px);
}

.hse-head{
  max-width:620px;
  margin:0 auto clamp(28px,4vw,48px);
  text-align:center;
}

.hse-eyebrow{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:0 12px;
  margin-bottom:10px;
  border-radius:999px;
  background:rgba(240,93,139,.08);
  border:1px solid rgba(240,93,139,.14);
  color:var(--bb-accent);
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
}

.hse-head h2{
  margin:0 0 8px;
  font-family:'DM Serif Display',Georgia,serif;
  color:var(--bb-primary);
  font-size:clamp(22px,3vw,34px);
  font-weight:400;
  line-height:1.1;
}

.hse-head p{
  margin:0;
  color:#7a8277;
  font-size:14px;
  line-height:1.65;
}

.hse-masonry{
  display:flex;
  align-items:flex-start;
  gap:10px;
}

.hse-col{
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:10px;
}

.hse-card{
  width:100%;
  border-radius:14px;
  overflow:hidden;
  position:relative;
  background:#2a2a2a;
  cursor:pointer;
  display:block;
}

.hse-card img{
  display:block;
  width:100%;
  height:auto;
  transition:transform .6s cubic-bezier(.22,.61,.36,1);
}

.hse-card:hover img{
  transform:scale(1.04);
}

.hse-card-overlay{
  position:absolute;
  inset:0;
  background:linear-gradient(to top,rgba(26,22,16,.80) 0%,rgba(26,22,16,.18) 44%,transparent 66%);
  pointer-events:none;
}

.hse-card-copy{
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:14px 16px 18px;
  z-index:2;
}

.hse-card-copy h3{
  margin:0 0 8px;
  font-family:'DM Serif Display',Georgia,serif;
  color:#fff;
  font-size:clamp(13px,1.4vw,18px);
  line-height:1.2;
  font-weight:400;
}

.hse-cta{
  display:inline-flex;
  align-items:center;
  height:30px;
  padding:0 12px;
  border-radius:999px;
  background:rgba(255,255,255,.14);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.22);
  color:#fff;
  font-size:11px;
  font-weight:600;
  text-decoration:none;
  transition:background .2s ease;
}

.hse-cta:hover{
  background:rgba(255,255,255,.26);
}

@media (max-width:600px){
  .hse-masonry{ gap:8px; }
  .hse-col{ gap:8px; }
  .hse-card{ border-radius:10px; }
  .hse-card-copy{ padding:10px 12px 14px; }
}

@media (prefers-reduced-motion:reduce){
  .hse-card img,
  .hse-cta{ transition:none; }
}
`;
