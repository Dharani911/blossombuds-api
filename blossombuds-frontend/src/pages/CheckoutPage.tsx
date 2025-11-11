// src/pages/CheckoutPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { useCart } from "../app/CartProvider";
import http from "../api/http";
import {
  getCountries,
  getStatesByCountry,
  getDistrictsByState,
  getAllDistricts,
  type Country,
  type State,
  type District,
} from "../api/geo";
import {
  startCheckout,
  loadRazorpay,
  getRzpConfig,
  type OrderDto,
  type OrderItemDto,
} from "../api/checkout";

// address helpers (your shared admin client)
import {
  listAddresses,
  addAddress as apiAddAddress,
  updateAddress as apiUpdateAddress,
  setDefaultAddress as apiSetDefaultAddress,
  deleteAddress as apiDeleteAddress,
  type Address as AddrModel,
} from "../api/customers";

// WhatsApp settings hook/utils
import { useWhatsAppNumber, waHrefFor } from "../lib/whatsapp";

/* ---------- Local address type (aligned with backend) ---------- */
type Address = AddrModel & {};

type DeliveryPartnerLite = { id: number; name: string; code?: string; active?: boolean };

function showOrderSuccessPopup(orderId?: number | string) {
  const host = document.createElement("div");
  host.setAttribute("data-ck-toast", "1");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "grid",
    placeItems: "center",
    background: "transparent",
  } as CSSStyleDeclaration);

  const card = document.createElement("div");
  card.setAttribute("role", "alert");
  Object.assign(card.style, {
    pointerEvents: "auto",
    background: "#ffffff",
    border: "1px solid rgba(0,0,0,.10)",
    borderRadius: "16px",
    boxShadow: "0 28px 88px rgba(0,0,0,.28)",
    padding: "16px 18px",
    maxWidth: "92vw",
    minWidth: "min(480px, 92vw)",
    color: "#2b2b2b",
    font: "14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    transform: "translateY(8px) scale(.98)",
    opacity: "0",
    transition: "opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1)",
    position: "relative",
    overflow: "hidden",
  } as CSSStyleDeclaration);

  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "4px",
    background: "#F05D8B", // accent
  } as CSSStyleDeclaration);

  const title = document.createElement("div");
  Object.assign(title.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: "900",
    marginBottom: "6px",
    letterSpacing: ".2px",
    color: "#4A4F41", // primary
  } as CSSStyleDeclaration);
  title.innerHTML = `
    <span style="width:10px;height:10px;border-radius:999px;background:#F6C320;box-shadow:0 0 0 6px rgba(246,195,32,.20);display:inline-block"></span>
    <span>Payment successful 🎉</span>
  `;

  const msg = document.createElement("div");
  Object.assign(msg.style, { fontSize: "13px", opacity: ".9" } as CSSStyleDeclaration);
  msg.textContent = orderId ? `Your order is confirmed. Order ID: #${orderId}` : "Your order is confirmed. We’ve emailed your receipt.";

  const actions = document.createElement("div");
  Object.assign(actions.style, { marginTop: "10px", display: "flex", gap: "8px", justifyContent: "flex-end" } as CSSStyleDeclaration);

  const close = document.createElement("button");
  close.textContent = "Close";
  Object.assign(close.style, {
    border: "1px solid rgba(0,0,0,.12)",
    background: "#fff",
    color: "#4A4F41",
    height: "34px",
    padding: "0 14px",
    fontWeight: "900",
    borderRadius: "12px",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  const primary = document.createElement("button");
  primary.textContent = "Okay";
  Object.assign(primary.style, {
    border: "none",
    background: "#F05D8B",
    color: "#fff",
    height: "34px",
    padding: "0 14px",
    fontWeight: "900",
    borderRadius: "12px",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(240,93,139,.30)",
  } as CSSStyleDeclaration);

  actions.appendChild(close);
  actions.appendChild(primary);
  card.appendChild(bar);
  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(actions);

  host.appendChild(card);
  document.body.appendChild(host);

  requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translateY(0) scale(1)";
  });

  const remove = () => {
    card.style.opacity = "0";
    card.style.transform = "translateY(8px) scale(.98)";
    setTimeout(() => { try { document.body.removeChild(host); } catch {} }, 180);
  };

  const t = setTimeout(remove, 3000);
  const finish = () => { clearTimeout(t); remove(); };
  close.addEventListener("click", finish, { once: true });
  primary.addEventListener("click", finish, { once: true });
  host.addEventListener("click", (e) => { if (e.target === host) finish(); }, { once: true });
}

/* ---------- Styles ---------- */
const css = `
.wrap{ --ink:rgba(0,0,0,.08); --ink2:rgba(0,0,0,.06); --accent:#F05D8B; --gold:#F6C320; --primary:#4A4F41;
  max-width:1200px; margin:0 auto; padding:16px; color:var(--primary); }
.head{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:12px; }
.head h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; font-size:28px; }

.grid{ display:grid; grid-template-columns: 1.2fr .8fr; gap:14px; }
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
.card{ background:#fff; border:1px solid var(--ink); border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }
.section-head{ padding:10px 12px; border-bottom:1px solid var(--ink); background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); font-weight:900; font-size:13px; }
.body{ padding:12px; }

/* ...existing CSS unchanged... */
.ta{
  width:100%;
  border:1px solid var(--ink);
  border-radius:10px;
  padding:8px 10px;
  outline:none;
  resize:vertical;
  min-height:84px;
}
.ta:focus{
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(246,195,32,.18);
}

/* === Overlays === */
.modal{
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter: blur(2px);
  padding: 12px;
}


.wrap{ --ink:rgba(0,0,0,.08); --ink2:rgba(0,0,0,.06); --accent:#F05D8B; --gold:#F6C320; --primary:#4A4F41;
  max-width:1200px; margin:0 auto; padding:16px; color:var(--primary); }
.head{ display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:12px; }
.head h1{ margin:0; font-family:"DM Serif Display", Georgia, serif; font-size:28px; }

.grid{ display:grid; grid-template-columns: 1.2fr .8fr; gap:14px; }
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }
.card{ background:#fff; border:1px solid var(--ink); border-radius:16px; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }
.section-head{ padding:10px 12px; border-bottom:1px solid var(--ink); background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); font-weight:900; font-size:13px; }
.body{ padding:12px; }

.addr{ display:grid; gap:10px; }
.addr .cur{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; border:1px dashed var(--ink); border-radius:12px; padding:10px; }
.addr .meta .name{ font-weight:900; }
.addr .meta .lines{ font-size:13px; opacity:.9; }
.addr .btns{ display:flex; gap:8px; }
.ghost{ height:32px; padding:0 10px; border-radius:10px; border:1px solid var(--ink); background:#fff; cursor:pointer; }
.link{ color: var(--accent); font-weight:800; background:transparent; border:none; cursor:pointer; }
.badge{ font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background: rgba(246,195,32,.22); }
.small{ font-size:12px; opacity:.75; }

.sum{ position:relative; }
.sum-inner{ position:sticky; top:16px; padding:12px; display:grid; gap:10px; }
.row-sum{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.total{ font-size:20px; font-weight:900; }
.items{ display:grid; gap:10px; }
.item{ display:grid; grid-template-columns: 1fr auto; gap:8px; padding:8px; border:1px dashed var(--ink); border-radius:12px; }
.item .name{ font-weight:800; }
.item .muted{ font-size:12px; opacity:.75; }
.item .line{ font-weight:900; color:var(--accent); }

.form{ display:grid; gap:10px; }
.lbl{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:4px; }
.inp{ height:38px; border:1px solid var(--ink); border-radius:10px; padding:0 10px; outline:none; width:100%; }
.inp:focus{ border-color: var(--gold); box-shadow: 0 0 0 3px rgba(246,195,32,.18); }
.sel{ height:38px; border:1px solid var(--ink); border-radius:10px; padding:0 10px; background:#fff; width:100%; }
.row2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
@media (max-width: 640px){ .row2{ grid-template-columns: 1fr; } }

.actions{ display:grid; gap:10px; margin-top:6px; }
.btn{
  height:42px; border:none; border-radius:12px; font-weight:900; cursor:pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease; }
.primary{ background: var(--accent); color:#fff; box-shadow:0 12px 28px rgba(240,93,139,.28); }
.primary:hover{ transform: translateY(-1px); box-shadow:0 16px 40px rgba(240,93,139,.36); background:#f1497b; }
.secondary{ background: var(--gold); color:#2b2b2b; box-shadow:0 10px 20px rgba(246,195,32,.22); }
.secondary:hover{ transform: translateY(-1px); box-shadow:0 14px 30px rgba(246,195,32,.30); background:#f5bd07; }

.alert{ margin:10px 0; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }

hr.sep{ border:none; height:1px; background:var(--ink); margin:6px 0; }
.ta{
  width:100%;
  border:1px solid var(--ink);
  border-radius:10px;
  padding:8px 10px;
  outline:none;
  resize:vertical;
  min-height:84px;
}
.ta:focus{
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(246,195,32,.18);
}


/* === Overlays === */
.modal{
  position:fixed; inset:0; background:rgba(0,0,0,.35);
  display:flex; align-items:center; justify-content:center; z-index:100; backdrop-filter: blur(2px);
  padding: 12px;
}
.sheet{
  width:min(920px, 100%); max-height:calc(100vh - 24px);
  background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.35);
  display:grid; grid-template-rows:auto 1fr auto; overflow:hidden;
}
.sheet-hd{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-bottom:1px solid var(--ink); }
.sheet-bd{ padding:12px; overflow:auto; }
.sheet-ft{ display:flex; justify-content:flex-end; gap:8px; padding:10px 12px; border-top:1px solid var(--ink); }

/* Address select list */
.addr-grid{ display:grid; gap:10px; }
.addr-card{
  border:1px solid var(--ink); border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(0,0,0,.06);
  padding:10px; display:grid; grid-template-columns: 30px 1fr auto; gap:10px; cursor:pointer; align-items:center;
}
svg.icon { width: 24px; height: 24px; }
.addr-card:hover{ background:#fafafa; }
.addr-icon{ width:28px; height:28px; border-radius:8px; border:1px solid var(--ink); display:grid; place-items:center; font-weight:900; }
.addr-info{ font-size:13px; line-height:1.35; }
.addr-info .nm{ font-weight:900; display:flex; align-items:center; gap:8px; }
.addr-badge{ font-size:11px; padding:2px 8px; border-radius:999px; background: rgba(246,195,32,.22); white-space:nowrap; }
.addr-meta{ opacity:.9; }

/* New Address modal */
.na-sheet{
  width:min(720px, 100%); max-height:calc(100vh - 24px);
  background:#fff; border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.35);
  display:grid; grid-template-rows:auto 1fr auto; overflow:hidden;
}
.na-bd{ padding:12px; overflow:auto; display:grid; gap:10px; }
.na-row2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
@media (max-width: 680px){ .na-row2{ grid-template-columns: 1fr; } }
`;

// INR
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `₹${(n || 0).toFixed(2)}`;
  }
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { items, total, clear } = useCart();
  const { number: waNumber } = useWhatsAppNumber();

  useEffect(() => {
    if (!items.length) nav("/cart");
  }, [items.length, nav]);

  // flow toggle
  const [international, setInternational] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  // Countries + maps
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryMap, setCountryMap] = useState<Record<number, string>>({});
  const [INDIA_ID, setINDIA_ID] = useState<number>(Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 0);

  // Lookups for labels (for address list rendering)
  const [stateMap, setStateMap] = useState<Record<number, string>>({});
  const [districtMap, setDistrictMap] = useState<Record<number, string>>({});

  // Addresses
  const [addrList, setAddrList] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<number | null>(null);

  // Partners + coupon (domestic only)
  const [partners, setPartners] = useState<DeliveryPartnerLite[]>([]);
  const [partnerId, setPartnerId] = useState<number | "">("");
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponAmt, setCouponAmt] = useState(0);

  // Modals
  const [selectSheetOpen, setSelectSheetOpen] = useState(false); // address selection sheet
  const [manageMode, setManageMode] = useState(false);
  const [newAddrOpen, setNewAddrOpen] = useState(false);
  const [editAddr, setEditAddr] = useState<Address | null>(null);
  const [modalContext, setModalContext] = useState<"domestic" | "intl">("domestic");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subtotal = useMemo(() => total, [total]);
  const discountTotal = couponAmt || 0;
  const loginCta = !user?.id;

  // 🔎 Profile info for WhatsApp message
  const [custName, setCustName] = useState<string>("");
  const [custEmail, setCustEmail] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      try {
        const { data } = await http.get<any>(`/api/customers/${user.id}`);
        if (!alive) return;
        const name =
          data?.fullName ??
          data?.fullname ??
          data?.name ??
          data?.username ??
          "";
        const email = data?.email ?? data?.mail ?? "";
        setCustName(name || "");
        setCustEmail(email || "");
      } catch {
        setCustName("");
        setCustEmail("");
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Load initial: countries, states/districts, partners, addresses
  // Load initial: countries, states/districts, partners, addresses
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cs = await getCountries().catch(() => [] as Country[]);
        if (!alive) return;
        setCountries(cs || []);

        // Build id->name map
        const cmap: Record<number, string> = {};
        (cs || []).forEach(c => { if (c?.id != null) cmap[c.id] = c.name || String(c.id); });
        setCountryMap(cmap);

        // Resolve INDIA_ID:
        // 1) environment override (preferred)
        const envIndiaId = Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 0;

        // 2) find by common names if env not provided
        let resolvedIndiaId = envIndiaId;
        if (!resolvedIndiaId) {
          const india = (cs || []).find(c => /\b(India|Bharat)\b/i.test(c?.name || ""));
          if (india?.id) resolvedIndiaId = india.id;
        }

        if (resolvedIndiaId) setINDIA_ID(resolvedIndiaId);
      } catch {/* ignore */}

      // label lookups
      (async () => {
        try {
          const sid = (Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || INDIA_ID || 0);
          const [states, allDists] = await Promise.all([
            sid ? getStatesByCountry(sid).catch(() => [] as State[]) : Promise.resolve([] as State[]),
            getAllDistricts().catch(() => [] as District[]),
          ]);
          if (!alive) return;
          const sm: Record<number, string> = {};
          const dm: Record<number, string> = {};
          (states || []).forEach(s => { if (s?.id != null) sm[s.id] = s.name || String(s.id); });
          (allDists || []).forEach(d => { if (d?.id != null) dm[d.id] = d.name || String(d.id); });
          setStateMap(sm);
          setDistrictMap(dm);
        } catch {/* ignore */}
      })();

      // delivery partners (domestic)
      try {
        const { data } = await http.get<DeliveryPartnerLite[]>(`/api/partners/active`);
        if (!alive) return;
        setPartners(data ?? []);
      } catch { /* ignore */ }

      // user addresses
      if (user?.id) {
        try {
          const a = await listAddresses(Number(user.id));
          if (!alive) return;
          setAddrList(a || []);
          const def = (a || []).find(x => x.isDefault) || (a || [])[0] || null;
          setSelectedAddrId(def?.id ?? null);
        } catch (e: any) {
          if (!alive) return;
          setErr(e?.response?.data?.message || e?.message || "Could not load addresses.");
        }
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  // domestic vs international partitions
  const domesticAddresses = useMemo(
    () => (addrList || []).filter(a => INDIA_ID && Number(a.countryId) === Number(INDIA_ID)),
    [addrList, INDIA_ID]
  );
  const internationalAddresses = useMemo(
    () => (addrList || []).filter(a => INDIA_ID && a.countryId && Number(a.countryId) !== Number(INDIA_ID)),
    [addrList, INDIA_ID]
  );

  // When toggling flow, pick selection from the right bucket
  useEffect(() => {
    if (!INDIA_ID) return;
    const list = international ? internationalAddresses : domesticAddresses;
    if (!list.length) { setSelectedAddrId(null); return; }
    const inList = list.some(a => a.id === selectedAddrId);
    if (!inList) {
      const def = list.find(a => a.isDefault) || list[0];
      setSelectedAddrId(def?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [international, domesticAddresses.length, internationalAddresses.length, INDIA_ID]);

  // Coupon preview
  async function tryCoupon() {
    setCouponErr(null);
    setCouponAmt(0);
    const code = coupon.trim();
    if (!code) return;
    try {
      const { data } = await http.post(
        `/api/promotions/coupons/${encodeURIComponent(code)}/preview`,
        {
          customerId: Number(user?.id || 0),
          orderTotal: subtotal,
          itemsCount,
        }
      );
      const amt = Number(data?.discount || 0);
      if (amt > 0) setCouponAmt(amt);
      else setCouponErr("Coupon not applicable for this order.");
    } catch (e: any) {
      setCouponErr(e?.response?.data?.message || e?.message || "Coupon validation failed.");
    }
  }


  // NEW: Clear coupon
  function clearCoupon() {
    setCoupon("");
    setCouponErr(null);
    setCouponAmt(0);
  }

  // Helper labels
  const stateNameById = (id?: number | null) => (id && stateMap[id]) || "";
  const districtNameById = (id?: number | null) => (id && districtMap[id]) || "";
  const countryNameById = (id?: number | null) => (id && countryMap[id]) || "";

  // ===== WhatsApp message (uses fetched profile name/email, not address recipient) =====
  function buildWhatsAppMessage(address: Address): string {
    const lines: string[] = [];
    lines.push(`*New International Order* 🌍`);
    lines.push(``);
    lines.push(`*Customer:*`);
    lines.push(`ID: ${user?.id ?? ""}`);
    if (custName) lines.push(`Name: ${custName}`);
    if (custEmail) lines.push(`Email: ${custEmail}`);
    lines.push(``);
    lines.push(`*Ship To:*`);
    lines.push(`${address.name || ""}`);
    lines.push(
      [
        address.line1,
        address.line2,
        countryNameById(address.countryId || undefined),
        address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    );
    if (address.phone) lines.push(`Phone: ${address.phone}`);
    lines.push(``);
    lines.push(`*Items:*`);
    items.forEach((it) => {
      lines.push(`• ${it.name}${it.variant ? " (" + it.variant + ")" : ""} × ${it.qty} — ${inr(it.price * it.qty)}`);
    });
    lines.push(``);
    lines.push(`*Total:* ${inr(subtotal)}`);
    return lines.join("\n");
  }

  async function onSendWhatsAppInternational() {
    if (!user?.id) { setErr("Please login to continue."); return; }
    if (!selectedAddrId) { setErr("Please select an international address."); return; }
    const addr = internationalAddresses.find(a => a.id === selectedAddrId);
    if (!addr) { setErr("Please select an international address."); return; }

    setErr(null);
    setSubmitting(true);
    try {
      const msg = buildWhatsAppMessage(addr);
      const href = waHrefFor(waNumber || "", msg);
      window.open(href, "_blank");
      clear();
      nav("/");
    } finally {
      setSubmitting(false);
    }
  }

  /* ===================== SHIPPING PREVIEW (DOMESTIC) ===================== */
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingLoading, setShippingLoading] = useState<boolean>(false);
  const [shippingErr, setShippingErr] = useState<string | null>(null);

  const selectedDomesticAddress = useMemo(
    () => domesticAddresses.find(a => a.id === selectedAddrId) || null,
    [domesticAddresses, selectedAddrId]
  );

  async function refreshShippingPreview(addr: Address | null) {
    if (!addr) { setShippingFee(0); setShippingErr(null); return; }
    setShippingLoading(true);
    setShippingErr(null);
    try {
      // We purposely use itemsSubtotal BEFORE discounts (to match your service’s threshold logic)
      const { data } = await http.post<{ fee: number; free: boolean }>(`/api/shipping/preview`, {
        itemsSubtotal: subtotal,
        stateId: addr.stateId ?? null,
        districtId: addr.districtId ?? null,
      });
      const fee = Number(data?.fee ?? 0);
      setShippingFee(isFinite(fee) ? fee : 0);
    } catch (e: any) {
      setShippingFee(0);
      setShippingErr(e?.response?.data?.message || e?.message || "Could not compute shipping fee.");
    } finally {
      setShippingLoading(false);
    }
  }

  // Trigger shipping preview whenever domestic flow + address or subtotal changes
  useEffect(() => {
    if (international) {
      setShippingFee(0);
      setShippingErr(null);
      setShippingLoading(false);
      return;
    }
    refreshShippingPreview(selectedDomesticAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [international, selectedDomesticAddress?.id, subtotal]);

  // Grand total now uses the previewed shippingFee
  const grandTotal = useMemo(() => {
    const ship = international ? 0 : (shippingFee || 0);
    return Math.max(0, subtotal + ship - discountTotal);
  }, [international, subtotal, shippingFee, discountTotal]);


    async function onPlaceDomestic() {
      if (!user?.id) { setErr("Please login to continue."); return; }

      const selectedAddress = domesticAddresses.find(a => a.id === selectedAddrId) || null;
      if (!selectedAddress) { setErr("Please add/select an Indian address."); return; }
      if (!partnerId) { setErr("Please select a delivery partner."); return; }
      if (shippingLoading) { setErr("Please wait while we calculate shipping."); return; }

      setErr(null);
      setSubmitting(true);

      // 1) Build order items payload (server DTO)
      const orderItems: OrderItemDto[] = items.map((it) => {
        const parsedId = Number(String(it.id).split(":")[0]);
        const pid = (it as any).productId ?? (Number.isFinite(parsedId) ? parsedId : undefined);
        return {
          productId: pid,
          productName: it.name,
          quantity: it.qty,
          unitPrice: it.price,
          lineTotal: (Number(it.price) * Number(it.qty)).toFixed(2),
          optionsText: it.variant || undefined,
        };
      });

      const partnerName = partners.find(p => p.id === partnerId)?.name;

      // 2) Build order payload (use previewed shippingFee + computed grandTotal)
      const order: OrderDto = {
        customerId: Number(user?.id),
        itemsSubtotal: subtotal,
        shippingFee: shippingFee || 0,
        discountTotal,
        grandTotal,
        currency: "INR",
        deliveryPartnerId: typeof partnerId === "number" ? partnerId : undefined,
          courierName: partnerName,
          couponId: typeof couponId === "number" ? couponId : undefined,
          couponCode: couponAmt > 0 ? coupon.trim() : undefined,
          orderNotes: orderNotes.trim() ? orderNotes.trim() : undefined,
        courierName: partnerName,
        shipName: selectedAddress.name,
        shipPhone: selectedAddress.phone || undefined,
        shipLine1: selectedAddress.line1,
        shipLine2: selectedAddress.line2 || undefined,
        shipPincode: selectedAddress.pincode || undefined,
        shipDistrictId: selectedAddress.districtId || undefined,
        shipStateId: selectedAddress.stateId || undefined,
        shipCountryId: selectedAddress.countryId || undefined,
      };

      try {
        // 3) Ask backend to create/prepare checkout (it should create the Razorpay order)
        const resp = await startCheckout(order, orderItems);
        if (resp?.type !== "RZP_ORDER" || !resp.razorpayOrder) {
          throw new Error("Server did not return a Razorpay order.");
        }
        const rzpOrder = resp.razorpayOrder; // { id, amount, currency, ... }
        const internalOrderId = (resp as any).orderId || (rzpOrder.notes?.orderId ? Number(rzpOrder.notes.orderId) : undefined);

        // 4) Ensure Razorpay script is loaded
        const ok = await loadRazorpay();
        if (!ok || !(window as any).Razorpay) {
          throw new Error("Could not load Razorpay. Please retry.");
        }

        // 5) Fetch public key from backend (profile-aware)
        const { keyId } = await getRzpConfig();
        if (!keyId) throw new Error("Razorpay key not configured on server.");

        // 6) Open Razorpay Checkout
        const rzp = new (window as any).Razorpay({
          key: keyId,
          order_id: rzpOrder.id,
          amount: rzpOrder.amount,                 // in paise
          currency: rzpOrder.currency || "INR",
          name: "Blossom Buds Floral Artistry",
          description: "Order Payment",
          prefill: {
            name: custName || "",
            email: custEmail || "",
            contact: selectedAddress.phone || "",
          },
          theme: { color: "#F05D8B" },
          handler: async function (response: any) {
            try {
              await http.post("/api/payments/razorpay/verify", {
                //orderId: createdOrderIdFromDraftOrIntent, // if you store it; if not, omit
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                amount: grandTotal,
                currency: "INR"
              });
              clear();
              nav("/"); // success UX
            } catch (e:any) {
              console.error(e);
              setErr(e?.response?.data?.message || "Payment captured but order could not be created.");
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
            },
          },
        });

        rzp.on("payment.failed", (err: any) => {
          console.warn("Razorpay payment.failed:", err);
          setErr(err?.error?.description || "Payment failed. Please try again.");
          setSubmitting(false);
        });

        rzp.open();
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || "Checkout failed. Please try again.";
        setErr(msg);
        setSubmitting(false);
      }
    }



  // ===== Address modal state (New/Edit) =====
  const [naName, setNaName] = useState("");
  const [naPhone, setNaPhone] = useState("");
  const [naLine1, setNaLine1] = useState("");
  const [naLine2, setNaLine2] = useState("");
  const [naPincode, setNaPincode] = useState("");
  const [naStateId, setNaStateId] = useState<number | "">("");
  const [naDistrictId, setNaDistrictId] = useState<number | "">("");
  const [naCountryId, setNaCountryId] = useState<number | "">("");
  const [naMakeDefault, setNaMakeDefault] = useState(true);
  const [naBusy, setNaBusy] = useState(false);
  const [naErr, setNaErr] = useState<string | null>(null);

  // options for the modal
  const [modalStates, setModalStates] = useState<State[]>([]);
  const [modalDistricts, setModalDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Open New Address (context-aware)
  function openNewAddress(ctx: "domestic" | "intl") {
    setModalContext(ctx);
    setEditAddr(null);
    setNaName(custName || "");
    setNaPhone("");
    setNaLine1("");
    setNaLine2("");
    setNaPincode("");
    setNaStateId("");
    setNaDistrictId("");
    setNaCountryId(ctx === "domestic" ? (INDIA_ID || "") : ""); // domestic defaults to India
    setNaMakeDefault(true);
    setNaErr(null);
    setNewAddrOpen(true);
  }

  // When opening the modal, load states for India (domestic). International: no states/districts UI.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!newAddrOpen) return;

      if (modalContext === "domestic" && INDIA_ID) {
        try {
          const states = await getStatesByCountry(INDIA_ID);
          if (!live) return;
          setModalStates(states || []);
          const sid =
            typeof naStateId === "number"
              ? naStateId
              : editAddr?.stateId ?? "";
          if (typeof sid === "number") {
            setLoadingDistricts(true);
            const d = await getDistrictsByState(sid);
            if (!live) return;
            setModalDistricts(d || []);
          } else {
            setModalDistricts([]);
          }
        } catch {
          setModalStates([]);
          setModalDistricts([]);
        } finally {
          setLoadingDistricts(false);
        }
      } else {
        // intl
        setModalStates([]);
        setModalDistricts([]);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newAddrOpen, modalContext, INDIA_ID]);

  // On state change (domestic), fetch districts
  useEffect(() => {
    let live = true;
    (async () => {
      if (!newAddrOpen) return;
      if (modalContext !== "domestic") return;
      if (typeof naStateId !== "number") { setModalDistricts([]); return; }
      setLoadingDistricts(true);
      try {
        const d = await getDistrictsByState(naStateId);
        if (!live) return;
        setModalDistricts(d || []);
        setNaDistrictId("");
      } finally {
        setLoadingDistricts(false);
      }
    })();
    return () => { live = false; };
  }, [naStateId, newAddrOpen, modalContext]);

  // If editing, prefill fields
  useEffect(() => {
    if (!newAddrOpen || !editAddr) return;
    setNaName(editAddr.name || "");
    setNaPhone(editAddr.phone || "");
    setNaLine1(editAddr.line1 || "");
    setNaLine2(editAddr.line2 || "");
    setNaPincode(editAddr.pincode || "");
    setNaStateId(editAddr.stateId ?? "");
    setNaDistrictId(editAddr.districtId ?? "");
    setNaCountryId(editAddr.countryId ?? "");
    setNaMakeDefault(!!editAddr.isDefault);
    setNaErr(null);
  }, [newAddrOpen, editAddr]);

  async function saveNewAddress() {
    if (!user?.id) { setNaErr("Please login to add an address."); return; }
    const isDomestic = modalContext === "domestic";

    // 🔒 Strict required fields for BOTH flows
    if (!naName.trim()) { setNaErr("Recipient name is required."); return; }
    if (!naPhone.trim()) { setNaErr("Phone number is required."); return; }
    if (!naLine1.trim()) { setNaErr("Address line 1 is required."); return; }
    if (!naLine2.trim()) { setNaErr("Address line 2 is required."); return; }
    if (!naPincode.trim()) { setNaErr("Pincode / ZIP is required."); return; }

    // Flow-specific required fields
    if (isDomestic) {
      if (!INDIA_ID) { setNaErr("Could not resolve India country id."); return; }
      if (typeof naStateId !== "number") { setNaErr("State is required."); return; }
      if (typeof naDistrictId !== "number") { setNaErr("District is required."); return; }
    } else {
      const cid = typeof naCountryId === "number" ? naCountryId : 0;
      if (!cid) { setNaErr("Country is required."); return; }
      if (INDIA_ID && cid === INDIA_ID) { setNaErr("Please choose a non-India country for international address."); return; }
    }

    setNaBusy(true);
    setNaErr(null);
    try {
      const payload: Partial<Address> = {
        customerId: Number(user.id),
        name: naName.trim(),
        phone: naPhone.trim(),
        line1: naLine1.trim(),
        line2: naLine2.trim(),
        pincode: naPincode.trim(),
        countryId: isDomestic ? INDIA_ID : (naCountryId as number),
        stateId: isDomestic ? (naStateId as number) : undefined,
        districtId: isDomestic ? (naDistrictId as number) : undefined,
        isDefault: !!naMakeDefault,
        active: true,
      };
      const created = await apiAddAddress(Number(user.id), payload);
      setAddrList(prev => ([...(prev || []), created]));
      setSelectedAddrId(created.id); // use for this order
      setNewAddrOpen(false);
    } catch (e: any) {
      setNaErr(e?.response?.data?.message || e?.message || "Could not save address.");
    } finally {
      setNaBusy(false);
    }
  }

  async function saveEditAddress() {
    if (!user?.id || !editAddr) return;
    const isDomestic = modalContext === "domestic";

    // 🔒 Strict required fields for BOTH flows
    if (!naName.trim()) { setNaErr("Recipient name is required."); return; }
    if (!naPhone.trim()) { setNaErr("Phone number is required."); return; }
    if (!naLine1.trim()) { setNaErr("Address line 1 is required."); return; }
    if (!naLine2.trim()) { setNaErr("Address line 2 is required."); return; }
    if (!naPincode.trim()) { setNaErr("Pincode / ZIP is required."); return; }

    // Flow-specific required fields
    if (isDomestic) {
      if (typeof naStateId !== "number") { setNaErr("State is required."); return; }
      if (typeof naDistrictId !== "number") { setNaErr("District is required."); return; }
    } else {
      const cid = typeof naCountryId === "number" ? naCountryId : 0;
      if (!cid) { setNaErr("Country is required."); return; }
      if (INDIA_ID && cid === INDIA_ID) { setNaErr("Please choose a non-India country for international address."); return; }
    }

    setNaBusy(true);
    setNaErr(null);
    try {
      const payload: Partial<Address> = {
        name: naName.trim(),
        phone: naPhone.trim(),
        line1: naLine1.trim(),
        line2: naLine2.trim(),
        pincode: naPincode.trim(),
        countryId: isDomestic ? INDIA_ID : (naCountryId as number),
        stateId: isDomestic ? (naStateId as number) : undefined,
        districtId: isDomestic ? (naDistrictId as number) : undefined,
        isDefault: !!naMakeDefault,
        active: true,
      };
      const updated = await apiUpdateAddress(editAddr.id, payload);
      setAddrList(prev => (prev || []).map(a => (a.id === updated.id ? updated : a)));
      setSelectedAddrId(updated.id);
      setNewAddrOpen(false);
      setEditAddr(null);
    } catch (e: any) {
      setNaErr(e?.response?.data?.message || e?.message || "Could not update address.");
    } finally {
      setNaBusy(false);
    }
  }

  async function onDeleteAddress(id: number) {
    if (!id) return;
    const ok = window.confirm("Delete this address?");
    if (!ok) return;
    try {
      await apiDeleteAddress(id);
      setAddrList(prev => (prev || []).filter(a => a.id !== id));
      if (selectedAddrId === id) {
        const bucket = international ? internationalAddresses : domesticAddresses;
        const next = bucket.find(a => a.id !== id);
        setSelectedAddrId(next?.id || null);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not delete address.");
    }
  }

  // Set default (manage view)
  async function onSetDefaultAddress(id: number) {
    try {
      const saved = await apiSetDefaultAddress(id);
      setAddrList(prev => (prev || []).map(x => ({ ...x, isDefault: x.id === saved.id })));
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not set default address.");
    }
  }

  const shownAddresses = international ? internationalAddresses : domesticAddresses;
  const selectedAddress = useMemo(
    () => shownAddresses.find(a => a.id === selectedAddrId) || null,
    [shownAddresses, selectedAddrId]
  );
  const itemsCount = useMemo(
    () => (items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0),
    [items]
  );

  return (
    <div className="wrap">
      <style>{css}</style>

      <header className="head">
        <h1>Checkout</h1>
        <span className="small">
          <Link to="/cart">← Back to cart</Link>
        </span>
      </header>

      {err && <div className="alert">{err}</div>}

      <div className="grid">
        {/* LEFT: Shipping flow */}
        <section className="card">
          <div className="section-head">Shipping</div>
          <div className="body">
            {!international ? (
              <div className="addr">
                <div className="small" style={{textAlign:"right"}}>
                  International order?{" "}
                  <button className="link" onClick={()=>setInternational(true)}>Click here</button>
                </div>

                {selectedAddress ? (
                  <div className="cur">
                    <div className="meta">
                      <div className="name">
                        {selectedAddress.name}{" "}
                        <span className="badge">{selectedAddress.isDefault ? "Default" : "Selected"}</span>
                      </div>
                      <div className="lines">
                        {selectedAddress.phone ? `${selectedAddress.phone} • ` : ""}
                        {selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                        <br/>
                        {[
                          districtNameById(selectedAddress.districtId) || "",
                          stateNameById(selectedAddress.stateId) || "",
                          selectedAddress.pincode || "",
                          countryNameById(selectedAddress.countryId) || "",
                        ].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <div className="btns">
                      <button
                        className="ghost"
                        onClick={()=>{ setManageMode(false); setSelectSheetOpen(true); }}
                        disabled={loginCta}
                      >
                        Change
                      </button>
                      <button
                        className="ghost"
                        onClick={()=>openNewAddress("domestic")}
                        disabled={loginCta || !INDIA_ID}
                      >
                        New
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cur">
                    <div>{loginCta ? "Login to manage addresses." : "No Indian addresses."}</div>
                    <div className="btns">
                      <button
                        className="ghost"
                        onClick={()=>openNewAddress("domestic")}
                        disabled={loginCta || !INDIA_ID}
                      >
                        Add address
                      </button>
                    </div>
                  </div>
                )}

                <hr className="sep"/>

                <div className="form">
                  <div>
                    <div className="lbl">Delivery partner</div>
                    <select className="sel" value={partnerId} onChange={e=>setPartnerId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Select a partner…</option>
                      {partners.map(p=>(
                        <option key={p.id} value={p.id}>
                          {p.name}{p.code ? ` (${p.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Coupon row with Apply + Clear */}
                  <div className="row2">
                    <div>
                      <div className="lbl">Coupon code</div>
                      <input
                        className="inp"
                        value={coupon}
                        onChange={e=>setCoupon(e.target.value)}
                        placeholder="e.g. BLOOM10"
                        onKeyDown={(e) => { if (e.key === "Enter") tryCoupon(); }}
                      />
                    </div>
                    <div style={{alignSelf:"end", display:"flex", gap:8, justifyContent:"flex-end"}}>
                      <button className="ghost" onClick={tryCoupon} disabled={loginCta || !coupon.trim()}>
                        Apply
                      </button>
                      <button
                        className="ghost"
                        onClick={clearCoupon}
                        disabled={!coupon.trim() && !couponErr && !(couponAmt > 0)}
                        title="Clear coupon"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {couponErr && <div className="small" style={{color:"#b0003a"}}>{couponErr}</div>}
                  {couponAmt>0 && <div className="small" style={{color:"#136f2a"}}>Coupon applied: −{inr(couponAmt)}</div>}
                </div>
              </div>
            ) : (
              <div className="addr">
                <div className="small" style={{textAlign:"right"}}>
                  Not international?{" "}
                  <button className="link" onClick={()=>setInternational(false)}>Back to domestic checkout</button>
                </div>

                {selectedAddress ? (
                  <div className="cur">
                    <div className="meta">
                      <div className="name">
                        {selectedAddress.name}{" "}
                        <span className="badge">{selectedAddress.isDefault ? "Default" : "Selected"}</span>
                      </div>
                      <div className="lines">
                        {selectedAddress.phone ? `${selectedAddress.phone} • ` : ""}
                        {selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                        <br/>
                        {[
                          selectedAddress.pincode || "",
                          countryNameById(selectedAddress.countryId) || "",
                        ].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <div className="btns">
                      <button className="ghost" onClick={()=>{ setManageMode(false); setSelectSheetOpen(true); }} disabled={loginCta}>Change</button>
                      <button className="ghost" onClick={()=>openNewAddress("intl")} disabled={loginCta}>New</button>
                    </div>
                  </div>
                ) : (
                  <div className="cur">
                    <div>{loginCta ? "Login to manage addresses." : "No international addresses."}</div>
                    <div className="btns">
                      <button className="ghost" onClick={()=>openNewAddress("intl")} disabled={loginCta}>Add address</button>
                    </div>
                  </div>
                )}

                <p className="small" style={{marginTop:4}}>
                  We’re currently processing international orders via WhatsApp. Please click the
                  <strong> “Send on WhatsApp”</strong> button on the right to share your cart and address with our team.
                  Sit back and relax — we’ll get back to you with shipping options and payment details. 💐
                </p>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: Order Summary & action button */}
        <aside className="card sum">
          <div className="section-head">Order Summary</div>
          <div className="sum-inner">
            <div className="items">
              {items.map(it=>(
                <div key={it.id} className="item">
                  <div>
                    <div className="name">{it.name}</div>
                    {it.variant && <div className="muted">{it.variant}</div>}
                    <div className="small">{it.qty} × {inr(it.price)}</div>
                  </div>
                  <div className="line">{inr(it.price * it.qty)}</div>
                </div>
              ))}
            </div>

            <div className="row-sum">
              <span>Subtotal</span>
              <span>{inr(subtotal)}</span>
            </div>

            {/* Shipping row (domestic only) */}
            {!international && (
              <div className="row-sum">
                <span>Shipping</span>
                <span>
                  {shippingLoading
                    ? "Calculating…"
                    : shippingErr
                      ? "—"
                      : inr(shippingFee || 0)}
                </span>
              </div>
            )}

            {!international && couponAmt>0 && (
              <div className="row-sum">
                <span>Discount</span>
                <span>−{inr(couponAmt)}</span>
              </div>
            )}

            <div className="row-sum total">
              <span>Total</span>
              <span>{inr(international ? subtotal : grandTotal)}</span>
            </div>

            {shippingErr && !international && (
              <div className="small" style={{ color:"#b0003a" }}>{shippingErr}</div>
            )}
            {/* Order notes (optional) */}
            {!international && (
            <div>
              <div className="lbl">Order notes (optional)</div>
              <textarea
                className="ta"
                rows={3}
                maxLength={500}
                placeholder="Do you want to let anything us know?"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
              <div className="small" style={{ textAlign: "right" }}>
                {500 - (orderNotes?.length || 0)} characters left
              </div>
            </div>)}

            <div className="actions">
              {international ? (
                <button className="btn primary" onClick={onSendWhatsAppInternational} disabled={submitting}>
                  {submitting ? "Opening WhatsApp…" : "Send on WhatsApp"}
                </button>
              ) : (

                <button className="btn primary" onClick={onPlaceDomestic} disabled={submitting || !user?.id || shippingLoading}>
                  {submitting ? "Processing…" : "Proceed to Pay"}
                </button>
              )}
              <button className="btn secondary" onClick={()=>nav("/categories")}>Continue shopping</button>
            </div>

            {!user?.id && !international && (
              <div className="small" style={{opacity:.7, marginTop:6}}>
                You’re not logged in. <Link to="/login" state={{ background: location, from: location }}>Login</Link> to pay online.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===== Address selection sheet ===== */}
      {selectSheetOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="sheet">
            <div className="sheet-hd">
              <strong>{manageMode ? "Manage addresses" : "Select an address"}</strong>
              <div style={{display:"flex", gap:8}}>
                <button className="ghost" onClick={()=>setManageMode(m => !m)}>
                  {manageMode ? "Back to select" : "Manage"}
                </button>
                <button className="ghost" onClick={()=>setSelectSheetOpen(false)}>✕</button>
              </div>
            </div>

            <div className="sheet-bd">
              {!manageMode ? (
                <>
                  <div className="addr-grid">
                    {shownAddresses.map(a => {
                      const stateNm = stateNameById(a.stateId);
                      const distNm = districtNameById(a.districtId);
                      const ctryNm = countryNameById(a.countryId);
                      return (
                        <div
                          key={a.id}
                          className="addr-card"
                          onClick={() => { setSelectedAddrId(a.id); setSelectSheetOpen(false); }}
                          title={a.isDefault ? "Default address" : "Click to use this address for this order"}
                        >
                          <div className="addr-icon">{a.name?.[0]?.toUpperCase() || "A"}</div>
                          <div className="addr-info">
                            <div className="nm">
                              {a.name}{a.isDefault && <span className="addr-badge">Default</span>}
                            </div>
                            <div className="addr-meta">
                              {a.phone ? `${a.phone} • ` : ""}
                              {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                              <br/>
                              {[
                                distNm,
                                stateNm,
                                a.pincode || "",
                                ctryNm,
                              ].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                          <div>
                            <button
                              className="ghost"
                              onClick={(e)=>{ e.stopPropagation(); setEditAddr(a); setModalContext(international ? "intl" : "domestic"); setNewAddrOpen(true); }}
                              aria-label="Edit"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:10}}>
                    <button className="ghost" onClick={()=>openNewAddress(international ? "intl" : "domestic")}>+ New address</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="addr-grid">
                    {shownAddresses.map(a => {
                      const stateNm = stateNameById(a.stateId);
                      const distNm = districtNameById(a.districtId);
                      const ctryNm = countryNameById(a.countryId);
                      return (
                        <div key={a.id} className="addr-card" style={{cursor:"default"}}>
                          <div className="addr-icon">{a.name?.[0]?.toUpperCase() || "A"}</div>
                          <div className="addr-info">
                            <div className="nm">
                              {a.name}{a.isDefault && <span className="addr-badge">Default</span>}
                            </div>
                            <div className="addr-meta">
                              {a.phone ? `${a.phone} • ` : ""}
                              {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                              <br/>
                              {[
                                distNm,
                                stateNm,
                                a.pincode || "",
                                ctryNm,
                              ].filter(Boolean).join(" • ")}
                            </div>
                          </div>
                          <div style={{display:"flex", gap:8}}>
                            {!a.isDefault && (
                              <button className="ghost" onClick={()=> onSetDefaultAddress(a.id)}>
                                Set default
                              </button>
                            )}
                            <button className="ghost" onClick={()=>{ setEditAddr(a); setModalContext(international ? "intl" : "domestic"); setNewAddrOpen(true); }}>Edit</button>
                            <button className="ghost" onClick={()=>onDeleteAddress(a.id)}>Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:10}}>
                    <button className="ghost" onClick={()=>openNewAddress(international ? "intl" : "domestic")}>+ New address</button>
                  </div>
                </>
              )}
            </div>

            <div className="sheet-ft">
              <button className="ghost" onClick={()=>setSelectSheetOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== New / Edit Address Modal (context-aware) ===== */}
      {newAddrOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="na-sheet">
            <div className="sheet-hd">
              <strong>{editAddr ? "Edit address" : "Add a new address"} {modalContext === "intl" ? "(International)" : "(India)"}</strong>
              <button className="ghost" onClick={()=>{ setNewAddrOpen(false); setEditAddr(null); }}>✕</button>
            </div>

            <div className="na-bd">
              {naErr && <div className="alert">{naErr}</div>}
              <div>
                <div className="lbl">Recipient name *</div>
                <input className="inp" value={naName} onChange={e=>setNaName(e.target.value)} />
              </div>
              <div className="na-row2">
                <div>
                  <div className="lbl">Phone *</div>
                  <input className="inp" value={naPhone} onChange={e=>setNaPhone(e.target.value)} placeholder={modalContext==="intl" ? "+49 176..." : "+91 9xxxxxxxxx"} />
                </div>
                <div>
                  <div className="lbl">Pincode / ZIP *</div>
                  <input className="inp" value={naPincode} onChange={e=>setNaPincode(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="lbl">Address line 1 *</div>
                <input className="inp" value={naLine1} onChange={e=>setNaLine1(e.target.value)} />
              </div>
              <div>
                <div className="lbl">Address line 2 *</div>
                <input className="inp" value={naLine2} onChange={e=>setNaLine2(e.target.value)} />
              </div>

              {modalContext === "domestic" ? (
                <>
                  <div className="na-row2">
                    <div>
                      <div className="lbl">State *</div>
                      <select
                        className="sel"
                        value={naStateId}
                        onChange={(e)=>{ const v = e.target.value ? Number(e.target.value) : ""; setNaStateId(v); setNaDistrictId(""); }}
                      >
                        <option value="">Select state…</option>
                        {modalStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="lbl">District *</div>
                      <select
                        className="sel"
                        value={naDistrictId}
                        onChange={(e)=>setNaDistrictId(e.target.value ? Number(e.target.value) : "")}
                        disabled={typeof naStateId !== "number" || loadingDistricts}
                      >
                        <option value="">{loadingDistricts ? "Loading…" : "Select district…"}</option>
                        {modalDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="small" style={{opacity:.8}}>
                    Country: <strong>{countryNameById(INDIA_ID) || "India"}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <div className="lbl">Country *</div>
                  <select
                    className="sel"
                    value={naCountryId}
                    onChange={(e)=>setNaCountryId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select country…</option>
                    {countries
                      .filter(c => !INDIA_ID || c.id !== INDIA_ID)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <label style={{display:"flex", alignItems:"center", gap:8}}>
                <input type="checkbox" checked={naMakeDefault} onChange={e=>setNaMakeDefault(e.target.checked)} />
                <span className="small">Make this my default {modalContext === "intl" ? "international" : "shipping"} address</span>
              </label>
            </div>

            <div className="sheet-ft">
              <button className="ghost" onClick={()=>{ setNewAddrOpen(false); setEditAddr(null); }}>Cancel</button>
              <button
                className="btn primary"
                onClick={editAddr ? saveEditAddress : saveNewAddress}
                disabled={naBusy}
              >
                {naBusy ? "Saving…" : (editAddr ? "Save changes" : "Save & use this")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
