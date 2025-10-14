// src/pages/admin/AdminLoginPage.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminLogin } from "../../api/adminAuth";
import Logo from "../../assets/BB_logo.svg";

const PRIMARY = "#4A4F41";
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const INK     = "rgba(0,0,0,.08)";

export default function AdminLoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const next = params.get("next") || "/admin";
  const expired = params.get("expired") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await adminLogin(username.trim(), password);
      if (!res?.token) throw new Error("No token returned");
      const params = new URLSearchParams(location.search);
      const next = params.get("next") || "/admin";
      nav(next, { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <style>{styles(PRIMARY, ACCENT, GOLD, INK)}</style>

      <div className="frame">
        <div className="brand">
          <div className="logo-wrap">
            <img src={Logo} alt="Blossom Buds Floral Artistry" className="logo" />
          </div>
          <div>
            <h2>Blossom Buds Floral Artistry</h2>
            <p className="muted">Admin Console</p>
          </div>
        </div>

        <div className="card" role="dialog" aria-modal="true" aria-labelledby="signin-title">
          <div className="card-hd">
            <h1 id="signin-title">Welcome back</h1>
            <p className="sub">Sign in to manage products & orders</p>
          </div>

          {expired && <div className="alert warn">Session expired. Please sign in again.</div>}
          {err && <div className="alert bad">{err}</div>}

          <form onSubmit={onSubmit} className="form" noValidate>
            <label className="field">
              <span>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="username"
                disabled={busy}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="pw">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className="eye"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((v) => !v)}
                  disabled={busy}
                >
                  {showPw ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.64-1.5 1.59-2.87 2.76-4.03M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8-1 2.35-2.7 4.39-4.76 5.76M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <button type="submit" className="btn" disabled={busy || !username.trim() || !password} aria-busy={busy}>
              {busy ? (<><span className="spinner" aria-hidden /> Signing in…</>) : "Sign in"}
            </button>
          </form>

          <div className="card-ft">
            <span className="muted tiny">Protected area. Unauthorized access prohibited.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function styles(PRIMARY: string, ACCENT: string, GOLD: string, INK: string) {
  return `
:root{
  --bb-primary: ${PRIMARY};
  --bb-accent: ${ACCENT};
  --bb-gold:   ${GOLD};
  --ink: ${INK};
  --ring: ${ACCENT}55;
  --bg1: #fff7fb;
  --bg2: #f7fbe8;
}
*{ box-sizing:border-box; }
.admin-login-wrap{
  min-height:100dvh;
  background: radial-gradient(1200px 600px at 15% 20%, var(--bg2), transparent),
              radial-gradient(1200px 600px at 85% 80%, #ffeaf2, transparent),
              linear-gradient(180deg, #fff, #fafafa);
  display:grid; place-items:center; padding: 24px;
  color: var(--bb-primary);
}
.frame{ width:min(980px,100%); display:grid; grid-template-columns:1fr; gap:18px; }
@media (min-width:960px){ .frame{ grid-template-columns:1.05fr .95fr; align-items:center; } }

.brand{ display:none; }
@media (min-width:960px){
  .brand{ display:flex; align-items:center; gap:16px; padding:12px; }
  .brand h2{ margin:0; font-size:26px; color:var(--bb-primary); letter-spacing:.2px; }
  .brand .muted{ margin:2px 0 0; opacity:.7; }
  .logo-wrap{
    width:64px; height:64px; border-radius:20px; display:grid; place-items:center;
    background:#fff; border:1px solid ${INK}; box-shadow:0 18px 60px rgba(0,0,0,.08);
  }
  .logo{ width:44px; height:44px; display:block; }
}

.card{
  width:100%; padding:22px 18px 16px; border-radius:18px;
  background:rgba(255,255,255,.9); border:1px solid ${INK};
  box-shadow:0 18px 60px rgba(0,0,0,.12); backdrop-filter:blur(6px);
}
@media (min-width:480px){ .card{ padding:24px; } }
.card-hd{ margin-bottom:6px; }
h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; color:var(--bb-primary); font-size:28px; line-height:1.1; }
.sub{ margin:6px 0 0; opacity:.75; }

.form{ display:grid; gap:12px; margin-top:12px; }
.field{ display:grid; gap:6px; }
.field span{ font-weight:700; color:var(--bb-primary); font-size:14px; }
input{
  height:44px; border-radius:12px; border:1px solid rgba(0,0,0,.12);
  padding:0 12px; outline:none; background:#fff;
  transition: box-shadow .15s, border-color .15s, transform .05s;
}
input:focus{ border-color:var(--ring); box-shadow:0 0 0 4px ${ACCENT}22; }

.pw{ position:relative; display:flex; align-items:center; }
.pw input{ width:100%; padding-right:40px; }
.eye{
  position:absolute; right:8px; top:50%; transform:translateY(-50%);
  height:28px; width:28px; display:grid; place-items:center;
  border-radius:8px; border:1px solid transparent; background:#fff; color:#444; cursor:pointer;
}
.eye:hover{ background:#fafafa; }
.eye:disabled{ opacity:.5; cursor:not-allowed; }

.btn{
  height:46px; border-radius:12px; border:none; cursor:pointer;
  background:linear-gradient(180deg, var(--bb-accent), #e24477);
  color:#fff; font-weight:900; display:inline-flex; align-items:center; justify-content:center; gap:10px;
  box-shadow:0 16px 36px rgba(240,93,139,.35);
  transition: transform .05s, box-shadow .15s;
}
.btn:hover{ transform:translateY(-1px); box-shadow:0 18px 40px rgba(240,93,139,.42); }
.btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; box-shadow:0 6px 18px rgba(0,0,0,.08); }

.spinner{
  width:16px; height:16px; border-radius:50%;
  border:2px solid rgba(255,255,255,.6); border-top-color:#fff;
  animation:spin .8s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg); } }

.alert{
  margin:10px 0 0; padding:10px 12px; border-radius:12px; font-size:14px;
  border:1px solid rgba(0,0,0,.06); background:#fffdf0; color:#5b4b00;
}
.alert.bad{ background:#fff3f5; color:#a10039; border:1px solid rgba(240,93,139,.25); }
.alert.warn{ background:#fff9e3; color:#6b5500; border:1px solid ${GOLD}55; }

.card-ft{ margin-top:14px; display:flex; justify-content:center; }
.muted{ opacity:.75; }
.tiny{ font-size:12px; }
`;
}
