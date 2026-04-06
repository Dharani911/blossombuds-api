import React from "react";
import { Link } from "react-router-dom";

type CategoryCard = {
  title: string;
  subtitle?: string;
  image: string;
  to: string;
};

type Props = {
  title?: string;
  cards: CategoryCard[];
};

export default function HomeCategoryLinks({
  title = "Shop by category",
  cards,
}: Props) {
  return (
    <section className="hcl" aria-labelledby="hcl-title">

      <div className="hcl-head">
        <h2 id="hcl-title">{title}</h2>
        <p>Explore curated collections for every celebration and style.</p>
      </div>

      <div className="hcl-grid">
        {cards.map((card) => (
          <Link key={card.title} to={card.to} className="hcl-card" aria-label={card.title}>
            <div className="hcl-media">
              <img src={card.image} alt={card.title} loading="lazy" />
            </div>

            <div className="hcl-overlay">
              <div className="hcl-copy">
                <h3>{card.title}</h3>
                {card.subtitle && <p>{card.subtitle}</p>}
              </div>
              <span className="hcl-cta">Explore ↗</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
