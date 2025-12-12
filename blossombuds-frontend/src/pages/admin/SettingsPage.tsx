import React, { useEffect, useMemo, useState } from "react";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  type SettingView,
} from "../../api/adminSettings";
import AdminFeatureImagesSetting from "../../components/admin/AdminFeatureImagesSetting";
import AdminCoupons from "../../components/admin/AdminCoupons";
import AdminDeliveryPartners from "../../components/admin/AdminDeliveryPartners";
import AdminDeliveryFeeRules from "../../components/admin/AdminDeliveryFeeRules";

/* ---- theme tokens ---- */
const PRIMARY = "#4A4F41";
const INK = "rgba(0,0,0,.08)";

type RowMode = "view" | "edit" | "new";

/** One kv row with UI state */
type Row = {
  key: string;
  value: string;
  mode: RowMode;
  _value?: string; // temp edited value for "edit"
};

/** A section groups keys by prefix before the first dot */
type Section = {
  name: string;
  open: boolean;
  rows: Row[];
  draft?: { keyPart: string; value: string } | null;
};

export default function SettingsPage() {
  const [allRows, setAllRows] = useState<Row[]>([]);
  // UI state for sections: open/closed, and draft row state
  const [sectionUi, setSectionUi] = useState<Record<string, { open: boolean; draft: { keyPart: string; value: string } | null }>>({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);
  const [q, setQ] = useState("");

  // top-level “new section” inline composer
  const [newSecOpen, setNewSecOpen] = useState(false);
  const [newSecName, setNewSecName] = useState("");
  const [newSecKeyPart, setNewSecKeyPart] = useState("");
  const [newSecValue, setNewSecValue] = useState("");

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await listSettings(); // SettingView[] {key,value}
        if (!live) return;
        const rows: Row[] = (data || [])
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((s) => ({ key: s.key, value: s.value ?? "", mode: "view" }));
        setAllRows(rows);

        // Initialize UI state for sections found
        const initialUi: Record<string, any> = {};
        const seen = new Set<string>();
        for (const r of rows) {
          const sec = sectionNameOf(r.key);
          if (!seen.has(sec)) {
            seen.add(sec);
            initialUi[sec] = { open: true, draft: null };
          }
        }
        setSectionUi(initialUi);

      } catch (e: any) {
        if (!live) return;
        setErr(e?.message || "Failed to load settings.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  /* ---------- helpers ---------- */
  const sectionNameOf = (key: string): string => {
    const i = key.indexOf(".");
    return i > 0 ? key.slice(0, i) : "general";
  };

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter(
      (r) =>
        r.key.toLowerCase().includes(needle) ||
        (r.value ?? "").toLowerCase().includes(needle)
    );
  }, [allRows, q]);

  // Derived sections from filteredRows + sectionUi
  const sections = useMemo(() => {
    const map = new Map<string, Row[]>();
    // Group rows
    for (const r of filteredRows) {
      const sec = sectionNameOf(r.key);
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(r);
    }

    // Also ensure we show sections that might have a draft but no rows (if we supported that, but currently drafts are attached to existing sections)
    // Actually, if we add a new key to a section that has no rows yet (via "New section" button), it appears in allRows.
    // So iterating filteredRows is sufficient.

    const list: Section[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, rows]) => {
        const ui = sectionUi[name] || { open: true, draft: null };
        return {
          name,
          open: ui.open,
          rows,
          draft: ui.draft,
        };
      });
    return list;
  }, [filteredRows, sectionUi]);

  /* ---------- row actions ---------- */
  function startEdit(fullKey: string) {
    setAllRows((rs) =>
      rs.map((r) => (r.key === fullKey ? { ...r, mode: "edit", _value: r.value } : r))
    );
  }
  function cancelEdit(fullKey: string) {
    setAllRows((rs) =>
      rs.map((r) =>
        r.key === fullKey ? { ...r, mode: "view", _value: undefined } : r
      )
    );
  }
  async function saveEdit(fullKey: string) {
    const row = allRows.find((r) => r.key === fullKey);
    if (!row) return;
    const value = (row._value ?? "").trim();
    try {
      await upsertSetting(fullKey, value);
      setAllRows((rs) =>
        rs.map((r) =>
          r.key === fullKey ? { ...r, value, mode: "view", _value: undefined } : r
        )
      );
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }
  async function remove(fullKey: string) {
    if (!confirm(`Delete setting "${fullKey}"?`)) return;
    try {
      await deleteSetting(fullKey);
      setAllRows((rs) => rs.filter((r) => r.key !== fullKey));
      setToast({ kind: "ok", msg: "Deleted." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Delete failed." });
    }
  }

  /* ---------- section-level add key ---------- */
  /* ---------- section-level add key ---------- */
  function setSecUi(name: string, patch: Partial<{ open: boolean; draft: any }>) {
    setSectionUi(prev => {
      const existing = prev[name] || { open: true, draft: null };
      return { ...prev, [name]: { ...existing, ...patch } };
    });
  }

  function addDraftRow(sectionName: string) {
    setSecUi(sectionName, { open: true, draft: { keyPart: "", value: "" } });
  }

  function updateDraft(sectionName: string, field: "keyPart" | "value", v: string) {
    setSectionUi(prev => {
      const existing = prev[sectionName];
      if (!existing || !existing.draft) return prev;
      return {
        ...prev,
        [sectionName]: { ...existing, draft: { ...existing.draft, [field]: v } }
      };
    });
  }

  async function saveDraft(sectionName: string) {
    const ui = sectionUi[sectionName];
    if (!ui || !ui.draft) return;

    const keyPart = ui.draft.keyPart.trim();
    const value = (ui.draft.value ?? "").trim();

    if (!keyPart) {
      setToast({ kind: "bad", msg: "Key is required." });
      return;
    }
    const fullKey = `${sectionName}.${keyPart}`;
    try {
      await upsertSetting(fullKey, value);
      setAllRows((rs) => {
        const exists = rs.some((r) => r.key === fullKey);
        const next = exists
          ? rs.map((r) => (r.key === fullKey ? { ...r, value } : r))
          : [...rs, { key: fullKey, value, mode: "view" as RowMode }];
        return next.sort((a, b) => a.key.localeCompare(b.key));
      });
      setSecUi(sectionName, { draft: null });
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }

  function cancelDraft(sectionName: string) {
    setSecUi(sectionName, { draft: null });
  }

  /* ---------- top-level: new section ---------- */
  function cancelNewSection() {
    setNewSecOpen(false);
    setNewSecName("");
    setNewSecKeyPart("");
    setNewSecValue("");
  }
  async function saveNewSection() {
    const sec = newSecName.trim();
    const part = newSecKeyPart.trim();
    if (!sec || !part) {
      setToast({ kind: "bad", msg: "Section and key are required." });
      return;
    }
    const fullKey = `${sec}.${part}`;
    try {
      await upsertSetting(fullKey, newSecValue ?? "");
      setAllRows((rs) =>
        [...rs, { key: fullKey, value: newSecValue ?? "", mode: "view" as RowMode }].sort((a, b) =>
          a.key.localeCompare(b.key)
        )
      );
      cancelNewSection();
      setToast({ kind: "ok", msg: "Section created." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }

  return (
    <div className="set-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* header */}
      <header className="hd">
        <div className="title">
          <h2>Settings</h2>
          <p className="muted">Organised by <code>section.key</code> naming.</p>
        </div>
        <div className="right">
          <div className="search">
            <input
              placeholder="Search key or value…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <button className="pill-btn strong" onClick={() => setNewSecOpen((v) => !v)}>
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New section
          </button>
        </div>
      </header>

      {/* new section composer */}
      {newSecOpen && (
        <div className="card composer">
          <div className="row">
            <label>Section</label>
            <input
              placeholder="e.g. contact"
              value={newSecName}
              onChange={(e) => setNewSecName(e.target.value)}
            />
          </div>
          <div className="row two">
            <div>
              <label>Key (within section)</label>
              <input
                placeholder="e.g. whatsapp"
                value={newSecKeyPart}
                onChange={(e) => setNewSecKeyPart(e.target.value)}
              />
            </div>
            <div>
              <label>Value</label>
              <input
                placeholder="text"
                value={newSecValue}
                onChange={(e) => setNewSecValue(e.target.value)}
              />
            </div>
          </div>
          <div className="row act">
            <button className="ghost sm ok" onClick={saveNewSection}>Create</button>
            <button className="ghost sm" onClick={cancelNewSection}>Cancel</button>
          </div>
        </div>
      )}

      {/* Feature images */}
      <AdminFeatureImagesSetting />

      {/* Coupons */}
      <AdminCoupons />

      {/* Delivery Partners */}
      <AdminDeliveryPartners />

      {/* Delivery Fee Rules (admin, uses Bearer token) */}
      <AdminDeliveryFeeRules />

      {/* content / sections */}
      {loading && (
        <div className="card empty">
          <div className="empty-icon">⏳</div>
          <h3>Loading…</h3>
        </div>
      )}
      {!loading && err && (
        <div className="card empty">
          <div className="empty-icon">⚠️</div>
          <h3>Couldn’t load settings</h3>
          <p className="muted">{err}</p>
        </div>
      )}

      {!loading && !err && sections.length === 0 && (
        <div className="card empty">
          <div className="empty-icon">📝</div>
          <h3>No settings yet</h3>
          <p className="muted">Create a section to get started.</p>
        </div>
      )}

      {!loading && !err && sections.map((sec) => (
        <div className="sec-card card" key={sec.name}>
          <div
            className="sec-hd"
            onClick={() =>
              setSecUi(sec.name, { open: !sec.open })
            }
          >
            <div className="sec-title">
              <span
                className="chev"
                style={{ transform: sec.open ? "rotate(0deg)" : "rotate(-90deg)" }}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
              <span className="pill">{sec.name}</span>
              <span className="sep">•</span>
              <span className="count">{sec.rows.length} key{sec.rows.length === 1 ? "" : "s"}</span>
            </div>
            <div className="right-actions" onClick={(e) => e.stopPropagation()}>
              <button className="pill-btn" onClick={() => addDraftRow(sec.name)}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add key
              </button>
            </div>
          </div>

          {sec.open && (
            <div className="table">
              {/* draft row */}
              {sec.draft && (
                <div className="trow draft">
                  <div className="cell-key">
                    <div className="key-group">
                      <code className="sec">{sec.name}</code>
                      <span className="dot">.</span>
                      <input
                        className="in"
                        placeholder="key"
                        value={sec.draft.keyPart}
                        onChange={(e) => updateDraft(sec.name, "keyPart", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="cell-val">
                    <input
                      className="in"
                      placeholder="value"
                      value={sec.draft.value}
                      onChange={(e) => updateDraft(sec.name, "value", e.target.value)}
                    />
                  </div>
                  <div className="cell-act">
                    <div className="act">
                      <button className="ghost sm ok" onClick={() => saveDraft(sec.name)}>Save</button>
                      <button className="ghost sm" onClick={() => cancelDraft(sec.name)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* rows */}
              {sec.rows.length === 0 && !sec.draft && (
                <div className="empty">
                  <div className="empty-icon">🌱</div>
                  <h3>No keys in this section</h3>
                </div>
              )}

              {sec.rows.map((r) => (
                <div className="trow" key={r.key}>
                  <div className="cell-key">
                    <code title={r.key}>{r.key}</code>
                  </div>
                  <div className="cell-val">
                    {r.mode === "view" ? (
                      <div className="val" title={r.value}>{r.value || "—"}</div>
                    ) : (
                      <input
                        className="in"
                        value={r._value ?? ""}
                        onChange={(e) =>
                          setAllRows((rs) =>
                            rs.map((x) =>
                              x.key === r.key ? { ...x, _value: e.target.value } : x
                            )
                          )
                        }
                      />
                    )}
                  </div>
                  <div className="cell-act">
                    {r.mode === "view" ? (
                      <div className="act">
                        <button className="ghost sm" onClick={() => startEdit(r.key)}>Edit</button>
                        <button className="ghost sm bad" onClick={() => remove(r.key)}>Delete</button>
                      </div>
                    ) : (
                      <div className="act">
                        <button className="ghost sm ok" onClick={() => saveEdit(r.key)}>Save</button>
                        <button className="ghost sm" onClick={() => cancelEdit(r.key)}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ PREMIUM SETTINGS PAGE STYLES ═══════════════════════════ */
const css = `
.set-wrap {
  padding: 24px;
  color: ${PRIMARY};
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
}

/* ═══════════════════════════ HEADER ═══════════════════════════ */
.hd {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  position: relative;
}

.hd::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  background: linear-gradient(90deg, #F05D8B, #F6C320, #9BB472);
  border-radius: 3px 3px 0 0;
}

.hd h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hd h2::before {
  content: "⚙️ ";
  -webkit-text-fill-color: initial;
}

.muted {
  opacity: 0.6;
  font-size: 13px;
  margin-top: 6px;
}

.title .muted code {
  background: rgba(0,0,0,0.04);
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ═══════════════════════════ SEARCH ═══════════════════════════ */
.search {
  position: relative;
}

.search input {
  height: 44px;
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 0 44px 0 16px;
  background: #fff;
  outline: none;
  min-width: 300px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search input:focus {
  border-color: #F05D8B;
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.search svg {
  position: absolute;
  right: 14px;
  top: 13px;
  opacity: 0.5;
}

/* ═══════════════════════════ PRIMARY PILL BUTTON ═══════════════════════════ */
.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  background: #fff;
  color: ${PRIMARY};
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), inset 0 0 0 1px ${INK};
  transition: all 0.2s ease;
}

.pill-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(246,195,32,0.5);
}

.pill-btn.strong {
  background: linear-gradient(135deg, #F05D8B 0%, #ff8ba7 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(240,93,139,0.3);
}

.pill-btn.strong:hover {
  box-shadow: 0 12px 32px rgba(240,93,139,0.4);
}

/* ═══════════════════════════ CARDS ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0,0,0,0.06);
  overflow: hidden;
}

/* ═══════════════════════════ COMPOSER ═══════════════════════════ */
.composer {
  padding: 20px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(246,195,32,0.04) 0%, #fff 100%);
}

.composer .row {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.composer .row.two {
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.composer label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #555;
  margin-bottom: 4px;
}

.composer input {
  height: 42px;
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 0 14px;
  outline: none;
  background: #fff;
  font-size: 14px;
  transition: all 0.2s ease;
}

.composer input:focus {
  border-color: #F05D8B;
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.composer .act {
  display: flex;
  gap: 10px;
}

/* ═══════════════════════════ BLOCKS ═══════════════════════════ */
.block {
  margin-bottom: 20px;
}

.block-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 0 4px 10px;
}

.block-hd h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: ${PRIMARY};
  display: flex;
  align-items: center;
  gap: 8px;
}

.block-hd h3::before {
  content: "";
  width: 4px;
  height: 18px;
  background: linear-gradient(180deg, #F05D8B, #F6C320);
  border-radius: 2px;
}

.block-body.card {
  padding: 16px 20px;
}

/* ═══════════════════════════ TABLE ═══════════════════════════ */
.table {
  display: block;
  overflow-x: auto;
}

.trow {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 200px;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid ${INK};
  transition: background 0.15s ease;
  min-width: 740px;
}

.trow:hover {
  background: linear-gradient(90deg, rgba(246,195,32,0.04) 0%, rgba(255,255,255,0) 100%);
}

.trow:last-child {
  border-bottom: none;
}

.trow.draft {
  background: linear-gradient(135deg, rgba(240,93,139,0.04) 0%, rgba(255,255,255,0) 100%);
}

.cell-key code {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0,0,0,0.04);
  color: ${PRIMARY};
}

.cell-val {
  min-width: 0;
}

.val {
  display: block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: #444;
}

.in {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid ${INK};
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.in:focus {
  border-color: #F05D8B;
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

/* ═══════════════════════════ SECTION CARDS ═══════════════════════════ */
.sec-card {
  margin-bottom: 16px;
}

.sec-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid ${INK};
  cursor: pointer;
  transition: all 0.2s ease;
}

.sec-hd:hover {
  background: linear-gradient(135deg, rgba(246,195,32,0.06) 0%, #fff 100%);
}

.sec-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.sec-title .chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: rgba(0,0,0,0.04);
  transition: all 0.2s ease;
}

.sec-hd:hover .chev {
  background: rgba(246,195,32,0.15);
}

.sep {
  opacity: 0.3;
  font-weight: 700;
}

.pill {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(246,195,32,0.2) 0%, rgba(255,215,0,0.15) 100%);
  font-size: 13px;
  font-weight: 700;
  color: #92400e;
}

.count {
  font-size: 13px;
  opacity: 0.6;
  white-space: nowrap;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ═══════════════════════════ BUTTONS ═══════════════════════════ */
.act {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.ghost {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  color: ${PRIMARY};
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.15s ease;
}

.ghost:hover {
  background: #fafafa;
  border-color: rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.ghost.sm {
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
}

.ghost.ok {
  border-color: rgba(67,233,123,0.4);
  color: #065f46;
}

.ghost.ok:hover {
  background: rgba(67,233,123,0.08);
}

.ghost.bad {
  border-color: rgba(198,40,40,0.3);
  color: #c62828;
}

.ghost.bad:hover {
  background: rgba(198,40,40,0.06);
}

/* ═══════════════════════════ KEY GROUP ═══════════════════════════ */
.key-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-group .sec {
  background: rgba(246,195,32,0.15);
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
  color: #92400e;
}

.key-group .dot {
  opacity: 0.4;
  font-weight: 800;
  font-size: 16px;
}

/* ═══════════════════════════ EMPTY STATE ═══════════════════════════ */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
  color: ${PRIMARY};
}

.empty-icon {
  font-size: 48px;
  opacity: 0.6;
  line-height: 1;
}

.empty h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}

/* ═══════════════════════════ TOAST ═══════════════════════════ */
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 200;
  padding: 14px 20px;
  border-radius: 14px;
  color: #fff;
  font-weight: 600;
  animation: toastSlide 2.8s ease forwards;
}

.toast.ok {
  background: linear-gradient(135deg, #F05D8B 0%, #ff8ba7 100%);
  box-shadow: 0 10px 32px rgba(240,93,139,0.4);
}

.toast.bad {
  background: linear-gradient(135deg, #c62828 0%, #e53935 100%);
  box-shadow: 0 10px 32px rgba(198,40,40,0.35);
}

@keyframes toastSlide {
  0% { transform: translateY(24px); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  85% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(12px); opacity: 0; }
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1100px) {
  .set-wrap {
    padding: 16px;
  }

  .hd {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .right {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .search input {
    min-width: 100%;
  }
}

@media (max-width: 980px) {
  .trow {
    grid-template-columns: 260px 1fr 180px;
    min-width: 600px;
  }
}

@media (max-width: 760px) {
  .trow {
    grid-template-columns: 220px 1fr 160px;
    min-width: 520px;
  }

  .composer .row.two {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .trow {
    grid-template-columns: 1fr;
    min-width: 0;
    gap: 12px;
  }

  .cell-act {
    justify-self: start;
  }

  .pill-btn {
    height: 36px;
    padding: 0 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pill-btn,
  .ghost,
  .trow,
  .composer input,
  .search input,
  .sec-hd,
  .toast {
    transition: none !important;
    animation: none !important;
  }
}
`;
