import React from "react";
import Hero from "../components/home/Hero";
import FeatureTiles from "../components/home/FeatureTiles";
import ProductShowcase from "../components/home/ProductShowCase";
import Testimonials from "../components/home/Testimonials";
import CustomOrderCTA from "../components/home/CustomOrderCTA";
import HomeCategoryCarousel from "../components/home/HomeCategoryCarousel";
import HomeStoryEditorial from "../components/home/HomeStoryEditorial";
import HomeCuratedShowcase from "../components/home/HomeCuratedShowcase";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

import customer5 from "../assets/home/customer5.jpeg";
import customer4 from "../assets/home/customer4.jpeg";
import customer3 from "../assets/home/customer3.jpeg";
import customer1 from "../assets/home/customer_1.jpeg";
import customer2 from "../assets/home/customer_2.jpeg";
import customizationFlowers from "../assets/home/customization_flowers.jpeg";
import customizationGarland from "../assets/home/customization_garland.jpeg";
import marriage from "../assets/home/marriage.jpeg";
import product1 from "../assets/home/product1.jpeg";
import product2 from "../assets/home/product2.jpeg";
import product3 from "../assets/home/product3.jpeg";
import product4 from "../assets/home/product4.jpeg";
import product5 from "../assets/home/product5.jpeg";
import product6 from "../assets/home/product6.jpeg";
import product7 from "../assets/home/product7.jpeg";
import product8 from "../assets/home/product8.jpeg";


const curatedItems = [
{
    title: "Wedding celebration look",
    image: marriage,
    to: "/categories/2",
    tag: "Wedding moment",
  },

  {
    title: "Daily Look",
    image: customer2,
    to: "/categories/1",
    tag: "Devotional moment",
  },
  {
    title: "Traditional Look",
    image: customer3,
    to: "/categories/4",
    tag: "Traditional wear",
  },
  {
    title: "For every attire",
    image: customer4,
    to: "/categories/1",
    tag: "Casual styling",
  },
  {
    title: "For every celebrations",
    image: customer5,
    to: "/categories/1",
    tag: "Bridal detail",
  },
{
    title: "Style it in your way",
    image: customer1,
    to: "/categories",
    tag: "Customer look",
  },
];


function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRevealOnScroll<HTMLElement>();

  return (
    <section ref={ref} className={`reveal ${className}`.trim()}>
      {children}
    </section>
  );
}

export default function HomePage() {
  return (
    <main className="home-root" role="main">
      <style>{styles}</style>

      <Hero />

      <div className="home-flow">
        <RevealSection className="home-block reveal-delay-1">
          <HomeCategoryCarousel />
        </RevealSection>

        <div className="bb-divider" />

        <RevealSection className="home-block reveal-delay-1">
          <FeatureTiles />
        </RevealSection>

        <RevealSection className="home-block reveal-delay-1">
          <HomeStoryEditorial
            items={[
              {
                src: product1,
                alt: "Hair styling with circular floral arrangement",
                title: "Where bridal styling begins",
                text: "A graceful first impression shaped with soft jasmine tones, elegant structure, and a statement floral centrepiece made to feel timeless.",
                to: "/categories/19",
                cta: "View styling pieces",
              },
              {
                src: product2,
                alt: "Pink devotional floral garland around deity",
                title: "Made for devotion and meaning",
                text: "Some flowers belong to celebration, and some belong to prayer. These handcrafted pieces bring colour, reverence, and warmth into sacred moments.",
                to: "/categories/9",
                cta: "Explore festive florals",
              },
              {
                src: product3,
                alt: "Minimal jasmine hair adornment",
                title: "Simple elegance, softly worn",
                text: "Lightweight floral styling designed for women who love a refined look that feels traditional, fresh, and effortless at the same time.",
                to: "/categories/1",
                cta: "Shop hair florals",
              },
              {
                src: product4,
                alt: "Single handcrafted miniature garland",
                title: "The beauty of handwork",
                text: "Every petal placement matters. This story is about patience, detail, and the quiet craftsmanship behind every finished piece.",
                to: "/categories/6",
                cta: "See handcrafted details",
              },
              {
                src: product5,
                alt: "Collection of jasmine garlands",
                title: "Gathered in abundance",
                text: "Fullness, softness, and texture come together in strands prepared for ceremonies, gifting, and grand traditional styling moments.",
                to: "/categories/1",
                cta: "Browse garlands",
              },
              {
                src: product6,
                alt: "Decorative diya with pink floral base",
                title: "Florals that hold the light",
                text: "A small devotional accent can transform the mood of a space. These pieces are designed to make rituals feel intimate, elegant, and memorable.",
                to: "/categories/9?product=244&fromCategory=9",
                cta: "Discover pooja accents",
              },
              {
                src: product7,
                alt: "Tray of colourful flowers",
                title: "A brighter side of celebration",
                text: "Playful colours, cheerful textures, and lively arrangements created for gifting, decor, and joyful moments that deserve something expressive.",
                to: "/categories/9?product=245&fromCategory=9",
                cta: "Shop colourful picks",
              },
              {
                src: product8,
                alt: "Mixed floral basket with jasmine and marigold tones",
                title: "Every occasion finds its flower",
                text: "From temple offerings to festive styling and home decoration, this collection brings many moods together in one beautiful floral language.",
                to: "/categories/all",
                cta: "Explore all collections",
              },
            ]}
          />
        </RevealSection>

        <div className="bb-divider" />

        <RevealSection className="home-block reveal-delay-2">
          <HomeCuratedShowcase items={curatedItems} />
        </RevealSection>

        <RevealSection className="home-block reveal-delay-1">
          <ProductShowcase title="New Arrivals" viewAllTo="/featured" />
        </RevealSection>

        <div className="bb-divider" />

        <RevealSection className="home-block reveal-delay-2">
          <Testimonials />
        </RevealSection>

        <RevealSection className="home-block reveal-delay-3">
          <CustomOrderCTA />
        </RevealSection>
      </div>
    </main>
  );
}

const styles = `
.home-root{
  background:
    radial-gradient(circle at top, rgba(255,255,255,.68), rgba(255,255,255,0) 24%),
    linear-gradient(180deg, #fdfbf7 0%, var(--bb-bg) 22%, var(--bb-bg) 100%);
  min-height: 100dvh;
  overflow-x: hidden;
}

.home-flow{
  position: relative;
}

.home-block{
  position: relative;
}

.bb-divider{
  width: min(var(--bb-page-max, 1180px), calc(100% - (var(--bb-page-pad, 14px) * 2)));
  height: 1px;
  margin: 0 auto;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(74,79,65,.06) 12%,
    rgba(74,79,65,.11) 50%,
    rgba(74,79,65,.06) 88%,
    transparent
  );
}

/* section heading shared */
.bb-section-head{
  max-width: 620px;
  margin: 0 auto 22px;
  text-align: center;
}

.bb-eyebrow{
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

.bb-section-head h2{
  margin: 0 0 8px;
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  color: var(--bb-primary);
  font-size: clamp(26px, 4vw, 40px);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -.02em;
}

.bb-section-head p{
  margin: 0;
  color: #7a8277;
  font-size: 15px;
  line-height: 1.72;
}

/* reveal rhythm */
.reveal{
  opacity: 1;
  transform: none;
  transition:
    opacity .7s ease,
    transform .7s cubic-bezier(.22,.61,.36,1);
  will-change: opacity, transform;
}

.reveal:not(.is-visible){
  opacity: 1;
  transform: none;
}

.reveal.is-visible{
  opacity: 1;
  transform: translateY(0);
}

.reveal-delay-1{
  transition-delay: .04s;
}
.reveal-delay-2{
  transition-delay: .10s;
}
.reveal-delay-3{
  transition-delay: .16s;
}


/* tablet */
@media (max-width: 900px){
  .gallery-grid{
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 170px;
  }
}

/* mobile */
@media (max-width: 560px){
  .bb-section-head{
    margin-bottom: 18px;
  }

  .bb-section-head h2{
    font-size: clamp(24px, 7.5vw, 32px);
  }

  .bb-section-head p{
    font-size: 14px;
    line-height: 1.64;
  }

  .gallery-wrap{
    padding: 26px 0;
  }

  .gallery-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 140px;
    gap: 10px;
  }

  .gallery-cell{
    border-radius: 18px;
  }
}

/* 360px focus */
@media (max-width: 390px){
  .bb-section-head h2{
    font-size: 24px;
  }

  .bb-section-head p{
    font-size: 13px;
  }

  .gallery-grid{
    grid-auto-rows: 128px;
    gap: 9px;
  }
}

@media (prefers-reduced-motion: reduce){
  .reveal,
  .reveal.is-visible{
    opacity: 1;
    transform: none;
    transition: none;
  }

  .gallery-cell img{
    transition: none;
  }
}
`;