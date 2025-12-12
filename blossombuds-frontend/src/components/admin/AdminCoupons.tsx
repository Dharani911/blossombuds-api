import React, { useEffect, useMemo, useState } from "react";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  setCouponActive,
  setCouponVisible,
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
      visible: true,
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

  async function toggleVisible(c: Coupon) {
    if (!c.id) return;
    const next = !c.visible;
    try {
      await setCouponVisible(c.id, next);
      setRows(rs => rs.map(r => (r.id === c.id ? { ...r, visible: next } : r)));
      setToast({ kind: "ok", msg: next ? "Coupon is now visible to customers." : "Coupon hidden from customers." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not toggle visibility." });
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
          <h3><span style={{ fontSize: "24px", color: "initial", marginRight: "12px", WebkitTextFillColor: "initial" }}>🎟️</span> Coupons & Promotion Codes</h3>
          <p className="cp-muted">
            Create and manage codes like <code>WELCOME10</code>, with % or flat discounts.
          </p>
        </div>
        <div className="cp-hd-right">
          <div className="cp-search">
            <input placeholder="Search code…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="cp-btn" onClick={openNew}>+ New coupon</button>
          <button
            className={`cp-ghost cp-iconbtn ${open ? "open" : ""}`}
            onClick={() => setOpen(v => !v)}
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
                <div style={{ textAlign: "right" }}>Actions</div>
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
                      ? <span className="cp-pill">Min {c.minItems} items</span>
                      : null}
                  </div>
                  <div>
                    <div className={c.visible !== false ? "cp-chip ok" : "cp-chip bad"} style={{ marginBottom: 6 }}>
                      {c.visible !== false ? "Visible" : "Hidden"}
                    </div>
                    <div className="cp-muted cp-small">{humanRange(c.validFrom, c.validTo)}</div>
                  </div>
                  <div className="cp-act">
                    <button className="cp-ghost cp-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="cp-ghost cp-sm" onClick={() => toggleVisible(c)}>
                      {c.visible !== false ? "Hide" : "Show"}
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
                    onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                    placeholder="WELCOME10"
                  />
                </div>
                <div className="cp-row2">
                  <div className="cp-f">
                    <label>Discount type *</label>
                    <select
                      value={draft.discountType}
                      onChange={e => setDraft({ ...draft, discountType: e.target.value as DiscountType })}
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
                      onChange={e => setDraft({ ...draft, discountValue: e.target.value })}
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
                      onChange={e => setDraft({ ...draft, minOrderTotal: e.target.value })}
                    />
                  </div>
                  <div className="cp-f">
                    <label>Min order items</label>
                    <input
                      type="number" min={0} step="1"
                      value={(draft.minItems ?? "") as any}
                      onChange={e => setDraft({
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
                      onChange={e => setDraft({
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
                      onChange={e => setDraft({
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
                      onChange={e => setDraft({ ...draft, validFrom: e.target.value })}
                    />
                  </div>
                  <div className="cp-f">
                    <label>Valid to</label>
                    <input
                      type="datetime-local"
                      value={toLocalInput(draft.validTo)}
                      onChange={e => setDraft({ ...draft, validTo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cp-f cp-chk">
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
  --cp-gold:#F6C320;
  --cp-mint:#4BE0B0;
}

.cp-wrap{ color:var(--cp-text); margin-bottom:24px; }

/* ─────────────── HEADER ─────────────── */
.cp-block-hd{
  display:flex; align-items:flex-end; justify-content:space-between;
  gap:16px; margin-bottom:16px; padding:20px 24px;
  background:#fff; border-radius:20px;
  box-shadow:0 4px 20px rgba(0,0,0,.06);
  position:relative;
}
.cp-block-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg, var(--cp-accent), var(--cp-gold), var(--cp-mint));
  border-radius:0 0 20px 20px;
}
.cp-block-hd h3{
  margin:0; font-size:22px; font-weight:900; letter-spacing:.3px;
  background:linear-gradient(135deg, var(--cp-accent), var(--cp-gold));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
  display:flex; align-items:center;
}
.cp-muted{ opacity:.75; font-size:13px; color:var(--cp-subtle); margin-top:4px; }
.cp-muted code{ background:rgba(0,0,0,.06); padding:2px 6px; border-radius:6px; font-size:12px; }
.cp-small{ font-size:12px; }
.cp-hd-left{ flex:1; }
.cp-hd-right{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

/* ─────────────── SEARCH ─────────────── */
.cp-search input{
  height:42px; border:1px solid var(--cp-ink); border-radius:14px; padding:0 16px;
  background:#fff; outline:none; min-width:260px;
  font-size:14px;
  transition:border-color .15s ease, box-shadow .15s ease, transform .1s ease;
}
.cp-search input:focus{
  border-color: var(--cp-accent);
  box-shadow:0 0 0 4px rgba(240,93,139,.12);
  transform:translateY(-1px);
}

/* ─────────────── BUTTONS ─────────────── */
.cp-btn{
  height:42px; padding:0 20px; border:none; border-radius:14px; cursor:pointer;
  background:linear-gradient(135deg, var(--cp-accent), #E34B7C);
  color:#fff; font-weight:900; font-size:14px;
  box-shadow: 0 8px 24px rgba(240,93,139,.25);
  transition: transform .1s ease, box-shadow .15s ease;
}
.cp-btn:hover{
  transform:translateY(-2px);
  box-shadow: 0 12px 32px rgba(240,93,139,.35);
}
.cp-btn:active{ transform: translateY(0); }
.cp-btn[disabled]{ opacity:.6; cursor:not-allowed; transform:none; }

.cp-ghost{
  height:36px; padding:0 14px; border-radius:12px;
  border:1px solid var(--cp-ink); background:#fff; cursor:pointer;
  font-size:13px; font-weight:600;
  transition: all .15s ease;
}
.cp-ghost:hover{
  background:#fafafa;
  border-color:rgba(0,0,0,.15);
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.08);
}
.cp-ghost.cp-sm{ height:32px; padding:0 12px; border-radius:10px; font-size:12.5px; }

/* ─────────────── CARD ─────────────── */
.cp-card{
  border:1px solid var(--cp-ink); border-radius:20px; background:var(--cp-card);
  box-shadow:0 12px 40px rgba(0,0,0,.08); overflow:hidden;
}

/* ─────────────── TABLE ─────────────── */
.cp-table{ display:grid; max-height:500px; overflow-y:auto; }
.cp-thead, .cp-row{
  display:grid;
  grid-template-columns: 1.2fr 1fr 2fr 1.2fr 1.1fr;
  gap:16px; padding:14px 20px; align-items:center;
}
.cp-thead{
  font-weight:900; font-size:11px; text-transform:uppercase; letter-spacing:.8px;
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.98));
  border-bottom:1px solid var(--cp-ink);
  position:sticky; top:0; z-index:5;
}
.cp-row{
  border-bottom:1px solid var(--cp-ink2);
  transition: background .15s ease, transform .1s ease;
}
.cp-row:hover{
  background:linear-gradient(90deg, rgba(240,93,139,.03), rgba(246,195,32,.03));
}
.cp-row:last-child{ border-bottom:none; }
.cp-codecell code{
  font-weight:900; font-size:14px;
  background:linear-gradient(135deg, var(--cp-accent), var(--cp-gold));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}
.cp-row strong{ font-size:15px; font-weight:700; }

/* ─────────────── PILLS / CHIPS ─────────────── */
.cp-cond{ display:flex; gap:6px; flex-wrap:wrap; }
.cp-pill{
  display:inline-flex; align-items:center; gap:6px; height:26px;
  padding:0 12px; border-radius:999px; border:1px solid var(--cp-ink);
  font-size:12px; font-weight:600; background:#fff;
}

.cp-chip{
  display:inline-flex; align-items:center; height:26px; padding:0 12px;
  border-radius:12px; font-size:11px; font-weight:800; letter-spacing:.5px;
  text-transform:uppercase; border:none;
}
.cp-chip.ok{
  background:linear-gradient(135deg, rgba(56,176,0,.15), rgba(75,224,176,.15));
  color:#0a5c36;
}
.cp-chip.bad{
  background:linear-gradient(135deg, rgba(240,93,139,.15), rgba(227,75,124,.15));
  color:#8E1743;
}

/* ─────────────── ACTIONS ─────────────── */
.cp-act{ display:flex; gap:8px; justify-content:flex-end; }

/* ─────────────── EMPTY STATE ─────────────── */
.cp-empty{ padding:48px 24px; text-align:center; color:var(--cp-text); }
.cp-empty-icon{ font-size:48px; opacity:.6; margin-bottom:12px; }
.cp-empty h4{ margin:0; font-size:16px; font-weight:600; opacity:.8; }

/* ─────────────── MODAL ─────────────── */
.cp-modal{
  position:fixed; inset:0; background:rgba(0,0,0,.45);
  display:flex; align-items:center; justify-content:center; z-index:200;
  backdrop-filter: blur(4px);
}
.cp-sheet{
  width:min(860px, 94vw); max-height:88vh; display:grid; grid-template-rows:auto 1fr auto;
  background:#fff; border-radius:24px;
  box-shadow:0 32px 80px rgba(0,0,0,.40); overflow:hidden;
  animation: cp-pop .18s ease-out;
}
@keyframes cp-pop { from{ transform:scale(.96) translateY(10px); opacity:0 } to{ transform:scale(1) translateY(0); opacity:1 } }

.cp-sheet-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 24px; border-bottom:1px solid var(--cp-ink);
  background:linear-gradient(180deg, rgba(246,195,32,.06), #fff);
  position:relative;
}
.cp-sheet-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, var(--cp-accent), var(--cp-gold), var(--cp-mint));
}
.cp-sheet-hd h4{
  margin:0; font-size:20px; font-weight:900;
  display:flex; align-items:center; gap:10px;
}
.cp-sheet-hd h4::before{ content:'🎟️'; font-size:22px; }
.cp-icon{
  border:none; background:rgba(0,0,0,.06); width:36px; height:36px;
  border-radius:12px; font-size:18px; cursor:pointer;
  display:grid; place-items:center;
  transition: background .12s ease, transform .1s ease;
}
.cp-icon:hover{ background:rgba(0,0,0,.10); transform:scale(1.05); }

.cp-sheet-bd{ padding:24px; overflow:auto; }
.cp-sheet-ft{
  display:flex; justify-content:flex-end; gap:12px;
  padding:16px 24px; border-top:1px solid var(--cp-ink);
  background:rgba(0,0,0,.02);
}

/* ─────────────── FORM ─────────────── */
.cp-grid{ display:grid; gap:18px; }
.cp-row2{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.cp-row3{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
.cp-f{ display:grid; gap:8px; }
.cp-f label{
  font-size:12px; font-weight:700; text-transform:uppercase;
  letter-spacing:.6px; color:var(--cp-subtle);
}
.cp-f input, .cp-f select{
  height:46px; border:1px solid var(--cp-ink); border-radius:14px;
  padding:0 16px; outline:none; background:#fff; font-size:14px;
  transition: border-color .12s ease, box-shadow .12s ease, transform .1s ease;
}
.cp-f input:focus, .cp-f select:focus{
  border-color:var(--cp-accent);
  box-shadow:0 0 0 4px rgba(240,93,139,.12);
  transform:translateY(-1px);
}
.cp-chk label{
  display:flex; align-items:center; gap:10px;
  font-size:14px; font-weight:600; cursor:pointer;
}
.cp-chk input[type="checkbox"]{
  width:20px; height:20px; accent-color:var(--cp-accent);
}

/* ─────────────── TOAST ─────────────── */
.cp-toast{
  position:fixed; right:20px; bottom:20px;
  background:#111; color:#fff; border-radius:14px;
  padding:14px 20px; z-index:9999; font-weight:600;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation: cp-slideIn 3.5s forwards ease;
}
.cp-toast.ok{
  background:linear-gradient(135deg, #0f5132, #1a7d4e);
}
.cp-toast.bad{
  background:linear-gradient(135deg, #842029, #a52a33);
}
@keyframes cp-slideIn {
  0%{ transform:translateX(120%); opacity:0; }
  8%{ transform:translateX(0); opacity:1; }
  85%{ transform:translateX(0); opacity:1; }
  100%{ transform:translateX(120%); opacity:0; }
}

/* ─────────────── CHEVRON BUTTON ─────────────── */
.cp-iconbtn{
  width:42px; height:42px; padding:0; display:grid; place-items:center;
  border-radius:14px;
}
.cp-iconbtn .chev{
  display:inline-block; width:10px; height:10px;
  border-right:2.5px solid var(--cp-text); border-bottom:2.5px solid var(--cp-text);
  transform: rotate(-45deg);
  transition: transform .2s ease, border-color .15s ease;
}
.cp-iconbtn.open .chev{ transform: rotate(45deg); }
.cp-iconbtn:hover .chev{ border-color: var(--cp-accent); }

/* ─────────────── RESPONSIVE ─────────────── */
@media (max-width: 1024px){
  .cp-thead, .cp-row{ grid-template-columns: 1.1fr 1fr 1.8fr 1.1fr 1fr; padding:12px 16px; }
}
@media (max-width: 768px){
  .cp-block-hd{ flex-direction:column; align-items:stretch; gap:12px; }
  .cp-hd-right{ justify-content:flex-start; }
  .cp-search input{ min-width:100%; }
  .cp-thead, .cp-row{ grid-template-columns: 1fr 1fr; gap:8px; }
  .cp-cond, .cp-act{ grid-column:1/-1; }
  .cp-row2, .cp-row3{ grid-template-columns:1fr; }
}
@media (prefers-reduced-motion: reduce){
  .cp-sheet, .cp-toast, .cp-btn, .cp-ghost, .cp-row{ animation:none; transition:none; }
}
`;
