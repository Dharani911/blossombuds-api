import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type CuratedItem = {
  title: string;
  image: string;
  to: string;
  tag?: string;
};

type Props = {
  items: CuratedItem[];
  intervalMs?: number;
};

export default function HomeCuratedShowcase({
  items,
  intervalMs = 3600,
}: Props) {
  const safeItems = useMemo(() => items ?? [], [items]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!safeItems.length || paused) return;

    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [safeItems.length, paused, intervalMs]);

  const goTo = (next: number) => {
    if (!safeItems.length) return;
    const normalized =
      ((next % safeItems.length) + safeItems.length) % safeItems.length;
    setIndex(normalized);
  };

  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  if (!safeItems.length) return null;

  return (
    <section className="hcs-wrap" aria-labelledby="hcs-title">
      <style>{styles}</style>

      <div className="hcs-shell">
        <div className="hcs-head">
          <span className="hcs-eyebrow">Customer moments</span>
          <h2 id="hcs-title">
            Our flowers in real celebrations and beautiful occasions
          </h2>
        </div>

        <div
          className="hcs-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="hcs-viewport" role="region" aria-label="Customer occasion carousel">
            <div
              className="hcs-track"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {safeItems.map((item, i) => (
                <article
                  key={`${item.title}-${i}`}
                  className={`hcs-slide ${i === index ? "is-active" : ""}`}
                  aria-hidden={i !== index}
                >
                  <Link to={item.to} className="hcs-card">
                    <div className="hcs-image-wrap">
                      <img src={item.image} alt={item.title} loading="lazy" />
                    </div>

                    <div className="hcs-meta">
                      {item.tag && <span className="hcs-tag">{item.tag}</span>}
                      <h3>{item.title}</h3>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            <button
              type="button"
              className="hcs-nav hcs-nav-prev"
              aria-label="Previous item"
              onClick={goPrev}
            >
              ‹
            </button>

            <button
              type="button"
              className="hcs-nav hcs-nav-next"
              aria-label="Next item"
              onClick={goNext}
            >
              ›
            </button>
          </div>

          <div className="hcs-dots" role="tablist" aria-label="Customer occasion navigation">
            {safeItems.map((item, i) => (
              <button
                key={`${item.title}-dot-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Go to item ${i + 1}`}
                className={`hcs-dot ${i === index ? "is-active" : ""}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = `
.hcs-wrap{
  width: min(var(--bb-page-max, 1180px), calc(100% - (var(--bb-page-pad, 14px) * 2)));
  margin: 0 auto;
  padding: clamp(34px, 5vw, 72px) 0;
}

.hcs-shell{
  position: relative;
}

.hcs-head{
  max-width: 760px;
  margin: 0 auto 26px;
  text-align: center;
}

.hcs-eyebrow{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  margin-bottom: 10px;
  border-radius: 999px;
  background: rgba(240,93,139,.08);
  border: 1px solid rgba(240,93,139,.14);
  color: var(--bb-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.hcs-head h2{
  margin: 0;
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  color: var(--bb-primary);
  font-size: clamp(26px, 4vw, 40px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -.02em;
}

.hcs-stage{
  position: relative;
}

.hcs-viewport{
  position: relative;
  overflow: hidden;
  border-radius: 30px;
}

.hcs-track{
  display: flex;
  transition: transform .85s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}

.hcs-slide{
  min-width: 100%;
}

.hcs-card{
  display: flex;
  flex-direction: column;
  text-decoration: none;
  border-radius: 30px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.66)),
    #f8f4ee;
  border: 1px solid rgba(74,79,65,.08);
  box-shadow:
    0 22px 54px rgba(26,28,24,.09),
    inset 0 1px 0 rgba(255,255,255,.68);
  transition:
    transform .28s ease,
    box-shadow .28s ease;
}

.hcs-card:hover{
  transform: translateY(-4px);
  box-shadow:
    0 28px 60px rgba(26,28,24,.12),
    inset 0 1px 0 rgba(255,255,255,.72);
}

.hcs-image-wrap{
  width: 100%;
  height: clamp(380px, 62vw, 760px);
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top, rgba(255,255,255,.45), rgba(255,255,255,0) 35%),
    linear-gradient(180deg, #f5efe7 0%, #f1ebe3 100%);
  padding: clamp(14px, 2vw, 22px);
}

.hcs-image-wrap img{
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  transition: transform .65s cubic-bezier(.22,.61,.36,1);
}

.hcs-slide.is-active .hcs-image-wrap img{
  transform: scale(1.01);
}

.hcs-meta{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 18px 20px;
  text-align: center;
}

.hcs-tag{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(240,93,139,.08);
  border: 1px solid rgba(240,93,139,.14);
  color: var(--bb-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.hcs-meta h3{
  margin: 0;
  color: var(--bb-primary);
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  font-size: clamp(20px, 2.6vw, 30px);
  line-height: 1.15;
  letter-spacing: -.02em;
}

.hcs-nav{
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  width: 52px;
  height: 52px;
  border: 0;
  border-radius: 999px;
  background: rgba(255,255,255,.92);
  color: var(--bb-primary);
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
  box-shadow:
    0 16px 34px rgba(26,28,24,.14),
    inset 0 1px 0 rgba(255,255,255,.85);
  transition:
    transform .2s ease,
    box-shadow .2s ease;
}

.hcs-nav:hover{
  transform: translateY(-50%) scale(1.04);
  box-shadow:
    0 18px 40px rgba(26,28,24,.18),
    inset 0 1px 0 rgba(255,255,255,.88);
}

.hcs-nav-prev{
  left: 16px;
}

.hcs-nav-next{
  right: 16px;
}

.hcs-dots{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-top: 16px;
}

.hcs-dot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 0;
  padding: 0;
  cursor: pointer;
  background: rgba(74,79,65,.18);
  transition:
    width .25s ease,
    background .25s ease;
}

.hcs-dot.is-active{
  width: 30px;
  background: var(--bb-accent);
}

@media (max-width: 640px){
  .hcs-wrap{
    padding: 26px 0;
  }

  .hcs-viewport,
  .hcs-card{
    border-radius: 22px;
  }

  .hcs-image-wrap{
    height: clamp(320px, 92vw, 520px);
    padding: 12px;
  }

  .hcs-meta{
    padding: 14px 14px 16px;
    gap: 6px;
  }

  .hcs-meta h3{
    font-size: clamp(18px, 6vw, 24px);
  }

  .hcs-nav{
    width: 42px;
    height: 42px;
    font-size: 24px;
  }

  .hcs-nav-prev{
    left: 10px;
  }

  .hcs-nav-next{
    right: 10px;
  }

  .hcs-dots{
    gap: 8px;
    padding-top: 14px;
  }
}

@media (prefers-reduced-motion: reduce){
  .hcs-track,
  .hcs-card,
  .hcs-image-wrap img,
  .hcs-nav,
  .hcs-dot{
    transition: none !important;
  }
}
`;