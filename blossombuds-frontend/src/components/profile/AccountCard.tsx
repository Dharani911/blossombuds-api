import React, { useEffect, useState } from "react";

type Props = {
  loading: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;

  fullName: string;
  setFullName: (s: string) => void;

  email: string;
  phone: string;
  setPhone: (s: string) => void;

  onSave: () => void;
  saving: boolean;

  isGoogleUser?: boolean; // Show Google badge if true
};

export default function AccountCard({
  loading,
  editing,
  setEditing,
  fullName,
  setFullName,
  email,
  phone,
  setPhone,
  onSave,
  saving,
  isGoogleUser,
}: Props) {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width:560px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width:560px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!isMobile); }, [isMobile]);

  return (
    <div className={`card ${isMobile ? "is-mobile" : ""}`}>
      <style>{styles}</style>

      <div className="head">
        <div className="head-title">
          <h3>Account</h3>
          {isGoogleUser && <span className="google-badge">Google</span>}
        </div>

        <div className="head-right">

          {/* Show actions only when expanded on mobile, always on desktop */}
          {(!isMobile || open) && (
            !editing ? (
              <button className="icon" onClick={() => setEditing(true)} title="Edit" aria-label="Edit">
                ✎
              </button>
            ) : (
              <div className="actions">
                <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn" onClick={onSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )
          )}
          {/* Mobile expand/collapse */}
          {isMobile && (
            <button
              className="toggle"
              aria-expanded={open}
              onClick={() => setOpen((s) => !s)}
              title={open ? "Collapse" : "Expand"}
            >
              <span className="toggle-ic">{open ? "▴" : "▾"}</span>
              <span className="toggle-label">{open ? "Collapse" : "Expand"}</span>
            </button>
          )}




        </div>
      </div>

      <div className={`body collapse ${open ? "open" : ""}`}>
        {loading ? (
          <div className="skeleton">Loading profile…</div>
        ) : (
          <div className="grid">
            <label className="field">
              <span>Full name</span>
              {editing ? (
                <input
                  className="input"
                  value={fullName ?? ""}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  inputMode="text"
                />
              ) : (
                <div className="value">{fullName || "—"}</div>
              )}
            </label>

            <label className="field">
              <span>Email {isGoogleUser && <small className="google-hint">(from Google)</small>}</span>
              <div className="value">{email || "—"}</div>
            </label>

            <label className="field">
              <span>Phone</span>
              {editing ? (
                <div className="phone-field">
                  <span className="phone-prefix">+91</span>
                  <input
                    className="input phone-input"
                    value={(phone ?? "").replace(/^\+91/, "")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(digits ? `+91${digits}` : "");
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    inputMode="tel"
                  />
                </div>
              ) : (
                <div className="value">{phone ? `+91 ${phone.replace(/^\+91/, "")}` : "—"}</div>
              )}
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = `
.head{
  display:flex; align-items:center; justify-content:space-between; gap: 10px;
  padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.06);
}
.head-title{ display:flex; align-items:center; gap:10px; }
.head-right{ display:flex; align-items:center; gap:8px; }

/* Google badge */
.google-badge{
  display:inline-flex; align-items:center; gap:4px;
  padding: 4px 10px; border-radius: 20px;
  background: linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335);
  background-size: 200% 100%;
  color: #fff; font-size: 11px; font-weight: 700;
  animation: google-shimmer 3s ease infinite;
}
@keyframes google-shimmer { 0%,100%{background-position: 0% 50%} 50%{background-position: 100% 50%} }
.google-hint{ font-weight:400; opacity:.7; font-size:11px; }

.icon{ width:36px; height:36px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer; }
.actions{ display:flex; gap:8px; }
.btn{ height: 36px; border-radius: 10px; border:none; padding: 0 14px; font-weight: 900; cursor:pointer; background: var(--bb-accent); color:#fff; box-shadow: 0 12px 30px rgba(240,93,139,.28); }
.btn.ghost{ background:#fff; color: var(--bb-primary); border:1px solid rgba(0,0,0,.1); box-shadow:none; }

/* Toggle (mobile-only) */
.toggle{
  display:inline-flex; align-items:center; gap:6px;
  height:36px; padding:0 10px; border-radius:10px;
  background:#fff; border:1px solid rgba(0,0,0,.10); cursor:pointer;
  font-weight:900; color: var(--bb-primary);
}
.toggle-ic{ font-size:14px; line-height:1; }

/* Open indicator */
.open-dot{
  width:8px; height:8px; border-radius:999px;
  background: var(--bb-accent);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--bb-accent), transparent 82%);
}

/* Collapsible body */
.body{ padding: 0; }
.collapse{ max-height: 0; overflow: hidden; transition: max-height .22s ease; }
.collapse.open{ max-height: 1200px; }
.grid{ padding: 12px 14px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 700px){ .grid{ grid-template-columns: 1fr; } }

.field{ display:flex; flex-direction:column; gap:6px; }
.field > span{ font-weight:800; font-size:13px; color: var(--bb-primary); }
.value{ min-height: 44px; display:flex; align-items:center; padding: 0 12px; border-radius: 12px; border:1px solid rgba(0,0,0,.08); background:#fafafa; }
.input{
  height: 44px; border-radius: 12px; border:1px solid rgba(0,0,0,.12);
  padding: 0 12px; background:#fff; color: var(--bb-primary);
}

/* Phone field with prefix */
.phone-field{
  display:flex; align-items:center; gap:0;
  border:1px solid rgba(0,0,0,.12); border-radius:12px; background:#fff; overflow:hidden;
}
.phone-prefix{
  padding:0 12px; background:rgba(0,0,0,.03); border-right:1px solid rgba(0,0,0,.12);
  font-weight:700; color: var(--bb-primary); height:44px; display:flex; align-items:center;
}
.phone-input{
  flex:1; height:44px; border:none !important; border-radius: 0 12px 12px 0 !important;
  padding: 0 12px; background:transparent; color: var(--bb-primary);
}

.skeleton{
  padding: 14px 16px; color: var(--bb-primary); opacity:.9;
  background: linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04));
  background-size: 300% 100%; animation: shimmer 1.1s linear infinite;
}
@keyframes shimmer { 0%{background-position: 0% 0} 100%{background-position: -300% 0} }

/* Desktop/tablet: always open, show actions, hide toggle */
@media (min-width: 561px){
  .collapse{ max-height: none !important; }
  .toggle{ display:none; }
}
`;
