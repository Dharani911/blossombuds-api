import React, { useEffect, useMemo, useRef, useState } from "react";
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
  intervalMs?: number;
};

function chunkItems<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export default function HomeStoryEditorial({
  items,
  intervalMs = 4200,
}: Props) {
  const safeItems = useMemo(() => items ?? [], [items]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cardsPerSlide, setCardsPerSlide] = useState(1);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const updateCardsPerSlide = () => {
      const w = window.innerWidth;
      setCardsPerSlide(w >= 980 ? 2 : 1);
    };

    updateCardsPerSlide();
    window.addEventListener("resize", updateCardsPerSlide);
    return () => window.removeEventListener("resize", updateCardsPerSlide);
  }, []);

  const slides = useMemo(
    () => chunkItems(safeItems, cardsPerSlide),
    [safeItems, cardsPerSlide]
  );

  useEffect(() => {
    setIndex((prev) => {
      if (!slides.length) return 0;
      return Math.min(prev, slides.length - 1);
    });
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length || paused || slides.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [slides.length, paused, intervalMs]);

  const goTo = (next: number) => {
    if (!slides.length) return;
    const normalized = ((next % slides.length) + slides.length) % slides.length;
    setIndex(normalized);
  };

  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

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

        <div
          className="hse-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="hse-viewport"
            role="region"
            aria-label="Floral story carousel"
          >
            <div
              className="hse-track"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((group, slideIdx) => (
                <article
                  key={`slide-${slideIdx}`}
                  className={`hse-slide ${slideIdx === index ? "is-active" : ""}`}
                  aria-hidden={slideIdx !== index}
                >
                  <div className="hse-grid">
                    {group.map((item, i) => (
                      <article key={`${item.title}-${i}`} className="hse-card">
                        <div className="hse-media">
                          <img src={item.src} alt={item.alt} loading="lazy" />
                          <div className="hse-media-overlay" />
                        </div>

                        <div className="hse-copy">
                          <div className="hse-copy-inner">
                            <h3>{item.title}</h3>
                            <p>{item.text}</p>

                            {item.to && (
                              <Link to={item.to} className="hse-cta">
                                {item.cta || "Explore collection"}
                              </Link>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  className="hse-nav hse-nav-prev"
                  aria-label="Previous story"
                  onClick={goPrev}
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="hse-nav hse-nav-next"
                  aria-label="Next story"
                  onClick={goNext}
                >
                  ›
                </button>
              </>
            )}
          </div>

          {slides.length > 1 && (
            <div className="hse-dots" role="tablist" aria-label="Story navigation">
              {slides.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to story slide ${i + 1}`}
                  className={`hse-dot ${i === index ? "is-active" : ""}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const styles = `
.hse-wrap{
  width: min(980px, calc(100% - 32px));
  margin: 0 auto;
  padding: clamp(20px, 3vw, 40px) 0;
}

.hse-shell{
  position: relative;
}

.hse-head{
  max-width: 620px;
  margin: 0 auto 18px;
  text-align: center;
}
.hse-eyebrow{
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

.hse-head h2{
  margin: 0 0 6px;
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  color: var(--bb-primary);
  font-size: clamp(22px, 3vw, 34px);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -.02em;
}

.hse-head p{
  margin: 0;
  color: #7a8277;
  font-size: 13px;
  line-height: 1.58;
}

.hse-stage{
  position: relative;
}

.hse-viewport{
  position: relative;
  overflow: hidden;
  border-radius: 30px;
}

.hse-track{
  display: flex;
  transition: transform .85s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}

.hse-slide{
  min-width: 100%;
  padding: 4px;
}

.hse-grid{
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.hse-card{
  overflow: hidden;
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.62)),
    #f8f4ee;
  border: 1px solid rgba(74,79,65,.08);
  box-shadow:
    0 12px 30px rgba(26,28,24,.08),
    inset 0 1px 0 rgba(255,255,255,.65);
}

.hse-media{
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(255,255,255,.45), rgba(255,255,255,0) 35%),
    linear-gradient(180deg, #f6f1ea 0%, #efe7dd 100%);
  min-height: 240px;
}

.hse-media img{
  position: center;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: absolute;
  padding: clamp(12px, 1.8vw, 22px);
  display: block;
}

.hse-media-overlay{
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(0,0,0,.02) 0%, rgba(0,0,0,0) 35%),
    linear-gradient(180deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 24%);
  pointer-events: none;
}

.hse-copy{
  display: flex;
  align-items: center;
  padding: 14px 14px 14px;
  background:
    radial-gradient(circle at top right, rgba(240,93,139,.09), rgba(240,93,139,0) 36%),
    linear-gradient(180deg, rgba(255,255,255,.76), rgba(255,255,255,.5));
}

.hse-copy-inner{
  max-width: 100%;
  opacity: .4;
  transform: translateX(24px);
  transition:
    opacity .6s ease,
    transform .7s cubic-bezier(.22,.61,.36,1);
  transition-delay: .14s;
}

.hse-slide.is-active .hse-copy-inner{
  opacity: 1;
  transform: translateX(0);
}

.hse-copy h3{
  margin: 0 0 12px;
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  color: var(--bb-primary);
  font-size: clamp(22px, 2.4vw, 32px);
  line-height: 1.14;
  letter-spacing: -.02em;
}

.hse-copy p{
  margin: 0 0 18px;
  color: #687064;
  font-size: 14px;
  line-height: 1.72;
}

.hse-cta{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  text-decoration: none;
  background: var(--bb-primary);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 12px 28px rgba(74,79,65,.16);
  transition:
    transform .22s ease,
    box-shadow .22s ease;
}

.hse-cta:hover{
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(74,79,65,.22);
}

.hse-nav{
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  width: 50px;
  height: 50px;
  border: 0;
  border-radius: 999px;
  background: rgba(255,255,255,.92);
  color: var(--bb-primary);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  box-shadow:
    0 16px 34px rgba(26,28,24,.14),
    inset 0 1px 0 rgba(255,255,255,.8);
  transition:
    transform .2s ease,
    box-shadow .2s ease,
    background .2s ease;
}

.hse-nav:hover{
  transform: translateY(-50%) scale(1.04);
  box-shadow:
    0 18px 38px rgba(26,28,24,.18),
    inset 0 1px 0 rgba(255,255,255,.85);
}

.hse-nav-prev{
  left: 16px;
}

.hse-nav-next{
  right: 16px;
}

.hse-dots{
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-top: 16px;
}

.hse-dot{
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

.hse-dot.is-active{
  width: 30px;
  background: var(--bb-accent);
}

@media (min-width: 980px){
  .hse-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .hse-media{
    min-height: 220px;
  }

  .hse-copy{
    padding: 14px 14px 14px;
  }

  .hse-copy h3{
    font-size: clamp(17px, 1.6vw, 22px);
    margin-bottom: 6px;
  }

  .hse-copy p{
    font-size: 12.5px;
    line-height: 1.5;
    margin-bottom: 10px;
  }

  .hse-cta{
    min-height: 34px;
    padding: 0 12px;
    font-size: 12px;
  }
}
@media (max-width: 640px){
  .hse-wrap{
    width: min(100%, calc(100% - 20px));
    padding: 18px 0;
  }

  .hse-card,
  .hse-viewport{
    border-radius: 18px;
  }

  .hse-media{
    min-height: 220px;
  }

  .hse-copy{
    padding: 12px;
  }

  .hse-copy h3{
    font-size: 17px;
    margin-bottom: 6px;
  }

  .hse-copy p{
    font-size: 12.5px;
    line-height: 1.48;
    margin-bottom: 10px;
  }

  .hse-cta{
    min-height: 34px;
    padding: 0 10px;
    font-size: 11.5px;
  }

  .hse-nav{
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .hse-nav-prev{
    left: 8px;
  }

  .hse-nav-next{
    right: 8px;
  }

  .hse-dots{
    gap: 7px;
    padding-top: 10px;
  }
}
@media (prefers-reduced-motion: reduce){
  .hse-track,
  .hse-copy-inner,
  .hse-cta,
  .hse-nav,
  .hse-dot{
    transition: none !important;
  }
}
.hse-media{ min-height: 180px; }

@media (max-width: 640px){
  .hse-media{ min-height: 165px; }
}
`;