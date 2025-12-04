// src/pages/admin/CreateOrderPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch } from "../../api/authFetch";

import {
  searchCustomersLite,
  createManualOrder,
} from "../../api/adminOrders";

import {
  searchProductsLite,
  getProductOptionsLite,
  resolveBasePrice,
  listProducts,
  type Product,
} from "../../api/adminCatalog";

import {
  listCustomerAddresses as listAddressesAdmin,
  addAddress as addAddressAdmin,
  type Address as AddrModel,
  createCustomer as adminCreateCustomer,
} from "../../api/adminCustomers";

import {
  getCountries,
  getStatesByCountry,
  getDistrictsByState,
  getAllDistricts,
  type Country,
  type State,
  type District,
} from "../../api/geo";

import { previewShipping } from "../../api/shippingPublic";

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────
type DestinationMode = "DOMESTIC" | "INTERNATIONAL";
type Currency = "INR";

type CustomerPick = { id: number; name?: string; fullName?: string; email?: string; phone?: string };
type CustomerDto = { id?: number; fullName: string; email?: string; phone?: string; active?: boolean };

type ProductPick = { id: number; name: string; price: number };

type OptionValueLite = { id: number; valueLabel: string; priceDelta?: number | null };
type ProductOptionLite = { id: number; name: string; values: OptionValueLite[] };
type SelectedValue = { optionId: number; value: OptionValueLite };

type CartLine = {
  key: string;
  product: ProductPick;
  quantity: number;
  qtyInput?: string;           // NEW: lenient input buffer for quantity
  basePrice: number;
  unitPrice: number;
  options: null | {
    metas: ProductOptionLite[];
    selected: SelectedValue[];
  };
};

type DeliveryPartnerLite = { id: number; name?: string | null; code?: string | null; active?: boolean | null };

const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const BG = "#FAF7E7";
const INK = "rgba(0,0,0,.08)";

const fmtCurrency = (amount: number, _code: Currency = "INR") => {
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount || 0)); }
  catch { return `₹${Number(amount || 0).toFixed(2)}`; }
};

function deriveUnitPrice(basePrice: number, selected?: SelectedValue[] | null): number {
  const deltas = (selected || [])
    .map(s => s?.value?.priceDelta)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0);
  if (deltas.length > 0) return Math.max(...deltas);
  return basePrice;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal admin helpers
// ─────────────────────────────────────────────────────────────────────────────
async function listActivePartners(): Promise<DeliveryPartnerLite[]> {
  const res = await authFetch("/api/partners/active");
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) ?? [];
}

async function previewCouponAdmin(code: string, payload: { customerId: number; orderTotal: number; itemsCount?: number }) {
  const res = await authFetch(`/api/promotions/coupons/${encodeURIComponent(code)}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = await res.text();
    try { const j = JSON.parse(msg); msg = j?.message || msg; } catch { }
    throw new Error(msg);
  }
  return res.json() as Promise<{ discount: number; couponId?: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateOrderPage() {
  const nav = useNavigate();

  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  const [dest, setDest] = useState<DestinationMode>("DOMESTIC");
  const isIntl = dest === "INTERNATIONAL";
  const currency: Currency = "INR";

  // Step 2: Customer search / +New
  const [custQuery, setCustQuery] = useState("");
  const [custSuggests, setCustSuggests] = useState<CustomerPick[] | null>(null);
  const [custOpen, setCustOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerPick | null>(null);
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [couponId, setCouponId] = useState<number | null>(null);

  const [newCust, setNewCust] = useState<CustomerDto>({ fullName: "", email: "", phone: "", active: true });

  useEffect(() => {
    let live = true;
    const q = custQuery.trim();
    if (!q) { setCustSuggests(null); setCustOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const list = await searchCustomersLite(q);
        if (!live) return;
        setCustSuggests(list || []);
        setCustOpen(true);
      } catch {
        setCustSuggests([]);
        setCustOpen(false);
      }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [custQuery]);

  function pickCustomer(c: CustomerPick) {
    setCustomer(c);
    const nm = c.name || c.fullName || "Customer";
    setCustQuery(`${c.id} — ${nm}`);
    setCustOpen(false);
  }

  async function createNewCustomer() {
    if (!newCust.fullName?.trim()) { setToast({ kind: "bad", msg: "Enter full name" }); return; }
    if (!newCust.email && !newCust.phone) { setToast({ kind: "bad", msg: "Provide email or phone" }); return; }
    try {
      const saved = await adminCreateCustomer({
        fullName: newCust.fullName.trim(),
        email: newCust.email?.trim(),
        phone: newCust.phone?.trim(),
        active: true,
      });
      setCustomer(saved);
      setCustQuery(`${saved.id} — ${saved.fullName || "Customer"}`);
      setNewCustOpen(false);
      setToast({ kind: "ok", msg: "Customer created" });
      setAddrList([]);
      setSelectedAddrId(null);
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not create customer" });
    }
  }

  // Step 3: Address
  type Address = AddrModel & {};
  const [addrList, setAddrList] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<number | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);

  // Geo maps
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryMap, setCountryMap] = useState<Record<number, string>>({});
  const [stateMap, setStateMap] = useState<Record<number, string>>({});
  const [districtMap, setDistrictMap] = useState<Record<number, string>>({});
  const [INDIA_ID, setINDIA_ID] = useState<number>(Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 0);

  const stateNameById = (id?: number | null) => (id && stateMap[id]) || "";
  const districtNameById = (id?: number | null) => (id && districtMap[id]) || "";
  const countryNameById = (id?: number | null) => (id && countryMap[id]) || "";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cs = await getCountries().catch(() => [] as Country[]);
        if (!alive) return;
        setCountries(cs || []);
        const cmap: Record<number, string> = {};
        (cs || []).forEach(c => { if (c?.id != null) cmap[c.id] = c.name || String(c.id); });
        setCountryMap(cmap);

        if (!INDIA_ID) {
          const found =
            cs.find(c => (c.isoCode || "").toUpperCase() === "IN") ||
            cs.find(c => /india/i.test(c.name || ""));
          if (found?.id) setINDIA_ID(found.id);
        }
      } catch { }

      try {
        const sid = INDIA_ID || Number(import.meta.env.VITE_COUNTRY_ID_INDIA) || 0;
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
      } catch { }
    })();
    return () => { alive = false; };
  }, [INDIA_ID]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!customer?.id) { setAddrList([]); setSelectedAddrId(null); return; }
      setAddrLoading(true);
      try {
        const list = await listAddressesAdmin(Number(customer.id));
        if (!alive) return;
        setAddrList(list || []);
        const def = (list || []).find(a => a.isDefault) || (list || [])[0] || null;
        setSelectedAddrId(def?.id ?? null);
      } catch {
        setAddrList([]);
      } finally {
        if (alive) setAddrLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customer?.id]);

  const [selectSheetOpen, setSelectSheetOpen] = useState(false);
  const [newAddrOpen, setNewAddrOpen] = useState(false);
  const [modalContext, setModalContext] = useState<"domestic" | "intl">("domestic");

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

  const [modalStates, setModalStates] = useState<State[]>([]);
  const [modalDistricts, setModalDistricts] = useState<District[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  function openNewAddress(ctx: "domestic" | "intl") {
    setModalContext(ctx);
    setNaName("");
    setNaPhone("");
    setNaLine1("");
    setNaLine2("");
    setNaPincode("");
    setNaStateId("");
    setNaDistrictId("");
    setNaCountryId(ctx === "domestic" ? (INDIA_ID || "") : "");
    setNaMakeDefault(true);
    setNaErr(null);
    setNewAddrOpen(true);
  }

  useEffect(() => {
    let live = true;
    (async () => {
      if (!newAddrOpen) return;

      if (modalContext === "domestic" && INDIA_ID) {
        try {
          const states = await getStatesByCountry(INDIA_ID);
          if (!live) return;
          setModalStates(states || []);
          setModalDistricts([]);
        } catch {
          setModalStates([]);
          setModalDistricts([]);
        }
      } else {
        setModalStates([]);
        setModalDistricts([]);
      }
    })();
    return () => { live = false; };
  }, [newAddrOpen, modalContext, INDIA_ID]);

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

  async function saveNewAddress() {
    if (!customer?.id) { setNaErr("Select or create a customer first."); return; }
    const isDomestic = modalContext === "domestic";

    if (!naName.trim()) { setNaErr("Recipient name is required."); return; }
    if (!naPhone.trim()) { setNaErr("Phone number is required."); return; }
    if (!naLine1.trim()) { setNaErr("Address line 1 is required."); return; }
    if (!naLine2.trim()) { setNaErr("Address line 2 is required."); return; }
    if (!naPincode.trim()) { setNaErr("Pincode / ZIP is required."); return; }

    if (isDomestic) {
      if (!INDIA_ID) { setNaErr("Could not resolve India country id."); return; }
      if (typeof naStateId !== "number") { setNaErr("State is required."); return; }
      if (typeof naDistrictId !== "number") { setNaErr("District is required."); return; }
    } else {
      const cid = typeof naCountryId === "number" ? naCountryId : 0;
      if (!cid) { setNaErr("Country is required."); return; }
      if (INDIA_ID && cid === INDIA_ID) { setNaErr("Choose a non-India country for international."); return; }
    }

    setNaBusy(true);
    setNaErr(null);
    try {
      const payload: Partial<Address> = {
        customerId: Number(customer.id),
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
      const created = await addAddressAdmin(Number(customer.id), payload);
      setAddrList(prev => ([...(prev || []), created]));
      setSelectedAddrId(created.id);
      setNewAddrOpen(false);
    } catch (e: any) {
      setNaErr(e?.message || "Could not save address.");
    } finally {
      setNaBusy(false);
    }
  }

  const domesticAddresses = useMemo(
    () => (addrList || []).filter(a => INDIA_ID && Number(a.countryId) === Number(INDIA_ID)),
    [addrList, INDIA_ID]
  );
  const internationalAddresses = useMemo(
    () => (addrList || []).filter(a => INDIA_ID && a.countryId && Number(a.countryId) !== Number(INDIA_ID)),
    [addrList, INDIA_ID]
  );

  const shownAddresses = isIntl ? internationalAddresses : domesticAddresses;
  const selectedAddress = useMemo(
    () => shownAddresses.find(a => a.id === selectedAddrId) || null,
    [shownAddresses, selectedAddrId]
  );

  useEffect(() => {
    const list = isIntl ? internationalAddresses : domesticAddresses;
    if (!list.length) { setSelectedAddrId(null); return; }
    const inList = list.some(a => a.id === selectedAddrId);
    if (!inList) {
      const def = list.find(a => a.isDefault) || list[0];
      setSelectedAddrId(def?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntl, domesticAddresses.length, internationalAddresses.length]);

  // Step 4: Products & cart
  const [qry, setQry] = useState("");
  const [prodSuggests, setProdSuggests] = useState<ProductPick[] | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  // NEW: Load all products for client-side filtering (like CategoriesPage)
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Load a large batch (1000) to cover most catalogs
        const page = await listProducts(0, 1000);
        if (live) setAllProducts(page.content || []);
      } catch {
        // ignore or log
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const q = qry.trim().toLowerCase();
    if (!q) { setProdSuggests(null); setProdOpen(false); return; }

    // Client-side filter
    const filtered = allProducts.filter(p =>
      String(p.id).includes(q) || p.name.toLowerCase().includes(q)
    );

    const mapped: ProductPick[] = filtered.map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.price ?? 0),
    }));

    setProdSuggests(mapped);
    setProdOpen(true);
  }, [qry, allProducts]);

  function lineSignature(p: ProductPick, selected?: SelectedValue[] | null) {
    const base = `p:${p.id}`;
    if (!selected || selected.length === 0) return base;
    const ids = selected.map(v => `${v.optionId}:${v.value.id}`).sort().join("|");
    return `${base}|${ids}`;
  }

  async function addProduct(p: ProductPick) {
    try {
      const metas = await getProductOptionsLite(p.id);
      const basePrice = resolveBasePrice(p);
      const line: CartLine = {
        key: crypto.randomUUID(),
        product: p,
        quantity: 1,
        qtyInput: "1",
        basePrice,
        unitPrice: basePrice,
        options: null,
      };
      if (metas && metas.length > 0) {
        const normalized: ProductOptionLite[] = metas.map(m => ({
          id: m.id,
          name: m.name,
          values: (m.values || []).map(v => ({
            id: v.id,
            valueLabel: v.valueLabel,
            priceDelta: v.priceDelta == null ? null : Number(v.priceDelta),
          })),
        }));
        line.options = { metas: normalized, selected: [] };
        setCart(prev => [...prev, line]);
        return;
      }
      setCart(prev => {
        const sig = lineSignature(p, null);
        const idx = prev.findIndex(x => lineSignature(x.product, x.options?.selected || null) === sig);
        if (idx >= 0) {
          const copy = prev.slice();
          const nextQty = copy[idx].quantity + 1;
          copy[idx] = { ...copy[idx], quantity: nextQty, qtyInput: String(nextQty) };
          return copy;
        }
        return [...prev, line];
      });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.message || "Could not load product options" });
    }
  }

  // Quantity: lenient typing (allow empty), normalize on blur
  function onQtyInput(k: string, raw: string) {
    setCart(prev => prev.map(x => {
      if (x.key !== k) return x;
      // accept empty, digits only otherwise
      if (raw === "") return { ...x, qtyInput: "" };
      if (!/^\d+$/.test(raw)) return x; // ignore invalid keystrokes
      const n = Math.min(999999, Number(raw));
      return { ...x, qtyInput: String(n) };
    }));
  }
  function onQtyBlur(k: string) {
    setCart(prev => prev.map(x => {
      if (x.key !== k) return x;
      const n = Math.max(1, Number(x.qtyInput || x.quantity || 1));
      return { ...x, quantity: n, qtyInput: String(n) };
    }));
  }

  function removeLine(k: string) {
    setCart(prev => prev.filter(x => x.key !== k));
  }

  function onPickOptionValue(lineKey: string, optionId: number, valueId: number) {
    setCart(prev => {
      const idx = prev.findIndex(x => x.key === lineKey);
      if (idx < 0) return prev;
      const ln = prev[idx];
      if (!ln.options) return prev;

      const opt = ln.options.metas.find(m => m.id === optionId);
      const val = opt?.values?.find(v => v.id === valueId);
      if (!val) return prev;

      const selected = [
        ...ln.options.selected.filter(s => s.optionId !== optionId),
        { optionId, value: val },
      ];

      const nextUnit = deriveUnitPrice(ln.basePrice, selected);

      const newSig = lineSignature(ln.product, selected);
      const otherIndex = prev.findIndex(
        (x, i) => i !== idx && lineSignature(x.product, x.options?.selected || null) === newSig
      );
      if (otherIndex >= 0) {
        const merged = prev.slice();
        const mergedQty = merged[otherIndex].quantity + ln.quantity;
        merged[otherIndex] = { ...merged[otherIndex], quantity: mergedQty, qtyInput: String(mergedQty) };
        merged.splice(idx, 1);
        return merged;
      }
      const copy = prev.slice();
      copy[idx] = { ...ln, options: { ...ln.options, selected }, unitPrice: nextUnit };
      return copy;
    });
  }

  // Coupons
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponAmt, setCouponAmt] = useState(0);

  async function applyCoupon() {
    const code = coupon.trim();
    setCouponErr(null); setCouponAmt(0); setCouponId(null);
    if (!code) return;
    if (!customer?.id) { setCouponErr("Choose a customer first."); return; }

    try {
      const subtotal = cart.reduce((s, l) => s + (l.quantity * (l.unitPrice || 0)), 0);
      const res = await previewCouponAdmin(code, { customerId: Number(customer.id), orderTotal: subtotal });
      const off = Number(res?.discount || 0);
      if (off > 0) {
        setCouponAmt(off);
        if (res?.couponId != null) setCouponId(Number(res.couponId));
      } else {
        setCouponErr("Coupon not applicable.");
      }
    } catch (e: any) {
      const msg = (e?.message || "Coupon validation failed.").toString();
      setCouponErr(msg);
    }
  }
  function clearCoupon() {
    setCoupon(""); setCouponErr(null); setCouponAmt(0); setCouponId(null);
  }


  // Partners + shipping
  const [partners, setPartners] = useState<DeliveryPartnerLite[]>([]);
  const [partnerId, setPartnerId] = useState<number | "">("");
  const [intlCarrier, setIntlCarrier] = useState<string>("");

  const [shippingFee, setShippingFee] = useState(0);
  const [shippingFeeInput, setShippingFeeInput] = useState<string>("0"); // NEW: lenient input buffer
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingErr, setShippingErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try { const p = await listActivePartners(); if (live) setPartners(p || []); } catch { }
    })();
    return () => { live = false; };
  }, []);

  // Keep buffer in sync if fee recalculates
  useEffect(() => {
    setShippingFeeInput(String(Number(shippingFee || 0)));
  }, [shippingFee]);

  // Domestic: auto calculate; International: manual entry (lenient)
  async function refreshShipping() {
    if (isIntl) { setShippingErr(null); return; }
    const addr = selectedAddress;
    if (!addr) { setShippingFee(0); setShippingErr("Select an address to compute shipping."); return; }
    setShippingLoading(true);
    setShippingErr(null);
    try {
      const subtotal = cart.reduce((s, l) => s + (l.quantity * (l.unitPrice || 0)), 0);
      const { fee } = await previewShipping({
        itemsSubtotal: subtotal,
        stateId: addr.stateId ?? undefined,
        districtId: addr.districtId ?? undefined,
      });
      setShippingFee(Number(fee || 0));
    } catch (e: any) {
      setShippingFee(0);
      const msg = (e?.response?.data?.message || e?.message || "Could not compute shipping.").toString();
      setShippingErr(msg);
    } finally {
      setShippingLoading(false);
    }
  }

  useEffect(() => {
    if (!isIntl) { void refreshShipping(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntl, selectedAddrId, cart]);

  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + (l.quantity * (l.unitPrice || 0)), 0),
    [cart]
  );
  const grand = useMemo(
    () => Math.max(0, subtotal + Number(shippingFee || 0) - Number(couponAmt || 0)),
    [subtotal, shippingFee, couponAmt]
  );

  // Create order
  const [note, setNote] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (!customer?.id) return "Choose or create a customer";
    if (!selectedAddress) return "Select or add a shipping address";
    if (!cart.length) return "Add at least one product";
    if (!isIntl && !partnerId) return "Select a delivery partner for domestic orders";
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) { setToast({ kind: "bad", msg: problem }); return; }

    const addr = selectedAddress!;
    const indiaFlow = !isIntl;

    // resolve partner name for courier (domestic)
    const selectedPartner = indiaFlow && typeof partnerId === "number"
      ? partners.find(p => p.id === Number(partnerId))
      : null;

    // shipping fee: include for BOTH flows
    const feeNum = Number.isFinite(Number(shippingFee)) ? Number(shippingFee) : 0;

    // --- build OrderDto (flat) ---
    const dto: any = {
      customerId: Number(customer!.id),
      status: "ORDERED",

      itemsSubtotal: Number(subtotal || 0),
      discountTotal: Number(couponAmt || 0),
      shippingFee: feeNum,                                   // ✅ send fee for domestic & international
      currency,                                              // "INR"
      couponCode: coupon.trim() || undefined,
      couponId: couponId ?? undefined,
      courierName: isIntl
        ? (intlCarrier?.trim() || undefined)                // ✅ intl: free text from input
        : (selectedPartner?.name || selectedPartner?.code || undefined), // ✅ domestic: partner name/code

      deliveryPartnerId: indiaFlow && selectedPartner ? selectedPartner.id : undefined,

      externalReference: externalRef?.trim() || undefined,
      orderNotes: note?.trim() || undefined,

      shipName: addr.name || "",
      shipPhone: addr.phone || undefined,
      shipLine1: addr.line1 || "",
      shipLine2: addr.line2 || undefined,
      shipPincode: addr.pincode || "",

      shipCountryId: typeof addr.countryId === "number" ? addr.countryId : undefined,
      shipStateId: typeof addr.stateId === "number" ? addr.stateId : undefined,
      shipDistrictId: typeof addr.districtId === "number" ? addr.districtId : undefined,
    };

    // Validate critical IDs before POST
    if (!dto.customerId) { setToast({ kind: "bad", msg: "customerId missing" }); return; }
    if (!dto.shipCountryId) { setToast({ kind: "bad", msg: "Country missing on shipping address" }); return; }
    if (indiaFlow) {
      if (!dto.shipStateId) { setToast({ kind: "bad", msg: "State is required for India shipments" }); return; }
      if (!dto.shipDistrictId) { setToast({ kind: "bad", msg: "District is required for India shipments" }); return; }
      if (!dto.shipPincode?.trim()) { setToast({ kind: "bad", msg: "PIN code is required for India shipments" }); return; }
    }

    // --- build items from cart ---
    const itemsPayload = cart.map(l => {
      const selected = l.options?.selected || [];
      const optionsText = selected.length
        ? selected.map(s => s.value.valueLabel).join(" / ")
        : undefined;

      const optionsJson = selected.map(s => ({
        optionId: s.optionId,
        valueId: s.value.id,
        valueLabel: s.value.valueLabel,
        priceDelta: s.value.priceDelta ?? null,
      }));

      const qty = Number(l.quantity || 0);
      const unit = Number(l.unitPrice || 0);

      return {
        // OrderItemDto fields expected by backend
        productId: l.product.id,
        productName: l.product.name,
        productSlug: String(l.product.id),  // or a real slug if you have it
        quantity: qty,
        unitPrice: unit,
        lineTotal: qty * unit,
        optionsText,
        optionsJson,
        active: true,
      };
    });

    if (!itemsPayload.length) { setToast({ kind: "bad", msg: "Add at least one product" }); return; }

    setBusy(true);
    try {
      const created = await createManualOrder({ order: dto, items: itemsPayload });
      setToast({ kind: "ok", msg: `Order ${created.publicCode ? `BB${created.publicCode}` : ""} created` });
      nav(`/admin/orders?code=${encodeURIComponent(created.publicCode || "")}`, { replace: true });
    } catch (e: any) {
      const msg = (e?.response?.data?.message || e?.message || "Create failed").toString();
      setToast({ kind: "bad", msg });
    } finally {
      setBusy(false);
    }
  }


  // ──────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────
  return (
    <div className="wrap">
      <style>{css}</style>

      {toast && (
        <div className={`toast ${toast.kind}`} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <header className="hd">
        <div className="tit">
          <h2>Create Order</h2>
          <p className="muted">Domestic / International → Customer & Address → Products → Coupon/Shipping → Create</p>
        </div>
        <div className="hd-actions">
          <Link className="ghost as-btn" to="/admin/orders"><span>← Back to orders</span></Link>
        </div>
      </header>

      {/* Step 1: Destination */}
      <section className="card pad">
        <div className="segrow">
          <div className="segline">
            <span className="lab">Destination</span>
            <div className="segs">
              <button type="button" className={"seg" + (dest === "DOMESTIC" ? " on" : "")} onClick={() => setDest("DOMESTIC")}>Domestic</button>
              <button type="button" className={"seg" + (dest === "INTERNATIONAL" ? " on" : "")} onClick={() => setDest("INTERNATIONAL")}>International</button>
            </div>
          </div>
          <div className="segline">
            <span className="lab">Currency</span>
            <span className="muted">{currency}</span>
          </div>
        </div>
      </section>

      {/* Step 2: Customer */}
      <section className="card pad" style={{ marginTop: 12 }}>
        <div className="row-inline">
          <label className="grow">
            <div className="lab">Customer</div>
            <div className="combo">
              <input
                value={custQuery}
                onChange={(e) => { setCustQuery(e.target.value); setCustomer(null); }}
                placeholder="Type ID or name/phone/email…"
                onFocus={() => setCustOpen(!!custSuggests?.length)}
              />
              {custOpen && custSuggests && custSuggests.length > 0 && (
                <div className="dropdown pretty">
                  {custSuggests.map(c => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="dd-item"
                    >
                      <div className="dd-line"><b>{c.id}</b> — {c.name || c.fullName || "Customer"}</div>
                      <div className="dd-sub">{[c.phone].filter(Boolean).join(" • ")}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <button className="ghost as-btn" type="button" onClick={() => setNewCustOpen(true)}>+ New</button>
        </div>
        {customer?.id && <div className="muted" style={{ marginTop: 6 }}>Selected: #{customer.id} — {customer.name || customer.fullName || "Customer"}</div>}

        {newCustOpen && (
          <div className="inline-modal">
            <div className="inline-hd">
              <strong>New Customer</strong>
              <button className="ghost sm" onClick={() => setNewCustOpen(false)}>✕</button>
            </div>
            <div className="form-grid">
              <label>
                <div className="lab">Full name *</div>
                <input value={newCust.fullName} onChange={e => setNewCust(c => ({ ...c, fullName: e.target.value }))} />
              </label>
              <label>
                <div className="lab">Email (optional)</div>
                <input type="email" value={newCust.email || ""} onChange={e => setNewCust(c => ({ ...c, email: e.target.value }))} placeholder="customer@example.com" />
              </label>
              <label>
                <div className="lab">Phone *</div>
                <div className="phone-field">
                  <span className="phone-prefix">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={(newCust.phone || "").replace(/^\+91/, "")}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setNewCust(c => ({ ...c, phone: digits ? `+91${digits}` : "" }));
                    }}
                    placeholder="9876543210"
                  />
                </div>
              </label>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Either email or phone is required.</div>
            <div className="end-row">
              <button className="ghost as-btn" onClick={() => setNewCustOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={createNewCustomer}>Save customer</button>
            </div>
          </div>
        )}
      </section>

      {/* Step 3: Address */}
      <section className="card pad" style={{ marginTop: 12 }}>
        <div className="lab" style={{ fontWeight: 900, marginBottom: 8 }}>
          Shipping Address ({isIntl ? "International" : "India"})
        </div>

        {!customer?.id ? (
          <div className="muted">Choose or create a customer to manage addresses.</div>
        ) : addrLoading ? (
          <div>Loading addresses…</div>
        ) : (
          <div className="addr">
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
                    <br />
                    {isIntl ? (
                      [
                        selectedAddress.pincode || "",
                        countryNameById(selectedAddress.countryId) || "",
                      ].filter(Boolean).join(" • ")
                    ) : (
                      [
                        districtNameById(selectedAddress.districtId) || "",
                        stateNameById(selectedAddress.stateId) || "",
                        selectedAddress.pincode || "",
                        countryNameById(selectedAddress.countryId) || "",
                      ].filter(Boolean).join(" • ")
                    )}
                  </div>
                </div>
                <div className="btns">
                  <button className="ghost as-btn" onClick={() => setSelectSheetOpen(true)}>Change</button>
                  <button className="ghost as-btn" onClick={() => openNewAddress(isIntl ? "intl" : "domestic")}>New</button>
                </div>
              </div>
            ) : (
              <div className="cur">
                <div>No {isIntl ? "international" : "Indian"} addresses.</div>
                <div className="btns">
                  <button className="ghost as-btn" onClick={() => openNewAddress(isIntl ? "intl" : "domestic")}>Add address</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 4: Products */}
      <section className="card pad" style={{ marginTop: 12 }}>
        <div className="lab" style={{ fontWeight: 900, marginBottom: 10 }}>Add Products</div>
        <div className="prod-add">
          <div className="combo">
            <input
              value={qry}
              onChange={e => setQry(e.target.value)}
              placeholder="Search products by ID or name…"
              onFocus={() => setProdOpen(!!prodSuggests?.length)}
            />
            {prodOpen && prodSuggests && prodSuggests.length > 0 && (
              <div className="dropdown pretty">
                {prodSuggests.map(s => {
                  const base = resolveBasePrice(s);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => { addProduct(s); setQry(""); setProdSuggests(null); setProdOpen(false); }}
                      className="dd-item"
                    >
                      <div className="dd-line">{s.name}</div>
                      <div className="dd-sub">#{s.id} • {fmtCurrency(base, currency)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="cart">
          <div className="thead">
            <div>Product</div>
            <div>Options</div>
            <div>Qty</div>
            <div>Unit</div>
            <div>Total</div>
            <div></div>
          </div>

          {cart.length === 0 ? (
            <div className="pad muted">No products added yet.</div>
          ) : cart.map(line => (
            <div className="trow" key={line.key}>
              <div className="prod-cell">
                <div className="pname">{line.product.name}</div>
                <div className="muted tiny">#{line.product.id}</div>
              </div>

              <div className="opts-cell">
                {line.options && line.options.metas.length > 0 ? (
                  <div className="opts-grid">
                    {line.options.metas.map(opt => (
                      <div className="opt" key={opt.id}>
                        <div className="opt-lab">{opt.name}</div>
                        <select
                          value={line.options!.selected.find(s => s.optionId === opt.id)?.value.id ?? ""}
                          onChange={(e) => onPickOptionValue(line.key, opt.id, Number(e.target.value))}
                        >
                          <option value="" disabled>Select…</option>
                          {opt.values.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.valueLabel}
                              {typeof v.priceDelta === "number" && v.priceDelta > 0
                                ? ` (${fmtCurrency(v.priceDelta, currency)})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="muted tiny">—</span>
                )}
              </div>

              <div className="qty-cell">
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="num"
                  value={line.qtyInput ?? String(line.quantity)}
                  onChange={(e) => onQtyInput(line.key, e.target.value)}
                  onBlur={() => onQtyBlur(line.key)}
                />
              </div>

              <div className="unit-cell">{fmtCurrency(line.unitPrice, currency)}</div>
              <div className="total-cell">{fmtCurrency((Number(line.qtyInput ?? line.quantity) || line.quantity) * (line.unitPrice || 0), currency)}</div>
              <div><button type="button" className="ghost sm as-btn" onClick={() => removeLine(line.key)}>Remove</button></div>
            </div>
          ))}
        </div>
      </section>

      {/* Step 5: Summary */}
      <section className="card sum" style={{ marginTop: 12 }}>
        <div className="section-head">Summary</div>
        <div className="sum-inner">
          <div className="row-sum"><span>Subtotal</span><span>{fmtCurrency(subtotal, currency)}</span></div>

          <div className="coupon-row">
            <div className="grow">
              <div className="lab">Coupon code</div>
              <input
                className="inp"
                value={coupon}
                onChange={e => setCoupon(e.target.value)}
                placeholder="e.g. FESTIVE10"
                onKeyDown={(e) => { if (e.key === "Enter") applyCoupon(); }}
              />
              {couponErr && <div className="small err-text">{couponErr}</div>}
              {couponAmt > 0 && <div className="small ok-text">Coupon applied: −{fmtCurrency(couponAmt, currency)}</div>}
            </div>
            <div className="hstack coupon-btns">
              <button className="ghost as-btn" onClick={applyCoupon} disabled={!coupon.trim() || !customer?.id}>Apply</button>
              <button className="ghost as-btn" onClick={clearCoupon} disabled={!coupon.trim() && !couponErr && !(couponAmt > 0)}>Clear</button>
            </div>
          </div>

          {!isIntl ? (
            <>
              <div className="row-sum">
                <span>Shipping</span>
                <span>
                  {shippingLoading ? "Calculating…" : (shippingErr ? "—" : fmtCurrency(shippingFee || 0, "INR"))}
                </span>
              </div>
              <div>
                <div className="lab">Delivery partner</div>
                <select className="sel" value={partnerId} onChange={(e) => setPartnerId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select a partner…</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.code ? ` (${p.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="row-sum">
                <span>Shipping (International)</span>
                <span style={{ minWidth: 180, display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="inp inp-sm num"
                    type="number"
                    min={0}
                    step="0.01"
                    value={shippingFeeInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // allow empty and partial decimals while typing
                      if (raw === "" || /^(\d+(\.\d{0,2})?)$/.test(raw)) {
                        setShippingFeeInput(raw);
                        if (raw !== "") setShippingFee(Number(raw));
                      }
                    }}
                    onBlur={() => {
                      const n = Math.max(0, Number(shippingFeeInput || 0));
                      setShippingFee(n);
                      setShippingFeeInput(String(n));
                    }}
                    placeholder="0.00"
                    style={{ width: 140 }}
                  />
                  <span className="muted">INR</span>
                </span>
              </div>
              <div>
                <div className="lab">Logistics provider (International)</div>
                <input className="inp" value={intlCarrier} onChange={e => setIntlCarrier(e.target.value)} placeholder="e.g. DHL / FedEx reference" />
              </div>
            </>
          )}

          <div>
            <div className="lab">External Reference Number (Payment reference)</div>
            <input
              className="inp"
              value={externalRef}
              onChange={e => setExternalRef(e.target.value)}
              placeholder="e.g. UTR / bank ref / Razorpay ref"
            />
          </div>

          <div className="row-sum total">
            <span>Total</span>
            <span>{fmtCurrency(grand, currency)}</span>
          </div>

          {shippingErr && !isIntl && (
            <div className="small err-text">{shippingErr}</div>
          )}

          <div>
            <div className="lab">Admin Note (optional)</div>
            <input className="inp" value={note} onChange={e => setNote(e.target.value)} placeholder="Visible in order timeline" />
          </div>

          <div className="actions">
            <button className="btn primary" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create Order"}
            </button>
            <Link className="btn secondary as-btn" to="/admin/orders">Cancel</Link>
          </div>
        </div>
      </section>

      {/* Address selection sheet */}
      {selectSheetOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="sheet">
            <div className="sheet-hd">
              <strong>Select an address</strong>
              <div className="hstack">
                <button className="ghost as-btn" onClick={() => setSelectSheetOpen(false)}>✕</button>
              </div>
            </div>

            <div className="sheet-bd">
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
                      title={a.isDefault ? "Default address" : "Click to use this address"}
                    >
                      <div className="addr-icon">{a.name?.[0]?.toUpperCase() || "A"}</div>
                      <div className="addr-info">
                        <div className="nm">
                          {a.name}{a.isDefault && <span className="addr-badge">Default</span>}
                        </div>
                        <div className="addr-meta">
                          {a.phone ? `${a.phone} • ` : ""}
                          {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                          <br />
                          {[
                            isIntl ? undefined : distNm,
                            isIntl ? undefined : stateNm,
                            a.pincode || "",
                            ctryNm,
                          ].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sheet-ft">
              <button
                className="ghost as-btn"
                onClick={() => openNewAddress(isIntl ? "intl" : "domestic")}
              >
                + New address
              </button>
              <button className="ghost as-btn" onClick={() => setSelectSheetOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* New Address Modal */}
      {newAddrOpen && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="na-sheet">
            <div className="sheet-hd">
              <strong>Add a new address {isIntl ? "(International)" : "(India)"}</strong>
              <button className="ghost as-btn" onClick={() => { setNewAddrOpen(false); }}>✕</button>
            </div>

            <div className="na-bd">
              {naErr && <div className="alert">{naErr}</div>}
              <div>
                <div className="lbl">Recipient name *</div>
                <input className="inp" value={naName} onChange={e => setNaName(e.target.value)} />
              </div>
              <div className="na-row2">
                <div>
                  <div className="lbl">Phone *</div>
                  <input className="inp" value={naPhone} onChange={e => setNaPhone(e.target.value)} placeholder={isIntl ? "+49 176..." : "+91 9xxxxxxxxx"} />
                </div>
                <div>
                  <div className="lbl">Pincode / ZIP *</div>
                  <input className="inp" value={naPincode} onChange={e => setNaPincode(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="lbl">Address line 1 *</div>
                <input className="inp" value={naLine1} onChange={e => setNaLine1(e.target.value)} />
              </div>
              <div>
                <div className="lbl">Address line 2 *</div>
                <input className="inp" value={naLine2} onChange={e => setNaLine2(e.target.value)} />
              </div>

              {!isIntl ? (
                <>
                  <div className="na-row2">
                    <div>
                      <div className="lbl">State *</div>
                      <select
                        className="sel"
                        value={naStateId}
                        onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ""; setNaStateId(v); setNaDistrictId(""); }}
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
                        onChange={(e) => setNaDistrictId(e.target.value ? Number(e.target.value) : "")}
                        disabled={typeof naStateId !== "number" || loadingDistricts}
                      >
                        <option value="">{loadingDistricts ? "Loading…" : "Select district…"}</option>
                        {modalDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="small" style={{ opacity: .8 }}>
                    Country: <strong>{countryNameById(INDIA_ID) || "India"}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <div className="lbl">Country *</div>
                  <select
                    className="sel"
                    value={naCountryId}
                    onChange={(e) => setNaCountryId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select country…</option>
                    {countries
                      .filter(c => !INDIA_ID || c.id !== INDIA_ID)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <label className="checkline">
                <input type="checkbox" checked={naMakeDefault} onChange={e => setNaMakeDefault(e.target.checked)} />
                <span className="small">Make default {isIntl ? "international" : "shipping"} address</span>
              </label>
            </div>

            <div className="sheet-ft">
              <button className="ghost as-btn" onClick={() => { setNewAddrOpen(false); }}>Cancel</button>
              <button className="btn primary" onClick={saveNewAddress} disabled={naBusy}>
                {naBusy ? "Saving…" : "Save & use this"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (restored number spinners; kept steady coupon buttons)
// ─────────────────────────────────────────────────────────────────────────────
const css = `
.wrap{ padding:12px; color:${PRIMARY}; background:${BG}; }
.muted{ opacity:.75; font-size:12px; }
.tiny{ font-size:11px; }

/* header */
.hd{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
  margin-bottom:12px; padding: 10px 12px;
  border:1px solid ${INK}; border-radius:14px; background:#fff;
  box-shadow:0 12px 36px rgba(0,0,0,.08);
}
.hd h2{ margin:0; font-family: "DM Serif Display", Georgia, serif; }
.hd-actions{ display:flex; gap:8px; align-items:center; }
.as-btn{
  display:inline-flex; align-items:center; justify-content:center;
  white-space: nowrap;
  padding: 0 14px; min-height:34px; border-radius:10px;
  width: auto; max-width: 100%;
}
.as-btn span{ overflow: hidden; text-overflow: ellipsis; }

/* buttons */
.ghost{
  min-height:34px; padding:0 12px; border:1px solid ${INK};
  background:#fff; border-radius:10px; cursor:pointer; color:${PRIMARY};
  line-height:32px; text-decoration:none; width:auto;
}
.ghost.sm{ min-height:28px; line-height:26px; font-size:12.5px; padding:0 10px; }
.ghost:hover{ box-shadow:0 8px 20px rgba(0,0,0,.08); transform: translateY(-1px); }

/* cards */
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; overflow: visible; box-shadow:0 12px 36px rgba(0,0,0,.08); }
.pad{ padding:12px; }

/* labels/inputs */
.lab{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:4px; }
.inp, .sel{ height:38px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; width:100%; background:#fff; }
.sel{ height:34px; }
.inp-sm { height: 34px; }
.err-text{ color:#b0003a; }
.ok-text{ color:#136f2a; }

/* layout helpers */
.form-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
.form-grid .span-2{ grid-column: 1 / span 2; }
@media (max-width: 680px){ .form-grid{ grid-template-columns: 1fr; } .form-grid .span-2{ grid-column: 1 / span 1; } }
.row-inline{ display:flex; gap:10px; align-items:flex-end; }
.row-inline .grow{ flex:1; }
.end-row{ display:flex; justify-content:flex-end; gap:8px; }
.hstack{ display:flex; gap:8px; align-items:center; }

/* segment buttons */
.segrow{ display:grid; gap:10px; }
.segline{ display:flex; align-items:center; gap:12px; flex-wrap: wrap; }
.segline .lab{ min-width:90px; }
.segs{ display:flex; gap:6px; flex-wrap:wrap; }
.seg{
  height:32px; padding:0 12px; border:1px solid ${INK}; border-radius:999px; background:#fff; cursor:pointer; font-weight:900;
  display:inline-flex; align-items:center;
}
.seg.on{ background:${GOLD}; border-color:transparent; }

/* combos & dropdowns */
.combo{ position:relative; }
.combo input{
  width:100%; height:36px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.dropdown{
  position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid ${INK};
  border-radius:10px; overflow:hidden; margin-top:6px; max-height:280px; overflow:auto; z-index:1000;
}
.dropdown.pretty{ box-shadow:0 12px 32px rgba(0,0,0,.12); border-color:rgba(0,0,0,.06); }
.dd-item{
  width:100%; text-align:left; display:block; padding:10px 12px; border-bottom:1px solid ${INK}; background:#fff; cursor:pointer;
}
.dd-item:hover{ background:#fafafa; }
.dd-line{ font-weight:700; }
.dd-sub{ font-size:12px; opacity:.8; }

/* inline new-customer modal */
.inline-modal{
  margin-top:12px; border:1px dashed ${INK}; border-radius:12px; padding:10px; background:#fffdf7;
}
.inline-hd{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }

/* address cards */
.addr .cur{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; border:1px dashed ${INK}; border-radius:12px; padding:10px; }
.addr .meta .name{ font-weight:900; }
.addr .meta .lines{ font-size:13px; opacity:.9; }
.addr .btns{ display:flex; gap:8px; }
.badge{ font-size:11px; font-weight:800; padding:2px 8px; border-radius:999px; background: rgba(246,195,32,.22); }

/* overlays */
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
.sheet-hd{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-bottom:1px solid ${INK}; }
.sheet-bd{ padding:12px; overflow:auto; }
.sheet-ft{ display:flex; justify-content:flex-end; gap:8px; padding:10px 12px; border-top:1px solid ${INK}; }

.addr-grid{ display:grid; gap:10px; }
.addr-card{
  border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 10px 28px rgba(0,0,0,.06);
  padding:10px; display:grid; grid-template-columns: 30px 1fr; gap:10px; cursor:pointer; align-items:center;
}
.addr-card:hover{ background:#fafafa; }
.addr-icon{ width:28px; height:28px; border-radius:8px; border:1px solid ${INK}; display:grid; place-items:center; font-weight:900; }
.addr-info{ font-size:13px; line-height:1.35; }
.addr-info .nm{ font-weight:900; display:flex; align-items:center; gap:8px; }
.addr-badge{ font-size:11px; padding:2px 8px; border-radius:999px; background: rgba(246,195,32,.22); white-space:nowrap; }
.addr-meta{ opacity:.9; }

/* products table */
.prod-add{ margin-bottom:10px; }
.cart{ margin-top:8px; }
.thead, .trow{
  display:grid; grid-template-columns: 1.6fr 1.8fr 110px 120px 120px 100px;
  gap:8px; padding:8px 0; align-items:center; border-bottom:1px dashed ${INK};
}
.thead{ font-weight:900; font-size:12px; background:#fafafa; padding:8px; border:1px solid ${INK}; border-radius:10px; }
.trow:last-child{ border-bottom:none; }
.prod-cell .pname{ font-weight:800; }
.opts-grid{ display:grid; gap:8px; }
.opt-lab{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:2px; }
.num{ width:100%; height:32px; border:1px solid ${INK}; border-radius:8px; padding:0 8px; outline:none; }

/* summary */
.sum{ position:relative; }
.section-head{ padding:10px 12px; border-bottom:1px solid ${INK}; background:linear-gradient(180deg, rgba(246,195,32,.08), rgba(255,255,255,.95)); font-weight:900; font-size:13px; }
.sum-inner{ padding:12px; display:grid; gap:10px; }
.row-sum{ display:flex; align-items:center; justify-content:space-between; gap:8px; }

/* Keep coupon buttons aligned even when helper text toggles */
.coupon-row{ display:flex; gap:10px; align-items:flex-start; }
.coupon-row .grow{ flex:1; }
.coupon-btns{ align-self:flex-start; margin-top:22px; }

.total{ font-size:20px; font-weight:900; }
.actions{ display:grid; gap:8px; margin-top:6px; }
.btn{
  min-height:42px; border:none; border-radius:12px; font-weight:900; cursor:pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
  padding: 0 16px; width: auto;
}
.primary{ background:${ACCENT}; color:#fff; box-shadow:0 12px 28px rgba(240,93,139,.28); }
.primary:hover{ transform: translateY(-1px); box-shadow:0 16px 40px rgba(240,93,139,.36); background:#f1497b; }
.secondary{ background:${GOLD}; color:#2b2b2b; box-shadow:0 10px 20px rgba(246,195,32,.22); }
.secondary:hover{ transform: translateY(-1px); box-shadow:0 14px 30px rgba(246,195,32,.30); background:#f5bd07; }

.small{ font-size:12px; opacity:.75; }
.alert{
  margin:10px 0; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25);
}
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

@media (max-width: 1000px){
  .thead, .trow{ grid-template-columns: 1fr 1fr 90px 100px 100px 80px; }
}

/* NOTE: We intentionally DO NOT hide number input spinners anymore */

/* Phone input with prefix */
.phone-field{ display:flex; align-items:center; border:1px solid ${INK}; border-radius:10px; background:#fff; overflow:hidden; }
.phone-field .phone-prefix{ padding:0 10px; background:#f5f5f5; border-right:1px solid ${INK}; font-weight:700; color:${PRIMARY}; height:36px; display:flex; align-items:center; }
.phone-field input{ flex:1; height:36px; border:none; padding:0 10px; outline:none; background:transparent; }
`;
