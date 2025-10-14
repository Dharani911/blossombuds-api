import React, { useEffect, useMemo, useState } from "react";
import {
  getByPublicCode,
  getByCustomer,
  listItems,
  listPayments,
  listEvents,
  patchStatus,
  addEvent,
  fetchInvoicePdf,
  fetchPackingSlipPdf,
  type OrderLite,
  type OrderItem,
  type Payment,
  type OrderEvent,
  type OrderStatus,
  // real helpers from your adminOrders.ts
  searchCustomersLite,
  searchProductsLite,
  getProductOptionsLite,
  createManualOrder,
} from "../../api/adminOrders";

/* Brand palette */
const PRIMARY = "#4A4F41";
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const BG      = "#FAF7E7";
const INK     = "rgba(0,0,0,.08)";

const statuses: OrderStatus[] = [
  "ORDERED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED_REFUNDED",
];

const fmtMoney = (n:number) => `₹${Number(n || 0).toFixed(2)}`;

/** ────────────────────────── Main Page ────────────────────────── **/
export default function OrdersPage() {
  const [code, setCode] = useState("");
  const [custId, setCustId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [active, setActive] = useState<OrderLite | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => { setActive(orders[0] || null); }, [orders]);

  async function search() {
    setLoading(true);
    try {
      if (code.trim()) {
        const one = await getByPublicCode(code.trim());
        setOrders(one ? [one] : []);
      } else if (custId.trim()) {
        const list = await getByCustomer(Number(custId));
        setOrders(list || []);
      } else {
        setOrders([]);
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Search failed" });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function reloadForCustomer(customerId?: number) {
    if (!customerId) return;
    setCustId(String(customerId));
    setCode("");
    await search();
  }

  return (
    <div className="ord-wrap">
      <style>{css}</style>

      {toast && (
        <div className={`toast ${toast.kind}`} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <header className="hd">
        <div className="tit">
          <h2>Orders</h2>
          <p className="muted">Find orders by public code or customer ID. Update status, view items, payments & timeline.</p>
        </div>
        <div className="searchbar" onKeyDown={(e)=>{ if(e.key==='Enter') search(); }}>
          <div className="box">
            <input
              placeholder="Public code (e.g. BB-AB12CD)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="sep">or</div>
          <div className="box">
            <input
              placeholder="Customer ID"
              value={custId}
              onChange={(e) => setCustId(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button type="button" className="btn" onClick={search} disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>

          <div className="spacer" />
          <button type="button" className="btn" onClick={()=>setCreateOpen(true)}>New Order</button>
        </div>
      </header>

      <main className="grid">
        <aside className="left card">
          {loading ? (
            <div className="pad">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="pad muted">No results yet. Search by code or customer.</div>
          ) : (
            <div className="olist">
              {orders.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  className={"oitem" + (active?.id === o.id ? " active" : "")}
                  onClick={() => setActive(o)}
                >
                  <div className="top">
                    <strong>{o.publicCode}</strong>
                    <span className={"badge s-" + (o.status || "ORDERED").toLowerCase()}>
                      {o.status}
                    </span>
                  </div>
                  <div className="sub">
                    <span>#{o.id}</span>
                    <span>{fmtMoney(o.grandTotal || 0)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="right">
          {active ? (
            <OrderDetail o={active} setToast={setToast} />
          ) : (
            <div className="card pad muted">Select an order</div>
          )}
        </section>
      </main>

      {createOpen && (
        <CreateOrderDrawer
          onClose={()=>setCreateOpen(false)}
          onCreated={(created)=> {
            setToast({ kind:"ok", msg:`Order ${created.publicCode} created` });
            setCreateOpen(false);
            reloadForCustomer(created.customerId);
          }}
          setToast={setToast}
        />
      )}
    </div>
  );
}

/** ────────────────────────── Order Detail ────────────────────────── **/
function OrderDetail({
  o,
  setToast,
}: {
  o: OrderLite;
  setToast: (t: { kind: "ok" | "bad"; msg: string } | null) => void;
}) {
  const [items, setItems] = useState<OrderItem[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [events, setEvents] = useState<OrderEvent[] | null>(null);

  const [updBusy, setUpdBusy] = useState(false);
  const [selStatus, setSelStatus] = useState<OrderStatus>(o.status as OrderStatus);
  const [statusNote, setStatusNote] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [it, pay, ev] = await Promise.all([
          listItems(o.id),
          listPayments(o.id),
          listEvents(o.id),
        ]);
        if (!live) return;
        setItems(it || []);
        setPayments(pay || []);
        setEvents(ev || []);
      } catch {
        setItems([]);
        setPayments([]);
        setEvents([]);
      }
    })();
    return () => { live = false; };
  }, [o.id]);

  useEffect(() => {
    setSelStatus(o.status as OrderStatus);
    setStatusNote("");
  }, [o.id, o.status]);

  async function applyStatus() {
    setUpdBusy(true);
    try {
      await patchStatus(o.id, selStatus, statusNote || undefined);
      const ev = await listEvents(o.id);
      setEvents(ev);
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Status update failed" });
    } finally {
      setUpdBusy(false);
    }
  }

  async function addNote() {
    const msg = note.trim();
    if (!msg) return;
    try {
      const ev = await addEvent(o.id, { type: "NOTE", message: msg });
      setEvents((prev) => [ev, ...(prev || [])]);
      setNote("");
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Could not add note" });
    }
  }

  async function openPrint(kind: "invoice" | "packing") {
    const win = window.open("", "_blank");
    if (!win) { setToast({ kind: "bad", msg: "Popup blocked. Allow popups for this site." }); return; }
    try {
      const blob = kind === "invoice" ? await fetchInvoicePdf(o.id) : await fetchPackingSlipPdf(o.id);
      const url = URL.createObjectURL(blob);
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e:any) {
      win.close();
      setToast({ kind: "bad", msg: e?.message || "Could not open PDF." });
    }
  }

  const shipAddress = useMemo(() => {
    const parts: string[] = [];
    if (o.shipName) parts.push(o.shipName);
    if (o.shipPhone) parts.push(o.shipPhone);
    if (o.shipLine1) parts.push(o.shipLine1);
    if (o.shipLine2) parts.push(o.shipLine2);
    if (o.shipPincode) parts.push(o.shipPincode);
    return parts.join(" · ");
  }, [o.shipName, o.shipPhone, o.shipLine1, o.shipLine2, o.shipPincode]);

  return (
    <div className="detail">
      <div className="head card">
        <div className="row">
          <div>
            <h3>{o.publicCode}</h3>
            <div className="muted">Order #{o.id}</div>
          </div>
          <div className="actions">
            <select disabled={updBusy} value={selStatus} onChange={(e) => setSelStatus(e.target.value as OrderStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              className="status-note"
              placeholder="(optional) note to timeline…"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
            />
            <button type="button" className="btn sm" disabled={updBusy} onClick={applyStatus}>
              {updBusy ? "Updating…" : "Apply"}
            </button>

            <div className="print-group">
              <button type="button" className="ghost sm" onClick={() => openPrint("invoice")}>Invoice PDF</button>
              <button type="button" className="ghost sm" onClick={() => openPrint("packing")}>Packing Slip</button>
            </div>
          </div>
        </div>

        <div className="facts">
          <span>Customer: {o.customerId ?? "—"}</span>
          <span>Total: {fmtMoney(o.grandTotal || 0)}</span>
          {typeof o.shippingFee === "number" && <span>Shipping: {fmtMoney(o.shippingFee)}</span>}
          {shipAddress && <span>Ship: {shipAddress}</span>}
        </div>
      </div>

      <div className="cols">
        <div className="col card">
          <h4>Items</h4>
          {!items ? (
            <div className="pad">Loading…</div>
          ) : items.length === 0 ? (
            <div className="pad muted">No items</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Product</div>
                <div>Qty</div>
                <div>Unit</div>
                <div>Total</div>
              </div>
              {items.map((it) => (
                <div className="trow" key={it.id}>
                  <div>
                    <div>{it.productName}</div>
                    {it.optionsText && <div className="muted" style={{ fontSize: 12 }}>{it.optionsText}</div>}
                  </div>
                  <div>{it.quantity}</div>
                  <div>{fmtMoney(it.unitPrice || 0)}</div>
                  <div>{fmtMoney(it.lineTotal || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col card">
          <h4>Payments</h4>
          {!payments ? (
            <div className="pad">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="pad muted">No payments</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Gateway</div>
                <div>Ref</div>
                <div>Amount</div>
                <div>When</div>
              </div>
              {payments.map((p) => (
                <div className="trow" key={p.id}>
                  <div>{p.gateway || "—"}</div>
                  <div>{p.ref || "—"}</div>
                  <div>{fmtMoney(p.amount || 0)}</div>
                  <div>{p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="note">
          <input
            placeholder="Add admin note to timeline…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button type="button" className="btn sm" onClick={addNote}>Add</button>
        </div>
        <h4>Timeline</h4>
        {!events ? (
          <div className="pad">Loading…</div>
        ) : events.length === 0 ? (
          <div className="pad muted">No events</div>
        ) : (
          <ul className="timeline">
            {events.map((ev) => (
              <li key={ev.id}>
                <div className="when">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""}</div>
                <div className="what"><b>{ev.type}</b> — {ev.message}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** ────────────────────────── Create Order Drawer ────────────────────────── **/

type CustomerPick = { id: number; name?: string; email?: string; phone?: string };
type ProductPick   = { id: number; name: string };

type OptionValueLite = { id:number; valueLabel:string; priceDelta:number; };
type ProductOptionLite = { id:number; name:string; values: OptionValueLite[] };

type SelectedValue = { optionId: number; value: OptionValueLite };

type CartLine = {
  key: string;
  product: ProductPick;
  quantity: number;
  unitPrice: number; // sum of selected value priceDeltas OR 0 if none chosen
  options: {
    metas: ProductOptionLite[];   // includes values loaded once
    selected: SelectedValue[];    // chosen values for each option
  } | null;
};

function CreateOrderDrawer({
  onClose,
  onCreated,
  setToast,
}: {
  onClose: () => void;
  onCreated: (o: { id:number; publicCode:string; customerId:number }) => void;
  setToast: (t: { kind: "ok" | "bad"; msg: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  // Customer search + choose
  const [customerField, setCustomerField] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [custSuggests, setCustSuggests] = useState<CustomerPick[] | null>(null);
  const [custOpen, setCustOpen] = useState(false);

  // Product search
  const [qry, setQry] = useState("");
  const [prodSuggests, setProdSuggests] = useState<ProductPick[] | null>(null);
  const [prodOpen, setProdOpen] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [shippingFee, setShippingFee] = useState<string>("0");
  const [note, setNote] = useState("");

  // Lock body scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // search customers (debounced)
  useEffect(() => {
    let live = true;
    const k = customerField.trim();
    if (!k) { setCustSuggests(null); setCustOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchCustomersLite(k);
        if (!live) return;
        setCustSuggests(res || []);
        setCustOpen(true);
      } catch {
        if (live) { setCustSuggests([]); setCustOpen(false); }
      }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [customerField]);

  // product search (debounced)
  useEffect(() => {
    let live = true;
    const q = qry.trim();
    if (!q) { setProdSuggests(null); setProdOpen(false); return; }
    const t = setTimeout(async () => {
      try{
        const list = await searchProductsLite(q);
        if (!live) return;
        setProdSuggests(list || []);
        setProdOpen(true);
      }catch{
        if (live) { setProdSuggests([]); setProdOpen(false); }
      }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [qry]);

  function lineSignature(p: ProductPick, selected?: SelectedValue[] | null) {
    const base = `p:${p.id}`;
    if (!selected || selected.length === 0) return base;
    const ids = selected.map(v => `${v.optionId}:${v.value.id}`).sort().join("|");
    return `${base}|${ids}`;
  }

  function calcUnitPriceFromSelected(selected?: SelectedValue[] | null) {
    if (!selected || selected.length === 0) return 0;
    return selected.reduce((sum, v) => sum + Number(v.value?.priceDelta || 0), 0);
  }

  // add/merge product
  async function addProduct(p: ProductPick) {
    // load options (with values)
    const metas = await getProductOptionsLite(p.id); // [{ id, name, values:[{id,valueLabel,priceDelta}] }, ...]
    let line: CartLine = {
      key: crypto.randomUUID(),
      product: p,
      quantity: 1,
      unitPrice: 0,
      options: null,
    };

    if (metas && metas.length > 0) {
      line.options = { metas, selected: [] };
      line.unitPrice = 0; // until values chosen
      // Do not merge yet (we don’t know the selection) — append a new line
      setCart(prev => [...prev, line]);
      return;
    }

    // No options → merge by product id
    setCart(prev => {
      const sig = lineSignature(p, null);
      const found = prev.findIndex(x => lineSignature(x.product, x.options?.selected || null) === sig);
      if (found >= 0) {
        const copy = prev.slice();
        copy[found] = { ...copy[found], quantity: copy[found].quantity + 1 };
        return copy;
      }
      return [...prev, { ...line, unitPrice: 0 }]; // unit price is 0 when there are no option deltas
    });
  }

  function removeLine(k: string) {
    setCart(prev => prev.filter(x => x.key !== k));
  }

  function setQty(k:string, val:string) {
    const n = Math.max(1, Number(val || 1));
    setCart(prev => prev.map(x => x.key===k ? { ...x, quantity: n } : x));
  }

  // when user chooses a value for a specific option
  function onPickOptionValue(lineKey: string, optionId: number, valueId: number) {
    setCart(prev => {
      const idx = prev.findIndex(x => x.key === lineKey);
      if (idx < 0) return prev;

      const ln = prev[idx];
      if (!ln.options) return prev;

      // find chosen value from cached metas
      const opt = ln.options.metas.find(m => m.id === optionId);
      const val = opt?.values?.find(v => v.id === valueId);
      if (!val) return prev;

      const selected = [
        ...ln.options.selected.filter(s => s.optionId !== optionId),
        { optionId, value: val },
      ];

      // If all options chosen, compute signature and attempt merge
      const unitPrice = calcUnitPriceFromSelected(selected);

      const newSig = lineSignature(ln.product, selected);
      const otherIndex = prev.findIndex(
        (x, i) => i !== idx && lineSignature(x.product, x.options?.selected || null) === newSig
      );

      if (otherIndex >= 0) {
        const merged = prev.slice();
        merged[otherIndex] = { ...merged[otherIndex], quantity: merged[otherIndex].quantity + ln.quantity };
        merged.splice(idx, 1);
        return merged;
      }

      const copy = prev.slice();
      copy[idx] = { ...ln, options: { ...ln.options, selected }, unitPrice };
      return copy;
    });
  }

  const subtotal = useMemo(() => {
    return cart.reduce((sum, ln) => sum + (Number(ln.quantity||0) * Number(ln.unitPrice||0)), 0);
  }, [cart]);

  const grand = useMemo(() => {
    return subtotal + Number(shippingFee || 0);
  }, [subtotal, shippingFee]);

  async function submit() {
    if (!customerId) { setToast({kind:"bad", msg:"Choose a customer"}); return; }
    const lines = cart.filter(l => l.product && l.quantity>0);
    if (lines.length === 0) { setToast({kind:"bad", msg:"Add at least one product"}); return; }

    setBusy(true);
    try{
      const payload = {
        customerId: customerId,
        shippingFee: Number(shippingFee || 0),
        note: note?.trim() || undefined,
        items: lines.map(l => ({
          productId: l.product.id,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice || 0),
          optionValueIds: l.options?.selected?.map(s => s.value.id) || [],
        })),
      };
      const created = await createManualOrder(payload);
      onCreated(created);
    }catch(e:any){
      setToast({ kind:"bad", msg: e?.response?.data?.message || e?.message || "Create failed" });
    }finally{
      setBusy(false);
    }
  }

  function pickCustomer(c: CustomerPick) {
    setCustomerField(`${c.id} — ${c.name || c.email || c.phone || "Customer"}`);
    setCustomerId(c.id);
    setCustOpen(false);
  }

  return (
    <div className="drawer" role="dialog" aria-modal="true">
      {/* Backdrop closes the drawer */}
      <div
        className="drawer-backdrop"
        onMouseDown={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="drawer-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-hd">
          <div className="ttl">Create Order</div>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>Close</button>
        </div>

        {/* Whole drawer scrolls */}
        <div className="drawer-body">
          {/* Customer picker */}
          <div className="form-grid">
            <label className="span-2">
              <div className="lab">Customer</div>
              <div className="combo">
                <input
                  value={customerField}
                  onChange={(e)=>{ setCustomerField(e.target.value); setCustomerId(null); }}
                  placeholder="Type ID or name (e.g. 5 or Dharani)…"
                  onFocus={()=> setCustOpen(!!custSuggests?.length)}
                />
                {custOpen && custSuggests && custSuggests.length > 0 && (
                  <div className="dropdown">
                    {custSuggests.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={()=>pickCustomer(c)}
                        className="dd-item"
                      >
                        <div className="dd-line"><b>{c.id}</b> — {c.name || "Customer"}</div>
                        <div className="dd-sub">{c.email || c.phone || ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerId ? <div className="muted tiny">Chosen: #{customerId}</div> : null}
            </label>

            <label className="span-2">
              <div className="lab">Admin Note (optional)</div>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Visible in order timeline" />
            </label>
          </div>

          {/* Product search */}
          <div className="prod-add">
            <div className="lab">Add products</div>
            <div className="combo">
              <input
                value={qry}
                onChange={e=>setQry(e.target.value)}
                placeholder="Search products by name / SKU…"
                onFocus={()=> setProdOpen(!!prodSuggests?.length)}
              />
              {prodOpen && prodSuggests && prodSuggests.length>0 && (
                <div className="dropdown">
                  {prodSuggests.map(s=>(
                    <button
                      type="button"
                      key={s.id}
                      onClick={()=>{ addProduct(s); setQry(""); setProdSuggests(null); setProdOpen(false); }}
                      className="dd-item"
                    >
                      <div className="dd-line">{s.name}</div>
                      <div className="dd-sub">#{s.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="cart card">
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
            ) : cart.map(line=>(
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
                            onChange={(e)=> onPickOptionValue(line.key, opt.id, Number(e.target.value))}
                          >
                            <option value="" disabled>Select…</option>
                            {opt.values.map(v => (
                              <option key={v.id} value={v.id}>{v.valueLabel}</option>
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
                    value={line.quantity}
                    onChange={(e)=> setQty(line.key, e.target.value)}
                  />
                </div>

                <div className="unit-cell">{fmtMoney(line.unitPrice)}</div>
                <div className="total-cell">{fmtMoney((line.quantity||0)*(line.unitPrice||0))}</div>
                <div><button type="button" className="ghost sm" onClick={()=>removeLine(line.key)}>Remove</button></div>
              </div>
            ))}
          </div>

          {/* Shipping & Totals */}
          <div className="sum-grid">
            <label className="ship">
              <div className="lab">Shipping Fee</div>
              <input
                className="num"
                value={shippingFee}
                onChange={e=>setShippingFee(e.target.value.replace(/[^\d.]/g,""))}
                placeholder="0.00"
              />
            </label>

            <div className="totals card">
              <div className="row"><span>Subtotal</span><b>{fmtMoney(subtotal)}</b></div>
              <div className="row"><span>Shipping</span><b>{fmtMoney(Number(shippingFee||0))}</b></div>
              <div className="row grand"><span>Grand Total</span><b>{fmtMoney(grand)}</b></div>
            </div>
          </div>

          <div className="actions-row">
            <button type="button" className="btn" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */
const css = `
.ord-wrap{ padding:12px; color:${PRIMARY}; background:${BG}; }
.muted{ opacity:.75; font-size:12px; }
.tiny{ font-size:11px; }

.hd{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
  margin-bottom:12px; padding: 10px 12px;
  border:1px solid ${INK}; border-radius:14px; background:#fff;
  box-shadow:0 12px 36px rgba(0,0,0,.08);
}
.hd h2{ margin:0; font-family: "DM Serif Display", Georgia, serif; }
.searchbar{ display:flex; align-items:center; gap:8px; width:100%; }
.searchbar .box{ position:relative; }
.searchbar input{
  height:38px; border:1px solid ${INK}; border-radius:12px; padding:0 12px; background:#fff; outline:none;
}
.sep{ opacity:.7; font-weight:800; }
.spacer{ flex:1; }

.grid{ display:grid; grid-template-columns: 340px 1fr; gap:12px; }
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,.08); }
.pad{ padding:12px; }

.olist{ display:grid; }
.oitem{
  text-align:left; padding:10px 12px; border-bottom:1px solid ${INK}; background:#fff; cursor:pointer;
}
.oitem:hover{ background:#fafafa; }
.oitem.active{ background:rgba(246,195,32,.12); border-left:3px solid ${GOLD}; }
.oitem .top{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.oitem .sub{ display:flex; align-items:center; justify-content:space-between; gap:10px; opacity:.9; font-size:12px; }

.badge{
  height:22px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:900; display:inline-grid; place-items:center;
  color:#fff; background:${PRIMARY};
}
.badge.s-ordered{ background:${ACCENT}; }
.badge.s-dispatched{ background:#7AA2E3; }
.badge.s-delivered{ background:#4caf50; }
.badge.s-cancelled{ background:#d32f2f; }
.badge.s-refunded{ background:#9c27b0; }
.badge.s-returned_refunded{ background:${PRIMARY}; }

.right{ min-width:0; display:grid; gap:12px; }

/* Detail */
.head .row{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px; padding:12px;
  border-bottom:1px solid ${INK};
}
.head h3{ margin:0; }
.actions{ display:flex; align-items:center; gap:8px; }
.actions select, .actions .status-note{
  height:34px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.actions .status-note{ width:240px; }
.print-group{ display:flex; align-items:center; gap:6px; margin-left:6px; }

.facts{ display:flex; flex-wrap:wrap; gap:10px; padding:10px 12px; font-size:12.5px; background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.92)); }

.cols{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
.col{ overflow:hidden; }
.col h4{ margin:10px 12px; }

.table{ display:grid; }
.thead, .trow{
  display:grid; grid-template-columns: 1fr 80px 100px 120px; gap:8px; padding:8px 12px; align-items:center;
}
.thead{ font-weight:900; font-size:12px; background:#fafafa; border-bottom:1px solid ${INK}; }
.trow{ border-bottom:1px solid ${INK}; }
.trow:last-child{ border-bottom:none; }

/* note */
.note{ display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid ${INK}; }
.note input{
  flex:1; height:34px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}

.timeline{ list-style:none; margin:0; padding:8px 12px; display:grid; gap:8px; }
.timeline li{ display:grid; grid-template-columns: 180px 1fr; gap:10px; }
.timeline .when{ font-size:12px; opacity:.85; }
.timeline .what{ font-size:14px; }

/* btns */
.btn{
  height:38px; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:${ACCENT}; color:#fff; font-weight:900; box-shadow:0 10px 28px rgba(240,93,139,.35);
}
.btn.sm{ height:32px; padding:0 12px; font-size:12.5px; border-radius:10px; }
.ghost{
  height:32px; padding:0 10px; border-radius:10px; border:1px solid ${INK};
  background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.sm{ height:28px; font-size:12.5px; }
.ghost:hover{ box-shadow:0 8px 20px rgba(0,0,0,.08); transform: translateY(-1px); }

/* Drawer container (overlay) */
.drawer{
  position:fixed; inset:0; z-index:120;
  display:flex; justify-content:flex-end;
  overscroll-behavior: contain; /* prevent background scroll chaining */
}

/* Backdrop (click to close) */
.drawer-backdrop{
  position:absolute; inset:0;
  background:rgba(0,0,0,.25);
  z-index:1;
}

/* The right panel itself (fixed height, no scroll) */
.drawer-panel{
  position:relative;
  width:min(920px, 96vw);
  height:100vh;               /* full viewport */
  max-height:100vh;
  background:#fff;
  border-left:1px solid rgba(0,0,0,.08);
  box-shadow:-8px 0 36px rgba(0,0,0,.18);
  display:flex;               /* flex column container */
  flex-direction:column;
  overflow:hidden;            /* header fixed; only body scrolls */
  animation: slideIn .18s ease both;
  z-index:2;                  /* above the backdrop */
}
@keyframes slideIn{ from{ transform:translateX(12px); opacity:.6 } to{ transform:none; opacity:1 } }

/* Header fixed at top of panel */
.drawer-hd{
  flex:0 0 auto;
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:12px; border-bottom:1px solid rgba(0,0,0,.08);
}

/* Scrolling body */
.drawer-body{
  flex:1 1 auto;              /* fill remaining height */
  min-height:0;               /* allow shrink for overflow */
  overflow:auto;              /* scroll here */
  -webkit-overflow-scrolling: touch;
  padding:12px;
  display:grid; gap:12px;
}

/* Ensure cards inside drawer can expand; only drawer-body scrolls */
.drawer-body .card{ overflow:visible; }

/* inputs + dropdowns */
.form-grid{
  display:grid; grid-template-columns: 1fr 1fr; gap:10px;
}
.form-grid .lab, .prod-add .lab{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:4px; }
.form-grid input, .form-grid select{
  height:36px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.form-grid .span-2{ grid-column: 1 / span 2; }

.combo{ position:relative; }
.combo input{
  width:100%; height:36px; border:1px solid ${INK}; border-radius:10px; padding:0 10px; outline:none; background:#fff;
}
.dropdown{
  position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid ${INK};
  border-radius:10px; overflow:hidden; margin-top:6px; max-height:280px; overflow:auto; z-index:5;
}
.dd-item{
  width:100%; text-align:left; display:block; padding:8px 10px; border-bottom:1px solid ${INK}; background:#fff; cursor:pointer;
}
.dd-item:hover{ background:#fafafa; }
.dd-line{ font-weight:700; }
.dd-sub{ font-size:12px; opacity:.8; }

/* product add section */
.prod-add .combo{ margin-top:4px; }

/* cart */
.cart .thead, .cart .trow{ grid-template-columns: 1.6fr 1.8fr 110px 120px 120px 100px; }
.cart .prod-cell .pname{ font-weight:800; }
.opts-grid{ display:grid; gap:8px; }
.opt-lab{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:2px; }
.num{ width:100%; height:32px; border:1px solid ${INK}; border-radius:8px; padding:0 8px; outline:none; }

.sum-grid{
  display:grid; grid-template-columns: 1fr 320px; gap:12px; align-items:start;
}
.sum-grid .ship .lab{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:4px; }
.totals{ border:1px solid ${INK}; border-radius:12px; padding:10px 12px; }
.totals .row{ display:flex; align-items:center; justify-content:space-between; padding:6px 0; }
.totals .grand{ font-size:16px; font-weight:900; border-top:1px dashed ${INK}; margin-top:4px; padding-top:8px; }

.actions-row{ display:flex; justify-content:flex-end; }

/* toast */
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }

/* responsive */
@media (max-width: 1100px){
  .grid{ grid-template-columns: 1fr; }
  .cols{ grid-template-columns: 1fr; }
  .actions{ flex-wrap:wrap; }
  .actions .status-note{ width:100%; }
  .timeline li{ grid-template-columns: 1fr; }

  .form-grid{ grid-template-columns: 1fr; }
  .form-grid .span-2{ grid-column: 1 / span 1; }

  .cart .thead, .cart .trow{ grid-template-columns: 1fr 1fr 90px 100px 100px 80px; }

  .sum-grid{ grid-template-columns: 1fr; }
}
`;
