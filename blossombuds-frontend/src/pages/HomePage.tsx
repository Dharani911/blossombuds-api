import React from "react";
import Hero from "../components/home/Hero";
import FeatureTiles from "../components/home/FeatureTiles";
import ProductShowcase from "../components/home/ProductShowcase";
import Testimonials from "../components/home/Testimonials";
import CustomOrderCTA from "../components/home/CustomOrderCTA";
// Note: HomeCarousel is imported but intentionally not used (kept as-is to avoid logic changes)
import HomeCarousel from "../components/home/HomeCarousel";

export default function HomePage() {
  return (
    <main className="home-wrap" role="main">
      {/* 1) HERO */}
      <section className="section hero-section">
        <Hero />
      </section>

      {/* 2) FEATURE TILES */}
      <section className="section">
        <FeatureTiles />
      </section>

      {/* 3) NEW ARRIVALS */}
      <section className="section">
        <ProductShowcase />
      </section>

      {/* 4) TESTIMONIALS */}
      <section className="section">
        <Testimonials />
      </section>

      {/* 5) CUSTOM ORDER CTA (must be last, after reviews) */}
      <section className="section section-last">
        <CustomOrderCTA />
      </section>

      <style>{css}</style>
    </main>
  );
}

const css = `
:root{
  --bb-primary:#4A4F41;
  --bb-accent:#F05D8B;
  --bb-accent-2:#F6C320;
  --bb-bg:#FAF7E7;
  --bb-radius:16px;
  --bb-shadow:0 10px 24px rgba(0,0,0,.08);
}

.home-wrap{
  background: var(--bb-bg);
  min-height: 100dvh;
  display: block;
  /* Mobile-first padding with safe-area */
  padding: 0 12px calc(16px + env(safe-area-inset-bottom, 0px));
}

/* Section rhythm: tight on mobile, relax on larger screens */
.section{
  margin: 0 auto;
  padding: 16px 0;
  max-width: 1200px;
}

/* Let hero breathe a bit more, but still mobile-first */
.hero-section{
  padding-top: 8px;
  padding-bottom: 12px;
}

/* Last section gets a bit more bottom space for thumb reach + FAB overlap */
.section-last{
  padding-bottom: 28px;
}

/* Subtle separators only on mobile to visually chunk sections without heavy borders */
.section + .section{
  border-top: 1px solid rgba(0,0,0,.06);
}

/* Tablet and up: remove separators, increase spacing */
@media (min-width: 680px){
  .home-wrap{ padding: 0 16px 24px; }
  .section{ padding: 24px 0; }
  .section + .section{ border-top: none; }
  .hero-section{ padding-top: 16px; padding-bottom: 20px; }
  .section-last{ padding-bottom: 36px; }
}

/* Desktop: more air */
@media (min-width: 1024px){
  .section{ padding: 28px 0; }
  .hero-section{ padding-top: 18px; padding-bottom: 22px; }
  .section-last{ padding-bottom: 44px; }
}

/* Respect reduced motion for any in-component smooth scrolls you may add later */
@media (prefers-reduced-motion: reduce){
  html:focus-within { scroll-behavior: auto; }
}
`;
