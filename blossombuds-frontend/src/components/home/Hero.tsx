import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../../api/base";
import { Link } from "react-router-dom";

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
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(apiUrl(ENDPOINT), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          if (alive) setSlides([]);
          return;
        }

        const json = (await res.json()) as FeatureImageDto[];

        const usable = (Array.isArray(json) ? json : [])
          .filter((x) => !!x?.url)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((x) => ({
            url: normalizeUrlForPhone(x.url),
            alt: (x.altText || "").trim(),
          }))
          .filter((x) => !!x.url);

        if (alive) setSlides(usable);
      } catch {
        if (alive) setSlides([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const frames =
    slides && slides.length
      ? slides
      : FALLBACK_IMAGES.map((u) => ({ url: u, alt: "" }));

  useEffect(() => {
    if (!frames.length) return;

    timer.current = window.setInterval(() => {
      setIdx((current) => {
        setPrevIdx(current);
        return (current + 1) % frames.length;
      });
    }, 6500);

    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [frames.length]);

  const goto = (n: number) => {
    if (!frames.length) return;
    setPrevIdx(idx);
    setIdx(n % frames.length);
  };

  return (
    <section className="hero" aria-label="Hero showcase">
      <style>{heroStyles}</style>

      <div className="hero-stage" role="region" aria-roledescription="carousel">
        {frames.map((f, i) => (
          <div
            key={`${i}-${f.url}`}
            className={`hero-slide ${i === idx ? "active" : i === prevIdx ? "exiting" : ""}`}
          >
            <img
              src={f.url}
              alt={f.alt || "Blossom Buds floral collection"}
              loading={i === idx ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </div>
        ))}

        <div className="hero-overlay-base" />
        <div className="hero-overlay-glow" />
        <div className="hero-overlay-side" />

        {/* Desktop / tablet content inside stage */}


        {frames.length > 1 && (
          <div className="hero-dots" role="tablist" aria-label="Slides">
            {frames.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Slide ${i + 1}`}
                className={`hero-dot${i === idx ? " on" : ""}`}
                onClick={() => goto(i)}
                type="button"
              />
            ))}
          </div>
        )}
      </div>


    </section>
  );
}

function normalizeUrlForPhone(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("/")) return raw;

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.endsWith(".lan");

    return isLocal ? u.pathname + (u.search || "") : raw;
  } catch {
    return /^https?:\/\//i.test(raw) ? raw : "/" + raw.replace(/^\/+/, "");
  }
}

const heroStyles = `
.hero{
  width:100%;
  background: var(--bb-bg, #FAF7E7);
  overflow:hidden;
}

/* 16:9 visual banner */
.hero-stage{
  position:relative;
  width:min(100%, 1280px);
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  min-height: 220px;
  max-height: 720px;
  overflow:hidden;
  background:#170f0a;
  border-radius: 0 0 28px 28px;
}

/* Full width on very small screens */
@media (max-width: 767px){
  .hero-stage{
    width:100%;
    border-radius: 0 0 22px 22px;
  }
}

.hero-slide{
  position:absolute;
  inset:0;
  opacity:0;
  transition:none;
}

.hero-slide.active{
  opacity:1;
  transition: opacity .95s ease;
  z-index:1;
}

.hero-slide.exiting{
  opacity:0;
  transition: opacity .95s ease;
  z-index:0;
}

.hero-slide img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  object-position:center center;
  display:block;
  transform: scale(1.002);
}

/* Elegant overlays so text is gone but image still looks rich */
.hero-overlay-base{
  position:absolute;
  inset:0;
  z-index:2;
  background:
    linear-gradient(
      to top,
      rgba(11,7,4,.20) 0%,
      rgba(11,7,4,.08) 28%,
      rgba(11,7,4,.03) 50%,
      transparent 100%
    );
  pointer-events:none;
}

.hero-overlay-glow{
  position:absolute;
  inset:0;
  z-index:2;
  background:
    radial-gradient(circle at 18% 20%, rgba(246,195,32,.08), transparent 24%),
    radial-gradient(circle at 78% 22%, rgba(240,93,139,.08), transparent 22%);
  mix-blend-mode: screen;
  pointer-events:none;
}

.hero-overlay-side{
  position:absolute;
  inset:0;
  z-index:2;
  background:
    linear-gradient(
      to right,
      rgba(11,7,4,.08) 0%,
      transparent 24%,
      transparent 76%,
      rgba(11,7,4,.06) 100%
    );
  pointer-events:none;
}

/* Dots */
.hero-dots{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  bottom:12px;
  z-index:4;
  display:flex;
  align-items:center;
  gap:7px;
  padding:6px 8px;
  border-radius:999px;
  background: rgba(0,0,0,.16);
  backdrop-filter: blur(8px);
}

.hero-dot{
  width:8px;
  height:8px;
  border:none;
  border-radius:999px;
  padding:0;
  background: rgba(255,255,255,.48);
  cursor:pointer;
  transition: width .22s ease, background .22s ease;
}

.hero-dot.on{
  width:22px;
  background:#fff;
}

/* remove old content containers */
.hero-desktop-content,
.hero-mobile-content{
  display:none !important;
}

/* 360x800 tuning */
@media (max-width: 420px){
  .hero-stage{
    aspect-ratio: 16 / 10;
    min-height: 210px;
    border-radius: 0 0 18px 18px;
  }

  .hero-dots{
    bottom:10px;
    padding:5px 7px;
    gap:6px;
  }

  .hero-dot{
    width:7px;
    height:7px;
  }

  .hero-dot.on{
    width:18px;
  }
}

@media (min-width: 768px){
  .hero-stage{
    border-radius: 0 0 32px 32px;
  }

  .hero-dots{
    bottom:18px;
  }
}

@media (prefers-reduced-motion: reduce){
  .hero-slide,
  .hero-dot{
    transition:none;
  }
}
`;