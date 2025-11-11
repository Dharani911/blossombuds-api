import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { customerLogin } from "../../api/auth";
import { useAuth } from "../../app/AuthProvider";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function LoginModal() {
  const nav = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useAuth();

  const from = (location.state as any)?.from as string | undefined;
  const cameFromBackground = Boolean((location.state as any)?.background);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpBusy, setFpBusy] = useState(false);
  const [fpMsg, setFpMsg] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  const isValid = /^\S+@\S+\.\S+$/.test(email) && password.length >= 1;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setBusy(true); setErr(null);
    try {
      const { token } = await customerLogin({ email, password });
      loginWithToken(token);
      nav("/profile", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (cameFromBackground && from) nav(from, { replace: true });
    else nav("/", { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    sheetRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(fpEmail)) { setFpMsg("Please enter a valid email."); return; }
    setFpBusy(true); setFpMsg(null);
    try {
      const res = await fetch("/api/customers/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: fpEmail }),
      });
      if (!res.ok) throw new Error();
      setFpMsg("If that email exists, a reset link has been sent.");
    } catch {
      setFpMsg("Could not send reset email. Please try again.");
    } finally {
      setFpBusy(false);
    }
  }

  const modal = (
    <>
      <style>{styles}</style>
      <div className="auth-scrim" onClick={close} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Login form">
        <div ref={sheetRef} className="sheet sheet-in">
          <header className="am-head">
            <div className="brand">
              <img src="/src/assets/BB_logo.svg" alt="" />
              <div className="brand-name">
                <span className="big">Blossom Buds</span>
                <span className="small">Floral Artistry</span>
              </div>
            </div>
            <button className="x" aria-label="Close" onClick={close}>✕</button>
          </header>

          <div className="sheet-scroll">
            <div className="hero">
              <h3>Welcome back</h3>
              <p>Sign in to view your profile and orders.</p>
            </div>

            <form className="form" onSubmit={onSubmit}>
              <label className="label">
                <span>Email</span>
                <div className="field">
                  <IconMail />
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                    required
                  />
                </div>
              </label>

              <label className="label">
                <span>Password</span>
                <div className="field">
                  <IconLock />
                  <input
                    className="input"
                    type={showPw ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn eye"
                    onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    title={showPw ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPw} />
                  </button>
                </div>
              </label>

              {err && <div className="error" role="alert">{err}</div>}

              <div className="links">
                <p className="muted">
                  <a href="/forgot-password">Forgot your password?</a>
                </p>
                <Link
                  to="/register"
                  state={{ from: from || "/", background: (location.state as any)?.background || location }}
                  className="textlink"
                >
                  Create an account
                </Link>
              </div>

              <button className="cta" type="submit" disabled={!isValid || busy}>
                {busy ? "Signing in…" : "Login"}
              </button>
            </form>
          </div>

          {forgotOpen && (
            <div className="mini" onClick={()=>setForgotOpen(false)}>
              <div className="mini-card" onClick={(e)=>e.stopPropagation()}>
                <h4>Reset your password</h4>
                <p>Enter your email and we’ll send a reset link.</p>
                <form className="mini-form" onSubmit={requestReset}>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={fpEmail}
                    onChange={(e)=>setFpEmail(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={fpBusy}>{fpBusy ? "Sending…" : "Send link"}</button>
                </form>
                {fpMsg && <div className="mini-msg">{fpMsg}</div>}
                <button className="mini-close" onClick={()=>setForgotOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}

/* Icons */
function IconMail(){ return (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path d="M4 6h16v12H4z" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6"/>
    <path d="M4 7l8 6 8-6" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6"/>
  </svg>
);}
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="3" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M2 12s4-7 10-7c2.4 0 4.4.8 6 2" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6"/>
      <path d="M22 12s-4 7-10 7c-2.4 0-4.4-.8-6-2" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6"/>
      <path d="M3 3l18 18" stroke="rgba(0,0,0,.6)" strokeWidth="1.6"/>
    </svg>
  );
}
function IconLock(){ return (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <rect x="5" y="10" width="14" height="9" rx="2" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6"/>
    <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6"/>
  </svg>
);}

const styles = `
:root{
  --bb-primary:#4A4F41;
  --bb-accent:#F05D8B;
  --bb-accent2:#F6C320;
  --bb-bg:#FAF7E7;
  --radius: 22px;
  --ink: rgba(0,0,0,.08);
}

.auth-scrim{
  position: fixed; inset: 0; z-index: 9998;
  background: rgba(0,0,0,.42);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.auth-modal{
  position: fixed; inset: 0; z-index: 9999;
  display: grid; place-items: end; /* bottom-sheet on mobile */
  padding: 0;
}

/* Sheet */
.sheet{
  width: 100%;
  max-width: 520px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.98)),
    radial-gradient(120% 100% at 0% 0%, rgba(240,93,139,.08), transparent 40%) no-repeat,
    radial-gradient(120% 100% at 100% 0%, rgba(246,195,32,.10), transparent 42%) no-repeat;
  border: 1px solid var(--ink);
  border-bottom: none;
  border-radius: var(--radius) var(--radius) 0 0;
  box-shadow: 0 40px 120px rgba(0,0,0,.30);
  overflow: hidden;
  transform-origin: 50% 100%;
  animation: popUp .24s cubic-bezier(.2,.8,.2,1) both;
  margin: 0 auto;
}
@keyframes popUp{ from{opacity:0; transform: translateY(18px)} to{opacity:1; transform:none} }

/* Header */
.am-head{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(246,195,32,.18), rgba(240,93,139,.10));
  border-bottom: 1px solid var(--ink);
}
.brand{ display:flex; align-items:center; gap:10px; }
.brand img{
  width:32px; height:32px; border-radius:8px; box-shadow: 0 6px 16px rgba(0,0,0,.08);
}
.brand-name{
  display:flex; flex-direction:column; justify-content:center; /* centers with logo */
}
.brand-name .big{
  display:block; font-family: "DM Serif Display", Georgia, serif;
  font-size: 18px; color: var(--bb-primary); line-height:1.1;
}
.brand-name .small{
  display:block; font-size: 11px; color: var(--bb-primary); opacity:.9; line-height:1.1;
}

.x{
  width:40px; height:40px; border-radius:12px;
  border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer;
}

/* Scrollable content region (mobile safe) */
.sheet-scroll{
  max-height: min(78vh, 640px);
  overflow:auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  -webkit-overflow-scrolling: touch;
}

/* Hero */
.hero{ padding: 2px 0 8px; text-align:left; }
.hero h3{ margin:0; font-family: "DM Serif Display", Georgia, serif; color: var(--bb-primary); font-size: 24px; }
.hero p{ margin: 6px 0 0; color: var(--bb-primary); opacity:.92; font-size:14px; }

/* Form */
.form{
  display:flex; flex-direction:column; gap:12px; width:100%;
}
.label{ display:flex; flex-direction:column; gap:6px; width:100%; }
.label > span{ font-weight:800; color: var(--bb-primary); font-size: 13px; }

.field{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  border-radius: 14px;
  padding: 0 10px;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.field:focus-within{ border-color: rgba(246,195,32,.9); box-shadow: 0 0 0 6px rgba(246,195,32,.16); }
.input{
  height: 48px; min-height:48px; border:none; outline:none; flex:1;
  color: var(--bb-primary); background: transparent; font-weight: 600; font-size:14px;
}

/* Links row */
.links{
  display:flex; justify-content: space-between; align-items:center; gap: 12px; margin-top: 2px;
}
.muted a{ color: var(--bb-primary); opacity:.9; text-decoration: underline; font-weight:700; font-size:14px; }
.textlink{
  background: transparent; border: none; padding: 0;
  color: var(--bb-primary); font-size: 14px; font-weight: 700; text-decoration: underline;
  letter-spacing: .1px; cursor: pointer; opacity: .92; transition: color .15s ease, opacity .15s ease;
}
.textlink:hover{ color: var(--bb-accent); opacity:1; }

/* Eye toggle button */
.icon-btn.eye{
  display:inline-flex; align-items:center; justify-content:center;
  width: 40px; height: 40px; border: none; background: transparent; border-radius: 10px; cursor: pointer;
}
.icon-btn.eye:hover{ background: rgba(0,0,0,.04); }

/* Error */
.error{
  background:#fff3f5; border:1px solid rgba(240,93,139,.25);
  color:#b0003a; padding:10px 12px; border-radius:12px; font-size:13px;
}

/* CTA */
.cta{
  width: 100%;
  height: 48px; min-height:48px; border-radius: 12px; border: none; cursor: pointer; padding: 0 16px;
  background: linear-gradient(135deg, var(--bb-accent), #ff7aa6);
  color:#fff; font-weight:900; letter-spacing:.2px;
  box-shadow: 0 10px 28px rgba(240,93,139,.35);
  transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
  margin-top: 6px;
}
.cta:hover{ transform: translateY(-1px); box-shadow: 0 12px 34px rgba(240,93,139,.45); }
.cta[disabled]{ opacity:.65; cursor:not-allowed; transform:none; box-shadow:none; }

/* Mini reset dialog */
.mini{ position: fixed; inset: 0; z-index: 10000; display:grid; place-items:center; background: rgba(0,0,0,.14); }
.mini-card{ width: min(420px, 92vw); background:#fff; border:1px solid var(--ink); border-radius:16px; box-shadow: 0 18px 60px rgba(0,0,0,.22); padding: 14px; animation: popUp .18s cubic-bezier(.2,.8,.2,1) both; }
.mini-card h4{ margin: 0; color: var(--bb-primary); font-weight: 900; }
.mini-card p{ margin: 6px 0 10px; color: var(--bb-primary); opacity:.92; }
.mini-form{ display:grid; grid-template-columns: 1fr auto; gap: 8px; }
.mini-form input{ height: 44px; border-radius: 12px; border:1px solid rgba(0,0,0,.14); padding: 0 10px; }
.mini-form button{ height: 44px; border-radius: 12px; background: var(--bb-primary); color:#fff; font-weight:900; border:none; padding: 0 12px; }
.mini-msg{ margin-top: 8px; font-size: 13px; color: var(--bb-primary); }
.mini-close{ margin-top: 8px; background: transparent; border: none; text-decoration: underline; color: var(--bb-primary); font-weight: 800; cursor: pointer; }

/* Desktop centers the modal like a dialog */
@media (min-width: 700px){
  .auth-modal{ place-items: center; padding: 16px; }
  .sheet{ border-radius: var(--radius); max-width: 520px; }
  .sheet-scroll{ max-height: 72vh; }
}

/* Respect bottom safe-area (iOS) */
@supports (padding: max(0px)){
  .sheet-scroll{
    padding-bottom: max(12px, calc(12px + env(safe-area-inset-bottom, 0px)));
  }
}
`;
