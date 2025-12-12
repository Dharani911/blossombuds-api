import React, { useEffect, useState } from "react";
import {
  listRules,
  saveRule,
  updateRule,
  deleteRule,
  type DeliveryFeeRule,
  type RuleScope,
} from "../../api/adminShippingRules";
import {
  getCountries,
  getStatesByCountry,
  getAllStates,
  getAllDistricts,
  type State,
  type District,
  type Country,
} from "../../api/geo";

const PRIMARY = "#4A4F41";
const INK = "rgba(0,0,0,.08)";

function asNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function scopeLabel(s: RuleScope | string) {
  switch ((s || "").toUpperCase()) {
    case "STATE": return "State";
    case "DISTRICT": return "District";
    case "DEFAULT":
    default: return "Default";
  }
}

export default function AdminDeliveryFeeRules() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState<DeliveryFeeRule[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string | number, boolean>>({});
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // Lookups
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [statesNote, setStatesNote] = useState<string>("");

  // Try env first, then auto-resolve India ID, then fallback to all states
  async function loadStatesResilient() {
    setStatesNote("");
    const fromEnv = Number((import.meta as any)?.env?.VITE_COUNTRY_ID_INDIA || 0);
    try {
      if (fromEnv > 0) {
        const st = await getStatesByCountry(fromEnv);
        if (st?.length) { setStates(st); return; }
      }

      // Try to resolve India by countries API
      const countries: Country[] = await getCountries().catch(() => []);
      const india =
        countries.find(c => (c.isoCode || "").toUpperCase() === "IN") ||
        countries.find(c => /india/i.test(c.name || ""));
      if (india?.id) {
        const st = await getStatesByCountry(india.id).catch(() => [] as State[]);
        if (st?.length) { setStates(st); return; }
      }

      // Fallback: load all states (UI still works; labels resolve)
      const all = await getAllStates().catch(() => [] as State[]);
      setStates(all || []);
      if (!all?.length) {
        setStatesNote("No states available. Check your /api/locations/states endpoint.");
      } else {
        setStatesNote("Using all states (fallback). Consider setting VITE_COUNTRY_ID_INDIA.");
      }
    } catch {
      // Hard fallback if everything fails
      setStates([]);
      setStatesNote("Could not load states. Please verify locations API.");
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        // Rules (admin client with Bearer token)
        const data = await listRules();
        if (!live) return;
        setRules((data || []).sort((a, b) => {
          const order = (s: string) => (s === "DEFAULT" ? 0 : s === "STATE" ? 1 : 2);
          const d = order((String(a.scope) || "").toUpperCase()) - order((String(b.scope) || "").toUpperCase());
          return d !== 0 ? d : ((Number(b.id) || 0) - (Number(a.id) || 0));
        }));

        // Geo lookups (resilient states + all districts)
        await loadStatesResilient();
        const dists = await getAllDistricts().catch(() => [] as District[]);
        if (!live) return;
        setDistricts(dists || []);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.status === 401 ? "Unauthorized. Please sign in to the admin." : (e?.message || "Failed to load delivery fee rules."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // Draft for new rule
  const [draftScope, setDraftScope] = useState<RuleScope>("DEFAULT");
  const [draftScopeId, setDraftScopeId] = useState<number | "">("");
  const [draftFee, setDraftFee] = useState<string>("0");
  const [draftActive, setDraftActive] = useState(true);

  function resetDraft() {
    setDraftScope("DEFAULT");
    setDraftScopeId("");
    setDraftFee("0");
    setDraftActive(true);
  }

  async function saveNew() {
    const fee = asNumber(draftFee);
    if (fee < 0) { setToast({ kind: "bad", msg: "Fee must be ≥ 0" }); return; }
    if (draftScope !== "DEFAULT" && !draftScopeId) {
      setToast({ kind: "bad", msg: `Please choose a ${draftScope.toLowerCase()}.` });
      return;
    }
    try {
      setSavingIds((m) => ({ ...m, new: true }));
      const created = await saveRule({
        scope: draftScope,
        scopeId: draftScope === "DEFAULT" ? null : Number(draftScopeId),
        feeAmount: fee,
        active: draftActive,
      });
      setRules((rs) => [created, ...rs]);
      setToast({ kind: "ok", msg: "Rule saved." });
      resetDraft();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Save failed." });
    } finally {
      setSavingIds((m) => ({ ...m, new: false }));
    }
  }

  async function saveExisting(r: DeliveryFeeRule) {
    const fee = asNumber(r.feeAmount);
    if (fee < 0) { setToast({ kind: "bad", msg: "Fee must be ≥ 0" }); return; }
    if ((String(r.scope) || "DEFAULT").toUpperCase() !== "DEFAULT" && !r.scopeId) {
      setToast({ kind: "bad", msg: `Scope target is required.` });
      return;
    }
    try {
      setSavingIds((m) => ({ ...m, [Number(r.id)]: true }));
      const saved = await updateRule(Number(r.id), {
        scope: (String(r.scope) || "DEFAULT").toUpperCase() as RuleScope,
        scopeId: (String(r.scope) || "").toUpperCase() === "DEFAULT" ? null : Number(r.scopeId),
        feeAmount: fee,
        active: !!r.active,
      });
      setRules((rs) => rs.map(x => x.id === saved.id ? saved : x));
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Save failed." });
    } finally {
      setSavingIds((m) => ({ ...m, [Number(r.id)]: false }));
    }
  }

  async function del(id: number) {
    if (!confirm("Delete this rule?")) return;
    try {
      setSavingIds((m) => ({ ...m, [id]: true }));
      await deleteRule(id);
      setRules((rs) => rs.filter((x) => x.id !== id));
      setToast({ kind: "ok", msg: "Deleted." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Delete failed." });
    } finally {
      setSavingIds((m) => ({ ...m, [id]: false }));
    }
  }

  const stateName = (id?: number | null) => (states.find(s => s.id === id)?.name) || "";
  const districtName = (id?: number | null) => (districts.find(d => d.id === id)?.name) || "";

  return (
    <section id="delivery-fee-rules" className="dfr-block">
      <style>{css}</style>
      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)} style={{ position: "static", marginBottom: 8 }}>
          {toast.msg}
        </div>
      )}

      <div className="dfr-hd">
        <h3><span style={{ fontSize: "24px", color: "initial", marginRight: "12px", WebkitTextFillColor: "initial" }}>🚚</span> Delivery Fee Rules</h3>
        <p className="muted">
          Configure shipping fees by <strong>Default</strong>, <strong>State</strong>, or <strong>District</strong>. Highest specificity wins.
        </p>
      </div>
      <div className="dfr-body card" style={{ padding: 10 }}>
        {/* Draft/new row */}
        <div className="trow tgrid">
          <div className="cell">
            <label className="lbl">Scope</label>
            <select
              className="in"
              value={draftScope}
              onChange={(e) => { const v = e.target.value as RuleScope; setDraftScope(v); setDraftScopeId(""); }}
            >
              <option value="DEFAULT">Default</option>
              <option value="STATE">State</option>
              <option value="DISTRICT">District</option>
            </select>
          </div>
          <div className="cell">
            <label className="lbl">{draftScope === "STATE" ? "State" : draftScope === "DISTRICT" ? "District" : "—"}</label>
            {draftScope === "DEFAULT" ? (
              <input className="in" disabled value="Not applicable" />
            ) : draftScope === "STATE" ? (
              <select className="in" value={draftScopeId} onChange={(e) => setDraftScopeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select state…</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <select className="in" value={draftScopeId} onChange={(e) => setDraftScopeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select district…</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {statesNote && draftScope === "STATE" && (
              <div className="muted" style={{ marginTop: 4 }}>{statesNote}</div>
            )}
          </div>
          <div className="cell">
            <label className="lbl">Fee (₹)</label>
            <input className="in" inputMode="decimal" value={draftFee} onChange={(e) => setDraftFee(e.target.value)} />
          </div>
          <div className="cell">
            <label className="lbl">Active</label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
              <span className="muted">{draftActive ? "Enabled" : "Disabled"}</span>
            </label>
          </div>
          <div className="cell" style={{ justifySelf: "end" }}>
            <button className="ghost sm ok" onClick={saveNew} disabled={!!savingIds["new"]}>
              {savingIds["new"] ? "Saving…" : "Add rule"}
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="trow thead">
          <div>Scope</div>
          <div>Target</div>
          <div>Fee (₹)</div>
          <div>Status</div>
          <div style={{ justifySelf: "end" }}>Actions</div>
        </div>

        {/* Existing rules */}
        {loading && <div className="trow"><div className="cell">Loading…</div></div>}
        {!loading && err && <div className="trow"><div className="cell" style={{ color: "#b0003a" }}>{err}</div></div>}
        {!loading && !err && rules.length === 0 && <div className="trow"><div className="cell">No rules yet.</div></div>}

        {!loading && !err && rules.map((r) => {
          const ru: any = r; // temp editing fields
          const editing = ru._edit === true;
          const workingScope: RuleScope = (editing ? ru._scope : (r.scope as RuleScope)) || "DEFAULT";
          const workingScopeId = editing ? (ru._scopeId ?? "") : (r.scopeId ?? "");
          const workingFee = editing ? ru._feeAmount : r.feeAmount;
          const workingActive = editing ? ru._active : !!r.active;

          function setEdit(v: boolean) {
            setRules((rs) => rs.map(x => x.id === r.id
              ? ({ ...x, _edit: v, _scope: x.scope, _scopeId: x.scopeId, _feeAmount: x.feeAmount, _active: x.active })
              : x));
          }
          function update(k: "_scope" | "_scopeId" | "_feeAmount" | "_active", v: any) {
            setRules((rs) => rs.map(x => x.id === r.id ? ({ ...x, [k]: v }) : x));
          }
          async function save() {
            await saveExisting({
              id: r.id,
              scope: (workingScope || "DEFAULT"),
              scopeId: (workingScope === "DEFAULT" ? null : Number(workingScopeId)),
              feeAmount: asNumber(workingFee),
              active: !!workingActive,
            } as DeliveryFeeRule);
            setEdit(false);
          }

          return (
            <div key={r.id} className="trow tgrid">
              <div className="cell">
                {!editing ? (
                  <div className="val">{scopeLabel(r.scope)}</div>
                ) : (
                  <select className="in" value={workingScope} onChange={(e) => { update("_scope", e.target.value as RuleScope); update("_scopeId", ""); }}>
                    <option value="DEFAULT">Default</option>
                    <option value="STATE">State</option>
                    <option value="DISTRICT">District</option>
                  </select>
                )}
              </div>
              <div className="cell">
                {!editing ? (
                  <div className="val">
                    {(String(r.scope) || "").toUpperCase() === "DEFAULT" ? "—" :
                      (String(r.scope) || "").toUpperCase() === "STATE" ? (stateName(r.scopeId) || `State #${r.scopeId}`) :
                        (districtName(r.scopeId) || `District #${r.scopeId}`)}
                  </div>
                ) : workingScope === "DEFAULT" ? (
                  <input className="in" disabled value="Not applicable" />
                ) : workingScope === "STATE" ? (
                  <>
                    <select className="in" value={workingScopeId ?? ""} onChange={(e) => update("_scopeId", e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Select state…</option>
                      {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {statesNote && <div className="muted" style={{ marginTop: 4 }}>{statesNote}</div>}
                  </>
                ) : (
                  <select className="in" value={workingScopeId ?? ""} onChange={(e) => update("_scopeId", e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Select district…</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                )}
              </div>
              <div className="cell">
                {!editing ? (
                  <div className="val">₹{asNumber(r.feeAmount).toFixed(2)}</div>
                ) : (
                  <input className="in" inputMode="decimal" value={String(workingFee)} onChange={(e) => update("_feeAmount", e.target.value)} />
                )}
              </div>
              <div className="cell">
                {!editing ? (
                  <span className="val" title={r.active ? "Enabled" : "Disabled"}>{r.active ? "Enabled" : "Disabled"}</span>
                ) : (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={!!workingActive} onChange={(e) => update("_active", e.target.checked)} />
                    <span className="muted">{workingActive ? "Enabled" : "Disabled"}</span>
                  </label>
                )}
              </div>
              <div className="cell" style={{ justifySelf: "end", display: "flex", gap: 8 }}>
                {!editing ? (
                  <>
                    <button className="ghost sm" onClick={() => setEdit(true)}>Edit</button>
                    <button className="ghost sm bad" onClick={() => del(Number(r.id))} disabled={!!savingIds[Number(r.id)]}>
                      {savingIds[Number(r.id)] ? "…" : "Delete"}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ghost sm ok" onClick={save} disabled={!!savingIds[Number(r.id)]}>
                      {savingIds[Number(r.id)] ? "Saving…" : "Save"}
                    </button>
                    <button className="ghost sm" onClick={() => setEdit(false)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <p className="muted" style={{ marginTop: 8 }}>
          Tip: Set a global free-shipping threshold with the key <code>shipping.free_threshold</code> in the general settings below.
        </p>
      </div>
    </section>
  );
}

/* local styles for this block only */
const css = `
.dfr-block{
  margin-bottom:24px; color:${PRIMARY};
  background:#fff; border-radius:20px;
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 8px 32px rgba(0,0,0,.06);
  overflow:hidden;
}

/* ─────────────── HEADER ─────────────── */
.dfr-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 24px;
  background:linear-gradient(180deg, rgba(246,195,32,.08), #fff);
  border-bottom:1px solid rgba(0,0,0,.08);
  position:relative;
}
.dfr-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, #F05D8B, #F6C320, #4BE0B0);
}
.dfr-hd h3{
  margin:0; font-size:20px; font-weight:900; letter-spacing:.3px;
  background:linear-gradient(135deg, #F05D8B, #F6C320);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
  display:flex; align-items:center;
}

.muted{ opacity:.75; font-size:13px; margin:0; }
.muted strong{ color:#2B2E2A; font-weight:700; }

/* ─────────────── BODY ─────────────── */
.dfr-body.card{
  padding:0; border:none; box-shadow:none;
}

/* ─────────────── TABLE ─────────────── */
.trow{
  display:grid; align-items:center;
  padding:16px 24px;
  border-bottom:1px solid rgba(0,0,0,.06);
  transition: all .15s ease;
}
.trow:last-child{ border-bottom:none; }
.trow:hover:not(.thead){
  background:linear-gradient(90deg, rgba(240,93,139,.02), rgba(246,195,32,.02));
}

.trow.thead{
  font-weight:900; text-transform:uppercase; letter-spacing:.8px; font-size:11px;
  background:#fafafa;
  border-bottom:1px solid rgba(0,0,0,.08);
  color:rgba(0,0,0,.6);
}

/* Grid columns matching the component logic */
.trow.thead, .trow.tgrid{
  gap:16px;
  grid-template-columns: 160px 1fr 140px 120px 160px;
}

.cell{ min-width:0; }
.lbl{
  font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px;
  opacity:.7; margin-bottom:6px; display:block;
}

/* ─────────────── INPUTS ─────────────── */
.in{
  height:40px; width:100%;
  border:1px solid rgba(0,0,0,.12); border-radius:10px;
  padding:0 12px; background:#fff; outline:none;
  font-size:14px;
  transition: all .12s ease;
}
.in:focus{
  border-color:#F05D8B; box-shadow:0 0 0 3px rgba(240,93,139,.1);
}
.in:disabled{ background:#f9f9f9; cursor:not-allowed; opacity:.8; }

.val{
  font-size:14px; font-weight:600;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  color:#2B2E2A;
}

/* ─────────────── BUTTONS ─────────────── */
.ghost{
  height:34px; padding:0 14px; border-radius:10px;
  border:1px solid rgba(0,0,0,.12); background:#fff;
  cursor:pointer; font-weight:700; font-size:13px;
  display:inline-flex; align-items:center; justify-content:center;
  transition: all .12s ease;
}
.ghost:hover{
  background:#fafafa; transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.06);
}

/* Success Action */
.ghost.ok{
  background:linear-gradient(135deg, #0f5132, #1a7d4e);
  color:#fff; border:none;
  box-shadow:0 4px 12px rgba(15,81,50,.2);
}
.ghost.ok:hover{
  background:linear-gradient(135deg, #146c43, #22a566);
  box-shadow:0 6px 16px rgba(15,81,50,.3);
}

/* Danger Action */
.ghost.bad{
  color:#b00020; border-color:rgba(176,0,32,.2);
}
.ghost.bad:hover{
  background:#fff5f5; border-color:#b00020;
}

/* ─────────────── TOAST ─────────────── */
.toast{
  padding:12px 18px; border-radius:12px;
  color:#fff; font-weight:600; font-size:14px;
  box-shadow:0 8px 24px rgba(0,0,0,.15);
  animation: fadeIn .2s ease-out;
}
.toast.ok{ background:linear-gradient(135deg, #0f5132, #1a7d4e); }
.toast.bad{ background:linear-gradient(135deg, #842029, #a52a33); }
@keyframes fadeIn { from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:translateY(0); } }

/* ─────────────── RESPONSIVE ─────────────── */
@media (max-width: 900px){
  .trow.thead, .trow.tgrid{ grid-template-columns: 140px 1fr 120px 100px 140px; gap:12px; }
  .block-hd{ flex-direction:column; align-items:stretch; gap:12px; }
}
@media (max-width: 720px){
  .trow{ display:flex; flex-direction:column; align-items:stretch; gap:12px; padding:16px; }
  .trow.thead{ display:none; }
  .cell{ width:100%; }
  .val{ font-size:15px; }
  .in{ height:44px; }
  .ghost{ width:100%; height:40px; }
}
`;
