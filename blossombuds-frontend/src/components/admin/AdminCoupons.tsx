import React, { useEffect, useMemo, useState } from "react";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  setCouponActive,
  sanitizeCouponPayload,
  type Coupon,
  type DiscountType,
} from "../../api/adminCoupons";
import { formatIstDateTime } from "../../utils/dates";


/** ─────────────────────────────────────────────────────────
 *  Design tokens
 *  ───────────────────────────────────────────────────────── */
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

type Mode = "list" | "edit" | "new";

export default function AdminCoupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);

  // modal state
  const [mode, setMode] = useState<Mode>("list");
  const [draft, setDraft] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await listCoupons();
        if (!alive) return;
        setRows((data || []).sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Could not load coupons.");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      r.code?.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  function openNew() {
    setMode("new");
    setDraft({
      code: "",
      discountType: "PERCENT",
      discountValue: "10",
      minOrderTotal: null,
      validFrom: "",
      validTo: "",
      usageLimit: null,
      perCustomerLimit: null,
      minItems: null,
      active: true,
    });
  }

  function openEdit(c: Coupon) {
    setMode("edit");
    setDraft({ ...c });
  }

  function closeModal() {
    setMode("list");
    setDraft(null);
    setSaving(false);
  }

  async function save() {
    if (!draft) return;
    if (!draft.code || !draft.discountType || draft.discountValue === undefined) {
      setToast({ kind: "bad", msg: "Code, Discount type and value are required." });
      return;
    }
    if (draft.discountType === "PERCENT") {
      const val = Number(draft.discountValue);
      if (!Number.isFinite(val) || val < 0 || val > 100) {
        setToast({ kind: "bad", msg: "Percent discount must be between 0 and 100." });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = sanitizeCouponPayload({
        ...draft,
        code: (draft.code || "").toUpperCase(),
        // ensure integers for minItems
        minItems:
          draft.minItems === null || draft.minItems === undefined || draft.minItems === ("" as any)
            ? null
            : Number(draft.minItems),
      } as Coupon);

      let saved: Coupon;
      if (mode === "new") {
        saved = await createCoupon(payload as Coupon);
        setRows(rs => [{ ...saved }, ...rs]);
      } else {
        saved = await updateCoupon(Number(draft.id), payload as Coupon);
        setRows(rs => rs.map(r => (r.id === saved.id ? { ...saved } : r)));
      }
      setToast({ kind: "ok", msg: "Saved coupon." });
      closeModal();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Save failed." });
    } finally { setSaving(false); }
  }

  async function toggleActive(c: Coupon) {
    if (!c.id) return;
    const next = !c.active;
    try {
      await setCouponActive(c.id, next);
      setRows(rs => rs.map(r => (r.id === c.id ? { ...r, active: next } : r)));
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not toggle." });
    }
  }

  return (
    <div className="cp-wrap">
      <style>{css}</style>

      {toast && (
        <div className={"cp-toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* Collapsible header */}
      <div className="cp-block-hd">
        <div className="cp-hd-left">
          <h3>Coupons & Promotion Codes</h3>
          <p className="cp-muted">
            Create and manage codes like <code>WELCOME10</code>, with % or flat discounts.
          </p>
        </div>
        <div className="cp-hd-right">
          <div className="cp-search">
            <input placeholder="Search code…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <button className="cp-btn" onClick={openNew}>+ New coupon</button>
          <button
            className={`cp-ghost cp-iconbtn ${open ? "open" : ""}`}
            onClick={()=>setOpen(v=>!v)}
            aria-label={open ? "Collapse" : "Expand"}
            title={open ? "Collapse" : "Expand"}
          >
            <span className="chev" />
          </button>
        </div>
      </div>

      {open && (
        <div className="cp-card">
          {loading && <div className="cp-empty"><div className="cp-empty-icon">⏳</div><h4>Loading…</h4></div>}
          {!loading && err && <div className="cp-empty"><div className="cp-empty-icon">⚠️</div><h4>{err}</h4></div>}
          {!loading && !err && filtered.length === 0 && (
            <div className="cp-empty"><div className="cp-empty-icon">📝</div><h4>No coupons yet</h4></div>
          )}

          {!loading && !err && filtered.length > 0 && (
            <div className="cp-table">
              <div className="cp-thead">
                <div>Code</div>
                <div>Discount</div>
                <div>Conditions</div>
                <div>Status / Validity</div>
                <div style={{textAlign:"right"}}>Actions</div>
              </div>
              {filtered.map(c => (
                <div className="cp-row" key={c.id ?? c.code}>
                  <div className="cp-codecell"><code>{c.code}</code></div>
                  <div>
                    {c.discountType === "PERCENT"
                      ? <strong>{c.discountValue}%</strong>
                      : <strong>₹{c.discountValue}</strong>}
                  </div>
                  <div className="cp-cond">
                    {c.minOrderTotal ? <span className="cp-pill">Min ₹{c.minOrderTotal}</span> : <span className="cp-muted">—</span>}
                    {" "}
                    {typeof c.minItems === "number" && c.minItems > 0
                      ? <span className="cp-pill">Min { c.minItems } items</span>
                      : null}
                  </div>
                  <div>
                    <div className={c.active ? "cp-chip ok" : "cp-chip bad"} style={{marginBottom:6}}>
                      {c.active ? "Active" : "Inactive"}
                    </div>
                    <div className="cp-muted cp-small">{humanRange(c.validFrom, c.validTo)}</div>
                  </div>
                  <div className="cp-act">
                    <button className="cp-ghost cp-sm" onClick={()=>openEdit(c)}>Edit</button>
                    <button className="cp-ghost cp-sm" onClick={()=>toggleActive(c)}>
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {mode !== "list" && draft && (
        <div className="cp-modal">
          <div className="cp-sheet">
            <div className="cp-sheet-hd">
              <h4>{mode === "new" ? "New coupon" : `Edit: ${draft.code}`}</h4>
              <button className="cp-icon" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <div className="cp-sheet-bd">
              <div className="cp-grid">
                <div className="cp-f">
                  <label>Code *</label>
                  <input
                    value={draft.code}
                    onChange={e=>setDraft({...draft, code: e.target.value.toUpperCase()})}
                    placeholder="WELCOME10"
                  />
                </div>
                <div className="cp-row2">
                  <div className="cp-f">
                    <label>Discount type *</label>
                    <select
                      value={draft.discountType}
                      onChange={e=>setDraft({...draft, discountType: e.target.value as DiscountType})}
                    >
                      <option value="PERCENT">% Percent</option>
                      <option value="FLAT">₹ Flat amount</option>
                    </select>
                  </div>
                  <div className="cp-f">
                    <label>Discount value *</label>
                    <input
                      type="number"
                      min={0}
                      max={draft.discountType === "PERCENT" ? 100 : undefined}
                      step="0.01"
                      value={draft.discountValue as any}
                      onChange={e=>setDraft({...draft, discountValue: e.target.value})}
                      placeholder={draft.discountType === "PERCENT" ? "10" : "200"}
                    />
                  </div>
                </div>

                <div className="cp-row3">
                  <div className="cp-f">
                    <label>Min order total (₹)</label>
                    <input
                      type="number" min={0} step="0.01"
                      value={(draft.minOrderTotal ?? "") as any}
                      onChange={e=>setDraft({...draft, minOrderTotal: e.target.value})}
                    />
                  </div>
                  <div className="cp-f">
                    <label>Min order items</label>
                    <input
                      type="number" min={0} step="1"
                      value={(draft.minItems ?? "") as any}
                      onChange={e=>setDraft({
                        ...draft,
                        minItems: e.target.value === "" ? null : Number(e.target.value)
                      })}
                    />
                  </div>
                  {/* no max discount field — not in DB */}
                </div>

                <div className="cp-row2">
                  <div className="cp-f">
                    <label>Usage limit (total)</label>
                    <input
                      type="number" min={0}
                      value={(draft.usageLimit ?? "") as any}
                      onChange={e=>setDraft({
                        ...draft,
                        usageLimit: e.target.value === "" ? null : Number(e.target.value)
                      })}
                    />
                  </div>
                  <div className="cp-f">
                    <label>Per-customer limit</label>
                    <input
                      type="number" min={0}
                      value={(draft.perCustomerLimit ?? "") as any}
                      onChange={e=>setDraft({
                        ...draft,
                        perCustomerLimit: e.target.value === "" ? null : Number(e.target.value)
                      })}
                    />
                  </div>
                </div>

                <div className="cp-row2">
                  <div className="cp-f">
                    <label>Valid from</label>
                    <input
                      type="datetime-local"
                      value={toLocalInput(draft.validFrom)}
                      onChange={e=>setDraft({...draft, validFrom: e.target.value})}
                    />
                  </div>
                  <div className="cp-f">
                    <label>Valid to</label>
                    <input
                      type="datetime-local"
                      value={toLocalInput(draft.validTo)}
                      onChange={e=>setDraft({...draft, validTo: e.target.value})}
                    />
                  </div>
                </div>

                <div className="cp-f cp-chk">
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
            <div className="cp-sheet-ft">
              <button className="cp-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="cp-btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- local helpers ---------- */
function toIsoOffset(s?: string | null): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function human(dt?: string | null) {
  if (!dt) return "—";
  try {
    return formatIstDateTime(dt);
  } catch {
    return "—";
  }
}

function humanRange(from?: string | null, to?: string | null) {
  const hasFrom = !!from;
  const hasTo = !!to;

  if (!hasFrom && !hasTo) return "—";

  const a = hasFrom ? human(from) : "—";
  const b = hasTo ? human(to) : "—";

  if (hasFrom && hasTo) return `${a} → ${b}`;
  if (hasFrom) return `from ${a}`;
  return `until ${b}`;
}


/* ---------- styles (namespaced) ---------- */
const css = `
:root{
  --cp-ink:${TOKENS.INK};
  --cp-ink2:${TOKENS.INK2};
  --cp-text:${TOKENS.TEXT};
  --cp-subtle:${TOKENS.SUBTLE};
  --cp-accent:${TOKENS.ACCENT};
  --cp-accent-hover:${TOKENS.ACCENT_HOVER};
  --cp-ok-bg:${TOKENS.OK_BG};
  --cp-ok-b:${TOKENS.OK_BORDER};
  --cp-ok:${TOKENS.OK_TEXT};
  --cp-bad-bg:${TOKENS.BAD_BG};
  --cp-bad-b:${TOKENS.BAD_BORDER};
  --cp-bad:${TOKENS.BAD_TEXT};
  --cp-card:${TOKENS.CARD_BG};
}

.cp-wrap{ color:var(--cp-text); }
.cp-block-hd{
  display:flex; align-items:flex-end; justify-content:space-between;
  gap:12px; margin-bottom:10px;
}
.cp-block-hd h3{ margin:0; font-size:18px; font-weight:900; letter-spacing:.2px; }
.cp-muted{ opacity:.75; font-size:12px; color:var(--cp-subtle); }
.cp-small{ font-size:12px; }
.cp-hd-right{ display:flex; align-items:center; gap:8px; }
.cp-search input{
  height:36px; border:1px solid var(--cp-ink); border-radius:12px; padding:0 12px;
  background:#fff; outline:none; min-width:220px; transition:border-color .15s ease, box-shadow .15s;
}
.cp-search input:focus{ border-color: var(--cp-accent); box-shadow:0 0 0 3px rgba(240,93,139,.12); }

.cp-btn{
  height:36px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:var(--cp-accent); color:#fff; font-weight:900;
  box-shadow: 0 10px 24px rgba(240,93,139,.20);
  transition: transform .06s ease, background .12s ease;
}
.cp-btn:hover{ background: var(--cp-accent-hover); }
.cp-btn:active{ transform: translateY(1px); }

.cp-ghost{
  height:36px; padding:0 12px; border-radius:12px; border:1px solid var(--cp-ink); background:#fff; cursor:pointer;
  transition: background .12s ease, border-color .12s ease;
}
.cp-ghost:hover{ background:#fafafa; border-color: var(--cp-ink2); }
.cp-ghost.cp-sm{ height:30px; padding:0 10px; border-radius:10px; font-size:12.5px; }

.cp-card{
  border:1px solid var(--cp-ink); border-radius:16px; background:var(--cp-card);
  box-shadow:0 12px 30px rgba(0,0,0,.08); overflow:hidden;
}

/* Table */
.cp-table{ display:grid; }
.cp-thead, .cp-row{
  display:grid;
  grid-template-columns: 1.2fr 1.1fr 2.0fr 1.3fr 1fr;
  gap:12px; padding:12px 14px; align-items:center;
}
.cp-thead{
  font-weight:900; font-size:12px;
  background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95));
  border-bottom:1px solid var(--cp-ink);
}
.cp-row{
  border-bottom:1px solid var(--cp-ink2); transition: background .12s ease;
}
.cp-row:hover{ background: rgba(0,0,0,.02); }
.cp-row:last-child{ border-bottom:none; }
.cp-codecell code{ font-weight:900; }

.cp-pill{
  display:inline-flex; align-items:center; gap:6px; height:24px;
  padding:0 10px; border-radius:999px; border:1px solid var(--cp-ink);
  font-size:12px; background:#fff;
}
.cp-pill.cp-ghost{ background:#fcfcfc; border-style:dashed; }

.cp-act{ display:flex; gap:8px; justify-content:flex-end; }
.cp-chip{
  display:inline-flex; align-items:center; height:22px; padding:0 8px;
  border-radius:999px; font-size:12px; font-weight:700; border:1px solid transparent;
}
.cp-chip.ok{ background: var(--cp-ok-bg); color:var(--cp-ok); border-color: var(--cp-ok-b); }
.cp-chip.bad{ background: var(--cp-bad-bg); color:var(--cp-bad); border-color: var(--cp-bad-b); }

.cp-empty{ padding:28px; text-align:center; color:var(--cp-text); }
.cp-empty-icon{ font-size:30px; opacity:.65; }

/* Modal */
.cp-modal{
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center; z-index:200;
  backdrop-filter: blur(2px);
}
.cp-sheet{
  width:min(920px, 96vw); max-height:90vh; display:grid; grid-template-rows:auto 1fr auto;
  background:#fff; border-radius:18px; box-shadow:0 24px 70px rgba(0,0,0,.35); overflow:hidden;
  animation: cp-pop .12s ease-out;
}
@keyframes cp-pop { from{ transform:scale(.985); opacity:.0 } to{ transform:scale(1); opacity:1 } }
.cp-sheet-hd{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--cp-ink); }
.cp-sheet-hd h4{ margin:0; font-size:18px; font-weight:900; }
.cp-icon{ border:none; background:transparent; font-size:18px; cursor:pointer; }
.cp-sheet-bd{ padding:14px 16px; overflow:auto; }
.cp-sheet-ft{ display:flex; justify-content:flex-end; gap:10px; padding:12px 16px; border-top:1px solid var(--cp-ink); }

.cp-grid{ display:grid; gap:12px; }
.cp-row2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.cp-row3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
.cp-f{ display:grid; gap:6px; }
.cp-f label{ font-size:12px; opacity:.8; }
.cp-f input, .cp-f select{
  height:40px; border:1px solid var(--cp-ink); border-radius:12px; padding:0 12px; outline:none; background:#fff;
  transition: border-color .12s ease, box-shadow .12s ease;
}
.cp-f input:focus, .cp-f select:focus{ border-color:var(--cp-accent); box-shadow:0 0 0 3px rgba(240,93,139,.12); }
.cp-chk label{ display:flex; align-items:center; gap:8px; }
.cp-btn[disabled]{ opacity:.7; cursor:not-allowed; }

/* Toast */
.cp-toast{
  position:fixed; right:16px; bottom:16px;
  background:#111; color:#fff; border-radius:12px; padding:10px 12px; z-index:9999;
  animation: cp-fadeout 3s forwards ease;
}
.cp-toast.ok{ background:#0f5132; }
.cp-toast.bad{ background:#842029; }
@keyframes cp-fadeout { 0%{opacity:1} 85%{opacity:1} 100%{opacity:0} }

/* icon-only toggle */
.cp-iconbtn{ width:36px; padding:0; display:grid; place-items:center; }
.cp-iconbtn .chev{
  display:inline-block; width:10px; height:10px;
  border-right:2px solid var(--cp-text); border-bottom:2px solid var(--cp-text);
  transform: rotate(-45deg);
  transition: transform .15s ease, border-color .12s ease;
}
.cp-iconbtn.open .chev{ transform: rotate(45deg); }
.cp-iconbtn:hover .chev{ border-color: var(--cp-accent); }

/* responsive */
@media (max-width: 900px){
  .cp-thead, .cp-row{ grid-template-columns: 1fr 1fr 1.6fr 1.1fr 1fr; }
}
@media (max-width: 720px){
  .cp-thead, .cp-row{ grid-template-columns: 1fr 1fr 1.3fr 1.1fr 1fr; }
  .cp-row2{ grid-template-columns:1fr; }
}
`;
