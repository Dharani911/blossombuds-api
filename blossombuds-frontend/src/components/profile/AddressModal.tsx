import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import {
  getAllStates,
  getDistrictsByState,
  getCountries,
  type State,
  type District,
  type Country,
} from "../../api/geo";

export type AddressDtoOut = {
  id?: number;
  customerId?: number;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  stateId: number;
  districtId: number;
  pincode: string;
  countryId?: number;
  isDefault?: boolean;
  active?: boolean;
};

const DEFAULT_INDIA_ID = Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 1;

export default function AddressModal({
  initial,
  busy,
  error,
  onClose,
  onSubmit,
  mode,
}: {
  initial?: Partial<AddressDtoOut & { stateName?: string; districtName?: string }>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (dto: AddressDtoOut) => void;
  mode: "add" | "edit";
}) {
  useLockBodyScroll(true);

  // Basic fields
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [line1, setLine1] = useState(initial?.line1 || "");
  const [line2, setLine2] = useState(initial?.line2 || "");
  const [pincode, setPincode] = useState(initial?.pincode || "");
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);

  // Countries (to set India id reliably)
  const [indiaId, setIndiaId] = useState<number | null>(null);

  // Location selects — IMPORTANT: coerce to numbers if present
  const [states, setStates] = useState<State[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [stateId, setStateId] = useState<number | "">(
    typeof initial?.stateId === "number"
      ? initial!.stateId
      : initial?.stateId
      ? Number(initial!.stateId)
      : ""
  );
  const [districtId, setDistrictId] = useState<number | "">(
    typeof initial?.districtId === "number"
      ? initial!.districtId
      : initial?.districtId
      ? Number(initial!.districtId)
      : ""
  );
  const [loadingLoc, setLoadingLoc] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // autofocus first field after mount
    firstFieldRef.current?.focus();
  }, []);

  // Esc key closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load countries → pick India id (or fallback)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cs: Country[] = await getCountries();
        if (!alive) return;
        const india = cs?.find((c) => c.name?.toLowerCase() === "india");
        setIndiaId(india ? india.id : DEFAULT_INDIA_ID);
      } catch {
        setIndiaId(DEFAULT_INDIA_ID);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load states once — DO NOT overwrite an existing stateId
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingLoc(true);
      try {
        const ss = await getAllStates();
        if (!alive) return;
        setStates(ss || []);
        // If editing and we had only names, try to match id by name
        if (!stateId && initial?.stateName) {
          const m = ss?.find((s) => s.name?.toLowerCase() === initial.stateName!.toLowerCase());
          if (m) setStateId(m.id);
        }
      } finally {
        if (alive) setLoadingLoc(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load districts whenever stateId changes — preserve an existing districtId if it belongs to this state
  useEffect(() => {
    if (!stateId || typeof stateId !== "number") {
      setDistricts([]);
      setDistrictId("");
      return;
    }
    let alive = true;
    (async () => {
      setLoadingLoc(true);
      try {
        const ds = await getDistrictsByState(stateId);
        if (!alive) return;
        setDistricts(ds || []);
        const initDid =
          typeof initial?.districtId === "number"
            ? initial!.districtId
            : initial?.districtId
            ? Number(initial!.districtId)
            : undefined;
        if (initDid && ds?.some((d) => d.id === initDid)) {
          setDistrictId((prev) => (prev ? prev : initDid));
        } else {
          setDistrictId((prev) => (prev && ds?.some((d) => d.id === prev) ? prev : ""));
        }
      } finally {
        if (alive) setLoadingLoc(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateId]);

  const canSubmit = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      phone.trim().length >= 6 &&
      line1.trim().length >= 3 &&
      pincode.trim().length >= 4 &&
      typeof stateId === "number" &&
      typeof districtId === "number"
    );
  }, [name, phone, line1, pincode, stateId, districtId]);

  function submit() {
    if (!canSubmit) return;
    const resolvedCountryId = indiaId ?? DEFAULT_INDIA_ID;
    onSubmit({
      id: initial?.id,
      name: name.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      line2: line2?.trim() || "",
      stateId: stateId as number,
      districtId: districtId as number,
      pincode: pincode.trim(),
      isDefault,
      active: true,
      countryId: resolvedCountryId,
    });
  }

  return (
    <div className="scrim" onClick={onClose}>
      <style>{styles}</style>
      {/* Stop propagation so clicks inside don’t close */}
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Address form">
        <div className="modal-head">
          <h4>{mode === "add" ? "Add address" : "Edit address"}</h4>
          <button className="icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Form body scrolls; header/footer are sticky */}
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {error && <div className="alert">{error}</div>}

          <div className="grid">
            <Field label="Full name">
              <input
                ref={firstFieldRef}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Receiver's full name"
                autoComplete="name"
                inputMode="text"
                required
              />
            </Field>

            <Field label="Phone">
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                autoComplete="tel"
                inputMode="tel"
                pattern="[0-9+\-\s()]*"
                maxLength={15}
                required
              />
            </Field>

            <Field label="Address line 1">
              <input
                className="input"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="House / Flat / Street"
                autoComplete="address-line1"
                inputMode="text"
                required
              />
            </Field>

            <Field label="Address line 2 (optional)">
              <input
                className="input"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Area / Landmark"
                autoComplete="address-line2"
                inputMode="text"
              />
            </Field>

            <Field label="State">
              <select
                className="select"
                value={stateId}
                onChange={(e) => setStateId(e.target.value ? Number(e.target.value) : "")}
                disabled={loadingLoc || states.length === 0}
                required
              >
                <option value="">
                  {loadingLoc && states.length === 0 ? "Loading…" : "Select state…"}
                </option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="District">
              <select
                className="select"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : "")}
                disabled={!stateId || loadingLoc || districts.length === 0}
                required
              >
                <option value="">
                  {!stateId ? "Select state first…" : loadingLoc ? "Loading…" : "Select district…"}
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Pincode">
              <input
                className="input"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g., 626161"
                autoComplete="postal-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                required
              />
            </Field>

            <label className="check">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>Set as default</span>
            </label>
          </div>

          {/* Submit kept here so Enter works; footer hosts the visible buttons */}
          <button type="submit" style={{ display: "none" }} />
        </form>

        <div className="modal-foot">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" type="button" onClick={submit} disabled={busy || !canSubmit}>
            {busy ? "Saving…" : mode === "add" ? "Add address" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

const styles = `
/* SCRIM locks background; modal is centered (desktop) / bottom-sheet (mobile) */
.scrim{
  position: fixed; inset:0; z-index: 1000;
  background: rgba(0,0,0,.42);
  backdrop-filter: blur(6px);
  display:flex; align-items:center; justify-content:center;
  padding: 12px;
  overflow: hidden;                 /* prevent background scroll bleed */
}

.modal{
  width: min(740px, 96vw);
  max-height: 92vh;
  display: grid;
  grid-template-rows: auto 1fr auto; /* header / scroll-body / footer */
  background:#fff; border:1px solid rgba(0,0,0,.08);
  border-radius: 18px; box-shadow: 0 30px 100px rgba(0,0,0,.32);
  animation: in .18s ease both;
  overflow: hidden;                  /* body section will scroll */
  overscroll-behavior: contain;      /* stop scroll chaining */
}
@supports (height: 100dvh) { .modal{ max-height: 92dvh; } }
@keyframes in{ from{ opacity:0; transform: translateY(8px) scale(.98) } to{ opacity:1; transform:none } }

/* Sticky header & footer */
.modal-head{
  position: sticky; top: 0; z-index: 1;
  display:flex; align-items:center; justify-content:space-between; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.06);
  background:#fff;
}
.modal-foot{
  position: sticky; bottom: 0; z-index: 1;
  padding: 10px 14px 14px; display:flex; gap: 8px; justify-content:flex-end;
  border-top: 1px solid rgba(0,0,0,.06);
  background:#fff;
}

/* The only scrollable area */
.modal-body{
  overflow: auto;
  padding: 12px 14px;
  -webkit-overflow-scrolling: touch;  /* smooth iOS scroll */
  overscroll-behavior: contain;       /* stop rubber-banding background */
}

/* Form layout */
.grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 680px){ .grid{ grid-template-columns: 1fr; } }

/* Controls — mobile keeps >=16px to stop iOS zoom; desktop can be tighter */
.field{ display:flex; flex-direction:column; gap:6px; }
.field > span{ font-weight: 800; font-size: 13px; color: var(--bb-primary); }

.input, .select{
  height: 46px; border-radius: 12px; border:1px solid rgba(0,0,0,.12);
  padding: 0 12px; background:#fff; color: var(--bb-primary);
  font-size: 15px;
}
@media (max-width: 560px), (pointer:coarse){
  .input, .select{ font-size: 16px; }  /* prevent iOS zoom on touch devices */
}

/* Native select chevrons */
.select{
  appearance:none;
  background-image: linear-gradient(45deg, transparent 50%, #888 50%), linear-gradient(135deg, #888 50%, transparent 50%);
  background-position: calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px);
  background-size: 5px 5px, 5px 5px; background-repeat:no-repeat;
}

/* Checkbox row — tighter, aligned, consistent size */
.check{
  display:flex; align-items:center; gap: 8px;
  font-weight:800; margin-top:2px;
}
.check input{
  margin:0;                           /* remove UA margins */
  width: 18px; height: 18px;
  accent-color: var(--bb-accent);
}
@media (min-width: 700px){
  .check input{ width: 16px; height: 16px; } /* feels less “big” on desktop */
}

/* Buttons */
.btn{
  height: 38px; border-radius: 12px; border:none; padding: 0 14px;
  font-weight: 900; cursor:pointer; background: var(--bb-accent); color:#fff;
  box-shadow: 0 14px 34px rgba(240,93,139,.35);
}
.btn.ghost{ background: #fff; color: var(--bb-primary); border:1px solid rgba(0,0,0,.10); box-shadow:none; }

.icon{ width:36px; height:36px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer; }

/* Alerts */
.alert{ padding: 10px 12px; border-radius: 12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); margin-bottom:10px; }

/* Mobile: make it a stable bottom-sheet to avoid “floating” feel */
@media (max-width: 560px){
  .scrim{ align-items: flex-end; }    /* anchor to bottom */
  .modal{
    width: 100%; max-width: none;
    border-radius: 16px 16px 0 0;
    max-height: 92dvh;
  }
}

`;
