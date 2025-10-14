// src/components/EmailVerifyBanner.tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function EmailVerifyBanner() {
  const [show, setShow] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // show if flag present
    const pending = localStorage.getItem("bb.verifyPending") === "1";
    setShow(pending);
  }, [location.key]);

  if (!show) return null;

  return (
    <div style={bar}>
      <div style={inner}>
        <span style={msg}>
          Please verify your email. We’ve sent a link to your inbox.
        </span>
        <span style={spacer} />
        <Link to="/pages/help" style={a}>Need help?</Link>
        <button
          onClick={() => { localStorage.removeItem("bb.verifyPending"); setShow(false); }}
          style={close}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 60,
  background: "linear-gradient(90deg, rgba(246,195,32,.25), rgba(240,93,139,.25))",
  backdropFilter: "saturate(180%) blur(6px)",
  borderBottom: "1px solid rgba(0,0,0,.06)",
};
const inner: React.CSSProperties = {
  maxWidth: 1200, margin: "0 auto", padding: "8px 12px",
  display: "flex", alignItems: "center", gap: 10,
};
const msg: React.CSSProperties = { color: "var(--bb-primary)", fontWeight: 800 };
const spacer: React.CSSProperties = { flex: 1 };
const a: React.CSSProperties = { color: "var(--bb-primary)", textDecoration: "underline", fontWeight: 700 };
const close: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,.1)", background: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer"
};
