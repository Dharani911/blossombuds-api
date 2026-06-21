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
            aria-hidden={i !== idx}
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

        <div className="hero-gradient" aria-hidden="true" />

        <div className="hero-content">
          <span className="hero-eyebrow">Handcrafted floral artistry</span>
          <h1 className="hero-headline">
            Artificial handmade flowers for every occasions
          </h1>
          <Link to="/categories" className="hero-cta">Shop collection →</Link>
        </div>

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
  overflow:hidden;
}

.hero-stage{
  position:relative;
  width:100%;
  /* 16:9 ratio — grows with full screen width, capped only at 95vh */
  height:clamp(220px,56.25vw,95vh);
  overflow:hidden;
  background:#1A1610;
}

.hero-slide{
  position:absolute;
  inset:0;
  opacity:0;
}

.hero-slide.active{
  opacity:1;
  z-index:1;
  transition:opacity .95s ease;
}

.hero-slide.exiting{
  opacity:0;
  z-index:0;
  transition:opacity .95s ease;
}

.hero-slide img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  /* contain — shows the full poster without any cropping */
  object-fit:contain;
  object-position:center center;
  display:block;
}

.hero-gradient{
  position:absolute;
  inset:0;
  z-index:2;
  background:linear-gradient(to top,rgba(26,22,16,.82) 0%,rgba(26,22,16,.34) 38%,rgba(26,22,16,0) 64%);
  pointer-events:none;
}

.hero-content{
  position:absolute;
  bottom:clamp(32px,7vh,72px);
  left:clamp(20px,6vw,80px);
  z-index:3;
}

.hero-eyebrow{
  display:block;
  font-size:11px;
  font-weight:600;
  letter-spacing:.18em;
  text-transform:uppercase;
  color:rgba(255,255,255,.74);
  margin-bottom:12px;
}

.hero-headline{
  margin:0 0 24px;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(36px,6vw,72px);
  font-weight:400;
  line-height:1.06;
  color:#fff;
  max-width:14ch;
}

.hero-headline em{
  font-style:italic;
}

.hero-cta{
  display:inline-flex;
  align-items:center;
  height:48px;
  padding:0 24px;
  border-radius:999px;
  background:#fff;
  color:#1A1610;
  font-size:14px;
  font-weight:700;
  text-decoration:none;
  letter-spacing:.01em;
  transition:transform .22s ease,box-shadow .22s ease;
  box-shadow:0 8px 24px rgba(0,0,0,.22);
}

.hero-cta:hover{
  transform:translateY(-2px);
  box-shadow:0 14px 32px rgba(0,0,0,.28);
}

.hero-dots{
  position:absolute;
  right:clamp(16px,4vw,48px);
  bottom:clamp(20px,3.5vh,36px);
  z-index:4;
  display:flex;
  align-items:center;
  gap:7px;
}

.hero-dot{
  width:8px;
  height:8px;
  border:none;
  border-radius:999px;
  padding:0;
  background:rgba(255,255,255,.42);
  cursor:pointer;
  transition:width .22s ease,background .22s ease;
}

.hero-dot.on{
  width:22px;
  background:#fff;
}

@media (max-width:640px){
  /* Posters are 16:9 — container is already 16:9 so no additional override needed */
  /* Just hide the text overlay since posters carry their own design */
  .hero-content{
    display:none;
  }

  .hero-dots{
    right:8px;
    bottom:8px;
    gap:5px;
    padding:4px 6px;
    background:rgba(0,0,0,.22);
    border-radius:999px;
  }

  .hero-dot{
    width:6px;
    height:6px;
  }

  .hero-dot.on{
    width:16px;
  }
}

@media (prefers-reduced-motion:reduce){
  .hero-slide,
  .hero-dot,
  .hero-cta{
    transition:none;
  }
}
`;
