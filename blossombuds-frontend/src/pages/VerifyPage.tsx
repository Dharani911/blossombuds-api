// src/pages/VerifyPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

type State = "idle" | "verifying" | "success" | "error";

export default function VerifyPage() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const token = search.get("token");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!token) {
        setState("error");
        setMessage("Missing verification token.");
        return;
      }
      setState("verifying");
      try {
        const res = await fetch(apiUrl(`/api/customers/auth/verify?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { Accept: "application/json" },
        }));
        if (!res.ok) throw new Error("Verification failed");
        setState("success");
        setMessage("Your email has been verified.");
        // optional: clear the pending banner flag
        localStorage.removeItem("bb.verifyPending");
        // redirect after a short pause
        setTimeout(() => nav("/profile", { replace: true }), 1200);
      } catch {
        setState("error");
        setMessage("We couldn’t verify this link. It may be expired or already used.");
      }
    }
    run();
  }, [token, nav]);

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={title}>Email verification</h2>
        <p style={p}>
          {state === "verifying" ? "Verifying your email…" : message}
        </p>
        {state === "error" && (
          <p style={pSmall}>
            Try logging in and requesting a new verification email, or head back to{" "}
            <Link to="/" style={link}>Home</Link>.
          </p>
        )}
        {state === "success" && (
          <p style={pSmall}>Redirecting to your profile…</p>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "50vh",
  display: "grid",
  placeItems: "center",
  background: "var(--bb-bg)",
  padding: "24px",
};
const card: React.CSSProperties = {
  width: "min(560px, 94vw)",
  background: "#fff",
  border: "1px solid rgba(0,0,0,.08)",
  borderRadius: 16,
  boxShadow: "0 20px 70px rgba(0,0,0,.15)",
  padding: 20,
};
const title: React.CSSProperties = { margin: 0, color: "var(--bb-primary)" };
const p: React.CSSProperties = { color: "var(--bb-primary)", opacity: .95 };
const pSmall: React.CSSProperties = { color: "var(--bb-primary)", opacity: .9, fontSize: 14 };
const link: React.CSSProperties = { color: "var(--bb-accent)", fontWeight: 800, textDecoration: "underline" };
