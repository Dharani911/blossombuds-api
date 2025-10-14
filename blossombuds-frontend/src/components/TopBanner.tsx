import React from "react";

export default function TopBanner() {
  return (
    <div className="bb-topbar" role="region" aria-label="Store announcement">
      <style>{`
        /* ===== Full-width, slim banner: slightly darker than header and blended ===== */
        .bb-topbar{
          position: sticky; top: 0; z-index: 80; /* sits above header */
          /* Refined primary-tinted gradient (a few shades darker than header),
             no muddy black—pure #4A4F41 glaze that gently fades out. */
          background: linear-gradient(
            180deg,
            rgba(74,79,65,0.55) 0%,   /* darker start */
            rgba(74,79,65,0.38) 55%,
            rgba(74,79,65,0.12) 85%,
            rgba(74,79,65,0.00) 100%  /* blends into header */
          ),
          linear-gradient(180deg, rgba(246,195,32,0.06), rgba(246,195,32,0)); /* tiny gold warmth */
          backdrop-filter: saturate(160%) blur(8px);
        }

        .bb-wrap{
          max-width: 1200px; margin: 0 auto;
          padding: 4px 12px; /* slim vertical footprint */
        }

        /* Marquee lane */
        .bb-lane{
          position: relative;
          height: 28px;                 /* slim height */
          overflow: hidden;
          /* Edge fades; keep subtle to match darker base */
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
        }

        .bb-track{
          display: flex; align-items: center;
          height: 28px; gap: 56px; white-space: nowrap;
          animation: bb-marquee 18s linear infinite;
        }
        .bb-topbar:hover .bb-track{ animation-play-state: paused; }

        /* High-contrast, polished text */
        .bb-item{
          display: inline-flex; align-items: center; gap: 10px;
          color: #fff;
          font-weight: 800;
          letter-spacing: .2px;
          font-size: 14px; line-height: 1;
          text-shadow:
            0 1px 0 rgba(0,0,0,0.25),
            0 6px 18px rgba(0,0,0,0.20);
        }

        /* Coupon chip with brand-forward gradient */
        .bb-chip{
          font-size: 12px; font-weight: 900; color: #fff;
          background: linear-gradient(90deg, #F6C320 0%, #F05D8B 100%);
          border: none; border-radius: 999px; padding: 4px 10px;
          box-shadow: 0 6px 16px rgba(240,93,139,.35), 0 2px 0 rgba(0,0,0,.08) inset;
          white-space: nowrap;
        }

        /* Gold dot with gentle glow */
        .bb-dot{
          width: 6px; height: 6px; border-radius: 999px;
          background: var(--bb-accent-2);
          box-shadow:
            0 0 0 3px rgba(246,195,32,.22),
            0 0 10px rgba(246,195,32,.45);
        }

        /* Soft gold keyword kicker for emphasis */
        .bb-kicker{
          color:#fff;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(246,195,32,.28);
          box-shadow: 0 6px 14px rgba(246,195,32,.25) inset;
          white-space: nowrap;
        }

        /* Duplicate content for seamless loop */
        .bb-inner{ display:flex; gap:56px; padding-left: 8px; }

        @keyframes bb-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); } /* second copy creates the loop */
        }

        /* Reduced motion accessibility */
        @media (prefers-reduced-motion: reduce){
          .bb-track{ animation: none; }
        }

        /* Small screens: keep proportions tidy */
        @media (max-width: 520px){
          .bb-wrap{ padding: 3px 12px; }
          .bb-lane{ height: 26px; }
          .bb-track{ height: 26px; gap: 40px; }
          .bb-inner{ gap: 40px; }
          .bb-item{ font-size: 13px; }
        }
      `}</style>

      <div className="bb-wrap">
        <div className="bb-lane" aria-live="polite">
          <div className="bb-track">
            <div className="bb-inner">{content()}</div>
            <div className="bb-inner" aria-hidden="true">{content()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rotating messages (edit copy here) */
function content() {
  return (
    <>
      <span className="bb-item">
        <i className="bb-dot" />
        <span className="bb-kicker">Free shipping</span> on orders over ₹2,499
      </span>
      <span className="bb-item">
        <i className="bb-dot" />
        Use coupon <span className="bb-chip">BLOSSOM10</span> for 10% off
      </span>
      <span className="bb-item">
        <i className="bb-dot" />
        Custom & overseas orders? <span className="bb-kicker">WhatsApp us</span> anytime
      </span>
      <span className="bb-item">
        <i className="bb-dot" />
        Fresh, <span className="bb-kicker">made-to-order</span> floral accessories
      </span>
    </>
  );
}
