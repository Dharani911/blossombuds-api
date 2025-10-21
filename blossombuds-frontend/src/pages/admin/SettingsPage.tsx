import React, { useEffect, useMemo, useState } from "react";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  type SettingView,
} from "../../api/adminSettings";
import AdminCarouselImagesSetting from "../../components/admin/AdminCarouselImagesSetting";
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
  const [sections, setSections] = useState<Section[]>([]);
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

  // build sections from rows
  useEffect(() => {
    const map = new Map<string, Row[]>();
    for (const r of filteredRows) {
      const sec = sectionNameOf(r.key);
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(r);
    }
    const next: Section[] = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, rows]) => ({
        name,
        open: true,
        rows,
        draft: null,
      }));
    setSections(next);
  }, [filteredRows]);

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
  function addDraftRow(sectionName: string) {
    setSections((secs) =>
      secs.map((s) =>
        s.name === sectionName
          ? { ...s, open: true, draft: { keyPart: "", value: "" } }
          : s
      )
    );
  }
  function updateDraft(sectionName: string, field: "keyPart" | "value", v: string) {
    setSections((secs) =>
      secs.map((s) =>
        s.name === sectionName && s.draft
          ? { ...s, draft: { ...s.draft, [field]: v } }
          : s
      )
    );
  }
  async function saveDraft(sectionName: string) {
    const sec = sections.find((s) => s.name === sectionName);
    if (!sec || !sec.draft) return;
    const keyPart = sec.draft.keyPart.trim();
    const value = (sec.draft.value ?? "").trim();
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
          : [...rs, { key: fullKey, value, mode: "view" }];
        return next.sort((a, b) => a.key.localeCompare(b.key));
      });
      setSections((secs) =>
        secs.map((s) =>
          s.name === sectionName ? { ...s, draft: null } : s
        )
      );
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    }
  }
  function cancelDraft(sectionName: string) {
    setSections((secs) =>
      secs.map((s) => (s.name === sectionName ? { ...s, draft: null } : s))
    );
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
        [...rs, { key: fullKey, value: newSecValue ?? "", mode: "view" }].sort((a, b) =>
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
      <section id="feature-images" className="block">
        <div className="block-hd">
          <h3>Homepage Feature Images</h3>
          <p className="muted">Manage images used by the FeatureTiles section on the storefront.</p>
        </div>
        <div className="block-body card">
          <div className="block-inner">
            <AdminCarouselImagesSetting />
          </div>
        </div>
      </section>

      {/* Coupons */}
      <section id="coupons" className="block">
        <div className="block-body card" style={{ padding: 10 }}>
          <AdminCoupons />
        </div>
      </section>

      {/* Delivery Partners */}
      <section id="delivery-partners" className="block">
        <div className="block-body card" style={{ padding: 10 }}>
          <AdminDeliveryPartners />
        </div>
      </section>

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
              setSections((secs) =>
                secs.map((s) => (s.name === sec.name ? { ...s, open: !s.open } : s))
              )
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

/* ---------- styles ---------- */
const css = `
.set-wrap{ padding:12px; color:${PRIMARY}; }

/* header */
.hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; }
.hd h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.muted{ opacity:.75; font-size:12px; }
.title .muted code{ background:rgba(0,0,0,.05); padding:2px 6px; border-radius:6px; }

.right{ display:flex; align-items:center; gap:10px; }
.search{ position:relative; }
.search input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 36px 0 12px; background:#fff; outline:none; min-width:280px;
}
.search svg{ position:absolute; right:10px; top:10px; opacity:.6; }

/* pill primary action */
.pill-btn{
  display:inline-flex; align-items:center; gap:8px;
  height:32px; padding:0 12px; border:none; border-radius:999px; cursor:pointer;
  background: #fff; color:${PRIMARY}; font-weight:800; letter-spacing:.2px;
  box-shadow: 0 6px 18px rgba(0,0,0,.08), inset 0 0 0 1px ${INK};
  transition: transform .12s ease, box-shadow .18s ease, background .18s ease;
}
.pill-btn:hover{
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(0,0,0,.10), inset 0 0 0 1px rgba(246,195,32,.45);
  background: linear-gradient(180deg, #fff, rgba(255,255,255,.92));
}
.pill-btn.strong{ box-shadow: 0 8px 22px rgba(0,0,0,.10), inset 0 0 0 1px rgba(246,195,32,.45); }

/* composer */
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }
.composer{ padding:12px; margin-bottom:12px; }
.composer .row{ display:grid; gap:8px; margin-bottom:8px; }
.composer .row.two{ grid-template-columns: 1fr 1fr; gap:12px; }
.composer label{ font-size:12px; font-weight:800; opacity:.8; }
.composer input{
  height:36px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.composer .act{ display:flex; gap:8px; }

/* block */
.block{ margin-bottom:14px; }
.block-hd{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:0 2px 4px; }
.block-hd h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; color:${PRIMARY}; }
.block-body.card{ padding:10px 12px; }
.block-inner{}

/* table wrapper */
.table{ display:block; overflow-x:auto; }
.trow{
  display:grid;
  grid-template-columns: 320px 1fr 180px; /* key | value | actions (for settings table) */
  align-items:center; padding:12px 14px;
  border-bottom:1px solid rgba(0,0,0,.06);
  transition: background .12s ease;
  min-width: 740px;
}
.trow:hover{ background: rgba(0,0,0,.02); }
.trow:last-child{ border-bottom:none; }

.lbl{ font-size:12px; font-weight:800; opacity:.8; margin-bottom:4px; display:block; }
.in{
  height:34px; width:100%; border:1px solid ${INK}; border-radius:8px; padding:0 10px; background:#fff; outline:none;
}

.cell{ min-width:0; }
.val{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* section cards */
.sec-card{ margin-bottom:12px; }
.sec-hd{
  display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px;
  background:
    radial-gradient(120% 120% at -20% -50%, rgba(246,195,32,.18), transparent 50%),
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.96));
  border-bottom:1px solid ${INK};
  cursor:pointer;
  transition: background .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.sec-hd:hover{
  box-shadow: 0 8px 22px rgba(0,0,0,.07);
  border-color: rgba(246,195,32,.35);
}
.sec-title{ display:flex; align-items:center; gap:8px; min-width:0; }
.sec-title .chev{
  display:inline-flex; align-items:center; justify-content:center;
  width:22px; height:22px; border-radius:999px; background: rgba(0,0,0,.04);
  transition: transform .18s ease, background .18s ease;
  margin-right:2px;
}
.sec-hd:hover .chev{ background: rgba(0,0,0,.06); }
.sep{ opacity:.35; font-weight:900; }
.pill{
  display:inline-flex; align-items:center; height:24px; padding:0 10px; border-radius:999px;
  background: rgba(246,195,32,.22);
  font-size:12px; font-weight:800; letter-spacing:.18px; color:${PRIMARY};
}
.count{ font-size:12.5px; opacity:.7; white-space:nowrap; }
.right-actions{ display:flex; align-items:center; gap:8px; }

/* buttons */
.act{ display:flex; gap:8px; flex-wrap:nowrap; white-space:nowrap; }
.ghost{
  height:32px; padding:0 10px; border-radius:10px; border:1px solid ${INK}; background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.sm{ height:28px; padding: 0 10px; border-radius:8px; font-size:12.5px; }
.ghost.ok{ border-color: rgba(89,178,107,.4); }
.ghost.bad{ border-color: rgba(240,93,139,.5); color:#b0003a; }

/* draft row key group */
.key-group{ display:flex; align-items:center; gap:6px; }
.key-group .sec{ background:rgba(0,0,0,.05); padding:2px 6px; border-radius:6px; }
.key-group .dot{ opacity:.5; font-weight:900; }

/* empty state */
.empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:8px; padding:24px 16px; text-align:center; color:${PRIMARY};
}
.empty-icon{ font-size:34px; opacity:.6; line-height:1; }
.empty h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; }

/* toast */
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

/* responsive tweaks for settings table */
@media (max-width: 860px){
  .trow{ grid-template-columns: 280px 1fr 160px; min-width: 640px; }
}
@media (max-width: 680px){
  .trow{ grid-template-columns: 240px 1fr 140px; min-width: 560px; }
}
`;
