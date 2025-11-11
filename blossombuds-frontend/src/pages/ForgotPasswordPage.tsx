// src/pages/ForgotPasswordPage.tsx
import React, { useMemo, useState } from "react";
import { requestPasswordReset } from "../api/authReset";
import { Link, useLocation } from "react-router-dom";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const location = useLocation();

  const emailValid = useMemo(() => isEmail(email), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!emailValid) {
      setErr("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      // Show generic success (no user enumeration)
      setSent(true);
    } catch (e: any) {
      console.warn("reset request failed", e?.response?.data || e);
      setSent(true); // still show generic success
    } finally {
      setSubmitting(false);
    }
  }

  function onResend() {
    // optional convenience; same generic UX
    if (submitting || !emailValid) return;
    void onSubmit(new Event("submit") as any);
  }

  return (
    <div className="fp-wrap">
      <style>{css}</style>

      <div className="fp-card card fade-in" role="dialog" aria-modal="true" aria-labelledby="fp-title">
        <div className="fp-hd">
          <div className="brand">
            <img src="/src/assets/BB_logo.svg" alt="" className="brand-logo" />
            <div className="brand-text">Blossom Buds Floral Artistry</div>
          </div>
        </div>

        <div className="fp-bd">
          <h2 id="fp-title">Forgot your password?</h2>
          <p className="muted">
            Enter your email and we’ll send a secure link to reset your password.
          </p>

          {sent ? (
            <div className="success" role="status" aria-live="polite">
              <div className="success-title">
                <span className="dot" aria-hidden="true" /> Link sent (if the account exists)
              </div>
              <p className="success-text">
                If an account exists for <strong>{email.trim()}</strong>, we’ve emailed a reset link.
                Please check your inbox and spam folder.
              </p>
              <div className="actions">
                <button className="btn primary" onClick={onResend} disabled={submitting || !emailValid}>
                  {submitting ? "Sending…" : "Resend link"}
                </button>
                <Link
                  to="/login"
                  state={{ background: location, from: location }}
                  className="btn secondary"
                >
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="form vstack" noValidate>
              <label className="lbl" htmlFor="fp-email">Email address</label>
              <input
                id="fp-email"
                className={"in" + (email && !emailValid ? " invalid" : "")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!(email && !emailValid)}
                aria-describedby={err ? "fp-err" : undefined}
                required
              />

              {err && <div id="fp-err" className="error" role="alert">{err}</div>}

              <button
                type="submit"
                className="btn primary"
                disabled={submitting || !emailValid}
                aria-busy={submitting || undefined}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>

              <div className="help">
                <span>Remembered your password?</span>{" "}
                <Link to="/login" state={{ background: location, from: location }} className="link">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const css = `
/* Layout shell */
.fp-wrap{
  min-height: calc(100dvh - 0px);
  display: grid;
  place-items: center;
  padding: 24px 16px;
}

.fp-card{
  width: min(520px, 100%);
  overflow: hidden;
  border-radius: var(--bb-radius);
  box-shadow: var(--bb-shadow);
  border: 1px solid rgba(0,0,0,.06);
  background: #fff;
}

/* Header with gentle brand bar */
.fp-hd{
  display:flex;
  align-items:center;
  padding: 12px 14px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.96));
}

.brand{
  display:flex;
  align-items:center;
  gap:10px;
}
.brand-logo{
  width:28px;height:28px; display:block;
}
.brand-text{
  font-weight:900; letter-spacing:.2px; color: var(--bb-primary);
  font-size: 14px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;
}

.fp-bd{
  padding: 16px;
}

h2{
  margin: 0 0 6px 0;
  color: var(--bb-primary);
  font-size: 24px;
  font-family: Georgia, "Times New Roman", serif;
}
.muted{ opacity:.85; margin:0 0 12px; }

/* Form */
.form.vstack{ display:grid; gap:12px; }
.lbl{ font-size:12px; font-weight:800; opacity:.85; }
.in{
  width:100%; height:40px; padding:0 12px; outline:none;
  border-radius:12px; border:1px solid rgba(0,0,0,.12); background:#fff;
  transition: box-shadow .12s ease, border-color .12s ease, background .12s ease;
  font-size:14px;
}
.in:focus{
  border-color: var(--bb-accent-2);
  box-shadow: 0 0 0 3px rgba(246,195,32,.22);
  background:#fff;
}
.in.invalid{
  border-color:#b00020;
  box-shadow: 0 0 0 3px rgba(176,0,32,.12);
}
.error{
  color:#b00020;
  background:#fff0f3;
  border:1px solid rgba(176,0,32,.18);
  padding:8px 10px;
  border-radius:10px;
  font-size:13px;
}

/* Buttons */
.btn{
  height:42px;
  border:none;
  border-radius:999px;
  cursor:pointer;
  font-weight:900;
  padding:0 16px;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease, opacity .12s ease;
  display:inline-flex; align-items:center; justify-content:center;
}
.btn.primary{
  background: var(--bb-accent);
  color:#fff;
  box-shadow:0 12px 28px rgba(240,93,139,.28);
}
.btn.primary:hover{ transform: translateY(-1px); box-shadow:0 16px 40px rgba(240,93,139,.36); }
.btn.secondary{
  background: var(--bb-accent-2);
  color:#2b2b2b;
  box-shadow:0 10px 22px rgba(246,195,32,.22);
}
.btn.secondary:hover{ transform: translateY(-1px); box-shadow:0 14px 30px rgba(246,195,32,.30); }

.btn[disabled]{ opacity:.7; cursor: not-allowed; }

/* Success state */
.success{
  border:1px solid rgba(0,0,0,.06);
  background: #f8fff5;
  padding:12px;
  border-radius:12px;
}
.success-title{
  font-weight:900; display:flex; align-items:center; gap:8px; color:#136f2a;
}
.success .dot{
  width:10px;height:10px;border-radius:999px;background:#23a047;
  box-shadow:0 0 0 6px rgba(35,160,71,.18); display:inline-block;
}
.success-text{ margin:.5rem 0 0; opacity:.9; }
.actions{ display:flex; gap:10px; margin-top:12px; flex-wrap: wrap; }

/* Footer help */
.help{
  margin-top:4px; font-size:13px; opacity:.85;
}
.link{
  color: var(--bb-accent);
  font-weight:800;
}
.link:hover{ text-decoration: underline; }

/* Respect small screens */
@media (max-width: 420px){
  .brand-text{ display:none; } /* keeps header neat on tiny phones */
}
`;
