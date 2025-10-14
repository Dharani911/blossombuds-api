import React from "react";

type Props = {
  loading: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;

  fullName: string;                 // ← use this for the name
  setFullName: (s: string) => void;

  email: string;
  phone: string;
  setPhone: (s: string) => void;

  onSave: () => void;
  saving: boolean;
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
}: Props) {
  return (
    <div className="card">
      <style>{styles}</style>
      <div className="head">
        <h3>Account</h3>
        {!editing ? (
          <button className="icon" onClick={() => setEditing(true)} title="Edit">✎</button>
        ) : (
          <div className="actions">
            <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button className="btn" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="body">
        {loading ? (
          <div className="skeleton">Loading profile…</div>
        ) : (
          <div className="grid">
            {/* Name (controlled by fullName prop) */}
            <label className="field">
              <span>Full name</span>
              {editing ? (
                <input
                  className="input"
                  value={fullName ?? ""}                 // ← reflects parent state
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              ) : (
                <div className="value">{fullName || "—"}</div>
              )}
            </label>

            {/* Email (read-only) */}
            <label className="field">
              <span>Email</span>
              <div className="value">{email || "—"}</div>
            </label>

            {/* Phone (controlled) */}
            <label className="field">
              <span>Phone</span>
              {editing ? (
                <input
                  className="input"
                  value={phone ?? ""}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                />
              ) : (
                <div className="value">{phone || "—"}</div>
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
.body{ padding: 12px 14px; }

.icon{ width:36px; height:36px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer; }
.actions{ display:flex; gap:8px; }
.btn{ height: 36px; border-radius: 10px; border:none; padding: 0 14px; font-weight: 900; cursor:pointer; background: var(--bb-accent); color:#fff; box-shadow: 0 12px 30px rgba(240,93,139,.28); }
.btn.ghost{ background:#fff; color: var(--bb-primary); border:1px solid rgba(0,0,0,.1); box-shadow:none; }

.grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 700px){ .grid{ grid-template-columns: 1fr; } }

.field{ display:flex; flex-direction:column; gap:6px; }
.field > span{ font-weight:800; font-size:13px; color: var(--bb-primary); }
.value{ min-height: 44px; display:flex; align-items:center; padding: 0 12px; border-radius: 12px; border:1px solid rgba(0,0,0,.08); background:#fafafa; }
.input{
  height: 44px; border-radius: 12px; border:1px solid rgba(0,0,0,.12);
  padding: 0 12px; background:#fff; color: var(--bb-primary);
}

.skeleton{
  padding: 14px 16px; color: var(--bb-primary); opacity:.9;
  background: linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04));
  background-size: 300% 100%; animation: shimmer 1.1s linear infinite;
}
@keyframes shimmer { 0%{background-position: 0% 0} 100%{background-position: -300% 0} }
`;
