// src/components/EmailVerifyBanner.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function EmailVerifyBanner() {
  const [show, setShow] = useState(false);
  const location = useLocation();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Show banner if the localStorage flag is set
    const pending = localStorage.getItem("bb.verifyPending") === "1";
    setShow(pending);
  }, [location.key]);

  // Focus the close button when banner appears (keyboard friendliness)
  useEffect(() => {
    if (show) {
      const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.removeItem("bb.verifyPending");
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Email verification notice"
      aria-live="polite"
      style={bar}
    >
      {/* a tiny style block to support animation without global CSS */}
      <style>{css}</style>

      <div style={inner} className="evb-inner">
        <span style={msg} className="evb-msg">
          Please verify your email. We’ve sent a link to your inbox.
        </span>

        <div style={spacer} aria-hidden />



        <button
          onClick={dismiss}
          ref={closeBtnRef}
          style={close}
          className="evb-close"
          aria-label="Dismiss verification notice"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ---------- inline styles (with CSS helper for animation & responsive tweaks) ---------- */

const bar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 60,
  // soft gradient, readable on light UIs
  background:
    "linear-gradient(90deg, rgba(246,195,32,.22), rgba(240,93,139,.22))",
  backdropFilter: "saturate(160%) blur(6px)",
  WebkitBackdropFilter: "saturate(160%) blur(6px)",
  borderBottom: "1px solid rgba(0,0,0,.06)",
  // safe-area padding so it never hugs the notch
  paddingLeft: "max(0px, env(safe-area-inset-left))",
  paddingRight: "max(0px, env(safe-area-inset-right))",
};

const inner: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",         // ✅ allow items to wrap on small screens
  animation: "evb-enter .22s ease-out both",
};


const msg: React.CSSProperties = {
  color: "var(--bb-primary)",
  fontWeight: 800,
  lineHeight: 1.3,
  wordBreak: "break-word",
  flex: "1 1 auto",
  minWidth: 0,              // ✅ allow shrinking
  fontSize: "14px",         // ✅ base font
  maxWidth: "100%",         // ✅ ensure no overflow
};


const spacer: React.CSSProperties = { flex: 1 };

const a: React.CSSProperties = {
  color: "var(--bb-primary)",
  textDecoration: "underline",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const close: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.1)",
  background: "#fff",
  borderRadius: 8,
  width: 28,
  height: 28,
  cursor: "pointer",
  flex: "0 0 auto",
};

/* Small CSS helper for animation + responsive wrapping */
const css = `
@keyframes evb-enter {
  from { opacity: 0; transform: translateY(-6px) }
  to   { opacity: 1; transform: translateY(0) }
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce){
  .evb-inner { animation: none !important; }
}

/* Make sure the banner contents wrap nicely on small screens */
@media (max-width: 560px){
  .evb-inner {
      padding: 10px 12px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .evb-msg {
      flex: 1 1 100%;
      font-size: 13.5px;
    }
  .evb-help{
    order: 2;
  }
  .evb-close{
    order: 3;
  }
}

/* Hide banner when printing */
@media print {
  .evb-inner { display: none !important; }
}
`;
