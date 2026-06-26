import React, { useCallback, useEffect, useState } from "react";
import {
  listRegions,
  createRegion,
  renameRegion,
  deleteRegion,
  setRegionStates,
  getAllowlistForState,
  addAllowlistEntry,
  removeAllowlistEntry,
  type DeliveryRegion,
} from "../../api/adminDeliveryRegions";
import { listPartners, type DeliveryPartner } from "../../api/adminDeliveryPartners";
import { getAllStates, getCountries, getStatesByCountry, type State, type Country } from "../../api/geo";

const PRIMARY = "#4A4F41";

export default function AdminDeliveryRegions() {
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // Regions panel state
  const [newRegionName, setNewRegionName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Allowlist panel state
  const [allowlistStateId, setAllowlistStateId] = useState<number | "">("");
  const [allowedPartnerIds, setAllowedPartnerIds] = useState<number[]>([]);
  const [allowlistLoading, setAllowlistLoading] = useState(false);

  const showToast = (kind: "ok" | "bad", msg: string) => setToast({ kind, msg });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [regs, allPartners] = await Promise.all([listRegions(), listPartners()]);
        if (!alive) return;
        setRegions(regs);
        setPartners(allPartners);

        // Load states — try India first
        try {
          const fromEnv = Number((import.meta as any)?.env?.VITE_COUNTRY_ID_INDIA || 0);
          if (fromEnv > 0) {
            const st = await getStatesByCountry(fromEnv);
            if (st?.length && alive) { setStates(st); return; }
          }
          const countries: Country[] = await getCountries().catch(() => []);
          const india = countries.find(c => (c.isoCode || "").toUpperCase() === "IN")
            || countries.find(c => /india/i.test(c.name || ""));
          if (india?.id) {
            const st = await getStatesByCountry(india.id).catch(() => [] as State[]);
            if (st?.length && alive) { setStates(st); return; }
          }
          const all = await getAllStates().catch(() => [] as State[]);
          if (alive) setStates(all || []);
        } catch { /* states unavailable */ }
      } catch (e: any) {
        if (alive) showToast("bad", e?.message || "Could not load regions.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const stateName = useCallback(
    (id: number) => states.find(s => s.id === id)?.name || `State #${id}`,
    [states]
  );

  // ── Regions CRUD ──────────────────────────────────────────────────────────

  async function handleCreateRegion() {
    if (!newRegionName.trim()) return;
    setSaving(s => ({ ...s, newRegion: true }));
    try {
      const r = await createRegion(newRegionName.trim());
      setRegions(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRegionName("");
      showToast("ok", `Region "${r.name}" created.`);
    } catch (e: any) {
      showToast("bad", e?.response?.data?.message || e?.message || "Create failed.");
    } finally {
      setSaving(s => ({ ...s, newRegion: false }));
    }
  }

  async function handleRename(id: number) {
    if (!editingName.trim()) return;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      const r = await renameRegion(id, editingName.trim());
      setRegions(prev => prev.map(x => x.id === id ? r : x).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      showToast("ok", "Region renamed.");
    } catch (e: any) {
      showToast("bad", e?.response?.data?.message || e?.message || "Rename failed.");
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete region "${name}"? Any fee rules scoped to it will lose their region target.`)) return;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await deleteRegion(id);
      setRegions(prev => prev.filter(x => x.id !== id));
      showToast("ok", "Region deleted.");
    } catch (e: any) {
      showToast("bad", e?.response?.data?.message || e?.message || "Delete failed.");
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  }

  function toggleStateInRegion(region: DeliveryRegion, stateId: number) {
    const has = region.stateIds.includes(stateId);
    const next = has
      ? region.stateIds.filter(id => id !== stateId)
      : [...region.stateIds, stateId];
    handleSetStates(region.id, next);
  }

  async function handleSetStates(regionId: number, stateIds: number[]) {
    setSaving(s => ({ ...s, [`states-${regionId}`]: true }));
    try {
      const r = await setRegionStates(regionId, stateIds);
      setRegions(prev => prev.map(x => x.id === regionId ? r : x));
    } catch (e: any) {
      showToast("bad", e?.message || "Failed to update states.");
    } finally {
      setSaving(s => ({ ...s, [`states-${regionId}`]: false }));
    }
  }

  // ── Allowlist ─────────────────────────────────────────────────────────────

  async function loadAllowlist(stateId: number) {
    setAllowlistLoading(true);
    try {
      const entries = await getAllowlistForState(stateId);
      setAllowedPartnerIds(entries.map(e => e.id.deliveryPartnerId));
    } catch {
      setAllowedPartnerIds([]);
    } finally {
      setAllowlistLoading(false);
    }
  }

  function handleAllowlistStateChange(val: string) {
    const id = val ? Number(val) : "";
    setAllowlistStateId(id);
    setAllowedPartnerIds([]);
    if (id) loadAllowlist(id as number);
  }

  async function toggleAllowlistPartner(partnerId: number) {
    if (!allowlistStateId) return;
    const sid = allowlistStateId as number;
    const isAllowed = allowedPartnerIds.includes(partnerId);
    try {
      if (isAllowed) {
        await removeAllowlistEntry(sid, partnerId);
        setAllowedPartnerIds(prev => prev.filter(id => id !== partnerId));
      } else {
        await addAllowlistEntry(sid, partnerId);
        setAllowedPartnerIds(prev => [...prev, partnerId]);
      }
    } catch (e: any) {
      showToast("bad", e?.message || "Allowlist update failed.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section style={{ marginBottom: 24, color: PRIMARY }}>
      <style>{css}</style>

      {toast && (
        <div className={"dr-toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      {/* ── Regions panel ── */}
      <div className="dr-card">
        <div className="dr-header">
          <h3 className="dr-title">
            <span style={{ fontSize: 22, marginRight: 10, WebkitTextFillColor: "initial" }}>🗺️</span>
            Delivery Regions
          </h3>
          <p className="dr-subtitle">
            Group states into regions (e.g. <strong>South India</strong>, <strong>North India</strong>) to set a single fee for multiple states at once.
          </p>
        </div>

        <div className="dr-body">
          {/* Add new region */}
          <div className="dr-add-row">
            <input
              className="dr-input"
              placeholder="New region name (e.g. South India)…"
              value={newRegionName}
              onChange={e => setNewRegionName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateRegion()}
            />
            <button
              className="dr-btn ok"
              onClick={handleCreateRegion}
              disabled={!newRegionName.trim() || saving["newRegion"]}
            >
              {saving["newRegion"] ? "Adding…" : "+ Add Region"}
            </button>
          </div>

          {loading && <div className="dr-empty">Loading…</div>}
          {!loading && regions.length === 0 && (
            <div className="dr-empty">No regions yet. Create one above.</div>
          )}

          {/* Region list */}
          {!loading && regions.map(region => {
            const isExpanded = expandedId === region.id;
            const isEditing = editingId === region.id;

            return (
              <div key={region.id} className="dr-region-row">
                {/* Region header */}
                <div className="dr-region-hd">
                  {isEditing ? (
                    <input
                      className="dr-input flex-1"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleRename(region.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="dr-region-name"
                      onClick={() => setExpandedId(isExpanded ? null : region.id)}
                    >
                      <span className="dr-chevron">{isExpanded ? "▾" : "▸"}</span>
                      {region.name}
                      <span className="dr-badge">{region.stateIds?.length ?? 0} states</span>
                    </button>
                  )}

                  <div className="dr-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="dr-btn ok sm"
                          onClick={() => handleRename(region.id)}
                          disabled={saving[region.id]}
                        >
                          {saving[region.id] ? "…" : "Save"}
                        </button>
                        <button className="dr-btn sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="dr-btn sm"
                          onClick={() => { setEditingId(region.id); setEditingName(region.name); }}
                        >
                          Rename
                        </button>
                        <button
                          className="dr-btn bad sm"
                          onClick={() => handleDelete(region.id, region.name)}
                          disabled={saving[region.id]}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded: state picker */}
                {isExpanded && (
                  <div className="dr-states-panel">
                    <p className="dr-states-hint">
                      Toggle states to add or remove them from this region.
                      {saving[`states-${region.id}`] && <span className="dr-saving"> Saving…</span>}
                    </p>
                    <div className="dr-states-grid">
                      {states.length === 0 && <span className="dr-muted">States not loaded.</span>}
                      {states.map(s => {
                        const included = (region.stateIds || []).includes(s.id);
                        return (
                          <label key={s.id} className={"dr-state-chip" + (included ? " active" : "")}>
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={() => toggleStateInRegion(region, s.id)}
                              style={{ display: "none" }}
                            />
                            {s.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── State Partner Allowlist panel ── */}
      <div className="dr-card" style={{ marginTop: 20 }}>
        <div className="dr-header">
          <h3 className="dr-title">
            <span style={{ fontSize: 22, marginRight: 10, WebkitTextFillColor: "initial" }}>🔒</span>
            State Partner Allowlist
          </h3>
          <p className="dr-subtitle">
            Restrict which delivery partners customers can choose for a specific state.
            States with <strong>no restrictions</strong> show all active partners.
          </p>
        </div>

        <div className="dr-body">
          <div className="dr-add-row" style={{ marginBottom: allowlistStateId ? 16 : 0 }}>
            <select
              className="dr-input"
              value={allowlistStateId}
              onChange={e => handleAllowlistStateChange(e.target.value)}
            >
              <option value="">Select a state to manage…</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {allowlistStateId && (
            <div className="dr-allowlist-panel">
              {allowlistLoading ? (
                <div className="dr-empty">Loading…</div>
              ) : (
                <>
                  <p className="dr-states-hint">
                    {allowedPartnerIds.length === 0
                      ? "No restrictions — all partners are visible for this state."
                      : `${allowedPartnerIds.length} partner(s) allowed. Others are hidden at checkout.`}
                  </p>
                  <div className="dr-partner-list">
                    {partners.length === 0 && <span className="dr-muted">No partners found.</span>}
                    {partners.map(p => {
                      const isAllowed = allowedPartnerIds.includes(p.id!);
                      return (
                        <label key={p.id} className={"dr-partner-chip" + (isAllowed ? " active" : "")}>
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => toggleAllowlistPartner(p.id!)}
                            style={{ display: "none" }}
                          />
                          <span className="dr-partner-icon">{isAllowed ? "✓" : "+"}</span>
                          <span>
                            <strong>{p.name}</strong>
                            {p.code && <span className="dr-code"> ({p.code})</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="dr-muted" style={{ marginTop: 8 }}>
                    Tip: If you check even one partner here, <em>only</em> checked partners will be shown for{" "}
                    {stateName(allowlistStateId as number)}. Uncheck all to remove all restrictions.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const css = `
/* ── Card ── */
.dr-card {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 8px 32px rgba(0,0,0,.06);
  overflow: hidden;
}

/* ── Header ── */
.dr-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 24px 16px;
  background: linear-gradient(180deg, rgba(75,224,176,.08), #fff);
  border-bottom: 1px solid rgba(0,0,0,.07);
  position: relative;
}
.dr-header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #4BE0B0, #F6C320, #F05D8B);
}
.dr-title {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: .3px;
  background: linear-gradient(135deg, #4BE0B0, #F6C320);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
}
.dr-subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(43,46,42,.72);
}
.dr-subtitle strong { color: #2B2E2A; }

/* ── Body ── */
.dr-body {
  padding: 16px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Add row ── */
.dr-add-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.dr-input {
  flex: 1;
  height: 40px;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: all .12s;
  background: #fff;
}
.dr-input:focus { border-color: #4BE0B0; box-shadow: 0 0 0 3px rgba(75,224,176,.12); }
.flex-1 { flex: 1; }

/* ── Buttons ── */
.dr-btn {
  height: 40px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,.12);
  background: #fff;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  transition: all .12s;
}
.dr-btn:hover:not(:disabled) {
  background: #fafafa;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,.06);
}
.dr-btn:disabled { opacity: .5; cursor: not-allowed; }
.dr-btn.sm { height: 32px; padding: 0 12px; font-size: 12px; }
.dr-btn.ok {
  background: linear-gradient(135deg, #0f5132, #1a7d4e);
  color: #fff;
  border: none;
  box-shadow: 0 4px 12px rgba(15,81,50,.2);
}
.dr-btn.ok:hover:not(:disabled) {
  background: linear-gradient(135deg, #146c43, #22a566);
  box-shadow: 0 6px 16px rgba(15,81,50,.3);
}
.dr-btn.bad { color: #b00020; border-color: rgba(176,0,32,.2); }
.dr-btn.bad:hover:not(:disabled) { background: #fff5f5; border-color: #b00020; }

/* ── Region rows ── */
.dr-region-row {
  border: 1px solid rgba(0,0,0,.07);
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: box-shadow .15s;
}
.dr-region-row:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); }

.dr-region-hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fafafa;
}
.dr-region-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  color: #2B2E2A;
  text-align: left;
  padding: 4px 0;
}
.dr-region-name:hover { color: #4BE0B0; }
.dr-chevron { font-size: 12px; opacity: .6; }
.dr-badge {
  font-size: 11px;
  font-weight: 700;
  background: rgba(75,224,176,.15);
  color: #0f7d5e;
  border-radius: 20px;
  padding: 2px 8px;
}
.dr-actions { display: flex; gap: 6px; }

/* ── States grid ── */
.dr-states-panel {
  padding: 12px 14px 14px;
  border-top: 1px solid rgba(0,0,0,.06);
  background: #fff;
}
.dr-states-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(43,46,42,.6);
}
.dr-saving { color: #F6C320; font-weight: 700; }
.dr-states-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dr-state-chip {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid rgba(0,0,0,.12);
  background: #fff;
  color: #4A4F41;
  transition: all .1s;
  user-select: none;
}
.dr-state-chip.active {
  background: linear-gradient(135deg, #4BE0B0, #22d3a0);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(75,224,176,.3);
}
.dr-state-chip:hover { transform: translateY(-1px); }

/* ── Allowlist panel ── */
.dr-allowlist-panel { margin-top: 4px; }
.dr-partner-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.dr-partner-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(0,0,0,.10);
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  color: #2B2E2A;
  transition: all .12s;
  user-select: none;
}
.dr-partner-chip.active {
  background: linear-gradient(135deg, rgba(240,93,139,.06), rgba(246,195,32,.06));
  border-color: #F05D8B;
}
.dr-partner-chip:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,.07); }
.dr-partner-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 900;
  flex-shrink: 0;
  background: rgba(0,0,0,.06);
  color: #555;
}
.dr-partner-chip.active .dr-partner-icon {
  background: linear-gradient(135deg, #F05D8B, #F6C320);
  color: #fff;
}
.dr-code { opacity: .6; font-weight: 500; font-size: 13px; }

/* ── Misc ── */
.dr-empty { padding: 24px; text-align: center; color: rgba(43,46,42,.5); font-size: 14px; }
.dr-muted { font-size: 12px; color: rgba(43,46,42,.6); margin: 0; }

/* ── Toast ── */
.dr-toast {
  padding: 12px 18px;
  border-radius: 12px;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  animation: drFadeIn .2s ease-out forwards;
  margin-bottom: 12px;
}
.dr-toast.ok { background: linear-gradient(135deg, #0f5132, #1a7d4e); }
.dr-toast.bad { background: linear-gradient(135deg, #842029, #a52a33); }
@keyframes drFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 720px) {
  .dr-add-row { flex-direction: column; }
  .dr-btn { width: 100%; }
  .dr-region-hd { flex-wrap: wrap; }
}
`;
