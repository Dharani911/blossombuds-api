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
import { listRegions, type DeliveryRegion } from "../../api/adminDeliveryRegions";
import { listPartners, type DeliveryPartner } from "../../api/adminDeliveryPartners";

const PRIMARY = "#4A4F41";

function asNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function scopeLabel(s: RuleScope | string) {
  switch ((s || "").toUpperCase()) {
    case "STATE":    return "State";
    case "DISTRICT": return "District";
    case "REGION":   return "Region";
    default:         return "Default";
  }
}

export default function AdminDeliveryFeeRules() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rules, setRules] = useState<DeliveryFeeRule[]>([]);
  const [savingIds, setSavingIds] = useState<Record<string | number, boolean>>({});
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  const [states, setStates]     = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions]   = useState<DeliveryRegion[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [statesNote, setStatesNote] = useState("");

  async function loadStatesResilient() {
    setStatesNote("");
    const fromEnv = Number((import.meta as any)?.env?.VITE_COUNTRY_ID_INDIA || 0);
    try {
      if (fromEnv > 0) {
        const st = await getStatesByCountry(fromEnv);
        if (st?.length) { setStates(st); return; }
      }
      const countries: Country[] = await getCountries().catch(() => []);
      const india = countries.find(c => (c.isoCode || "").toUpperCase() === "IN")
        || countries.find(c => /india/i.test(c.name || ""));
      if (india?.id) {
        const st = await getStatesByCountry(india.id).catch(() => [] as State[]);
        if (st?.length) { setStates(st); return; }
      }
      const all = await getAllStates().catch(() => [] as State[]);
      setStates(all || []);
      if (!all?.length) setStatesNote("No states available.");
    } catch {
      setStates([]);
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [data, dists, regs, prts] = await Promise.all([
          listRules(),
          getAllDistricts().catch(() => [] as District[]),
          listRegions().catch(() => [] as DeliveryRegion[]),
          listPartners().catch(() => [] as DeliveryPartner[]),
        ]);
        if (!live) return;
        setRules((data || []).sort((a, b) => {
          const order = (s: string) => s === "DEFAULT" ? 0 : s === "STATE" ? 1 : s === "DISTRICT" ? 2 : s === "REGION" ? 1 : 3;
          const d = order((String(a.scope) || "").toUpperCase()) - order((String(b.scope) || "").toUpperCase());
          return d !== 0 ? d : ((Number(b.id) || 0) - (Number(a.id) || 0));
        }));
        setDistricts(dists || []);
        setRegions(regs || []);
        setPartners(prts || []);
        await loadStatesResilient();
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.status === 401 ? "Unauthorized." : (e?.message || "Failed to load."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // Draft for new rule
  const [draftScope, setDraftScope]       = useState<RuleScope>("DEFAULT");
  const [draftScopeId, setDraftScopeId]   = useState<number | "">("");
  const [draftRegionId, setDraftRegionId] = useState<number | "">("");
  const [draftPartnerId, setDraftPartnerId] = useState<number | "">("");
  const [draftFee, setDraftFee]           = useState("0");
  const [draftActive, setDraftActive]     = useState(true);

  function resetDraft() {
    setDraftScope("DEFAULT");
    setDraftScopeId("");
    setDraftRegionId("");
    setDraftPartnerId("");
    setDraftFee("0");
    setDraftActive(true);
  }

  async function saveNew() {
    const fee = asNumber(draftFee);
    if (fee < 0) { setToast({ kind: "bad", msg: "Fee must be ≥ 0" }); return; }
    if (draftScope === "STATE" || draftScope === "DISTRICT") {
      if (!draftScopeId) { setToast({ kind: "bad", msg: `Please choose a ${draftScope.toLowerCase()}.` }); return; }
    }
    if (draftScope === "REGION" && !draftRegionId) {
      setToast({ kind: "bad", msg: "Please choose a region." }); return;
    }
    try {
      setSavingIds(m => ({ ...m, new: true }));
      const created = await saveRule({
        scope: draftScope,
        scopeId: (draftScope === "STATE" || draftScope === "DISTRICT") ? Number(draftScopeId) : null,
        regionId: draftScope === "REGION" ? Number(draftRegionId) : null,
        deliveryPartnerId: draftPartnerId ? Number(draftPartnerId) : null,
        feeAmount: fee,
        active: draftActive,
      });
      setRules(rs => [created, ...rs]);
      setToast({ kind: "ok", msg: "Rule saved." });
      resetDraft();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Save failed." });
    } finally {
      setSavingIds(m => ({ ...m, new: false }));
    }
  }

  async function saveExisting(r: DeliveryFeeRule) {
    const fee = asNumber(r.feeAmount);
    if (fee < 0) { setToast({ kind: "bad", msg: "Fee must be ≥ 0" }); return; }
    const scope = (String(r.scope) || "DEFAULT").toUpperCase() as RuleScope;
    if ((scope === "STATE" || scope === "DISTRICT") && !r.scopeId) {
      setToast({ kind: "bad", msg: "Scope target is required." }); return;
    }
    if (scope === "REGION" && !r.regionId) {
      setToast({ kind: "bad", msg: "Region is required." }); return;
    }
    try {
      setSavingIds(m => ({ ...m, [Number(r.id)]: true }));
      const saved = await updateRule(Number(r.id), {
        scope,
        scopeId: (scope === "STATE" || scope === "DISTRICT") ? Number(r.scopeId) : null,
        regionId: scope === "REGION" ? Number(r.regionId) : null,
        deliveryPartnerId: r.deliveryPartnerId ?? null,
        feeAmount: fee,
        active: !!r.active,
      });
      setRules(rs => rs.map(x => x.id === saved.id ? saved : x));
      setToast({ kind: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Save failed." });
    } finally {
      setSavingIds(m => ({ ...m, [Number(r.id)]: false }));
    }
  }

  async function del(id: number) {
    if (!confirm("Delete this rule?")) return;
    try {
      setSavingIds(m => ({ ...m, [id]: true }));
      await deleteRule(id);
      setRules(rs => rs.filter(x => x.id !== id));
      setToast({ kind: "ok", msg: "Deleted." });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Delete failed." });
    } finally {
      setSavingIds(m => ({ ...m, [id]: false }));
    }
  }

  const stateName    = (id?: number | null) => states.find(s => s.id === id)?.name || "";
  const districtName = (id?: number | null) => districts.find(d => d.id === id)?.name || "";
  const regionName   = (id?: number | null) => regions.find(r => r.id === id)?.name || "";
  const partnerName  = (id?: number | null) => {
    if (!id) return "All partners";
    const p = partners.find(p => p.id === id);
    return p ? `${p.name}${p.code ? ` (${p.code})` : ""}` : `Partner #${id}`;
  };

  function scopeTargetLabel(r: DeliveryFeeRule) {
    const s = (String(r.scope) || "").toUpperCase();
    if (s === "DEFAULT") return "—";
    if (s === "STATE")    return stateName(r.scopeId) || `State #${r.scopeId}`;
    if (s === "DISTRICT") return districtName(r.scopeId) || `District #${r.scopeId}`;
    if (s === "REGION")   return regionName(r.regionId) || `Region #${r.regionId}`;
    return "—";
  }

  function ScopeTargetEditor({ scope, scopeId, regionId, onChange }: {
    scope: RuleScope;
    scopeId: number | "" | null | undefined;
    regionId: number | "" | null | undefined;
    onChange: (patch: { scopeId?: number | ""; regionId?: number | "" }) => void;
  }) {
    if (scope === "DEFAULT") return <input className="in" disabled value="Not applicable" />;
    if (scope === "STATE") return (
      <select className="in" value={scopeId ?? ""} onChange={e => onChange({ scopeId: e.target.value ? Number(e.target.value) : "" })}>
        <option value="">Select state…</option>
        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    );
    if (scope === "DISTRICT") return (
      <select className="in" value={scopeId ?? ""} onChange={e => onChange({ scopeId: e.target.value ? Number(e.target.value) : "" })}>
        <option value="">Select district…</option>
        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    );
    // REGION
    return (
      <select className="in" value={regionId ?? ""} onChange={e => onChange({ regionId: e.target.value ? Number(e.target.value) : "" })}>
        <option value="">Select region…</option>
        {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
    );
  }

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
          Configure fees by <strong>Partner</strong> + <strong>Default</strong> / <strong>State</strong> / <strong>District</strong> / <strong>Region</strong>. Most specific partner rule wins.
        </p>
      </div>

      <div className="dfr-body card" style={{ padding: 10 }}>
        {/* Draft / new row */}
        <div className="trow tgrid">
          {/* Partner */}
          <div className="cell">
            <label className="lbl">Partner</label>
            <select className="in" value={draftPartnerId} onChange={e => setDraftPartnerId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">All partners</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
            </select>
          </div>
          {/* Scope */}
          <div className="cell">
            <label className="lbl">Scope</label>
            <select className="in" value={draftScope} onChange={e => {
              setDraftScope(e.target.value as RuleScope);
              setDraftScopeId("");
              setDraftRegionId("");
            }}>
              <option value="DEFAULT">Default</option>
              <option value="STATE">State</option>
              <option value="DISTRICT">District</option>
              <option value="REGION">Region</option>
            </select>
          </div>
          {/* Target */}
          <div className="cell">
            <label className="lbl">{draftScope === "STATE" ? "State" : draftScope === "DISTRICT" ? "District" : draftScope === "REGION" ? "Region" : "—"}</label>
            <ScopeTargetEditor
              scope={draftScope}
              scopeId={draftScopeId}
              regionId={draftRegionId}
              onChange={p => {
                if (p.scopeId !== undefined) setDraftScopeId(p.scopeId);
                if (p.regionId !== undefined) setDraftRegionId(p.regionId);
              }}
            />
            {statesNote && draftScope === "STATE" && <div className="muted" style={{ marginTop: 4 }}>{statesNote}</div>}
          </div>
          {/* Fee */}
          <div className="cell">
            <label className="lbl">Fee (₹)</label>
            <input className="in" inputMode="decimal" value={draftFee} onChange={e => setDraftFee(e.target.value)} />
          </div>
          {/* Active */}
          <div className="cell">
            <label className="lbl">Active</label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={draftActive} onChange={e => setDraftActive(e.target.checked)} />
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
          <div>Partner</div>
          <div>Scope</div>
          <div>Target</div>
          <div>Fee (₹)</div>
          <div>Status</div>
          <div style={{ justifySelf: "end" }}>Actions</div>
        </div>

        {loading && <div className="trow"><div className="cell">Loading…</div></div>}
        {!loading && err && <div className="trow"><div className="cell" style={{ color: "#b0003a" }}>{err}</div></div>}
        {!loading && !err && rules.length === 0 && <div className="trow"><div className="cell">No rules yet.</div></div>}

        {!loading && !err && rules.map(r => {
          const ru: any = r;
          const editing = ru._edit === true;
          const workingScope: RuleScope = (editing ? ru._scope : (r.scope as RuleScope)) || "DEFAULT";
          const workingScopeId  = editing ? (ru._scopeId ?? "")  : (r.scopeId ?? "");
          const workingRegionId = editing ? (ru._regionId ?? "") : (r.regionId ?? "");
          const workingPartnerId = editing ? (ru._partnerId ?? "") : (r.deliveryPartnerId ?? "");
          const workingFee    = editing ? ru._feeAmount : r.feeAmount;
          const workingActive = editing ? ru._active   : !!r.active;

          function setEdit(v: boolean) {
            setRules(rs => rs.map(x => x.id === r.id
              ? ({ ...x, _edit: v, _scope: x.scope, _scopeId: x.scopeId, _regionId: x.regionId, _partnerId: x.deliveryPartnerId, _feeAmount: x.feeAmount, _active: x.active })
              : x));
          }
          function upd(k: string, v: any) {
            setRules(rs => rs.map(x => x.id === r.id ? ({ ...x, [k]: v }) : x));
          }
          async function save() {
            await saveExisting({
              id: r.id,
              scope: workingScope,
              scopeId: (workingScope === "STATE" || workingScope === "DISTRICT") ? Number(workingScopeId) : null,
              regionId: workingScope === "REGION" ? Number(workingRegionId) : null,
              deliveryPartnerId: workingPartnerId ? Number(workingPartnerId) : null,
              feeAmount: asNumber(workingFee),
              active: !!workingActive,
            } as DeliveryFeeRule);
            setEdit(false);
          }

          return (
            <div key={r.id} className="trow tgrid">
              {/* Partner */}
              <div className="cell">
                {!editing ? (
                  <div className="val partner-val">{partnerName(r.deliveryPartnerId)}</div>
                ) : (
                  <select className="in" value={workingPartnerId ?? ""} onChange={e => upd("_partnerId", e.target.value ? Number(e.target.value) : "")}>
                    <option value="">All partners</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
                  </select>
                )}
              </div>
              {/* Scope */}
              <div className="cell">
                {!editing ? (
                  <div className="val">{scopeLabel(r.scope)}</div>
                ) : (
                  <select className="in" value={workingScope} onChange={e => {
                    upd("_scope", e.target.value);
                    upd("_scopeId", "");
                    upd("_regionId", "");
                  }}>
                    <option value="DEFAULT">Default</option>
                    <option value="STATE">State</option>
                    <option value="DISTRICT">District</option>
                    <option value="REGION">Region</option>
                  </select>
                )}
              </div>
              {/* Target */}
              <div className="cell">
                {!editing ? (
                  <div className="val">{scopeTargetLabel(r)}</div>
                ) : (
                  <ScopeTargetEditor
                    scope={workingScope}
                    scopeId={workingScopeId}
                    regionId={workingRegionId}
                    onChange={p => {
                      if (p.scopeId !== undefined) upd("_scopeId", p.scopeId);
                      if (p.regionId !== undefined) upd("_regionId", p.regionId);
                    }}
                  />
                )}
              </div>
              {/* Fee */}
              <div className="cell">
                {!editing ? (
                  <div className="val">₹{asNumber(r.feeAmount).toFixed(2)}</div>
                ) : (
                  <input className="in" inputMode="decimal" value={String(workingFee)} onChange={e => upd("_feeAmount", e.target.value)} />
                )}
              </div>
              {/* Status */}
              <div className="cell">
                {!editing ? (
                  <span className="val">{r.active ? "Enabled" : "Disabled"}</span>
                ) : (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={!!workingActive} onChange={e => upd("_active", e.target.checked)} />
                    <span className="muted">{workingActive ? "Enabled" : "Disabled"}</span>
                  </label>
                )}
              </div>
              {/* Actions */}
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
          Tip: Set a global free-shipping threshold with the key <code>shipping.free_threshold</code> in general settings.
          Partner-specific rules are matched first; if none found, falls back to the no-partner rules.
        </p>
      </div>
    </section>
  );
}

const css = `
.dfr-block{
  margin-bottom:24px; color:${PRIMARY};
  background:#fff; border-radius:20px;
  border:1px solid rgba(0,0,0,.08);
  box-shadow:0 8px 32px rgba(0,0,0,.06);
  overflow:hidden;
}
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
.dfr-body.card{ padding:0; border:none; box-shadow:none; }
.trow{
  display:grid; align-items:center;
  padding:14px 24px;
  border-bottom:1px solid rgba(0,0,0,.06);
  transition: all .15s ease;
}
.trow:last-child{ border-bottom:none; }
.trow:hover:not(.thead){ background:linear-gradient(90deg, rgba(240,93,139,.02), rgba(246,195,32,.02)); }
.trow.thead{
  font-weight:900; text-transform:uppercase; letter-spacing:.8px; font-size:11px;
  background:#fafafa; border-bottom:1px solid rgba(0,0,0,.08); color:rgba(0,0,0,.6);
}
.trow.thead, .trow.tgrid{
  gap:12px;
  grid-template-columns: 160px 110px 1fr 110px 100px 160px;
}
.cell{ min-width:0; }
.lbl{
  font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px;
  opacity:.7; margin-bottom:6px; display:block;
}
.in{
  height:40px; width:100%;
  border:1px solid rgba(0,0,0,.12); border-radius:10px;
  padding:0 12px; background:#fff; outline:none;
  font-size:14px; transition: all .12s ease;
}
.in:focus{ border-color:#F05D8B; box-shadow:0 0 0 3px rgba(240,93,139,.1); }
.in:disabled{ background:#f9f9f9; cursor:not-allowed; opacity:.8; }
.val{ font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2B2E2A; }
.partner-val{ color:#4A4F41; font-size:13px; }
.ghost{
  height:34px; padding:0 14px; border-radius:10px;
  border:1px solid rgba(0,0,0,.12); background:#fff;
  cursor:pointer; font-weight:700; font-size:13px;
  display:inline-flex; align-items:center; justify-content:center;
  transition: all .12s ease;
}
.ghost:hover{ background:#fafafa; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.06); }
.ghost.ok{
  background:linear-gradient(135deg, #0f5132, #1a7d4e); color:#fff; border:none;
  box-shadow:0 4px 12px rgba(15,81,50,.2);
}
.ghost.ok:hover{ background:linear-gradient(135deg, #146c43, #22a566); box-shadow:0 6px 16px rgba(15,81,50,.3); }
.ghost.bad{ color:#b00020; border-color:rgba(176,0,32,.2); }
.ghost.bad:hover{ background:#fff5f5; border-color:#b00020; }
.ghost.sm{ height:32px; padding:0 12px; font-size:12px; }
.toast{
  padding:12px 18px; border-radius:12px; color:#fff;
  font-weight:600; font-size:14px;
  box-shadow:0 8px 24px rgba(0,0,0,.15);
  animation: fadeIn .2s ease-out;
}
.toast.ok{ background:linear-gradient(135deg, #0f5132, #1a7d4e); }
.toast.bad{ background:linear-gradient(135deg, #842029, #a52a33); }
@keyframes fadeIn{ from{ opacity:0; transform:translateY(4px); } to{ opacity:1; transform:translateY(0); } }
@media (max-width: 1100px){
  .trow.thead, .trow.tgrid{ grid-template-columns: 130px 90px 1fr 100px 90px 140px; gap:10px; }
}
@media (max-width: 800px){
  .trow{ display:flex; flex-direction:column; align-items:stretch; gap:12px; padding:16px; }
  .trow.thead{ display:none; }
  .cell{ width:100%; }
  .in{ height:44px; }
  .ghost{ width:100%; height:40px; }
}
`;
