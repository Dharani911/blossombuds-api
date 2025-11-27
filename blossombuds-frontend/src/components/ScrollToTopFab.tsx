// src/components/ScrollToTopFab.tsx
import React, { useEffect, useState } from "react";

export default function ScrollToTopFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) setVisible(true);
      else setVisible(false);
    };
    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        /* Scroll-to-top FAB – aligned with .wa-fab */
        .scroll-top-btn {
          position: fixed;
          /* same horizontal anchor as .wa-fab */
          right: clamp(12px, 2.4vw, 22px);

          /* stacked just above the WhatsApp FAB:
             same bottom clamp + 56px (fab height) + 10px gap */
          bottom: calc(clamp(12px, 2.4vw, 22px) + 56px + 10px);

          width: 56px;
          height: 56px;
          border-radius: 999px;
          border: none;
          background: var(--bb-accent, #F05D8B);
          color: #fff;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 0;

          box-shadow: var(--bb-shadow, 0 14px 36px rgba(0,0,0,.18));
          cursor: pointer;
          z-index: 91;
          transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .scroll-top-btn:hover {
          background: #e94c7a;
          transform: translateY(-2px);
          box-shadow: 0 18px 40px rgba(0,0,0,.22);
        }

        .scroll-top-btn:active {
          transform: translateY(0);
          box-shadow: 0 14px 36px rgba(0,0,0,.18);
        }

        @media (min-width: 768px) {
          .scroll-top-btn {
            /* optional: slightly more presence on bigger screens */
            width: 60px;
            height: 60px;
          }
        }
      `}</style>

      <button
        className="scroll-top-btn"
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ScrollArrowIcon />
      </button>
    </>
  );
}

/** Minimal, elegant up-arrow icon with a subtle circle accent */
function ScrollArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
    >
      {/* soft circle outline */}
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.7"
      />
      {/* arrow stem */}
      <path
        d="M12 16V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* arrow head */}
      <path
        d="M9 12l3-3 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
