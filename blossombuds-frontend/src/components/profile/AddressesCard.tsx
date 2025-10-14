import React from "react";
import { toText } from "../../lib/ui";

export default function AddressesCard({
  loading,
  addresses,
  onAdd,
  onEdit,
  onSetDefault,
  onDelete,
  stateNameById,
  districtNameById,
}: {
  loading: boolean;
  addresses: any[];
  onAdd: () => void;
  onEdit: (a: any) => void;
  onSetDefault: (id: number) => void;
  onDelete: (id: number) => void;               // ✅ NEW
  stateNameById: (id?: number) => string;
  districtNameById: (id?: number) => string;
}) {
  return (
    <div className="card glass">
      <style>{styles}</style>
      <div className="head">
        <h3>Addresses</h3>
        <button className="icon" onClick={onAdd} title="Add">＋</button>
      </div>

      {loading && <div className="skeleton">Loading addresses…</div>}

      {!loading && (addresses?.length ?? 0) === 0 && (
        <div className="empty">
          No addresses yet.
          <div className="muted">Add one now or during checkout to save it here.</div>
        </div>
      )}

      <div className="addr-grid">
        {addresses?.map((a: any) => {
          const name = a.name || [a.firstName, a.lastName].filter(Boolean).join(" ");
          const line1 = a.line1 || "";
          const line2 = a.line2 || "";
          const id = Number(a.id);

          // Prefer ids → map to names; fall back to nested/name strings
          const state =
            typeof a.stateId === "number" ? stateNameById(a.stateId) :
            toText(a.state) || toText(a.stateName) || "";

          const district =
            typeof a.districtId === "number" ? districtNameById(a.districtId) :
            toText(a.district) || toText(a.city) || "";

          const pincode = a.pincode ?? a.postalCode ?? "";
          const phone = a.phone || "";
          const isDefault = Boolean(a.isDefault);

          return (
            <div className="addr" key={id || Math.random()}>
              <div className="in">
                <div className="addr-top">
                  <div className="addr-title">
                    <strong>{name || "—"}</strong>
                    {isDefault && <span className="tag">Default</span>}
                  </div>
                  <div className="addr-actions">
                    {!isDefault && !!id && <button className="chip" onClick={()=>onSetDefault(id)}>Set default</button>}
                    <button className="chip" onClick={()=>onEdit(a)}>Edit</button>
                    {!!id && <button className="chip danger" onClick={()=>onDelete(id)}>Delete</button>}
                  </div>
                </div>
                <div className="addr-body">
                  <div>{[line1, line2].filter(Boolean).join(", ") || "—"}</div>
                  <div>{[district, state, pincode].filter(Boolean).join(", ")}</div>
                  {phone && <div className="addr-phone">📞 {phone}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = `
.card.glass{ background: linear-gradient(180deg, rgba(255,255,255,.86), rgba(255,255,255,.98)); backdrop-filter: saturate(160%) blur(6px); }
.head{ display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.06); }
.icon{ width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(0,0,0,.10); background:#fff; cursor:pointer; }

.addr-grid{ padding: 12px 16px 16px; display:grid; gap: 12px; }
.addr{ position:relative; border-radius: 16px; padding: 1px; background: linear-gradient(135deg, rgba(240,93,139,.35), rgba(246,195,32,.35)); }
.addr > .in{ background: #fff; border-radius: 15px; padding: 12px; }
.addr-top{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.addr-title{ display:flex; align-items:center; gap:8px; }
.addr-actions{ display:flex; gap: 8px; flex-wrap: wrap; }

.chip{ height: 28px; padding: 0 12px; border-radius: 999px; border:1px solid rgba(0,0,0,.12); background:#fff; font-weight: 800; cursor:pointer; }
.chip.danger{ border-color: rgba(176,0,58,.25); color:#b0003a; background:#fff3f5; }
.tag{ display:inline-flex; align-items:center; height: 22px; padding: 0 8px; border-radius: 999px; background: rgba(246,195,32,.24); color: var(--bb-primary); font-weight: 800; font-size: 12px; }

.addr-body{ margin-top: 6px; display:grid; gap:2px; }
.addr-phone{ opacity:.9; }
.empty{ padding: 18px 16px; text-align:center; color: var(--bb-primary); background:#fff; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; margin: 12px; }
.muted{ opacity:.85; }

.skeleton{
  padding: 14px 16px; color: var(--bb-primary); opacity:.9;
  background: linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04));
  background-size: 300% 100%; animation: shimmer 1.1s linear infinite;
}
@keyframes shimmer { 0%{background-position: 0% 0} 100%{background-position: -300% 0} }
`;
