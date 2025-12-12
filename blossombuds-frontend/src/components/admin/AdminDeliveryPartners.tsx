// src/components/admin/AdminDeliveryPartners.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listPartners,
  createPartner,
  updatePartner,
  togglePartnerActive,
  togglePartnerVisible,
  deletePartner,
  type DeliveryPartner,
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
      visible: true,
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

  async function toggleVisibleRow(p: DeliveryPartner) {
    if (!p.id) return;
    const next = !p.visible;
    try {
      const saved = await togglePartnerVisible(p.id, next);
      setRows(rs => rs.map(r => (r.id === p.id ? saved : r)));
      setToast({ kind: "ok", msg: next ? "Partner is now visible to customers." : "Partner hidden from customers." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not toggle visibility." });
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
          <h3><span style={{ fontSize: "24px", color: "initial", marginRight: "12px", WebkitTextFillColor: "initial" }}>🚚</span> Delivery Partners</h3>
          <p className="dp-muted">Manage couriers you ship with (active/inactive, tracking link).</p>
        </div>
        <div className="dp-hd-right">
          <div className="dp-search">
            <input placeholder="Search name/code…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="dp-btn" onClick={openNew}>+ New partner</button>
          <button
            className={`dp-ghost dp-iconbtn ${open ? "open" : ""}`}
            onClick={() => setOpen(v => !v)}
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
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>
              {filtered.map(p => (
                <div className="dp-row" key={p.id ?? p.code}>
                  <div className="dp-name">{p.name}</div>
                  <div className="dp-code"><code>{p.code}</code></div>
                  <div className="dp-ellipsis" title={p.trackingUrlTemplate || ""}>{p.trackingUrlTemplate || "—"}</div>
                  <div className="dp-status">
                    <span className={p.visible !== false ? "dp-chip ok" : "dp-chip bad"}>{p.visible !== false ? "Visible" : "Hidden"}</span>
                  </div>
                  <div className="dp-act">
                    <button className="dp-ghost dp-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="dp-ghost dp-sm" onClick={() => toggleVisibleRow(p)}>{p.visible !== false ? "Hide" : "Show"}</button>
                    <button className="dp-ghost dp-sm bad" onClick={() => remove(p)}>Delete</button>
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
                    onChange={e => setDraft({ ...draft, name: e.target.value })}
                    placeholder="BlueDart"
                  />
                </div>
                <div className="dp-f">
                  <label>Code *</label>
                  <input
                    value={draft.code || ""}
                    onChange={e => setDraft({ ...draft, code: sanitizeCode(e.target.value) })}
                    placeholder="bluedart"
                  />
                </div>
                <div className="dp-f">
                  <label>Tracking URL Template (use {`{trackingNumber}`} placeholder)</label>
                  <input
                    value={draft.trackingUrlTemplate || ""}
                    onChange={e => setDraft({ ...draft, trackingUrlTemplate: e.target.value })}
                    placeholder="https://track.example.com/{trackingNumber}"
                  />
                </div>
                <div className="dp-f dp-chk">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.visible !== false}
                      onChange={e => setDraft({ ...draft, visible: e.target.checked })}
                    />
                    <span>Visible to customers</span>
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
  --dp-gold:#F6C320;
  --dp-mint:#4BE0B0;
}

.dp-wrap{ color:var(--dp-text); margin-bottom:24px; }

/* ─────────────── HEADER ─────────────── */
.dp-hd{
  display:flex; align-items:flex-end; justify-content:space-between;
  gap:16px; margin-bottom:16px; padding:20px 24px;
  background:#fff; border-radius:20px;
  box-shadow:0 4px 20px rgba(0,0,0,.06);
  position:relative;
}
.dp-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg, var(--dp-accent), var(--dp-gold), var(--dp-mint));
  border-radius:0 0 20px 20px;
}
.dp-hd h3{
  margin:0; font-size:22px; font-weight:900; letter-spacing:.3px;
  background:linear-gradient(135deg, var(--dp-accent), var(--dp-gold));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
  display:flex; align-items:center;
}
.dp-muted{ opacity:.75; font-size:13px; color:var(--dp-subtle); margin-top:4px; }
.dp-hd-left{ flex:1; }
.dp-hd-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

/* ─────────────── SEARCH ─────────────── */
.dp-search input{
  height:42px; border:1px solid var(--dp-ink); border-radius:14px; padding:0 16px;
  background:#fff; outline:none; min-width:260px;
  font-size:14px;
  transition:border-color .15s ease, box-shadow .15s ease, transform .1s ease;
}
.dp-search input:focus{
  border-color: var(--dp-accent);
  box-shadow:0 0 0 4px rgba(240,93,139,.12);
  transform:translateY(-1px);
}

/* ─────────────── BUTTONS ─────────────── */
.dp-btn{
  height:42px; padding:0 20px; border:none; border-radius:14px; cursor:pointer;
  background:linear-gradient(135deg, var(--dp-accent), #E34B7C);
  color:#fff; font-weight:900; font-size:14px;
  box-shadow: 0 8px 24px rgba(240,93,139,.25);
  transition: transform .1s ease, box-shadow .15s ease;
}
.dp-btn:hover{
  transform:translateY(-2px);
  box-shadow: 0 12px 32px rgba(240,93,139,.35);
}
.dp-btn:active{ transform: translateY(0); }
.dp-btn[disabled]{ opacity:.6; cursor:not-allowed; transform:none; }

.dp-ghost{
  height:36px; padding:0 14px; border-radius:12px;
  border:1px solid var(--dp-ink); background:#fff; cursor:pointer;
  font-size:13px; font-weight:600;
  transition: all .15s ease;
}
.dp-ghost:hover{
  background:#fafafa;
  border-color:rgba(0,0,0,.15);
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.08);
}
.dp-ghost.dp-sm{ height:32px; padding:0 12px; border-radius:10px; font-size:12.5px; }
.dp-ghost.bad{ border-color:rgba(240,93,139,.3); color:var(--dp-bad); }
.dp-ghost.bad:hover{ background:rgba(240,93,139,.06); border-color:var(--dp-accent); }

/* ─────────────── CHEVRON BUTTON ─────────────── */
.dp-iconbtn{
  width:42px; height:42px; padding:0; display:grid; place-items:center;
  border-radius:14px;
}
.dp-iconbtn .chev{
  display:inline-block; width:10px; height:10px;
  border-right:2.5px solid var(--dp-text); border-bottom:2.5px solid var(--dp-text);
  transform: rotate(-45deg);
  transition: transform .2s ease, border-color .15s ease;
}
.dp-iconbtn.open .chev{ transform: rotate(45deg); }
.dp-iconbtn:hover .chev{ border-color: var(--dp-accent); }

/* ─────────────── CARD ─────────────── */
.dp-card{
  border:1px solid var(--dp-ink); border-radius:20px; background:var(--dp-card);
  box-shadow:0 12px 40px rgba(0,0,0,.08); overflow:hidden;
}

/* ─────────────── TABLE ─────────────── */
.dp-table{ display:grid; max-height:400px; overflow-y:auto; }
.dp-thead, .dp-row{
  display:grid;
  grid-template-columns: 1.3fr 1fr 2.2fr 1fr 1.4fr;
  gap:16px; padding:14px 20px; align-items:center;
}
.dp-thead{
  font-weight:900; font-size:11px; text-transform:uppercase; letter-spacing:.8px;
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.98));
  border-bottom:1px solid var(--dp-ink);
  position:sticky; top:0; z-index:5;
}
.dp-row{
  border-bottom:1px solid var(--dp-ink2);
  transition: background .15s ease, transform .1s ease;
}
.dp-row:hover{
  background:linear-gradient(90deg, rgba(240,93,139,.03), rgba(246,195,32,.03));
}
.dp-row:last-child{ border-bottom:none; }

.dp-name{ font-weight:700; font-size:14px; }
.dp-code code{
  font-weight:900; font-size:13px;
  background:linear-gradient(135deg, var(--dp-accent), var(--dp-gold));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}
.dp-ellipsis{
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  font-size:12px; color:var(--dp-subtle);
}

/* ─────────────── STATUS CHIPS ─────────────── */
.dp-chip{
  display:inline-flex; align-items:center; height:26px; padding:0 12px;
  border-radius:12px; font-size:11px; font-weight:800; letter-spacing:.5px;
  text-transform:uppercase; border:none;
}
.dp-chip.ok{
  background:linear-gradient(135deg, rgba(56,176,0,.15), rgba(75,224,176,.15));
  color:#0a5c36;
}
.dp-chip.bad{
  background:linear-gradient(135deg, rgba(240,93,139,.15), rgba(227,75,124,.15));
  color:#8E1743;
}

/* ─────────────── ACTIONS ─────────────── */
.dp-act{ display:flex; gap:8px; justify-content:flex-end; }

/* ─────────────── EMPTY STATE ─────────────── */
.dp-empty{ padding:48px 24px; text-align:center; color:var(--dp-text); }
.dp-empty-icon{ font-size:48px; opacity:.6; margin-bottom:12px; }
.dp-empty h4{ margin:0; font-size:16px; font-weight:600; opacity:.8; }

/* ─────────────── MODAL ─────────────── */
.dp-modal{
  position:fixed; inset:0; background:rgba(0,0,0,.45);
  display:flex; align-items:center; justify-content:center; z-index:200;
  backdrop-filter: blur(4px);
}
.dp-sheet{
  width:min(680px, 94vw); max-height:88vh; display:grid; grid-template-rows:auto 1fr auto;
  background:#fff; border-radius:24px;
  box-shadow:0 32px 80px rgba(0,0,0,.40); overflow:hidden;
  animation: dp-pop .18s ease-out;
}
@keyframes dp-pop { from{ transform:scale(.96) translateY(10px); opacity:0 } to{ transform:scale(1) translateY(0); opacity:1 } }

.dp-sheet-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 24px; border-bottom:1px solid var(--dp-ink);
  background:linear-gradient(180deg, rgba(246,195,32,.06), #fff);
  position:relative;
}
.dp-sheet-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, var(--dp-accent), var(--dp-gold), var(--dp-mint));
}
.dp-sheet-hd h4{
  margin:0; font-size:20px; font-weight:900;
  display:flex; align-items:center; gap:10px;
}
.dp-sheet-hd h4::before{ content:'🚚'; font-size:22px; }
.dp-icon{
  border:none; background:rgba(0,0,0,.06); width:36px; height:36px;
  border-radius:12px; font-size:18px; cursor:pointer;
  display:grid; place-items:center;
  transition: background .12s ease, transform .1s ease;
}
.dp-icon:hover{ background:rgba(0,0,0,.10); transform:scale(1.05); }

.dp-sheet-bd{ padding:24px; overflow:auto; }
.dp-sheet-ft{
  display:flex; justify-content:flex-end; gap:12px;
  padding:16px 24px; border-top:1px solid var(--dp-ink);
  background:rgba(0,0,0,.02);
}

/* ─────────────── FORM ─────────────── */
.dp-grid{ display:grid; gap:18px; }
.dp-f{ display:grid; gap:8px; }
.dp-f label{
  font-size:12px; font-weight:700; text-transform:uppercase;
  letter-spacing:.6px; color:var(--dp-subtle);
}
.dp-f input{
  height:46px; border:1px solid var(--dp-ink); border-radius:14px;
  padding:0 16px; outline:none; background:#fff; font-size:14px;
  transition: border-color .12s ease, box-shadow .12s ease, transform .1s ease;
}
.dp-f input:focus{
  border-color:var(--dp-accent);
  box-shadow:0 0 0 4px rgba(240,93,139,.12);
  transform:translateY(-1px);
}
.dp-chk label{
  display:flex; align-items:center; gap:10px;
  font-size:14px; font-weight:600; cursor:pointer;
}
.dp-chk input[type="checkbox"]{
  width:20px; height:20px; accent-color:var(--dp-accent);
}

/* ─────────────── TOAST ─────────────── */
.dp-toast{
  position:fixed; right:20px; bottom:20px;
  background:#111; color:#fff; border-radius:14px;
  padding:14px 20px; z-index:9999; font-weight:600;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation: dp-slideIn 3.5s forwards ease;
}
.dp-toast.ok{
  background:linear-gradient(135deg, #0f5132, #1a7d4e);
}
.dp-toast.bad{
  background:linear-gradient(135deg, #842029, #a52a33);
}
@keyframes dp-slideIn {
  0%{ transform:translateX(120%); opacity:0; }
  8%{ transform:translateX(0); opacity:1; }
  85%{ transform:translateX(0); opacity:1; }
  100%{ transform:translateX(120%); opacity:0; }
}

/* ─────────────── RESPONSIVE ─────────────── */
@media (max-width: 1024px){
  .dp-thead, .dp-row{ grid-template-columns: 1.2fr 1fr 2fr 1fr 1.3fr; padding:12px 16px; }
}
@media (max-width: 768px){
  .dp-hd{ flex-direction:column; align-items:stretch; gap:12px; }
  .dp-hd-right{ justify-content:flex-start; }
  .dp-search input{ min-width:100%; }
  .dp-thead, .dp-row{ grid-template-columns: 1fr 1fr; gap:8px; }
  .dp-status, .dp-act{ grid-column:1/-1; }
  .dp-act{ justify-content:flex-start; gap:6px; }
}
@media (prefers-reduced-motion: reduce){
  .dp-sheet, .dp-toast, .dp-btn, .dp-ghost, .dp-row{ animation:none; transition:none; }
}
`;
