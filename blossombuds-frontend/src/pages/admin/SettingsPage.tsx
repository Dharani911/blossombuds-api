import React, { useEffect, useMemo, useState } from "react";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  type SettingView,
} from "../../api/adminSettings";
import AdminCarouselImagesSetting from "../../components/admin/AdminCarouselImagesSetting";



const PRIMARY = "#4A4F41";
const INK = "rgba(0,0,0,.08)";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";

type RowMode = "view" | "edit" | "new";

type Row = {
  key: string;
  value: string;
  mode: RowMode;
  // local, for editing state
  _value?: string;
};

export default function SettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await listSettings();
        if (!live) return;
        setRows(
          data
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((s) => ({ ...s, mode: "view" as RowMode }))
        );
      } catch (e: any) {
        if (!live) return;
        if (e.status === 401) {
          setErr("You’re not signed in. Please log in as admin.");
        } else {
          setErr(e?.message || "Failed to load settings.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.key.toLowerCase().includes(needle) ||
        (r.value ?? "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  function startEdit(key: string) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, mode: "edit", _value: r.value } : r))
    );
  }
  function cancelEdit(key: string) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, mode: "view", _value: undefined } : r))
    );
  }
  async function saveEdit(key: string) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    const value = (row._value ?? "").trim();
    try {
      await upsertSetting(key, value);
      setRows((rs) =>
        rs.map((r) =>
          r.key === key ? { ...r, value, mode: "view", _value: undefined } : r
        )
      );
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }
  async function remove(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return;
    try {
      await deleteSetting(key);
      setRows((rs) => rs.filter((r) => r.key !== key));
      setToast({ kind: "ok", msg: "Deleted." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Delete failed." });
    }
  }

  function addNewRow() {
    // prevent multiple “new” rows
    if (rows.some((r) => r.mode === "new")) return;
    const draft: Row = { key: "", value: "", mode: "new" };
    setRows((rs) => [draft, ...rs]);
  }
  function updateNewKey(v: string) {
    setRows((rs) =>
      rs.map((r, i) => (i === 0 && r.mode === "new" ? { ...r, key: v } : r))
    );
  }
  function updateNewValue(v: string) {
    setRows((rs) =>
      rs.map((r, i) => (i === 0 && r.mode === "new" ? { ...r, value: v } : r))
    );
  }
  async function saveNew() {
    const draft = rows.find((r) => r.mode === "new");
    if (!draft) return;
    const key = draft.key.trim();
    const value = draft.value.trim();
    if (!key) {
      setToast({ kind: "bad", msg: "Key is required." });
      return;
    }
    try {
      await upsertSetting(key, value);
      setRows((rs) => {
        const withoutDraft = rs.filter((r) => r.mode !== "new");
        // If key existed, replace; else insert
        const existing = withoutDraft.find((r) => r.key === key);
        if (existing) {
          return withoutDraft.map((r) =>
            r.key === key ? { key, value, mode: "view" } : r
          );
        }
        return [{ key, value, mode: "view" }, ...withoutDraft].sort((a, b) =>
          a.key.localeCompare(b.key)
        );
      });
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }
  function cancelNew() {
    setRows((rs) => rs.filter((r) => r.mode !== "new"));
  }

  return (
    <div className="set-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <header className="hd">
        <div>
          <h2>Settings</h2>
        </div>
        <div className="right">
          <div className="search">
            <input
              placeholder="Search key or value…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="btn" onClick={addNewRow}>+ Add setting</button>
        </div>
      </header>

      {/* --- Feature images management block (uses AdminFeatureImagesSetting) --- */}
      <section id="feature-images" className="block">
        <div className="block-hd">
          <h3>Homepage Feature Images</h3>
          <p className="muted">Manage images used by the FeatureTiles section on the storefront.</p>
        </div>
        <div className="block-body card">
          {/* The component includes its own UI/controls & internal styles */}
          <div className="block-inner">
            <AdminCarouselImagesSetting />
          </div>
        </div>
      </section>

      {/* --- Generic key/value settings table (unchanged) --- */}
      <div className="card">
        <div className="table">
          <div className="thead">
            <div>Key</div>
            <div>Value</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {loading && (
            <div className="empty">
              <div className="empty-icon">⏳</div>
              <h3>Loading…</h3>
            </div>
          )}

          {!loading && err && (
            <div className="empty">
              <div className="empty-icon">⚠️</div>
              <h3>Couldn’t load settings</h3>
              <p className="muted">{err}</p>
            </div>
          )}

          {!loading && !err && filtered.length === 0 && (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <h3>No settings yet</h3>
            </div>
          )}

          {!loading && !err && filtered.map((r, idx) => (
            <div className="trow" key={r.mode === "new" ? "new-row" : r.key}>
              {/* key */}
              <div className="cell-key">
                {r.mode === "new" ? (
                  <input
                    className="in"
                    placeholder='e.g. "brand.whatsapp"'
                    value={r.key}
                    onChange={(e) => updateNewKey(e.target.value)}
                  />
                ) : (
                  <code title={r.key}>{r.key}</code>
                )}
              </div>

              {/* value */}
              <div className="cell-val">
                {r.mode === "view" ? (
                  <div className="val" title={r.value}>{r.value || "—"}</div>
                ) : r.mode === "edit" ? (
                  <input
                    className="in"
                    value={r._value ?? ""}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((x) =>
                          x.key === r.key ? { ...x, _value: e.target.value } : x
                        )
                      )
                    }
                  />
                ) : (
                  <input
                    className="in"
                    placeholder='e.g. "+91 90000 00000"'
                    value={r.value}
                    onChange={(e) => updateNewValue(e.target.value)}
                  />
                )}
              </div>

              {/* actions */}
              <div className="cell-act">
                {r.mode === "view" && (
                  <div className="act">
                    <button className="ghost sm" onClick={() => startEdit(r.key)}>Edit</button>
                    <button className="ghost sm bad" onClick={() => remove(r.key)}>Delete</button>
                  </div>
                )}
                {r.mode === "edit" && (
                  <div className="act">
                    <button className="ghost sm ok" onClick={() => saveEdit(r.key)}>Save</button>
                    <button className="ghost sm" onClick={() => cancelEdit(r.key)}>Cancel</button>
                  </div>
                )}
                {r.mode === "new" && idx === 0 && (
                  <div className="act">
                    <button className="ghost sm ok" onClick={saveNew}>Save</button>
                    <button className="ghost sm" onClick={cancelNew}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ---------- styles ---------- */
const css = `
.set-wrap{ padding:12px; color:${PRIMARY}; }

.hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; }
.hd h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.muted{ opacity:.75; font-size:12px; }

.right{ display:flex; align-items:center; gap:10px; }
.search input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 12px; background:#fff; outline:none; min-width:280px;
}
.btn{
  height:38px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:${ACCENT}; color:#fff; font-weight:900; box-shadow: 0 10px 28px rgba(240,93,139,.35);
}

/* Block wrapper for the feature images component */
.block{ margin-bottom:14px; }
.block-hd{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:0 2px 4px; }
.block-hd h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; color:${PRIMARY}; }
.block-body.card{ padding:10px 12px; }
.block-inner{ /* keeps AdminFeatureImagesSetting layout comfy */ }

.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }

.table{ display:grid; min-height:260px; }
.thead, .trow{
  display:grid; grid-template-columns: 1.4fr 3fr 220px; gap:10px; align-items:center; padding:10px 12px;
}
.thead{ font-weight:900; font-size:12px; background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); border-bottom:1px solid ${INK}; }
.trow{ border-bottom:1px solid ${INK}; }
.trow:last-child{ border-bottom:none; }

.cell-key code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:13px; background:rgba(0,0,0,.04); padding:2px 6px; border-radius:6px; }
.cell-val .val{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.in{
  height:34px; width:100%; border:1px solid ${INK}; border-radius:8px; padding:0 10px; background:#fff; outline:none;
}

.cell-act{ text-align:right; }
.act{ display:inline-flex; gap:6px; }
.ghost{
  height:32px; padding:0 10px; border-radius:10px; border:1px solid ${INK}; background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.sm{ height:28px; padding: 0 10px; border-radius:8px; font-size:12.5px; }
.ghost.ok{ border-color: rgba(89,178,107,.4); }
.ghost.bad{ border-color: rgba(240,93,139,.5); color:#b0003a; }

/* empty state */
.empty{
  grid-column: 1 / -1;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; padding:36px 16px; text-align:center; color:${PRIMARY};
}
.empty-icon{ font-size:34px; opacity:.6; line-height:1; }
.empty h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; }

/* hint */
.hint{ margin-top:12px; padding:12px; border:1px dashed ${INK}; border-radius:12px; background:#fff; }
.hint-title{ font-weight:900; margin-bottom:6px; }

/* toast */
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

/* responsive */
@media (max-width: 1000px){
  .thead, .trow{ grid-template-columns: 1.2fr 2fr 200px; }
  .search input{ min-width: 200px; }
}
@media (max-width: 760px){
  .thead, .trow{ grid-template-columns: 1fr; }
  .cell-act{ text-align:left; }
}
`;
