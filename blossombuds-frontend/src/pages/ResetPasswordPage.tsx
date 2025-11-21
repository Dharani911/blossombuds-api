// src/pages/ResetPasswordPage.tsx
import React, { useMemo, useState } from "react";
import { useSearchParams, Link, useNavigate, useLocation } from "react-router-dom";
import { confirmPasswordReset } from "../api/authReset";

function validatePassword(pw: string) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  return null;
}

/* ---- top-most success popup (center modal) ---- */
function showResetSuccessPopup(onClose?: () => void) {
  const host = document.createElement("div");
  host.setAttribute("data-rp-toast", "1");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,.35)",
    backdropFilter: "blur(2px)",
  } as CSSStyleDeclaration);

  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  Object.assign(card.style, {
    width: "min(460px, 92vw)",
    background: "#fff",
    border: "1px solid rgba(0,0,0,.10)",
    borderRadius: "16px",
    boxShadow: "0 28px 88px rgba(0,0,0,.28)",
    padding: "16px",
    color: "#2b2b2b",
    font: "14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    transform: "translateY(8px) scale(.98)",
    opacity: "0",
    transition: "opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1)",
    position: "relative",
    overflow: "hidden",
  } as CSSStyleDeclaration);

  // top accent bar (brand color)
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "absolute",
    left: 0, right: 0, top: 0, height: "4px",
    background: "#F05D8B",
  } as CSSStyleDeclaration);
  card.appendChild(bar);

  const title = document.createElement("div");
  Object.assign(title.style, {
    display: "flex", alignItems: "center", gap: "10px",
    fontWeight: "900", marginBottom: "6px", letterSpacing: ".2px",
    color: "#4A4F41",
  } as CSSStyleDeclaration);
  title.innerHTML = `
    <span style="width:10px;height:10px;border-radius:999px;background:#23a047;box-shadow:0 0 0 6px rgba(35,160,71,.18);display:inline-block"></span>
    <span>Password reset successful</span>
  `;

  const msg = document.createElement("div");
  Object.assign(msg.style, { fontSize: "13px", opacity: ".9", marginBottom: "10px" } as CSSStyleDeclaration);
  msg.textContent = "Your password has been updated. Redirecting you to the login page…";

  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "8px", justifyContent: "flex-end" } as CSSStyleDeclaration);

  const goBtn = document.createElement("button");
  goBtn.textContent = "Go to login now";
  Object.assign(goBtn.style, {
    border: "none",
    background: "#F05D8B",
    color: "#fff",
    height: "34px",
    padding: "0 14px",
    fontWeight: "900",
    borderRadius: "12px",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(240,93,139,.30)",
  } as CSSStyleDeclaration);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  Object.assign(closeBtn.style, {
    border: "1px solid rgba(0,0,0,.12)",
    background: "#fff",
    color: "#2b2b2b",
    height: "34px",
    padding: "0 14px",
    fontWeight: "800",
    borderRadius: "12px",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  actions.appendChild(closeBtn);
  actions.appendChild(goBtn);
  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(actions);

  host.appendChild(card);
  document.body.appendChild(host);

  requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translateY(0) scale(1)";
  });

  const remove = () => {
    card.style.opacity = "0";
    card.style.transform = "translateY(8px) scale(.98)";
    setTimeout(() => { try { document.body.removeChild(host); } catch {} }, 180);
    onClose && onClose();
  };

  closeBtn.addEventListener("click", remove, { once: true });
  goBtn.addEventListener("click", remove, { once: true });
  host.addEventListener("click", (e) => { if (e.target === host) remove(); });

  return remove;
}

export default function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const token = useMemo(() => (sp.get("token") || "").trim(), [sp]);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
const [showPw, setShowPw] = useState(false);
const [showPw2, setShowPw2] = useState(false);

  const nav = useNavigate();
  const location = useLocation();

  const pwErr = validatePassword(pw);
  const matchErr = pw && pw2 && pw !== pw2 ? "Passwords do not match." : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!token) { setErr("Invalid or missing token."); return; }
    if (pwErr)   { setErr(pwErr); return; }
    if (matchErr){ setErr(matchErr); return; }

    setSubmitting(true);
    try {
      await confirmPasswordReset(token, pw);
      setDone(true);

      // Show popup and redirect to /login after 2.5s (or immediately when clicking the CTA)
      const remove = showResetSuccessPopup(() => nav("/login"));
      // auto-redirect timer
      setTimeout(() => {
        try { remove(); } catch {}
        nav("/login");
      }, 2500);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "The link is invalid or has expired.";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rp-wrap">
      <style>{css}</style>

      <div className="rp-card card fade-in" role="dialog" aria-modal="true" aria-labelledby="rp-title">
        <div className="rp-hd">
          <div className="brand">
            <img src="/src/assets/BB_logo.svg" alt="" className="brand-logo" />
            <div className="brand-text">Blossom Buds Floral Artistry</div>
          </div>
        </div>

        <div className="rp-bd">
          <h2 id="rp-title">Set a new password</h2>
          <p className="muted">Create a strong password you don’t use elsewhere.</p>

          {done ? (
            <div className="success" role="status" aria-live="polite">
              <div className="success-title">
                <span className="dot" aria-hidden="true" /> Password updated
              </div>
              <p className="success-text">
                Your password has been updated successfully. A login screen will open shortly.
              </p>
              <div className="actions">
                <Link to="/login" state={{ background: location, from: location }} className="btn primary">
                  Go to login
                </Link>
                <button className="btn secondary" onClick={() => nav("/")}>Back to home</button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="form vstack" noValidate>
              {!token && (
                <div className="error" role="alert">
                  Invalid or missing token. Please use the latest reset link from your email.
                </div>
              )}


              <label className="lbl" htmlFor="new-pw">New password</label>
              <div className="in-wrap">
                <input
                  id="new-pw"
                  className={"in" + (pw && pwErr ? " invalid" : "")}
                  type={showPw ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!(pw && pwErr)}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    // eye-off icon
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.58 10.58A3 3 0 0113.42 13.4M9.88 5.09A9.77 9.77 0 0112 5c7 0 11 7 11 7a18.21 18.21 0 01-3.06 3.93M6.53 6.53A18.42 18.42 0 001 12s4 7 11 7a11.64 11.64 0 004.47-.86"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    // eye icon
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {pw && pwErr && <div className="hint bad">{pwErr}</div>}


              <label className="lbl" htmlFor="new-pw2">Confirm new password</label>
              <div className="in-wrap">
                <input
                  id="new-pw2"
                  className={"in" + (pw2 && matchErr ? " invalid" : "")}
                  type={showPw2 ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!(pw2 && matchErr)}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw2(v => !v)}
                  aria-label={showPw2 ? "Hide password" : "Show password"}
                >
                  {showPw2 ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.58 10.58A3 3 0 0113.42 13.4M9.88 5.09A9.77 9.77 0 0112 5c7 0 11 7 11 7a18.21 18.21 0 01-3.06 3.93M6.53 6.53A18.42 18.42 0 001 12s4 7 11 7a11.64 11.64 0 004.47-.86"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {pw2 && matchErr && <div className="hint bad">{matchErr}</div>}


              {err && <div className="error" role="alert">{err}</div>}

              <button
                type="submit"
                className="btn primary"
                disabled={submitting || !token || !!pwErr || !!matchErr}
                aria-busy={submitting || undefined}
              >
                {submitting ? "Updating…" : "Update password"}
              </button>

              <div className="help">
                <Link to="/forgot-password" className="link">Request a new link</Link>
                <span className="sep">•</span>
                <Link to="/login" className="link">Back to login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const css = `
/* Layout */
.rp-wrap{
  min-height: calc(100dvh - 0px);
  display: grid;
  place-items: center;
  padding: 24px 16px;
}
.rp-card{
  width: min(520px, 100%);
  overflow: hidden;
  border-radius: var(--bb-radius);
  box-shadow: var(--bb-shadow);
  border: 1px solid rgba(0,0,0,.06);
  background: #fff;
}

/* Header */
.rp-hd{
  display:flex;
  align-items:center;
  padding: 12px 14px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.96));
}
.brand{ display:flex; align-items:center; gap:10px; }
.brand-logo{ width:28px; height:28px; display:block; }
.brand-text{ font-weight:900; letter-spacing:.2px; color: var(--bb-primary); font-size: 14px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }

.rp-bd{ padding: 16px; }
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
.hint{ font-size:12px; opacity:.85; }
.hint.bad{ color:#b00020; }

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

/* Success */
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

/* Error + helpers */
.error{
  color:#b00020;
  background:#fff0f3;
  border:1px solid rgba(176,0,32,.18);
  padding:8px 10px;
  border-radius:10px;
  font-size:13px;
}
.help{ margin-top:6px; font-size:13px; opacity:.9; display:flex; align-items:center; gap:8px; flex-wrap: wrap; }
.link{ color: var(--bb-accent); font-weight:800; }
.link:hover{ text-decoration: underline; }
.sep{ opacity:.45; }

/* Tiny screens */
@media (max-width: 420px){
  .brand-text{ display:none; }
}
.in-wrap{
  position: relative;
  display: flex;
  align-items: center;
}
.in-wrap .in{
  padding-right: 40px; /* space for eye icon */
}
.pw-toggle{
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: rgba(0,0,0,.6);
}
.pw-toggle svg{
  width: 20px;
  height: 20px;
}
.pw-toggle:hover{
  color: rgba(0,0,0,.9);
}
.pw-toggle:focus-visible{
  outline: 2px solid var(--bb-accent);
  outline-offset: 2px;
  border-radius: 999px;
}

`;
