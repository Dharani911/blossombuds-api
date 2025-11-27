import React from "react";
import Hero from "../components/home/Hero";
import FeatureTiles from "../components/home/FeatureTiles";
import ProductShowcase from "../components/home/ProductShowCase";
import Testimonials from "../components/home/Testimonials";
import CustomOrderCTA from "../components/home/CustomOrderCTA";
// Note: HomeCarousel import kept (unused) to avoid logic changes


export default function HomePage() {
  return (
    <main className="home-wrap" role="main">
      {/* 1) HERO (full-bleed on mobile) */}
      <section className="section hero-section edge-full">
        <Hero />
      </section>



      {/* 2) NEW ARRIVALS */}
      <section className="section">
        <ProductShowcase />
      </section>

      {/* 3) FEATURE TILES */}
            <section className="section">
              <FeatureTiles />
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

/* Home wrapper: rely on AppLayout's padding, don't add another layer here */
.home-wrap{
  background: var(--bb-bg);
  min-height: 100dvh;
  width: 100%;
  overflow-x: hidden;   /* hard-stop horizontal leaks */
  display: block;
  padding: 0;           /* ✅ no double horizontal padding with AppLayout */
}

/* Sections live inside AppLayout's padded area; keep them centered */
.section{
  margin: 0 auto;
  padding: 16px 0;      /* vertical rhythm only here */
  max-width: 1200px;
  width: 100%;
}

/* Full-bleed utility for hero (edge-to-edge on mobile) */
.edge-full{
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  width: 100vw;
}

/* Let hero breathe a bit more on small screens */
.hero-section{
  padding-top: 8px;
  padding-bottom: 12px;
}

/* Last section: extra bottom space for thumb reach + FAB overlap */
.section-last{
  padding-bottom: 28px;
}

/* Subtle separators on small screens to visually chunk sections */
.section + .section{
  border-top: 1px solid rgba(0,0,0,.06);
}

/* Tablet and up: remove separators, increase spacing */
@media (min-width: 680px){
  .section{ padding: 24px 0; }
  .section + .section{ border-top: none; }
  .hero-section{ padding-top: 16px; padding-bottom: 20px; }
  .section-last{ padding-bottom: 36px; }

  /* Make hero return to contained layout on larger screens */
  .edge-full{
    left: auto; right: auto; margin-left: auto; margin-right: auto; width: auto;
  }
}

/* Desktop: more air */
@media (min-width: 1024px){
  .section{ padding: 28px 0; }
  .hero-section{ padding-top: 18px; padding-bottom: 22px; }
  .section-last{ padding-bottom: 44px; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce){
  html:focus-within { scroll-behavior: auto; }
}
`;
