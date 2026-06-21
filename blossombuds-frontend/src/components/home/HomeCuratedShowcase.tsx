import React, { useMemo } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import {
  Autoplay,
  EffectCoverflow,
  Navigation,
  Pagination,
} from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";

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
  intervalMs = 2200,
}: Props) {
  const safeItems = useMemo(() => items ?? [], [items]);

  if (!safeItems.length) return null;

  return (
    <section className="hcs-wrap" aria-labelledby="hcs-title">
      <style>{styles}</style>

      <div className="hcs-head">
        <span className="hcs-eyebrow">Customer moments</span>
        <h2 id="hcs-title">
          Our flowers in real celebrations and beautiful occasions
        </h2>
        <p>Real customers, real moments — and the florals that made them memorable.</p>
      </div>

      <div className="hcs-stage">
        <Swiper
          spaceBetween={30}
          effect="coverflow"
          grabCursor
          centeredSlides
          loop
          slidesPerView="auto"
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 100,
            modifier: 2.5,
          }}
          autoplay={{ delay: intervalMs, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          navigation={{
            nextEl: ".hcs-btn-next",
            prevEl: ".hcs-btn-prev",
          }}
          modules={[EffectCoverflow, Autoplay, Pagination, Navigation]}
        >
          {safeItems.map((item, i) => (
            <SwiperSlide key={`a-${i}`} className="hcs-slide">
              <div className="hcs-card">
                <img
                  src={item.image}
                  alt={item.title}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
                <div className="hcs-card-meta" aria-hidden="true">
                  {item.tag && <span className="hcs-tag">{item.tag}</span>}
                  <p className="hcs-card-title">{item.title}</p>
                </div>
              </div>
            </SwiperSlide>
          ))}
          {/* Duplicate pass keeps loop seamless with slidesPerView="auto" */}
          {safeItems.map((item, i) => (
            <SwiperSlide key={`b-${i}`} className="hcs-slide" aria-hidden>
              <div className="hcs-card">
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <div className="hcs-card-meta" aria-hidden="true">
                  {item.tag && <span className="hcs-tag">{item.tag}</span>}
                  <p className="hcs-card-title">{item.title}</p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Custom nav buttons */}
        <button className="hcs-nav hcs-btn-prev" aria-label="Previous">‹</button>
        <button className="hcs-nav hcs-btn-next" aria-label="Next">›</button>
      </div>
    </section>
  );
}

const styles = `
/* ── Section ── */
.hcs-wrap{
  width:100%;
  padding:clamp(48px,7vw,88px) 0 clamp(44px,6vw,72px);
  background:linear-gradient(160deg,#FFF8F0 0%,#F5EDE0 100%);
  overflow:hidden;
  position:relative;
}

/* ── Header ── */
.hcs-head{
  max-width:680px;
  margin:0 auto clamp(28px,4vw,48px);
  text-align:center;
  padding:0 clamp(16px,5vw,32px);
}

.hcs-eyebrow{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:28px;
  padding:0 12px;
  margin-bottom:10px;
  border-radius:999px;
  background:rgba(240,93,139,.08);
  border:1px solid rgba(240,93,139,.14);
  color:var(--bb-accent,#F05D8B);
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
}

.hcs-head h2{
  margin:0 0 6px;
  font-family:'DM Serif Display',Georgia,serif;
  color:var(--bb-primary,#4A4F41);
  font-size:clamp(22px,3.2vw,36px);
  font-weight:400;
  line-height:1.12;
}

.hcs-head p{
  margin:0;
  color:#7a8277;
  font-size:14px;
  line-height:1.65;
}

/* ── Swiper stage ── */
.hcs-stage{
  position:relative;
}

/* Override Swiper defaults */
.hcs-stage .swiper{
  width:100%;
  padding-bottom:52px;
}

.hcs-stage .swiper-slide{
  width:300px;
  background-position:center;
  background-size:cover;
}

@media (min-width:900px){
  .hcs-stage .swiper-slide{ width:380px; }
}

@media (min-width:1200px){
  .hcs-stage .swiper-slide{ width:440px; }
}

.hcs-stage .swiper-slide img{
  display:block;
  width:100%;
}

/* Kill default Swiper 3D side shadows */
.hcs-stage .swiper-3d .swiper-slide-shadow-left,
.hcs-stage .swiper-3d .swiper-slide-shadow-right{
  background-image:none;
  background:none;
}

/* ── Card ── */
.hcs-card{
  position:relative;
  border-radius:20px;
  overflow:hidden;
  background:#E8DDD0;
  cursor:grab;
}

.hcs-card:active{ cursor:grabbing; }

.hcs-card img{
  display:block;
  width:100%;
  aspect-ratio:3/4;
  object-fit:cover;
  object-position:center top;
  border-radius:20px;
  pointer-events:none;
}

/* Gradient overlay + text */
.hcs-card-meta{
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  padding:12px 14px 18px;
  background:linear-gradient(to top,rgba(26,22,16,.80) 0%,rgba(26,22,16,.18) 55%,transparent 80%);
  border-radius:0 0 20px 20px;
  display:flex;
  flex-direction:column;
  gap:5px;
}

.hcs-tag{
  display:inline-flex;
  align-items:center;
  align-self:flex-start;
  height:22px;
  padding:0 10px;
  border-radius:999px;
  background:rgba(255,255,255,.16);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
  border:1px solid rgba(255,255,255,.22);
  color:#fff;
  font-size:9px;
  font-weight:700;
  letter-spacing:.12em;
  text-transform:uppercase;
}

.hcs-card-title{
  margin:0;
  font-family:'DM Serif Display',Georgia,serif;
  color:#fff;
  font-size:15px;
  font-weight:400;
  line-height:1.2;
}

/* ── Pagination dots ── */
.hcs-stage .swiper-pagination-bullet{
  background:rgba(74,79,65,.22);
  opacity:1;
  transition:background .2s, width .25s;
}

.hcs-stage .swiper-pagination-bullet-active{
  background:var(--bb-accent,#F05D8B);
  width:28px;
  border-radius:999px;
}

/* ── Custom nav buttons ── */
.hcs-nav{
  position:absolute;
  top:50%;
  transform:translateY(calc(-50% - 26px)); /* shift up by half pagination height */
  z-index:10;
  width:44px;
  height:44px;
  display:grid;
  place-items:center;
  border-radius:50%;
  border:1px solid rgba(0,0,0,.10);
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  color:var(--bb-primary,#4A4F41);
  font-size:22px;
  line-height:1;
  cursor:pointer;
  box-shadow:0 4px 16px rgba(0,0,0,.10);
  transition:background .18s ease, transform .18s ease, box-shadow .18s ease;
}

.hcs-nav:hover{
  background:#F05D8B;
  color:#fff;
  border-color:#F05D8B;
  box-shadow:0 8px 24px rgba(240,93,139,.28);
  transform:translateY(calc(-50% - 26px)) scale(1.06);
}

/* Hide the built-in Swiper arrows since we use custom ones */
.hcs-stage .swiper-button-prev,
.hcs-stage .swiper-button-next{
  display:none;
}

.hcs-btn-prev{ left:clamp(8px,2vw,20px); }
.hcs-btn-next{ right:clamp(8px,2vw,20px); }

@media (max-width:480px){
  .hcs-stage .swiper-slide{ width:220px; }
  .hcs-nav{ width:36px; height:36px; font-size:18px; }
}

@media (prefers-reduced-motion:reduce){
  .hcs-stage .swiper-pagination-bullet,
  .hcs-nav{ transition:none; }
}
`;
