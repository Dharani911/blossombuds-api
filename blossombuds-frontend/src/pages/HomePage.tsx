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

      {/* Announcement bar — marquee ticker */}
      <div className="home-announcement" aria-label="Store announcements">
        {/* Two copies so the loop is seamless (animate -50%) */}
        <div className="home-ann-track" aria-hidden="true">
          <span>Handcrafted with love</span>
          <span className="home-ann-dot">·</span>
          <span>Made to order</span>
          <span className="home-ann-dot">·</span>
          <span>Floral accessories</span>
          <span className="home-ann-dot">·</span>
          <span>Designed to last</span>
          <span className="home-ann-dot">·</span>
          <span>Handcrafted with love</span>
          <span className="home-ann-dot">·</span>
          <span>Made to order</span>
          <span className="home-ann-dot">·</span>
          <span>Floral accessories</span>
          <span className="home-ann-dot">·</span>
          <span>Designed to last</span>
          <span className="home-ann-dot">·</span>
        </div>
      </div>

      <Hero />

      <div className="home-flow">
        <RevealSection className="home-block">
          <HomeCategoryCarousel />
        </RevealSection>

        <RevealSection className="home-block">
          <FeatureTiles />
        </RevealSection>

        <RevealSection className="home-block">
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
                cta: "Browse strings",
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

        <RevealSection className="home-block">
          <HomeCuratedShowcase items={curatedItems} />
        </RevealSection>

        <RevealSection className="home-block">
          <ProductShowcase title="New Arrivals" viewAllTo="/featured" />
        </RevealSection>

        <RevealSection className="home-block">
          <Testimonials />
        </RevealSection>

        <RevealSection className="home-block">
          <CustomOrderCTA />
        </RevealSection>
      </div>
    </main>
  );
}

const styles = `
.home-root{
  background:var(--bb-bg,#FAF7E7);
  min-height:100dvh;
  /* escape app-main's 12px/16px side padding so sections can bleed to viewport edges */
  margin:-12px -12px 0;
}

@media (min-width:920px){
  .home-root{
    margin:-16px -16px 0;
  }
}

/* Announcement bar — marquee ticker */
.home-announcement{
  background:var(--bb-accent,#F05D8B);
  color:#fff;
  height:36px;
  overflow:hidden;
  position:relative; /* contains absolutely-positioned track */
}

/* position:absolute keeps this OUT of normal flow so it never
   inflates the parent's scrollWidth — this prevents the forced
   overflow-y:auto on ancestor scroll containers from breaking page scroll */
.home-ann-track{
  position:absolute;
  top:50%;
  left:0;
  transform:translateY(-50%);
  display:inline-flex;
  align-items:center;
  gap:20px;
  white-space:nowrap;
  font-size:11px;
  letter-spacing:.14em;
  text-transform:uppercase;
  font-weight:600;
  animation:annMarquee 26s linear infinite;
}

.home-ann-dot{
  opacity:.55;
  font-size:14px;
}

@keyframes annMarquee{
  from{ transform:translateY(-50%) translateX(0); }
  to{ transform:translateY(-50%) translateX(-50%); }
}

@media (prefers-reduced-motion:reduce){
  .home-ann-track{
    position:static;
    transform:none;
    animation:none;
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    white-space:normal;
    padding:8px 16px;
  }
  .home-announcement{
    height:auto;
  }
}

.home-flow{
  position:relative;
}

.home-block{
  position:relative;
}

/* Scroll reveal: fade only — no Y shift so it never mimics reverse-scroll */
.reveal{
  opacity:0;
  transition:opacity .55s ease;
  will-change:opacity;
}

.reveal.in-view{
  opacity:1;
}

@media (prefers-reduced-motion:reduce){
  .reveal,
  .reveal.in-view{
    opacity:1;
    transition:none;
  }
}
`;
