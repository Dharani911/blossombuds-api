// src/components/admin/AdminDeliveryPartners.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listPartners,
  createPartner,
  updatePartner,
  togglePartnerActive,
  deletePartner,
  type DeliveryPartner, // -> make sure API type is {id?, name, code, trackingUrlTemplate?, active?}
} from "../../api/adminDeliveryPartners";

/** Design tokens */
const TOKENS = {
  INK: "rgba(0,0,0,.10)",
  INK2: "rgba(0,0,0,.06)",
  TEXT: "#2B2E2A",
  SUBTLE: "rgba(43,46,42,.72)",
  ACCENT: "#F05D8B",
  ACCENT_HOVER: "#E34B7C",
  OK_BG: "rgba(56,176,0,.12)",
  OK_BORDER: "rgba(56,176,0,.35)",
  OK_TEXT: "#146500",
  BAD_BG: "rgba(240,93,139,.12)",
  BAD_BORDER: "rgba(240,93,139,.30)",
  BAD_TEXT: "#8E1743",
  CARD_BG: "#FFFFFF",
};

type Mode = "list" | "new" | "edit";

export default function AdminDeliveryPartners() {
  const [rows, setRows] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);

  const [mode, setMode] = useState<Mode>("list");
  const [draft, setDraft] = useState<DeliveryPartner | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await listPartners();
        if (!alive) return;
        setRows((data || []).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Could not load delivery partners.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      (r.name || "").toLowerCase().includes(needle) ||
      (r.code || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  function openNew() {
    setMode("new");
    setDraft({
      name: "",
      code: "",
      trackingUrlTemplate: "",
      active: true,
    } as DeliveryPartner);
  }

  function openEdit(p: DeliveryPartner) {
    setMode("edit");
    setDraft({ ...p });
  }

  function closeModal() {
    setMode("list");
    setDraft(null);
    setSaving(false);
  }

  async function save() {
    if (!draft) return;
    const name = (draft.name || "").trim();
    const code = sanitizeCode(draft.code);
    if (!name || !code) {
      setToast({ kind: "bad", msg: "Name and a valid Code are required." });
      return;
    }

    setSaving(true);
    try {
      const payload: DeliveryPartner = {
        ...draft,
        name,
        code,
        trackingUrlTemplate: (draft.trackingUrlTemplate || "").trim() || null as any,
      };

      let saved: DeliveryPartner;
      if (mode === "new") {
        saved = await createPartner(payload);
        setRows(rs => [...rs, saved].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      } else {
        saved = await updatePartner(Number(draft.id), payload);
        setRows(rs => rs.map(r => (r.id === saved.id ? saved : r)));
      }
      setToast({ kind: "ok", msg: "Saved partner." });
      closeModal();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Save failed." });
    } finally { setSaving(false); }
  }

  async function toggleActiveRow(p: DeliveryPartner) {
    if (!p.id) return;
    try {
      const saved = await togglePartnerActive(p.id, !p.active);
      setRows(rs => rs.map(r => (r.id === p.id ? saved : r)));
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not toggle active." });
    }
  }

  async function remove(p: DeliveryPartner) {
    if (!p.id) return;
    if (!confirm(`Delete partner "${p.name}"? This cannot be undone.`)) return;
    try {
      await deletePartner(p.id);
      setRows(rs => rs.filter(r => r.id !== p.id));
      setToast({ kind: "ok", msg: "Deleted." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Delete failed." });
    }
  }

  return (
    <div className="dp-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"dp-toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <div className="dp-hd">
        <div className="dp-hd-left">
          <h3>Delivery Partners</h3>
          <p className="dp-muted">Manage couriers you ship with (active/inactive, tracking link).</p>
        </div>
        <div className="dp-hd-right">
          <div className="dp-search">
            <input placeholder="Search name/code…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <button className="dp-btn" onClick={openNew}>+ New partner</button>
          <button
            className={`dp-ghost dp-iconbtn ${open ? "open" : ""}`}
            onClick={()=>setOpen(v=>!v)}
            aria-label={open ? "Collapse" : "Expand"}
            title={open ? "Collapse" : "Expand"}
          >
            <span className="chev" />
          </button>
        </div>
      </div>

      {open && (
        <div className="dp-card">
          {loading && <div className="dp-empty"><div className="dp-empty-icon">⏳</div><h4>Loading…</h4></div>}
          {!loading && err && <div className="dp-empty"><div className="dp-empty-icon">⚠️</div><h4>{err}</h4></div>}
          {!loading && !err && filtered.length === 0 && (
            <div className="dp-empty"><div className="dp-empty-icon">📝</div><h4>No partners yet</h4></div>
          )}

          {!loading && !err && filtered.length > 0 && (
            <div className="dp-table">
              <div className="dp-thead">
                <div>Name</div>
                <div>Code</div>
                <div>Tracking URL Template</div>
                <div>Status</div>
                <div style={{textAlign:"right"}}>Actions</div>
              </div>
              {filtered.map(p => (
                <div className="dp-row" key={p.id ?? p.code}>
                  <div className="dp-name">{p.name}</div>
                  <div className="dp-code"><code>{p.code}</code></div>
                  <div className="dp-ellipsis" title={p.trackingUrlTemplate || ""}>{p.trackingUrlTemplate || "—"}</div>
                  <div className="dp-status">
                    <span className={p.active ? "dp-chip ok" : "dp-chip bad"}>{p.active ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="dp-act">
                    <button className="dp-ghost dp-sm" onClick={()=>openEdit(p)}>Edit</button>
                    <button className="dp-ghost dp-sm" onClick={()=>toggleActiveRow(p)}>{p.active ? "Deactivate" : "Activate"}</button>
                    <button className="dp-ghost dp-sm bad" onClick={()=>remove(p)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {mode !== "list" && draft && (
        <div className="dp-modal" role="dialog" aria-modal="true">
          <div className="dp-sheet">
            <div className="dp-sheet-hd">
              <h4>{mode === "new" ? "New partner" : `Edit: ${draft.name}`}</h4>
              <button className="dp-icon" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <div className="dp-sheet-bd">
              <div className="dp-grid">
                <div className="dp-f">
                  <label>Name *</label>
                  <input
                    value={draft.name || ""}
                    onChange={e=>setDraft({...draft, name: e.target.value})}
                    placeholder="BlueDart"
                  />
                </div>
                <div className="dp-f">
                  <label>Code *</label>
                  <input
                    value={draft.code || ""}
                    onChange={e=>setDraft({...draft, code: sanitizeCode(e.target.value)})}
                    placeholder="bluedart"
                  />
                </div>
                <div className="dp-f">
                  <label>Tracking URL Template (use {`{trackingNumber}`} placeholder)</label>
                  <input
                    value={draft.trackingUrlTemplate || ""}
                    onChange={e=>setDraft({...draft, trackingUrlTemplate: e.target.value})}
                    placeholder="https://track.example.com/{trackingNumber}"
                  />
                </div>
                <div className="dp-f dp-chk">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!draft.active}
                      onChange={e=>setDraft({...draft, active: e.target.checked})}
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="dp-sheet-ft">
              <button className="dp-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="dp-btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* helpers */
function sanitizeCode(input: string | undefined | null): string {
  const s = (input || "").toLowerCase().trim();
  // letters, digits, hyphen; collapse repeats; trim edges
  return s.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/* styles */
const css = `
:root{
  --dp-ink:${TOKENS.INK};
  --dp-ink2:${TOKENS.INK2};
  --dp-text:${TOKENS.TEXT};
  --dp-subtle:${TOKENS.SUBTLE};
  --dp-accent:${TOKENS.ACCENT};
  --dp-accent-hover:${TOKENS.ACCENT_HOVER};
  --dp-ok-bg:${TOKENS.OK_BG};
  --dp-ok-b:${TOKENS.OK_BORDER};
  --dp-ok:${TOKENS.OK_TEXT};
  --dp-bad-bg:${TOKENS.BAD_BG};
  --dp-bad-b:${TOKENS.BAD_BORDER};
  --dp-bad:${TOKENS.BAD_TEXT};
  --dp-card:${TOKENS.CARD_BG};
}

.dp-wrap{ color:var(--dp-text); }

/* header */
.dp-hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:10px; }
.dp-hd h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; }
.dp-muted{ opacity:.75; font-size:12px; color:var(--dp-subtle); }
.dp-hd-right{ display:flex; align-items:center; gap:8px; }
.dp-search input{
  height:36px; border:1px solid var(--dp-ink); border-radius:12px; padding:0 12px; background:#fff; outline:none; min-width:220px;
  transition:border-color .15s ease, box-shadow .15s;
}
.dp-search input:focus{ border-color:var(--dp-accent); box-shadow:0 0 0 3px rgba(240,93,139,.12); }

/* buttons */
.dp-btn{
  height:36px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:var(--dp-accent); color:#fff; font-weight:900;
  box-shadow:0 10px 24px rgba(240,93,139,.20);
  transition: transform .06s ease, background .12s ease;
}
.dp-btn:hover{ background:var(--dp-accent-hover); }
.dp-btn:active{ transform: translateY(1px); }

.dp-ghost{
  height:36px; padding:0 12px; border-radius:12px; border:1px solid var(--dp-ink); background:#fff; cursor:pointer;
  transition: background .12s ease, border-color .12s ease;
}
.dp-ghost:hover{ background:#fafafa; border-color: var(--dp-ink2); }
.dp-ghost.dp-sm{ height:30px; padding:0 10px; border-radius:10px; font-size:12.5px; }

/* icon-only toggle */
.dp-iconbtn{ width:36px; padding:0; display:grid; place-items:center; }
.dp-iconbtn .chev{
  display:inline-block; width:10px; height:10px;
  border-right:2px solid var(--dp-text); border-bottom:2px solid var(--dp-text);
  transform: rotate(-45deg); /* ► when closed */
  transition: transform .15s ease, border-color .12s ease;
}
.dp-iconbtn.open .chev{ transform: rotate(45deg); } /* ▾ when open */
.dp-iconbtn:hover .chev{ border-color: var(--dp-accent); }

/* card / table */
.dp-card{
  border:1px solid var(--dp-ink); border-radius:16px; background:var(--dp-card);
  box-shadow:0 12px 30px rgba(0,0,0,.08); overflow:hidden;
}
.dp-table{ display:grid; }
.dp-thead, .dp-row{
  display:grid;
  grid-template-columns: 1.2fr .9fr 2.2fr .9fr 1.2fr;
  gap:12px; padding:12px 14px; align-items:center;
}
.dp-thead{
  font-weight:900; font-size:12px;
  background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95));
  border-bottom:1px solid var(--dp-ink);
}
.dp-row{ border-bottom:1px solid var(--dp-ink2); transition: background .12s ease; }
.dp-row:hover{ background: rgba(0,0,0,.02); }
.dp-row:last-child{ border-bottom:none; }
.dp-ellipsis{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dp-act{ display:flex; gap:8px; justify-content:flex-end; }

.dp-chip{
  display:inline-flex; align-items:center; height:22px; padding:0 8px;
  border-radius:999px; font-size:12px; font-weight:700; border:1px solid transparent;
}
.dp-chip.ok{ background: var(--dp-ok-bg); color:var(--dp-ok); border-color: var(--dp-ok-b); }
.dp-chip.bad{ background: var(--dp-bad-bg); color:var(--dp-bad); border-color: var(--dp-bad-b); }

/* empty */
.dp-empty{ padding:28px; text-align:center; color:var(--dp-text); }
.dp-empty-icon{ font-size:30px; opacity:.65; }

/* modal */
.dp-modal{
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center; z-index:200;
  backdrop-filter: blur(2px);
}
.dp-sheet{
  width:min(720px, 96vw); max-height:90vh; display:grid; grid-template-rows:auto 1fr auto;
  background:#fff; border-radius:18px; box-shadow:0 24px 70px rgba(0,0,0,.35); overflow:hidden;
  animation: dp-pop .12s ease-out;
}
@keyframes dp-pop { from{ transform:scale(.985); opacity:.0 } to{ transform:scale(1); opacity:1 } }
.dp-sheet-hd{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--dp-ink); }
.dp-sheet-hd h4{ margin:0; font-size:18px; font-weight:900; }
.dp-icon{ border:none; background:transparent; font-size:18px; cursor:pointer; }
.dp-sheet-bd{ padding:14px 16px; overflow:auto; }
.dp-sheet-ft{ display:flex; justify-content:flex-end; gap:10px; padding:12px 16px; border-top:1px solid var(--dp-ink); }

.dp-grid{ display:grid; gap:12px; }
.dp-f{ display:grid; gap:6px; }
.dp-f label{ font-size:12px; opacity:.8; }
.dp-f input{
  border:1px solid var(--dp-ink); border-radius:12px; padding:8px 12px; outline:none; background:#fff;
  transition: border-color .12s ease, box-shadow .12s ease; height:40px;
}
.dp-f input:focus{ border-color:var(--dp-accent); box-shadow:0 0 0 3px rgba(240,93,139,.12); }
.dp-chk label{ display:flex; align-items:center; gap:8px; }
.dp-btn[disabled]{ opacity:.7; cursor:not-allowed; }

/* toast */
.dp-toast{
  position:fixed; right:16px; bottom:16px;
  background:#111; color:#fff; border-radius:12px; padding:10px 12px; z-index:9999;
  animation: dp-fadeout 3s forwards ease;
}
.dp-toast.ok{ background:#0f5132; }
.dp-toast.bad{ background:#842029; }
@keyframes dp-fadeout { 0%{opacity:1} 85%{opacity:1} 100%{opacity:0} }

/* responsive */
@media (max-width: 900px){
  .dp-thead, .dp-row{ grid-template-columns: 1.1fr .8fr 2fr .8fr 1.1fr; }
}
@media (max-width: 680px){
  .dp-thead, .dp-row{ grid-template-columns: 1fr 1fr; }
  .dp-status, .dp-act{ grid-column: 1 / -1; }
  .dp-act{ justify-content:flex-start; gap:6px; }
}
`;
