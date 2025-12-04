import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { customerRegister } from "../../api/auth";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import logo from "../../assets/BB_logo.svg";
import { apiUrl } from "../../api/base";
import http from "../../api/http";

type Step = "choose" | "email-form" | "otp-verify";

export default function RegisterModal() {
  const nav = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useAuth();

  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // OTP verification
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

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

  // Validation
  const nameOk = name.trim().length >= 2;
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const pwOk = password.length >= 8;
  const confirmOk = confirm === password && confirm.length > 0;
  const canSubmit = nameOk && emailOk && pwOk && confirmOk;

  // Step 1: Submit registration form
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);

    try {
      await customerRegister({ name, email, password, phone: undefined } as any);
      // Move to OTP verification step
      setStep("otp-verify");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Registration failed. Try a different email.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Verify OTP and auto-login
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setOtpBusy(true);
    setOtpErr(null);

    try {
      // Verify the OTP - backend returns token on success
      const { data } = await http.post("/api/customers/auth/verify-email-otp", { email, code: otp });

      // Auto-login with returned token
      if (data?.token) {
        loginWithToken(data.token);
        nav("/profile", { replace: true });
      } else {
        // Fallback: try login with email/password
        const loginRes = await http.post("/api/customers/auth/login", { identifier: email, password });
        if (loginRes.data?.token) {
          loginWithToken(loginRes.data.token);
          nav("/profile", { replace: true });
        }
      }
    } catch (e: any) {
      setOtpErr(e?.response?.data?.message || "Invalid or expired code. Please try again.");
    } finally {
      setOtpBusy(false);
    }
  };

  // Resend OTP
  const resendOtp = async () => {
    setResendBusy(true);
    setResendMsg(null);
    try {
      await http.post("/api/customers/auth/resend-verification", { email });
      setResendMsg("New code sent! Check your email.");
    } catch {
      setResendMsg("Could not resend. Please try again.");
    } finally {
      setResendBusy(false);
    }
  };

  const close = () => nav("/", { replace: true });

  const modal = (
    <>
      <style>{styles}</style>
      <div className="auth-scrim" onClick={close} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Register form" onClick={close}>
        <div ref={sheetRef} className="sheet" onClick={(e) => e.stopPropagation()}>
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

          <div className="sheet-scroll">
            {/* STEP: Choose method */}
            {step === "choose" && (
              <>
                <div className="hero">
                  <h3>Create your account</h3>
                  <p>Join Blossom Buds Floral Artistry.</p>
                </div>

                <div className="form">
                  <button
                    type="button"
                    className="google-btn primary-google"
                    onClick={() => window.location.href = apiUrl("/oauth2/authorization/google")}
                  >
                    <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="" />
                    <span>Sign up with Google</span>
                  </button>

                  <div className="divider"><span>or</span></div>

                  <button
                    type="button"
                    className="email-toggle-btn"
                    onClick={() => setStep("email-form")}
                  >
                    Sign up with Email
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
                </div>
              </>
            )}

            {/* STEP: Email form */}
            {step === "email-form" && (
              <>
                <div className="hero">
                  <h3>Sign up with Email</h3>
                  <p>We'll send you a verification code.</p>
                </div>

                <form className="form email-form" onSubmit={onSubmit}>
                  <label className="label">
                    <span>Name</span>
                    <div className="field">
                      <input
                        className="input"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoComplete="name"
                        autoFocus
                      />
                    </div>
                    <small className={`hint ${nameOk ? "ok" : ""}`}>
                      {nameOk ? "Looks good." : "At least 2 characters."}
                    </small>
                  </label>

                  <label className="label">
                    <span>Email</span>
                    <div className="field">
                      <input
                        className="input"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                    <small className={`hint ${emailOk ? "ok" : ""}`}>
                      {emailOk ? "Valid email." : "Enter a valid email address."}
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
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="icon-btn eye"
                        onClick={() => setShowPw(s => !s)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        <EyeIcon open={showPw} />
                      </button>
                    </div>
                    <small className={`hint ${pwOk ? "ok" : ""}`}>
                      {pwOk ? "Strong enough." : "Minimum 8 characters."}
                    </small>
                  </label>

                  <label className="label">
                    <span>Confirm password</span>
                    <div className="field">
                      <input
                        className="input"
                        type={showPw2 ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="icon-btn eye"
                        onClick={() => setShowPw2(s => !s)}
                        aria-label={showPw2 ? "Hide password" : "Show password"}
                      >
                        <EyeIcon open={showPw2} />
                      </button>
                    </div>
                    <small className={`hint ${confirmOk ? "ok" : ""}`}>
                      {confirm.length === 0 ? "Please confirm password." : (confirmOk ? "Passwords match." : "Passwords don't match.")}
                    </small>
                  </label>

                  {err && <div className="error" role="alert">{err}</div>}

                  <button className="cta" type="submit" disabled={!canSubmit || busy}>
                    {busy ? "Creating account…" : "Continue"}
                  </button>

                  <button type="button" className="back-btn" onClick={() => setStep("choose")}>
                    ← Back
                  </button>
                </form>
              </>
            )}

            {/* STEP: OTP Verification */}
            {step === "otp-verify" && (
              <>
                <div className="hero">
                  <h3>Verify your email</h3>
                  <p>We sent a 6-digit code to <strong>{email}</strong></p>
                </div>

                <form className="form otp-form" onSubmit={verifyOtp}>
                  <label className="label">
                    <span>Verification Code</span>
                    <div className="field otp-field">
                      <input
                        className="input otp-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        autoFocus
                        autoComplete="one-time-code"
                      />
                    </div>
                  </label>

                  {otpErr && <div className="error" role="alert">{otpErr}</div>}

                  <button className="cta" type="submit" disabled={otp.length < 6 || otpBusy}>
                    {otpBusy ? "Verifying…" : "Verify & Continue"}
                  </button>

                  <div className="resend-row">
                    <span className="muted">Didn't receive the code?</span>
                    <button
                      type="button"
                      className="textlink"
                      onClick={resendOtp}
                      disabled={resendBusy}
                    >
                      {resendBusy ? "Sending…" : "Resend"}
                    </button>
                  </div>
                  {resendMsg && <div className="resend-msg">{resendMsg}</div>}

                  <button type="button" className="back-btn" onClick={() => setStep("email-form")}>
                    ← Change email
                  </button>
                </form>
              </>
            )}
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
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M2 12s4-7 10-7c2.4 0 4.4.8 6 2" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6" />
      <path d="M22 12s-4 7-10 7c-2.4 0-4.4-.8-6-2" fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.6" />
      <path d="M3 3l18 18" stroke="rgba(0,0,0,.6)" strokeWidth="1.6" />
    </svg>
  );
}

const styles = `
:root{
  --bb-primary: #4A4F41;
  --bb-accent: #F05D8B;
  --bb-secondary: #F6C320;
}

/* Overlay */
.auth-scrim{
  position:fixed; inset:0; z-index:9998;
  background: rgba(0,0,0,.28);
  backdrop-filter: blur(6px);
  animation: fadeIn .18s ease both;
}
@keyframes fadeIn{ from{ opacity:0 } to{ opacity:1 } }

/* Centered container */
.auth-modal{
  position:fixed; inset:0; z-index:9999;
  display:grid; place-items:center;
  padding:16px;
}

/* Sheet card */
.sheet{
  display: flex;
  flex-direction: column;
  width: min(440px, 96vw);
  max-height: min(88vh, 680px);
  background:#fff;
  border-radius: 20px;
  box-shadow: 0 24px 80px rgba(0,0,0,.22);
  animation: popUp .22s cubic-bezier(.2,.8,.2,1) both;
  overflow: hidden;
}
@keyframes popUp{ from{ opacity:0; transform: scale(.96) translateY(12px); } to{ opacity:1; transform:none; } }

/* Header */
.am-head{
  display:flex; align-items:center; justify-content:space-between; gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,0,0,.06);
  flex-shrink: 0;
}
.brand{ display:flex; align-items:center; gap: 10px; }
.brand img{ height: 40px; }
.brand-name{ display:flex; flex-direction:column; }
.brand-name .big{ font-family: "DM Serif Display", Georgia, serif; font-size: 16px; color: var(--bb-primary); }
.brand-name .small{ font-size: 11px; color: var(--bb-primary); opacity:.8; }
.x{ width:34px; height:34px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer; }

/* Scrollable body */
.sheet-scroll{
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
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

/* Inputs */
.field{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  border-radius: 14px;
  padding: 0 10px;
  transition: border-color .16s ease, box-shadow .16s ease;
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
  height: 48px; border-radius: 12px; border: none; cursor: pointer; padding: 0 16px;
  background: linear-gradient(135deg, var(--bb-accent), #ff7aa6);
  color:#fff; font-weight:900; letter-spacing:.2px;
  box-shadow: 0 10px 28px rgba(240,93,139,.35);
  transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease;
  margin-top: 6px;
}
.cta:hover{ transform: translateY(-1px); box-shadow: 0 12px 34px rgba(240,93,139,.45); }
.cta[disabled]{ opacity:.65; cursor:not-allowed; transform:none; box-shadow:none; }

/* Links */
.links{ display:flex; justify-content:center; gap: 8px; align-items:center; margin-top: 8px; }
.muted{ color: var(--bb-primary); opacity:.8; font-size: 13px; }
.textlink{
  background: transparent; border: none; padding: 0;
  color: var(--bb-primary); font-size: 14px; font-weight: 700; text-decoration: underline;
  cursor: pointer; opacity: .92; transition: color .15s ease;
}
.textlink:hover{ color: var(--bb-accent); opacity:1; }
.textlink[disabled]{ opacity:.5; cursor:not-allowed; }

/* Eye toggles */
.icon-btn.eye{
  display:inline-flex; align-items:center; justify-content:center;
  width: 36px; height: 36px; border: none; background: transparent; border-radius: 10px; cursor: pointer;
}
.icon-btn.eye:hover{ background: rgba(0,0,0,.04); }

/* Divider */
.divider{ display:flex; align-items:center; gap:12px; margin: 16px 0 12px; }
.divider::before, .divider::after{ content:""; flex:1; height:1px; background: rgba(0,0,0,.1); }
.divider span{ font-size:13px; color: var(--bb-primary); opacity:.7; font-weight:600; }

/* Google button */
.google-btn{
  display:flex; align-items:center; justify-content:center; gap:10px;
  width:100%; height:48px; border-radius:12px;
  background:#fff; border:1px solid rgba(0,0,0,.15);
  color: #3c4043; font-weight:600; font-size:15px;
  cursor:pointer; transition: background .15s ease;
}
.google-btn:hover{ background:#f8f9fa; }
.google-btn img{ width:20px; height:20px; }

/* Primary Google - blue */
.primary-google{
  background: linear-gradient(135deg, #4285f4, #357ae8) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 700 !important;
  box-shadow: 0 8px 24px rgba(66,133,244,.35);
}
.primary-google:hover{ 
  background: linear-gradient(135deg, #357ae8, #2a68c4) !important; 
  box-shadow: 0 10px 28px rgba(66,133,244,.45);
}
.primary-google img{ filter: brightness(0) invert(1); }

/* Email toggle button */
.email-toggle-btn{
  display:flex; align-items:center; justify-content:center;
  width:100%; height:48px; border-radius:12px;
  background:#fff; border:1px solid rgba(0,0,0,.15);
  color: var(--bb-primary); font-weight:600; font-size:15px;
  cursor:pointer; transition: background .15s ease, border-color .15s ease;
}
.email-toggle-btn:hover{ background:#f8f9fa; border-color: var(--bb-accent); }

/* Email form animation */
.email-form{
  animation: slideIn .2s ease-out both;
}
@keyframes slideIn{ from{ opacity:0; transform: translateY(10px); } to{ opacity:1; transform:none; } }

/* Back button */
.back-btn{
  display:inline-flex; align-items:center; justify-content:center;
  width:100%; height:40px; border-radius:10px;
  background:transparent; border:1px dashed rgba(0,0,0,.15);
  color: var(--bb-primary); font-weight:600; font-size:14px;
  cursor:pointer; opacity:.8; transition: opacity .15s ease, background .15s ease;
}
.back-btn:hover{ opacity:1; background:rgba(0,0,0,.03); }

/* OTP form */
.otp-form{ animation: slideIn .2s ease-out both; }
.otp-field{ justify-content:center; }
.otp-input{
  text-align:center; font-size:28px !important; letter-spacing:8px; font-weight:700;
  max-width: 200px;
}
.resend-row{ display:flex; align-items:center; justify-content:center; gap:8px; margin-top:6px; }
.resend-msg{ text-align:center; font-size:13px; color: var(--bb-primary); opacity:.9; }

/* Small screens */
@media (max-width: 560px){
  .auth-modal{ padding: 12px; }
  .sheet{ width: min(96vw, 440px); max-height: min(90vh, 680px); border-radius: 16px; }
}
`;

const iosFontFix = `
html { -webkit-text-size-adjust: 100%; }
`;
