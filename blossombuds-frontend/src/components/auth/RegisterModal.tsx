import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { customerRegister } from "../../api/auth";
import { useNavigate, useLocation, Link } from "react-router-dom";
//import { useAuth } from "../../app/AuthProvider";
import logo from "../../assets/BB_logo.svg";

export default function RegisterModal() {
  const nav = useNavigate();
  const location = useLocation();
  //const { loginWithToken } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheetRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  // Lock page scroll while modal is open (iOS-safe)
  useEffect(() => {
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPos: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
    };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.documentElement.style.overflow = prev.htmlOverflow;
      document.body.style.overflow = prev.bodyOverflow;
      document.body.style.position = prev.bodyPos;
      document.body.style.top = prev.bodyTop;
      document.body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // validation
  const digits = phone.replace(/\D+/g, "");
  const nameOk = name.trim().length >= 2;
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const phoneOk = digits.length >= 10 && digits.length <= 15;
  const pwOk = password.length >= 8;
  const confirmOk = confirm === password && confirm.length > 0;
  const canSubmit = nameOk && emailOk && phoneOk && pwOk && confirmOk;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);

    try {
      await customerRegister({
        name,
        email,
        password,
        phone,
      } as any);

      // ✅ No auto-login, no token, no profile redirect
      // Option A: send them straight to login modal
      nav("/login", {
        replace: true,
        state: { from: "/", background: (location.state as any)?.background || location },
      });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Registration failed. Try a different email.");
    } finally {
      setBusy(false);
    }
  };


  const close = () => nav("/", { replace: true });

  const modal = (
    <>
      <style>{styles}</style>
      <div className="auth-scrim" onClick={close} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Register form" onClick={close}>
        <div ref={sheetRef} className="sheet" onClick={(e)=>e.stopPropagation()}>
          <header className="am-head">
            <div className="brand">
              <img src={logo} alt="" />
              <div className="brand-name">
                <span className="big">Blossom Buds</span>
                <span className="small">Floral Artistry</span>
              </div>
            </div>
            <button className="x" aria-label="Close" onClick={close}>✕</button>
          </header>

          {/* Only this area scrolls */}
          <div className="sheet-scroll">
            <div className="hero">
              <h3>Create your account</h3>
              <p>Join Blossom Buds Floral Artistry.</p>
            </div>

            <form className="form" onSubmit={onSubmit}>
              <label className="label">
                <span>Name</span>
                <div className="field">
                  <input
                    className="input"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              </label>

              <label className="label">
                <span>Email</span>
                <div className="field">
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e)=>setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </label>

              <label className="label">
                <span>Mobile number</span>
                <div className="field">
                  <input
                    className="input"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e)=>setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <small className={`hint ${phoneOk ? "ok" : ""}`}>
                  {phoneOk ? "Looks good." : "Enter 10–15 digits (you can include + and spaces)."}
                </small>
              </label>

              <label className="label">
                <span>Password</span>
                <div className="field">
                  <input
                    className="input"
                    type={showPw ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
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
                <small className={`hint ${pwOk ? "ok" : ""}`}>
                  {pwOk ? "Strong enough." : "Minimum 8 characters."}
                </small>
              </label>

              <label className="label">
                <span>Re-enter password</span>
                <div className="field">
                  <input
                    className="input"
                    type={showPw2 ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e)=>setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="icon-btn eye"
                    onClick={() => setShowPw2(s => !s)}
                    aria-label={showPw2 ? "Hide password" : "Show password"}
                    title={showPw2 ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPw2} />
                  </button>
                </div>
                <small className={`hint ${confirmOk ? "ok" : ""}`}>
                  {confirm.length === 0 ? "Please re-enter your password." : (confirmOk ? "Passwords match." : "Passwords do not match.")}
                </small>
              </label>

              {err && <div className="error" role="alert">{err}</div>}

              <button className="cta" type="submit" disabled={!canSubmit || busy}>
                {busy ? "Creating…" : "Create account"}
              </button>

              <div className="links single">
                <span className="muted">Already have an account?</span>
                <Link
                  to="/login"
                  state={{ from: "/", background: (location.state as any)?.background || location }}
                  className="textlink"
                >
                  Login
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
      <style>{iosFontFix}</style>
    </>
  );

  return createPortal(modal, document.body);
}

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

const styles = `
:root{
  --bb-primary: #4A4F41;
  --bb-accent: #F05D8B;
  --bb-accent2: #F6C320;
  --bb-bg: #FAF7E7;
  --radius: 22px;
  --ink: rgba(0,0,0,.08);
}

/* Backdrop */
.auth-scrim{
  position: fixed; inset: 0; z-index: 9998;
  background: rgba(0,0,0,.42);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

/* Host – centered, and stop scroll chaining */
.auth-modal{
  position: fixed; inset: 0; z-index: 9999;
  display: grid; place-items: center;
  padding: 16px;
  overscroll-behavior: contain;
  overflow: hidden; /* prevent page scroll peeking through */
}

/* Dialog as a flex column so inner content can scroll */
.sheet{
  width: min(560px, 94vw);
  height: min(86vh, 720px);         /* give it a real height */
  background:
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.98)),
    radial-gradient(120% 100% at 0% 0%, rgba(240,93,139,.08), transparent 40%) no-repeat,
    radial-gradient(120% 100% at 100% 0%, rgba(246,195,32,.10), transparent 42%) no-repeat;
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  box-shadow: 0 40px 120px rgba(0,0,0,.30);
  display: flex;                    /* <<< */
  flex-direction: column;           /* <<< */
  overflow: hidden;
  transform-origin: 50% 50%;
  animation: pop .22s cubic-bezier(.2,.8,.2,1) both;
}
@keyframes pop{ from{opacity:0; transform: scale(.98)} to{opacity:1; transform:none} }

/* Header */
.am-head{
  flex: 0 0 auto;
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(246,195,32,.18), rgba(240,93,139,.10));
  border-bottom: 1px solid var(--ink);
}
.brand{ display:flex; align-items:center; gap:12px; min-width:0; }
.brand img{ width:34px; height:34px; border-radius:8px; box-shadow: 0 6px 16px rgba(0,0,0,.08); }
.brand-name{ display:flex; flex-direction:column; min-width:0; }
.brand-name .big{
  display:block; font-family: "DM Serif Display", Georgia, serif; font-size: 18px;
  color: var(--bb-primary); line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.brand-name .small{
  display:block; font-size: 11px; color: var(--bb-primary); opacity:.9; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.x{ width:34px; height:34px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer; }

/* Scrollable body */
.sheet-scroll{
  flex: 1 1 auto;                   /* take remaining height */
  min-height: 0;                    /* allow to shrink and scroll */
  overflow: auto;                   /* this is the scroller */
  overscroll-behavior: contain;     /* don't bubble to page */
  -webkit-overflow-scrolling: touch;
  padding: 12px 16px 16px;
}

/* Hero */
.hero{ padding: 4px 0 6px; text-align:left; }
.hero h3{ margin:0; font-family: "DM Serif Display", Georgia, serif; color: var(--bb-primary); font-size: 24px; }
.hero p{ margin: 6px 0 0; color: var(--bb-primary); opacity:.92; }

/* Form */
.form{ display:flex; flex-direction:column; gap:12px; width:100%; }
.label{ display:flex; flex-direction:column; gap:6px; width:100%; }
.label > span{ font-weight:800; color: var(--bb-primary); font-size: 13px; }

/* Inputs: 16px to prevent iOS zoom */
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
  color: var(--bb-primary); background: transparent; font-weight: 600; font-size:16px;
}

/* Hints */
.hint{ font-size: 12px; color: var(--bb-primary); opacity:.8; margin-top: 4px; display:block; }
.hint.ok{ color:#0c6e3c; opacity:1; }

/* Error */
.error{
  background:#fff3f5; border:1px solid rgba(240,93,139,.25);
  color:#b0003a; padding:8px 10px; border-radius:12px; font-size:13px;
}

/* CTA */
.cta{
  width: 100%;
  height: 46px; border-radius: 12px; border: none; cursor: pointer; padding: 0 16px;
  background: linear-gradient(135deg, var(--bb-accent), #ff7aa6);
  color:#fff; font-weight:900; letter-spacing:.2px;
  box-shadow: 0 10px 28px rgba(240,93,139,.35);
  transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
  margin-top: 6px;
}
.cta:hover{ transform: translateY(-1px); box-shadow: 0 12px 34px rgba(240,93,139,.45); }
.cta[disabled]{ opacity:.65; cursor:not-allowed; transform:none; box-shadow:none; }

/* Links */
.links{ display:flex; justify-content:flex-end; gap: 8px; align-items:center; margin-top: 8px; }
.muted{ color: var(--bb-primary); opacity:.8; font-size: 13px; }
.textlink{
  background: transparent; border: none; padding: 0;
  color: var(--bb-primary); font-size: 14px; font-weight: 700; text-decoration: underline;
  letter-spacing: .1px; cursor: pointer; opacity: .92; transition: color .15s ease, opacity .15s ease;
}
.textlink:hover{ color: var(--bb-accent); opacity:1; }

/* Eye toggles */
.icon-btn.eye{
  display:inline-flex; align-items:center; justify-content:center;
  width: 36px; height: 36px; border: none; background: transparent; border-radius: 10px; cursor: pointer;
}
.icon-btn.eye:hover{ background: rgba(0,0,0,.04); }

/* Small screens */
@media (max-width: 560px){
  .auth-modal{ padding: 12px; }
  .sheet{ width: min(96vw, 560px); height: min(86vh, 640px); border-radius: 16px; }
}

/* Safe areas */
@supports (padding: max(0px)){
  .auth-modal{
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
}
`;

/* Extra iOS nudge: keep text size stable */
const iosFontFix = `
html { -webkit-text-size-adjust: 100%; }
`;
