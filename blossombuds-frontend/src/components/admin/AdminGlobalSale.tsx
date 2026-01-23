// src/components/admin/AdminGlobalSale.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type GlobalSaleConfigDto,
} from "../../api/adminGlobalSale";
import { getEffectiveDiscount, type GlobalSaleConfig } from "../../api/globalSaleConfig";

/* ---- theme tokens ---- */
const PRIMARY = "#4A4F41";

type Toast = { kind: "ok" | "bad"; msg: string } | null;

function asNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** ISO -> datetime-local (YYYY-MM-DDTHH:mm) in user's local tz */
const IST_TZ = "Asia/Kolkata";

/** ISO -> datetime-local string as IST clock time (YYYY-MM-DDTHH:mm) */
function isoToIstInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}


/** datetime-local -> ISO (UTC). empty => null */
/** datetime-local typed as IST -> ISO (UTC). empty => null */
function istInputToIso(v?: string | null): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;

  // s = "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = s.split("T");
  if (!datePart || !timePart) return null;

  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;

  // Interpret as IST and convert to UTC by subtracting 5h30m
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - (5.5 * 60 * 60 * 1000);
  return new Date(utcMs).toISOString();
}


function windowLabel(r: GlobalSaleConfigDto) {
  const fmt = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-IN", { timeZone: IST_TZ })
      : "—";

  const s = fmt(r.startsAt);
  const e = fmt(r.endsAt);

  if (!r.startsAt && !r.endsAt) return "Always on (no window)";
  return `${s} → ${e}`;
}


export default function AdminGlobalSale() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [rows, setRows] = useState<(GlobalSaleConfigDto & any)[]>([]);
  const [effective, setEffective] = useState<GlobalSaleConfig | null>(null);

  const [busy, setBusy] = useState<Record<string | number, boolean>>({});

  // Draft (create)
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftPercentOff, setDraftPercentOff] = useState<string>("10");
  const [draftLabel, setDraftLabel] = useState<string>("SALE");
  const [draftStartsAt, setDraftStartsAt] = useState<string>("");
  const [draftEndsAt, setDraftEndsAt] = useState<string>("");

  const effectiveLabel = useMemo(() => {
    if (!effective) return "None";
    const p = asNumber(effective.percentOff);
    const lbl = (effective.label ?? "").trim();
    return `${p}%${lbl ? ` (${lbl})` : ""}`;
  }, [effective]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const [all, eff] = await Promise.all([
        listDiscounts(),
        getEffectiveDiscount().catch(() => null),
      ]);

      setRows((all || []).map((r) => ({ ...r, _edit: false })));
      setEffective(eff);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load discounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      await refresh();
      if (!live) return;
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetDraft() {
    setDraftEnabled(true);
    setDraftPercentOff("10");
    setDraftLabel("SALE");
    setDraftStartsAt("");
    setDraftEndsAt("");
  }

  function validate(percentOff: number) {
    if (percentOff <= 0) return "Percent off must be > 0.";
    if (percentOff > 95) return "Percent off looks too high (max 95%).";
    // Optional: enforce window consistency if both provided
    const sIso = istInputToIso(draftStartsAt);
    const eIso = istInputToIso(draftEndsAt);

    if (sIso && eIso) {
      if (new Date(eIso).getTime() <= new Date(sIso).getTime()) {
        return "Ends at must be after Starts at.";
      }
    }
    return null;
  }

  async function onCreate() {
    const pct = asNumber(draftPercentOff);
    const msg = validate(pct);
    if (msg) {
      setToast({ kind: "bad", msg });
      return;
    }

    try {
      setBusy((m) => ({ ...m, create: true }));
      const created = await createDiscount({
        enabled: !!draftEnabled,
        percentOff: pct,
        label: (draftLabel ?? "").trim() || null,
        startsAt: istInputToIso(draftStartsAt),
        endsAt: istInputToIso(draftEndsAt),

      });

      setRows((rs) => [created, ...rs]);
      setToast({ kind: "ok", msg: "Discount added." });

      // refresh effective label
      const eff = await getEffectiveDiscount().catch(() => null);
      setEffective(eff);

      resetDraft();
    } catch (e: any) {
      setToast({
        kind: "bad",
        msg: e?.response?.data?.message || e?.message || "Create failed.",
      });
    } finally {
      setBusy((m) => ({ ...m, create: false }));
    }
  }

  function startEdit(id: number) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              _edit: true,
              _enabled: !!r.enabled,
              _percentOff: String(r.percentOff ?? ""),
              _label: r.label ?? "",
              _startsAtLocal: isoToIstInput(r.startsAt),
              _endsAtLocal: isoToIstInput(r.endsAt),

            }
          : r
      )
    );
  }

  function cancelEdit(id: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, _edit: false } : r)));
  }

  function patch(id: number, key: string, value: any) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  async function saveEdit(id: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    const pct = asNumber(row._percentOff);
    if (pct <= 0 || pct > 95) {
      setToast({ kind: "bad", msg: "Percent off must be between 1 and 95." });
      return;
    }

    const sIso = istInputToIso(row._startsAtLocal);
    const eIso = istInputToIso(row._endsAtLocal);

    if (sIso && eIso && new Date(eIso).getTime() <= new Date(sIso).getTime()) {
      setToast({ kind: "bad", msg: "Ends at must be after Starts at." });
      return;
    }

    try {
      setBusy((m) => ({ ...m, [id]: true }));
      const saved = await updateDiscount(id, {
        enabled: !!row._enabled,
        percentOff: pct,
        label: (row._label ?? "").trim() || null,
        startsAt: sIso,
        endsAt: eIso,
      });

      setRows((rs) =>
        rs.map((r) =>
          r.id === id ? { ...saved, _edit: false } : r
        )
      );

      setToast({ kind: "ok", msg: "Saved." });

      // refresh effective label
      const eff = await getEffectiveDiscount().catch(() => null);
      setEffective(eff);
    } catch (e: any) {
      setToast({
        kind: "bad",
        msg: e?.response?.data?.message || e?.message || "Save failed.",
      });
    } finally {
      setBusy((m) => ({ ...m, [id]: false }));
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this discount config?")) return;

    try {
      setBusy((m) => ({ ...m, [id]: true }));
      await deleteDiscount(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      setToast({ kind: "ok", msg: "Deleted." });

      const eff = await getEffectiveDiscount().catch(() => null);
      setEffective(eff);
    } catch (e: any) {
      setToast({
        kind: "bad",
        msg: e?.response?.data?.message || e?.message || "Delete failed.",
      });
    } finally {
      setBusy((m) => ({ ...m, [id]: false }));
    }
  }

  return (
    <section id="global-sale" className="gs-card">
      <style>{css}</style>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <div className="gs-hd">
        <h3>🏷️ Global Sale / Discount</h3>
        <div className="gs-effective">
          Effective now: <b>{effectiveLabel}</b>
        </div>
      </div>

      <div className="gs-body">
        {/* Composer */}
        <div className="gs-grid gs-compose">
          <div className="cell">
            <label className="lbl">Enabled</label>
            <label className="chk">
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={(e) => setDraftEnabled(e.target.checked)}
              />
              <span>{draftEnabled ? "Enabled" : "Disabled"}</span>
            </label>
          </div>

          <div className="cell">
            <label className="lbl">Percent off</label>
            <input
              className="in"
              inputMode="decimal"
              value={draftPercentOff}
              onChange={(e) => setDraftPercentOff(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>

          <div className="cell">
            <label className="lbl">Label</label>
            <input
              className="in"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. SALE"
            />
          </div>

          <div className="cell">
            <label className="lbl">Starts at</label>
            <input
              className="in"
              type="datetime-local"
              value={draftStartsAt}
              onChange={(e) => setDraftStartsAt(e.target.value)}
            />
          </div>

          <div className="cell">
            <label className="lbl">Ends at</label>
            <input
              className="in"
              type="datetime-local"
              value={draftEndsAt}
              onChange={(e) => setDraftEndsAt(e.target.value)}
            />
          </div>

          <div className="cell actions">
            <button className="btn ok" onClick={onCreate} disabled={!!busy["create"]}>
              {busy["create"] ? "Adding…" : "Add discount"}
            </button>
          </div>
        </div>

        <div className="gs-actions-row">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <div className="tip muted">
            Tip: If you want “always-on” discount, keep both dates empty.
          </div>
        </div>

        {/* Errors */}
        {!loading && err && <div className="err">{err}</div>}

        {/* Table */}
        <div className="gs-grid gs-head">
          <div>ID</div>
          <div>Enabled</div>
          <div>% Off</div>
          <div>Label</div>
          <div>Window</div>
          <div style={{ justifySelf: "end" }}>Actions</div>
        </div>

        {loading && <div className="row-solo">Loading…</div>}
        {!loading && !err && rows.length === 0 && <div className="row-solo">No discounts yet.</div>}

        {!loading &&
          !err &&
          rows.map((r: any) => {
            const editing = r._edit === true;

            return (
              <div key={r.id} className="gs-grid gs-row">
                <div className="val mono">{r.id}</div>

                <div className="val">
                  {!editing ? (
                    r.enabled ? "Yes" : "No"
                  ) : (
                    <label className="chk" style={{ height: 40 }}>
                      <input
                        type="checkbox"
                        checked={!!r._enabled}
                        onChange={(e) => patch(r.id, "_enabled", e.target.checked)}
                      />
                      <span>{r._enabled ? "Enabled" : "Disabled"}</span>
                    </label>
                  )}
                </div>

                <div className="val">
                  {!editing ? (
                    `${asNumber(r.percentOff)}%`
                  ) : (
                    <input
                      className="in"
                      inputMode="decimal"
                      value={String(r._percentOff ?? "")}
                      onChange={(e) => patch(r.id, "_percentOff", e.target.value)}
                    />
                  )}
                </div>

                <div className="val">
                  {!editing ? (
                    r.label || "—"
                  ) : (
                    <input
                      className="in"
                      value={String(r._label ?? "")}
                      onChange={(e) => patch(r.id, "_label", e.target.value)}
                      placeholder="SALE"
                    />
                  )}
                </div>

                <div className="val">
                  {!editing ? (
                    windowLabel(r)
                  ) : (
                    <div className="window-edit">
                      <input
                        className="in"
                        type="datetime-local"
                        value={String(r._startsAtLocal ?? "")}
                        onChange={(e) => patch(r.id, "_startsAtLocal", e.target.value)}
                      />
                      <span className="arrow">→</span>
                      <input
                        className="in"
                        type="datetime-local"
                        value={String(r._endsAtLocal ?? "")}
                        onChange={(e) => patch(r.id, "_endsAtLocal", e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="row-actions">
                  {!editing ? (
                    <>
                      <button className="btn" onClick={() => startEdit(Number(r.id))}>
                        Edit
                      </button>
                      <button
                        className="btn bad"
                        onClick={() => onDelete(Number(r.id))}
                        disabled={!!busy[Number(r.id)]}
                        title={busy[Number(r.id)] ? "Working…" : "Delete"}
                      >
                        {busy[Number(r.id)] ? "…" : "Delete"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn ok"
                        onClick={() => saveEdit(Number(r.id))}
                        disabled={!!busy[Number(r.id)]}
                      >
                        {busy[Number(r.id)] ? "Saving…" : "Save"}
                      </button>
                      <button className="btn" onClick={() => cancelEdit(Number(r.id))}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

const css = `
.gs-card{
  border:1px solid rgba(0,0,0,.08);
  border-radius:20px;
  background:#fff;
  box-shadow:0 12px 40px rgba(0,0,0,.06);
  overflow:hidden;
  margin-bottom:24px;
  color:${PRIMARY};
}

.gs-hd{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:16px 20px;
  border-bottom:1px solid rgba(0,0,0,.08);
  background:linear-gradient(180deg, #fff7f2, #fff);
  position:relative;
}
.gs-hd::after{
  content:"";
  position:absolute;
  bottom:0; left:0; right:0;
  height:3px;
  background:linear-gradient(90deg, #F05D8B, #F6C320, #9BB472);
}
.gs-hd h3{ margin:0; font-size:18px; font-weight:900; }
.gs-effective{ font-size:12px; opacity:.75; }

.gs-body{ padding:16px; }

.muted{ opacity:.75; font-size:13px; }

/* ✅ One consistent grid definition */
.gs-grid{
  display:grid;
  gap:14px;
  align-items:end; /* aligns button with inputs */
}

/* ✅ Composer row: checkbox + 4 inputs + button */
.gs-compose{
  grid-template-columns: 140px 1.1fr 1fr 1fr 1fr 160px;
  padding-bottom:14px;
  border-bottom:1px solid rgba(0,0,0,.06);
  margin-bottom:12px;
}

.cell{ min-width:0; }
.cell.actions{ display:flex; justify-content:flex-end; }

.lbl{
  display:block;
  font-size:11px;
  font-weight:800;
  text-transform:uppercase;
  letter-spacing:.5px;
  opacity:.65;
  margin-bottom:6px;
}

.in{
  width:100%;
  height:40px;
  border:1px solid rgba(0,0,0,.12);
  border-radius:10px;
  padding:0 12px;
  outline:none;
  font-size:14px;
  transition: all .12s ease;
}
.in:focus{
  border-color:#F05D8B;
  box-shadow:0 0 0 3px rgba(240,93,139,.10);
}
.in:disabled{ background:#f7f7f7; opacity:.8; }

.chk{
  display:flex;
  align-items:center;
  gap:10px;
  height:40px;
}

.btn{
  height:40px;
  padding:0 14px;
  border-radius:10px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  cursor:pointer;
  font-weight:800;
  font-size:13px;
  transition: all .12s ease;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
}
.btn:hover{
  transform: translateY(-1px);
  box-shadow:0 6px 18px rgba(0,0,0,.08);
}
.btn.ok{
  border:none;
  color:#fff;
  background:linear-gradient(135deg, #0f5132, #1a7d4e);
  box-shadow:0 8px 22px rgba(15,81,50,.18);
}
.btn.ok:hover{
  box-shadow:0 10px 28px rgba(15,81,50,.26);
}
.btn.bad{
  color:#b00020;
  border-color:rgba(176,0,32,.2);
}
.btn.bad:hover{
  background:#fff5f5;
  border-color:rgba(176,0,32,.35);
}

.gs-actions-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin: 10px 0 14px;
}
.tip{ flex:1; text-align:left; }

.err{
  color:#b0003a;
  background: rgba(176,0,58,.06);
  border:1px solid rgba(176,0,58,.12);
  padding:10px 12px;
  border-radius:12px;
  margin-bottom:12px;
}

/* Table header + rows use same grid */
.gs-head{
  grid-template-columns: 80px 110px 110px 1fr 1.2fr 180px;
  padding:10px 12px;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.8px;
  color:rgba(0,0,0,.55);
  background:#fafafa;
  border-radius:12px;
  border:1px solid rgba(0,0,0,.06);
}

.gs-row{
  grid-template-columns: 80px 110px 110px 1fr 1.2fr 180px;
  padding:12px;
  border-bottom:1px solid rgba(0,0,0,.06);
  align-items:center;
}
.gs-row:hover{
  background:linear-gradient(90deg, rgba(246,195,32,0.04), rgba(255,255,255,0));
}

.val{
  min-width:0;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  font-weight:600;
  color:#2B2E2A;
}
.mono{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
}

.row-actions{
  justify-self:end;
  display:flex;
  gap:8px;
}

.window-edit{
  display:flex;
  align-items:center;
  gap:8px;
  min-width:0;
}
.window-edit .arrow{
  opacity:.5;
  font-weight:900;
}

.row-solo{
  padding:14px 6px;
  opacity:.75;
}

/* Toast */
.toast{
  position:fixed;
  right:20px;
  bottom:20px;
  z-index:200;
  padding:14px 18px;
  border-radius:14px;
  color:#fff;
  font-weight:800;
  box-shadow:0 10px 32px rgba(0,0,0,.15);
  animation: toastSlide 2.8s ease forwards;
}
.toast.ok{ background:linear-gradient(135deg, #0f5132, #1a7d4e); }
.toast.bad{ background:linear-gradient(135deg, #c62828, #e53935); }

@keyframes toastSlide{
  0% { transform: translateY(24px); opacity:0; }
  10% { transform: translateY(0); opacity:1; }
  85% { transform: translateY(0); opacity:1; }
  100%{ transform: translateY(12px); opacity:0; }
}

/* Responsive */
@media (max-width: 980px){
  .gs-compose{
    grid-template-columns: 140px 1fr 1fr;
  }
  .cell.actions{ justify-content:flex-start; }
  .gs-head, .gs-row{
    grid-template-columns: 80px 1fr 140px;
  }
  .row-actions{ justify-self:start; }
  .window-edit{ flex-direction:column; align-items:stretch; }
}
@media (max-width: 620px){
  .gs-compose{ grid-template-columns: 1fr; align-items:stretch; }
  .gs-actions-row{ flex-direction:column; align-items:stretch; }
  .gs-head{ display:none; }
  .gs-row{ grid-template-columns: 1fr; gap:10px; }
  .row-actions{ justify-self:stretch; }
  .row-actions .btn{ width:100%; }
}
.btn{
  height:40px;
  padding:0 14px;
  border-radius:10px;
  border:1px solid rgba(74,79,65,.28);
  background:#f7f7f4;              /* ✅ not pure white */
  color:#1f241b;                    /* ✅ strong text */
  cursor:pointer;
  font-weight:900;
  font-size:13px;
  transition: all .12s ease;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  box-shadow:0 2px 10px rgba(0,0,0,.06); /* ✅ visible on light bg */
}


.btn:active{
  transform: translateY(0);
  box-shadow:0 3px 10px rgba(0,0,0,.08);
}

.btn:disabled{
  opacity:.55;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}
.btn.bad{
  color:#b00020;
  background:#fff4f6;                 /* ✅ visible */
  border-color:rgba(176,0,32,.22);
}
.btn.bad:hover{
  background:#ffe9ee;
  border-color:rgba(176,0,32,.35);
}
.row-actions{
  justify-self:end;
  display:flex;
  gap:8px;
  flex-wrap:wrap;        /* ✅ wrap instead of disappearing */
  align-items:center;
}
.row-actions .btn{
  white-space:nowrap;
}
.gs-row{ overflow: visible; }   /* add this if any parent clips */

`;
