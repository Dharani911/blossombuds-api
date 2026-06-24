import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { customerLogin, requestPhoneLoginOtp, verifyPhoneLoginOtp } from "../../api/auth";
import { useAuth } from "../../app/AuthProvider";
import { useNavigate, useLocation, Link } from "react-router-dom";
import logo from "../../assets/BB_logo.svg";
import { apiUrl } from "../../api/base";

type Step = "choose" | "email-form" | "phone-form" | "phone-otp" | "forgot-password" | "forgot-password-reset";

export default function LoginModal() {
  const nav = useNavigate();
  const location = useLocation();
  const { loginWithToken } = useAuth();

  const from = (location.state as any)?.from as string | undefined;
  const cameFromBackground = Boolean((location.state as any)?.background);

  const [step, setStep] = useState<Step>("choose");

  // Email login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Phone login
  const [phone, setPhone] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  // Phone OTP step
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpBusy, setPhoneOtpBusy] = useState(false);
  const [phoneOtpErr, setPhoneOtpErr] = useState<string | null>(null);
  const [phoneResendBusy, setPhoneResendBusy] = useState(false);
  const [phoneResendMsg, setPhoneResendMsg] = useState<string | null>(null);

  // Forgot password
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpNewPw, setFpNewPw] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpBusy, setFpBusy] = useState(false);
  const [fpMsg, setFpMsg] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  // Validations
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const canEmailLogin = emailOk && password.length >= 1;

  const rawPhone = phone.replace(/\D/g, "");
  const phoneOk = /^[6-9]\d{9}$/.test(rawPhone);

  // ── Email login ────────────────────────────────────────────────────────────

  const submitEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEmailLogin) return;
    setBusy(true);
    setErr(null);
    setNeedsVerify(false);
    try {
      const { token } = await customerLogin({ identifier: email, password });
      loginWithToken(token);
      nav("/profile", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Login failed. Please check your credentials.";
      setErr(msg);
      if (typeof msg === "string" && msg.toLowerCase().includes("verify your email")) {
        setNeedsVerify(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!emailOk) return;
    setResendBusy(true);
    setResendMsg(null);
    try {
      await fetch(apiUrl("/api/customers/auth/resend-verification"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendMsg("Verification email sent. Check your inbox.");
    } catch {
      setResendMsg("Could not resend. Try again.");
    } finally {
      setResendBusy(false);
    }
  };

  // ── Phone login ────────────────────────────────────────────────────────────

  const submitPhoneForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOk) return;
    setPhoneBusy(true);
    setPhoneErr(null);
    try {
      await requestPhoneLoginOtp({ phone: rawPhone });
      setStep("phone-otp");
    } catch (e: any) {
      setPhoneErr(e?.response?.data?.message || "Could not send code. Check your number and try again.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const submitPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneOtp.length < 6) return;
    setPhoneOtpBusy(true);
    setPhoneOtpErr(null);
    try {
      const { token } = await verifyPhoneLoginOtp({ phone: rawPhone, code: phoneOtp });
      loginWithToken(token);
      nav("/profile", { replace: true });
    } catch (e: any) {
      setPhoneOtpErr(e?.response?.data?.message || "Invalid or expired code. Please try again.");
    } finally {
      setPhoneOtpBusy(false);
    }
  };

  const resendPhoneLoginOtp = async () => {
    setPhoneResendBusy(true);
    setPhoneResendMsg(null);
    try {
      await requestPhoneLoginOtp({ phone: rawPhone });
      setPhoneResendMsg("New code sent to your phone!");
    } catch {
      setPhoneResendMsg("Could not resend. Please try again.");
    } finally {
      setPhoneResendBusy(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(fpEmail)) { setFpMsg("Please enter a valid email."); return; }
    setFpBusy(true);
    setFpMsg(null);
    try {
      await fetch(apiUrl("/api/customers/auth/password-reset/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail }),
      });
      setFpMsg("If that email exists, a reset code has been sent.");
      setStep("forgot-password-reset");
    } catch {
      setFpMsg("Could not send reset email. Try again.");
    } finally {
      setFpBusy(false);
    }
  };

  const completePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpCode.length < 6 || fpNewPw.length < 8 || fpNewPw !== fpConfirm) return;
    setFpBusy(true);
    setFpMsg(null);
    try {
      await fetch(apiUrl("/api/customers/auth/password-reset/confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail, code: fpCode, newPassword: fpNewPw }),
      });
      try {
        const { token } = await customerLogin({ identifier: fpEmail, password: fpNewPw });
        loginWithToken(token);
        nav("/profile", { replace: true });
      } catch {
        setEmail(fpEmail);
        setPassword("");
        setFpMsg("Password updated. Please sign in.");
        setStep("email-form");
      }
    } catch {
      setFpMsg("Invalid code or error. Please check and try again.");
    } finally {
      setFpBusy(false);
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

  // Scroll lock
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

  const modal = (
    <>
      <style>{styles}</style>
      <div className="auth-scrim" onClick={close} />
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Login" onClick={close}>
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

            {/* ── CHOOSE ──────────────────────────────────────────────── */}
            {step === "choose" && (
              <>
                <div className="hero">
                  <h3>Welcome back</h3>
                  <p>Sign in to your account.</p>
                </div>
                <div className="form">
                  <button
                    type="button"
                    className="google-btn primary-google"
                    onClick={() => window.location.href = apiUrl("/oauth2/authorization/google")}
                  >
                    <img src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" alt="" />
                    <span>Continue with Google</span>
                  </button>
                  <div className="divider"><span>or</span></div>
                  <button type="button" className="method-btn" onClick={() => { setErr(null); setStep("email-form"); }}>
                    <IconMail /> Login with Email
                  </button>
                  <button type="button" className="method-btn" onClick={() => { setPhoneErr(null); setStep("phone-form"); }}>
                    <IconPhone /> Login with Mobile
                  </button>
                  <div className="links single">
                    <span className="muted">Don't have an account?</span>
                    <Link
                      to="/register"
                      state={{ from: "/", background: (location.state as any)?.background || location }}
                      className="textlink"
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              </>
            )}

            {/* ── EMAIL LOGIN ──────────────────────────────────────────── */}
            {step === "email-form" && (
              <>
                <div className="hero">
                  <h3>Login with Email</h3>
                  <p>Enter your email and password.</p>
                </div>
                <form className="form slide-in" onSubmit={submitEmailLogin}>
                  <label className="label">
                    <span>Email</span>
                    <div className="field">
                      <IconMail />
                      <input className="input" type="email" placeholder="you@example.com" value={email}
                        onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
                    </div>
                  </label>
                  <label className="label">
                    <span>Password</span>
                    <div className="field">
                      <IconLock />
                      <input className="input" type={showPw ? "text" : "password"} placeholder="Your password"
                        value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                      <button type="button" className="icon-btn eye" onClick={() => setShowPw(s => !s)}>
                        <EyeIcon open={showPw} />
                      </button>
                    </div>
                  </label>
                  <button type="button" className="forgot-link"
                    onClick={() => { setFpEmail(email); setStep("forgot-password"); }}>
                    Forgot password?
                  </button>
                  {err && (
                    <div className="error" role="alert">
                      {err}
                      {needsVerify && (
                        <button type="button" className="resend-btn" onClick={resendVerification} disabled={resendBusy}>
                          {resendBusy ? "Sending…" : "Resend verification email"}
                        </button>
                      )}
                    </div>
                  )}
                  {resendMsg && <div className="resend-msg success">{resendMsg}</div>}
                  <button className="cta" type="submit" disabled={!canEmailLogin || busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                  <button type="button" className="back-btn" onClick={() => setStep("choose")}>← Back</button>
                </form>
              </>
            )}

            {/* ── PHONE LOGIN ──────────────────────────────────────────── */}
            {step === "phone-form" && (
              <>
                <div className="hero">
                  <h3>Login with Mobile</h3>
                  <p>We'll send a 6-digit code to your number.</p>
                </div>
                <form className="form slide-in" onSubmit={submitPhoneForm}>
                  <label className="label">
                    <span>Mobile number</span>
                    <div className="field">
                      <span className="phone-prefix">+91</span>
                      <input className="input" type="tel" inputMode="numeric" placeholder="10-digit mobile number"
                        value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        autoComplete="tel" maxLength={10} autoFocus />
                    </div>
                    {rawPhone.length > 0 && (
                      <small className={`hint ${phoneOk ? "ok" : ""}`}>
                        {phoneOk ? "Valid number." : "Enter a valid 10-digit Indian mobile number."}
                      </small>
                    )}
                  </label>
                  {phoneErr && <div className="error" role="alert">{phoneErr}</div>}
                  <button className="cta" type="submit" disabled={!phoneOk || phoneBusy}>
                    {phoneBusy ? "Sending code…" : "Send code"}
                  </button>
                  <button type="button" className="back-btn" onClick={() => setStep("choose")}>← Back</button>
                </form>
              </>
            )}

            {/* ── PHONE OTP ────────────────────────────────────────────── */}
            {step === "phone-otp" && (
              <>
                <div className="hero">
                  <h3>Enter your code</h3>
                  <p>We sent a 6-digit code to <strong>+91 {rawPhone}</strong> via SMS.</p>
                </div>
                <form className="form slide-in" onSubmit={submitPhoneOtp}>
                  <label className="label">
                    <span>Verification code</span>
                    <div className="field otp-field">
                      <input className="input otp-input" type="text" inputMode="numeric" maxLength={6}
                        placeholder="000000" value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        autoFocus autoComplete="one-time-code" />
                    </div>
                  </label>
                  {phoneOtpErr && <div className="error" role="alert">{phoneOtpErr}</div>}
                  <button className="cta" type="submit" disabled={phoneOtp.length < 6 || phoneOtpBusy}>
                    {phoneOtpBusy ? "Verifying…" : "Sign in"}
                  </button>
                  <div className="resend-row">
                    <span className="muted">Didn't receive the code?</span>
                    <button type="button" className="textlink" onClick={resendPhoneLoginOtp} disabled={phoneResendBusy}>
                      {phoneResendBusy ? "Sending…" : "Resend"}
                    </button>
                  </div>
                  {phoneResendMsg && <div className="resend-msg">{phoneResendMsg}</div>}
                  <button type="button" className="back-btn" onClick={() => setStep("phone-form")}>← Change number</button>
                </form>
              </>
            )}

            {/* ── FORGOT PASSWORD ──────────────────────────────────────── */}
            {step === "forgot-password" && (
              <>
                <div className="hero">
                  <h3>Reset password</h3>
                  <p>We'll send a reset code to your email.</p>
                </div>
                <form className="form slide-in" onSubmit={requestPasswordReset}>
                  <label className="label">
                    <span>Email</span>
                    <div className="field">
                      <IconMail />
                      <input className="input" type="email" placeholder="you@example.com" value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value)} required autoComplete="email" autoFocus />
                    </div>
                  </label>
                  {fpMsg && <div className="resend-msg">{fpMsg}</div>}
                  <button className="cta" type="submit" disabled={fpBusy}>
                    {fpBusy ? "Sending…" : "Send reset code"}
                  </button>
                  <button type="button" className="back-btn" onClick={() => setStep("email-form")}>← Back to login</button>
                </form>
              </>
            )}

            {/* ── FORGOT PASSWORD RESET ────────────────────────────────── */}
            {step === "forgot-password-reset" && (
              <>
                <div className="hero">
                  <h3>Enter code & new password</h3>
                  <p>Check your email for the 6-digit code sent to <strong>{fpEmail}</strong>.</p>
                </div>
                <form className="form slide-in" onSubmit={completePasswordReset}>
                  <label className="label">
                    <span>Reset code</span>
                    <div className="field otp-field">
                      <input className="input otp-input" type="text" inputMode="numeric" maxLength={6}
                        placeholder="000000" value={fpCode}
                        onChange={(e) => setFpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
                    </div>
                  </label>
                  <label className="label">
                    <span>New password</span>
                    <div className="field">
                      <IconLock />
                      <input className="input" type="password" placeholder="At least 8 characters"
                        value={fpNewPw} onChange={(e) => setFpNewPw(e.target.value)} required autoComplete="new-password" />
                    </div>
                  </label>
                  <label className="label">
                    <span>Confirm new password</span>
                    <div className="field">
                      <IconLock />
                      <input className="input" type="password" placeholder="Re-enter new password"
                        value={fpConfirm} onChange={(e) => setFpConfirm(e.target.value)} required />
                    </div>
                  </label>
                  {fpMsg && <div className="resend-msg">{fpMsg}</div>}
                  <button className="cta" type="submit"
                    disabled={fpBusy || fpCode.length < 6 || fpNewPw.length < 8 || fpNewPw !== fpConfirm}>
                    {fpBusy ? "Updating…" : "Confirm & Login"}
                  </button>
                  <button type="button" className="back-btn" onClick={() => setStep("forgot-password")}>← Back</button>
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

// ── Icons ──────────────────────────────────────────────────────────────────

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M4 6l8 5 8-5" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6" />
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 118 0v3" fill="none" stroke="rgba(0,0,0,.5)" strokeWidth="1.6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  );
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

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = `
:root{
  --bb-primary: #4A4F41;
  --bb-accent: #F05D8B;
  --bb-accent-2: #F6C320;
  --bb-bg: #FAF7E7;
}
.auth-scrim{
  position:fixed; inset:0; z-index:9998;
  background:rgba(0,0,0,.28); backdrop-filter:blur(6px);
  animation:fadeIn .18s ease both;
}
@keyframes fadeIn{ from{opacity:0} to{opacity:1} }
.auth-modal{
  position:fixed; inset:0; z-index:9999;
  display:grid; place-items:center; padding:16px;
}
.sheet{
  display:flex; flex-direction:column;
  width:min(440px,96vw); max-height:min(88vh,700px);
  background:var(--bb-bg); border-radius:22px;
  box-shadow:0 24px 80px rgba(0,0,0,.22);
  animation:popUp .22s cubic-bezier(.2,.8,.2,1) both;
  overflow:hidden;
}
@keyframes popUp{
  from{opacity:0;transform:scale(.96) translateY(12px)}
  to{opacity:1;transform:none}
}
.am-head{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:12px 18px; border-bottom:1px solid rgba(0,0,0,.06); flex-shrink:0;
  background:linear-gradient(135deg,rgba(240,93,139,.22),rgba(246,195,32,.18));
  box-shadow:0 3px 10px rgba(0,0,0,.06),0 1px 0 rgba(255,255,255,.55) inset;
}
.brand{ display:flex; align-items:center; gap:10px; }
.brand img{ height:40px; }
.brand-name{ display:flex; flex-direction:column; }
.brand-name .big{
  font-family:"DM Serif Display",Georgia,serif; font-size:16px; color:#2f332a;
}
.brand-name .small{ font-size:11px; color:#4A4F41; opacity:.9; }
.x{
  width:34px; height:34px; border-radius:10px;
  border:1px solid rgba(0,0,0,.1); background:rgba(255,255,255,.9);
  cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
}
.sheet-scroll{
  flex:1 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch; padding:12px 16px 16px;
  background:#FFFBF3; border-radius:0 0 22px 22px;
}
.hero{ padding:6px 2px 10px; }
.hero h3{
  margin:0; font-family:"DM Serif Display",Georgia,serif;
  color:var(--bb-primary); font-size:24px;
}
.hero p{ margin:6px 0 0; color:var(--bb-primary); opacity:.92; }
.form{ display:flex; flex-direction:column; gap:12px; width:100%; }
.label{ display:flex; flex-direction:column; gap:6px; width:100%; }
.label > span{ font-weight:800; color:var(--bb-primary); font-size:13px; }
.field{
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(0,0,0,.12); background:#fff;
  border-radius:14px; padding:0 10px;
  transition:border-color .16s,box-shadow .16s,background .16s;
}
.field:focus-within{
  border-color:rgba(246,195,32,.95);
  box-shadow:0 0 0 6px rgba(246,195,32,.16); background:#FFFEF8;
}
.input{
  height:48px; min-height:48px; border:none; outline:none;
  flex:1; color:var(--bb-primary); background:transparent;
  font-weight:600; font-size:16px;
}
.phone-prefix{
  font-size:15px; font-weight:700; color:var(--bb-primary); opacity:.7;
  padding-right:6px; border-right:1px solid rgba(0,0,0,.1); margin-right:2px; white-space:nowrap;
}
.hint{ font-size:12px; color:var(--bb-primary); opacity:.8; margin-top:4px; display:block; }
.hint.ok{ color:#0c6e3c; opacity:1; }
.error{
  display:flex; flex-direction:column; gap:6px;
  background:#fff3f5; border:1px solid rgba(240,93,139,.25);
  color:#b0003a; padding:8px 10px; border-radius:12px; font-size:13px;
}
.resend-btn{
  background:transparent; border:1px solid rgba(240,93,139,.4);
  color:#b0003a; border-radius:8px; padding:4px 10px; font-size:12px;
  cursor:pointer; font-weight:600; align-self:flex-start;
}
.cta{
  width:100%; height:48px; border-radius:12px; border:none; cursor:pointer;
  background:linear-gradient(135deg,var(--bb-accent),#ff7aa6); color:#fff;
  font-weight:900; letter-spacing:.2px;
  box-shadow:0 10px 28px rgba(240,93,139,.35);
  transition:transform .16s,box-shadow .16s,opacity .16s; margin-top:6px;
}
.cta:hover{ transform:translateY(-1px); box-shadow:0 12px 34px rgba(240,93,139,.45); }
.cta[disabled]{ opacity:.65; cursor:not-allowed; transform:none; box-shadow:none; }
.links{ display:flex; justify-content:center; gap:8px; align-items:center; margin-top:8px; }
.single{ justify-content:center; }
.muted{ color:var(--bb-primary); opacity:.8; font-size:13px; }
.textlink{
  background:transparent; border:none; padding:0; color:var(--bb-accent);
  font-size:14px; font-weight:700; text-decoration:underline; cursor:pointer;
  opacity:.92; transition:color .15s,opacity .15s;
}
.textlink:hover{ color:#d94676; opacity:1; }
.textlink[disabled]{ opacity:.5; cursor:not-allowed; }
.icon-btn.eye{
  display:inline-flex; align-items:center; justify-content:center;
  width:36px; height:36px; border:none; background:transparent;
  border-radius:10px; cursor:pointer;
}
.icon-btn.eye:hover{ background:rgba(0,0,0,.04); }
.divider{
  display:flex; align-items:center; gap:12px; margin:14px 0 10px;
}
.divider::before,.divider::after{
  content:""; flex:1; height:1px; background:rgba(0,0,0,.08);
}
.divider span{ font-size:13px; color:var(--bb-primary); opacity:.7; font-weight:600; }
.google-btn{
  display:flex; align-items:center; justify-content:center; gap:10px;
  width:100%; height:48px; border-radius:12px; background:#fff;
  border:1px solid rgba(0,0,0,.08); color:#3c4043;
  font-weight:600; font-size:15px; cursor:pointer;
  transition:background .15s,box-shadow .15s,transform .15s;
}
.google-btn img{ width:20px; height:20px; }
.primary-google{
  background:linear-gradient(135deg,#F05D8B,#ff8fb0) !important;
  border:none !important; color:#fff !important; font-weight:700 !important;
  box-shadow:0 8px 24px rgba(240,93,139,.35);
}
.primary-google:hover{
  background:linear-gradient(135deg,#e44a7b,#ff7aa2) !important;
  box-shadow:0 10px 28px rgba(240,93,139,.45);
}
.primary-google img{ filter:brightness(0) invert(1); }
.method-btn{
  display:flex; align-items:center; justify-content:center; gap:10px;
  width:100%; height:48px; border-radius:12px; background:#fff;
  border:1px solid rgba(0,0,0,.12); color:var(--bb-primary);
  font-weight:600; font-size:15px; cursor:pointer;
  transition:background .15s,border-color .15s,box-shadow .15s;
}
.method-btn:hover{
  background:#FFFEF8; border-color:var(--bb-accent);
  box-shadow:0 6px 18px rgba(0,0,0,.06);
}
.slide-in{ animation:slideIn .2s ease-out both; }
@keyframes slideIn{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
.back-btn{
  display:inline-flex; align-items:center; justify-content:center;
  width:100%; height:40px; border-radius:10px; background:transparent;
  border:1px dashed rgba(0,0,0,.15); color:var(--bb-primary);
  font-weight:600; font-size:14px; cursor:pointer; opacity:.8;
  transition:opacity .15s,background .15s,border-color .15s;
}
.back-btn:hover{ opacity:1; background:rgba(250,247,231,.9); border-color:rgba(246,195,32,.6); }
.forgot-link{
  background:transparent; border:none; padding:0; margin-top:4px;
  align-self:flex-end; font-size:13px; font-weight:600;
  color:var(--bb-primary); text-decoration:underline; cursor:pointer; opacity:.8;
  transition:color .15s,opacity .15s;
}
.forgot-link:hover{ color:var(--bb-accent); opacity:1; }
.otp-field{ justify-content:center; }
.otp-input{
  text-align:center; font-size:28px !important;
  letter-spacing:8px; font-weight:700; max-width:200px;
}
.resend-row{
  display:flex; align-items:center; justify-content:center; gap:8px; margin-top:6px;
}
.resend-msg{ text-align:center; font-size:13px; color:var(--bb-primary); opacity:.9; }
@media (max-width:560px){
  .auth-modal{ padding:12px; }
  .sheet{ width:min(96vw,440px); max-height:min(90vh,700px); border-radius:18px; }
  .sheet-scroll{ border-radius:0 0 18px 18px; }
}
`;

const iosFontFix = `html { -webkit-text-size-adjust: 100%; }`;
