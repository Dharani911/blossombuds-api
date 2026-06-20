// src/pages/ProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom"; // ⬅️ added useLocation
import http from "../api/http";
import { useAuth } from "../app/AuthProvider";
import AccountCard from "../components/profile/AccountCard";
import AddressesCard from "../components/profile/AddressesCard";
import OrdersSection from "../components/profile/OrdersSection";
import { ToastHost, useToasts } from "../components/profile/Toast";
import AddressModal from "../components/profile/AddressModal";
import ProfileHero from "../components/profile/ProfileHero";
import type { Customer, Address, OrderLite } from "../types/profile";
import {
  getAllStates,
  getAllDistricts,
  getCountries,
  type State,
  type District,
  type Country,
} from "../api/geo";
import { getCommunicationPreference, saveCommunicationPreference } from "../api/customers";

export default function ProfilePage() {
  const { user, logout, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation(); // ⬅️ needed to build ?next=
  const toasts = useToasts();
  const DEFAULT_INDIA_ID = Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 1;

  // ---------- Auth guard with "next" ----------
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      // preserve exact target (e.g., /profile?code=250023&pid=1&itemId=2)
      const next = `${location.pathname}${location.search || ""}`;
      nav(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, location.pathname, location.search]);

  const [cust, setCust] = useState<Customer | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [orders, setOrders] = useState<OrderLite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // lookup maps
  const [stateMap, setStateMap] = useState<Record<number, string>>({});
  const [districtMap, setDistrictMap] = useState<Record<number, string>>({});
  const [countryMap, setCountryMap] = useState<Record<number, string>>({});

  // account edit state
  const [editingAcc, setEditingAcc] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingAcc, setSavingAcc] = useState(false);

  // address modal state
  const [addrModal, setAddrModal] = useState<null | { mode: "add" | "edit"; data?: Address }>(null);
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrErr, setAddrErr] = useState<string | null>(null);

  // communication preferences state
  const [waOptedIn, setWaOptedIn] = useState(false);
  const [smsOptedIn, setSmsOptedIn] = useState(false);
  const [commPrefToggling, setCommPrefToggling] = useState(false);

  // load lookups once (states, districts, countries)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [states, dists, countries] = await Promise.all([
          getAllStates(),
          getAllDistricts(),
          getCountries(),
        ]);
        if (!alive) return;

        const sm: Record<number, string> = {};
        const dm: Record<number, string> = {};
        const cm: Record<number, string> = {};

        (states || []).forEach((s: State) => { if (s?.id != null) sm[s.id] = s.name || String(s.id); });
        (dists || []).forEach((d: District) => { if (d?.id != null) dm[d.id] = d.name || String(d.id); });
        (countries || []).forEach((c: Country) => { if (c?.id != null) cm[c.id] = c.name || String(c.id); });

        setStateMap(sm);
        setDistrictMap(dm);
        setCountryMap(cm);
      } catch {
        // silent fallback
      }
    })();
    return () => { alive = false; };
  }, []);

  const stateNameById = (id?: number) => (id && stateMap[id]) || "";
  const districtNameById = (id?: number) => (id && districtMap[id]) || "";
  const countryNameById = (id?: number) => (id && countryMap[id]) || "";

  // load profile data
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user?.id) return;
      setLoading(true); setErr(null);
      try {
        const [c, a, o, waPref] = await Promise.all([
          http.get<Customer>(`/api/customers/${user.id}`),
          http.get<Address[]>(`/api/customers/${user.id}/addresses`),
          http.get<OrderLite[]>(`/api/orders/by-customer/${user.id}`),
          getCommunicationPreference(Number(user.id)).catch(() => null),
        ]);
        if (!alive) return;
        setCust(c.data || null);
        setFullName(c.data?.name || "");
        setPhone(c.data?.phone || "");
        setAddresses(a.data || []);
        setOrders(o.data || []);
        setWaOptedIn(waPref?.whatsappOptedIn ?? false);
        setSmsOptedIn(waPref?.smsOptedIn ?? false);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.response?.data?.message || "Could not load your profile data.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [user?.id]);

  const initials = useMemo(() => {
    // Backend may return the field as `name` or `fullName`; check both
    const src = cust?.fullName || (cust as any)?.name || cust?.email || "";
    const bits = src.split(" ").filter(Boolean);
    return (bits[0]?.[0] || "") + (bits[1]?.[0] || "");
  }, [cust]);

  const onLogout = async () => {
    try { await http.post("/api/auth/logout"); } catch { }
    logout();
  };

  async function saveAccount() {
    if (!cust?.id) return;
    setSavingAcc(true);

    // keep current name in case the GET response doesn’t include one
    const prevName = fullName;

    try {
      // Send all plausible field names so the backend binds one of them.
      await http.patch(`/api/customers/${cust.id}`, {
        fullName: fullName,
        fullname: fullName,
        name: fullName,
        phone: phone,
      });

      // Refetch to confirm what was persisted
      const { data: fresh } = await http.get(`/api/customers/${cust.id}`);

      // Resolve the best display name; if none returned, keep previous
      const nextName =
        fresh?.fullName ??
        fresh?.fullname ??
        fresh?.name ??
        prevName;

      setCust(fresh ? { ...fresh, fullName: nextName } : cust);
      setFullName(nextName);
      setPhone(fresh?.phone ?? phone);
      setEditingAcc(false);
      toasts.push("Profile updated", "ok");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Could not save changes.";
      toasts.push(msg, "bad");
    } finally {
      setSavingAcc(false);
    }
  }

  async function toggleChannel(channel: "whatsapp" | "sms", currentValue: boolean) {
    if (!cust?.id || commPrefToggling) return;
    const custPhone = phone || cust?.phone || "";
    if (!currentValue && !custPhone) {
      toasts.push("Add a phone number to your profile first.", "bad");
      return;
    }
    setCommPrefToggling(true);
    try {
      const newValue = !currentValue;
      const payload: { phone?: string; whatsappOptedIn?: boolean; smsOptedIn?: boolean; source: string } = {
        source: "PROFILE",
        // Always send phone so the backend can identify the preference record on opt-out too
        phone: custPhone || undefined,
      };
      if (channel === "whatsapp") payload.whatsappOptedIn = newValue;
      else payload.smsOptedIn = newValue;

      await saveCommunicationPreference(cust.id, payload);

      if (channel === "whatsapp") {
        setWaOptedIn(newValue);
        toasts.push(newValue ? "WhatsApp notifications turned on!" : "WhatsApp notifications turned off.", "ok");
      } else {
        setSmsOptedIn(newValue);
        toasts.push(newValue ? "SMS notifications turned on!" : "SMS notifications turned off.", "ok");
      }
    } catch {
      toasts.push("Could not update preference.", "bad");
    } finally {
      setCommPrefToggling(false);
    }
  }

  function openAddAddress() {
    setAddrErr(null);
    setAddrModal({
      mode: "add",
      data: {
        name: "",
        phone: "",
        line1: "",
        line2: "",
        pincode: "",
        stateId: "",
        districtId: "",
      } as unknown as Address
    });
  }

  function pickIds(a: any) {
    const stateId =
      typeof a?.stateId === "number" ? a.stateId :
        typeof a?.stateId === "string" ? Number(a.stateId) :
          typeof a?.state?.id === "number" ? a.state.id :
            typeof a?.state?.id === "string" ? Number(a.state.id) : undefined;

    const districtId =
      typeof a?.districtId === "number" ? a.districtId :
        typeof a?.districtId === "string" ? Number(a.districtId) :
          typeof a?.district?.id === "number" ? a.district.id :
            typeof a?.district?.id === "string" ? Number(a.district.id) : undefined;

    return { stateId, districtId };
  }

  function openEditAddress(a: Address) {
    setAddrErr(null);
    const ids = pickIds(a);
    setAddrModal({
      mode: "edit",
      data: { ...a, ...ids } as any,
    });
  }

  async function submitAddress(dto: import("../components/profile/AddressModal").AddressDtoOut) {
    if (!cust?.id) return;
    setAddrBusy(true); setAddrErr(null);

    const countryId = dto.countryId ?? DEFAULT_INDIA_ID;

    try {
      if (addrModal?.mode === "add") {
        const { data: created } = await http.post(`/api/customers/${cust.id}/addresses`, {
          customerId: Number(cust.id),
          name: dto.name,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2,
          stateId: dto.stateId,
          districtId: dto.districtId,
          pincode: dto.pincode,
          countryId,
          isDefault: dto.isDefault ?? false,
          active: true,
        });
        setAddresses(prev => ([...(prev || []), created]));
        toasts.push("Address added", "ok");
      } else if (addrModal?.mode === "edit" && dto.id) {
        const { data: updated } = await http.patch(`/api/customers/addresses/${dto.id}`, {
          customerId: Number(cust.id),
          name: dto.name,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2,
          stateId: dto.stateId,
          districtId: dto.districtId,
          pincode: dto.pincode,
          countryId,
          isDefault: dto.isDefault ?? false,
          active: true,
        });
        setAddresses(prev => (prev || []).map(a => (a.id === updated.id ? updated : a)));
        toasts.push("Address updated", "ok");
      }
      setAddrModal(null);
    } catch (e: any) {
      setAddrErr(e?.response?.data?.message || "Could not save address.");
    } finally {
      setAddrBusy(false);
    }
  }

  async function setDefaultAddress(id: number) {
    try {
      await http.post(`/api/customers/addresses/${id}/set-default`);
      setAddresses(prev => (prev || []).map(a => ({ ...a, isDefault: a.id === id })));
      toasts.push("Default address updated", "ok");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Could not set default address.";
      toasts.push(msg, "bad");
    }
  }

  async function deleteAddress(id: number) {
    if (!id) return;
    const ok = window.confirm("Delete this address?");
    if (!ok) return;
    try {
      await http.delete(`/api/customers/addresses/${id}`);
      setAddresses(prev => (prev || []).filter(a => a.id !== id));
      toasts.push("Address deleted", "ok");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Could not delete address.";
      toasts.push(msg, "bad");
    }
  }

  const ordersCount = orders?.length ?? 0;
  const safeAddresses = useMemo(() => (Array.isArray(addresses) ? addresses : []), [addresses]);

  return (
    <div className="pro2-wrap">
      <style>{pageStyles}</style>

      <ProfileHero
        initials={(initials || "BB").slice(0, 2).toUpperCase()}
        fullName={cust?.name || "Your profile"}
        ordersCount={ordersCount}
        onLogout={onLogout}
      />

      {/* MAIN */}
      <section className="pro2-main">
        {err && <div className="alert bad">{err}</div>}

        <div className="grid">
          <div className="col">
            <AccountCard
              loading={loading}
              editing={editingAcc}
              setEditing={setEditingAcc}
              fullName={fullName}
              setFullName={setFullName}
              email={cust?.email || ""}
              phone={phone}
              setPhone={setPhone}
              onSave={saveAccount}
              saving={savingAcc}
              isGoogleUser={!!cust?.googleSubject}
            />

            <AddressesCard
              loading={!addresses}
              addresses={safeAddresses}
              onAdd={openAddAddress}
              onEdit={openEditAddress}
              onSetDefault={setDefaultAddress}
              onDelete={deleteAddress}
              stateNameById={stateNameById}
              districtNameById={districtNameById}
              countryNameById={countryNameById}
            />

            {/* Marketing notification preferences */}
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Notification Preferences</div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
                Choose how you'd like to receive offers, new arrivals and festive deals.
              </div>

              {/* WhatsApp row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>WhatsApp</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                    {waOptedIn ? "Currently receiving updates on WhatsApp." : "Not opted in."}
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel("whatsapp", waOptedIn)}
                  disabled={commPrefToggling || loading}
                  style={{
                    flexShrink: 0,
                    padding: "5px 16px",
                    borderRadius: 20,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: commPrefToggling || loading ? "not-allowed" : "pointer",
                    opacity: commPrefToggling || loading ? 0.6 : 1,
                    background: waOptedIn ? "#e8f5e9" : "#F05D8B",
                    color: waOptedIn ? "#2e7d32" : "#fff",
                    transition: "background .2s, opacity .2s",
                  }}
                >
                  {commPrefToggling ? "…" : waOptedIn ? "Turn Off" : "Turn On"}
                </button>
              </div>

              {/* SMS row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>SMS</div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                    {smsOptedIn ? "Currently receiving updates via SMS." : "Not opted in."}
                  </div>
                </div>
                <button
                  onClick={() => toggleChannel("sms", smsOptedIn)}
                  disabled={commPrefToggling || loading}
                  style={{
                    flexShrink: 0,
                    padding: "5px 16px",
                    borderRadius: 20,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: commPrefToggling || loading ? "not-allowed" : "pointer",
                    opacity: commPrefToggling || loading ? 0.6 : 1,
                    background: smsOptedIn ? "#e8f5e9" : "#F05D8B",
                    color: smsOptedIn ? "#2e7d32" : "#fff",
                    transition: "background .2s, opacity .2s",
                  }}
                >
                  {commPrefToggling ? "…" : smsOptedIn ? "Turn Off" : "Turn On"}
                </button>
              </div>
            </div>
          </div>

          <div className="col">
            {/* ⬇️ Orders UI (auto-opens drawer via ?code=&pid=&itemId=) */}
            <OrdersSection orders={orders || []} />
            <div className="card promo">
              <div className="promo-inner">
                <h4>Looking for something bespoke?</h4>
                <p>Share your idea, we’ll make it bloom beautifully.</p>
                <Link to="/" className="cta">Start a custom order</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {addrModal && (
        <AddressModal
          initial={addrModal.data}
          busy={addrBusy}
          error={addrErr}
          onClose={() => setAddrModal(null)}
          onSubmit={submitAddress}
          mode={addrModal.mode}
        />
      )}

      <ToastHost items={toasts.items} />
    </div>
  );
}

/* page-level styles (responsive width + small padding on mobile) */
const pageStyles = `
.pro2-wrap { background: var(--bb-bg); color: var(--bb-primary); }

/* Desktop / wide */
.pro2-main{
  max-width: 1200px;
  margin: 20px auto 30px;
  padding: 0 16px; /* base gutter */
}

.alert{
  margin: 0 0 14px;
  padding: 10px 12px;
  border:1px solid rgba(240,93,139,.25);
  border-radius: 12px;
  background:#fff3f5;
  color:#b0003a;
}

/* 2-col layout on wide screens */
.grid{
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 18px;
  align-items: start;
}
.col{ display:grid; gap: 18px; }

.card{
  position:relative;
  border-radius:18px;
  overflow:hidden;
  background:#fff;
  border:1px solid rgba(0,0,0,.06);
  box-shadow: 0 18px 60px rgba(0,0,0,.10);
}

/* Promo card */
.card.promo{
  background: linear-gradient(135deg, rgba(246,195,32,.12), rgba(240,93,139,.10));
  border: 1px solid rgba(0,0,0,.06);
}
.promo .promo-inner{ padding: 16px; }
.promo h4{ margin: 0 0 6px; font-family: "DM Serif Display", Georgia, serif; }
.promo p{ margin: 0 0 12px; opacity:.95; }
.cta{
  display:inline-flex; align-items:center; justify-content:center;
  height: 40px; padding: 0 14px; border-radius: 12px;
  background: var(--bb-accent); color:#fff; font-weight: 900;
  box-shadow: 0 12px 32px rgba(240,93,139,.34);
}

/* ---------- Mobile: full-width cards with small gutters ---------- */
@media (max-width: 860px){
  .pro2-main{
    max-width: none;            /* stretch */
    margin: 10px 0 20px;        /* remove fixed centering margins */
    padding: 0 5px;            /* small side padding */
  }

  .grid{
    grid-template-columns: 1fr; /* single column */
    gap: 14px;
  }
  .col{ gap: 14px; }

  .card{
    border-radius: 16px;
    width: 100%;
  }

  .promo .promo-inner{ padding: 14px; }
}

/* Extra-small phones: a touch tighter */
@media (max-width: 420px){
  .pro2-main{ padding: 0 10px; }
  .card{ border-radius: 14px; }
}
`;
