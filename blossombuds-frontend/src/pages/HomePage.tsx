import React from "react";
import Hero from "../components/home/Hero";
import FeatureTiles from "../components/home/FeatureTiles";
import ProductShowcase from "../components/home/ProductShowcase";
import Testimonials from "../components/home/Testimonials";
import CustomOrderCTA from "../components/home/CustomOrderCTA";
import HomeCarousel from "../components/home/HomeCarousel";

export default function HomePage() {
  return (
    <div style={{ background: "var(--bb-bg)" }}>
      {/* 1) HERO */}
      <Hero />

      {/* 2) FEATURE TILES */}
      <FeatureTiles />

      {/* 3) NEW ARRIVALS */}
      <ProductShowcase />

      {/* 4) TESTIMONIALS */}
      <Testimonials />

      {/* 5) CUSTOM ORDER CTA (must be last, after reviews) */}
      <CustomOrderCTA />
    </div>
  );
}
