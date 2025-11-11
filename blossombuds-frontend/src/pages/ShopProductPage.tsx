// src/pages/ShopProductPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Seo from "../components/Seo";
import {
  getProduct,
  listProductImages,
  listOptionValues,
  type Product,
  type ProductImage,
  type ProductOptionWithValues,
} from "../api/catalog";
import { useCart } from "../app/CartProvider";

export default function ProductPage() {
  const { id } = useParams();
  const productId = Number(id);
  const { add } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const isModal = Boolean((location.state as any)?.background);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [p, setP] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [cur, setCur] = useState(0);

  const [opts, setOpts] = useState<ProductOptionWithValues[]>([]);
  const [sel, setSel] = useState<Record<number, number>>({});
  const [qty, setQty] = useState(1);

  // fetch product, images, and options (values include absolute prices)
  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      setErr("Invalid product.");
      setLoading(false);
      return;
    }

    let live = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const [prod, imgs, options] = await Promise.all([
          getProduct(productId),
          listProductImages(productId),
          // shape: [{id,name,required,active?,values:[{id,valueLabel,active?,priceDelta (absolute)}]}]
          listOptionValues(productId),
        ]);
        if (!live) return;

        setP(prod || null);

        const sortedImgs = (imgs || [])
          .filter((im) => im?.url)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setImages(sortedImgs);

        // only active options; default to first active value
        const activeOptions = (options || []).filter((o) => o.active !== false);
        const initialSel: Record<number, number> = {};
        activeOptions.forEach((o) => {
          const vals = (o.values || []).filter((v) => v.active !== false);
          if (vals.length > 0) initialSel[o.id] = vals[0].id;
        });
        setOpts(activeOptions);
        setSel(initialSel);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load product.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [productId]);

  // price = selected value's absolute price (first match), else base price
  const unitPrice = useMemo(() => {
    for (const o of opts) {
      const vId = sel[o.id];
      const v = o.values.find((x) => x.id === vId);
      if (v && typeof v.priceDelta === "number") return Number(v.priceDelta);
    }
    return Number(p?.price ?? 0);
  }, [opts, sel, p?.price]);

  const priceText = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
        unitPrice
      );
    } catch {
      return `₹${unitPrice.toFixed(2)}`;
    }
  }, [unitPrice]);

  function onPick(optionId: number, valueId: number) {
    setSel((s) => ({ ...s, [optionId]: valueId }));
  }

  // unavailable = disabled or hidden
  const unavailable = Boolean(p && ((p as any).active === false || (p as any).visible === false));

  function onAdd() {
    if (!p || unavailable) return;
    for (const o of opts) {
      if (o.required && !sel[o.id]) {
        alert(`Please select: ${o.name}`);
        return;
      }
    }
    const optionValueIds = Object.values(sel);
    add?.({
      id: `${p.id}:${optionValueIds.sort().join("-") || "base"}`,
      name: p.name,
      price: unitPrice,
      qty: Math.max(1, qty | 0),
      image: images[0]?.url || p.primaryImageUrl || "",
      variant:
        opts
          .map((o) => {
            const v = o.values.find((x) => x.id === sel[o.id]);
            return v ? `${o.name}: ${v.valueLabel}` : null;
          })
          .filter(Boolean)
          .join(" • ") || undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 800);
  }

  // modal chrome
  const overlayRef = useRef<HTMLDivElement>(null);
  function close() {
    if (isModal) navigate(-1);
  }
  useEffect(() => {
    if (!isModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModal]);

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) close();
  }

  const hero = images[cur]?.url || p?.primaryImageUrl || "";

  // “Added to cart” pulse
  const [added, setAdded] = useState(false);

  // shared content (blurred & disabled via wrapper when unavailable)
  const Content = (
    <div className={"wrap-shell" + (unavailable ? " is-unavail" : "")}>
      {unavailable && (
        <div className="unavail-banner" role="status" aria-live="polite">
          This product is unavailable{(p as any)?.visible === false ? " (hidden)" : ""}.
        </div>
      )}
      <div className="sheet" aria-disabled={unavailable}>
        <div className="left">
          <div className="carousel">
            <div className="view">
              {hero ? <img src={hero} alt={p?.name || "Product"} /> : <div className="ph" />}
            </div>
            {images.length > 1 && (
              <div className="dots" role="tablist" aria-label="Product images">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={"dot" + (i === cur ? " on" : "")}
                    onClick={() => !unavailable && setCur(i)}
                    aria-label={`Image ${i + 1}`}
                    role="tab"
                    aria-selected={i === cur}
                    disabled={unavailable}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="right">
          <h1 className="title">{p?.name || "Product"}</h1>
          <div className="price">{priceText}</div>

          {opts.map((o) => {
            const activeValues = o.values.filter((v) => v.active !== false);
            return (
              <div key={o.id} className="opt">
                <label>
                  {o.name}
                  {o.required ? " *" : ""}
                </label>
                <div className="select">
                  <select
                    value={sel[o.id] ?? activeValues[0]?.id ?? ""}
                    onChange={(e) => onPick(o.id, Number(e.target.value))}
                    disabled={unavailable}
                  >
                    {activeValues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.valueLabel}
                        {typeof v.priceDelta === "number"
                          ? ` • ₹${Number(v.priceDelta).toFixed(2)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <span className="chev">▾</span>
                </div>
              </div>
            );
          })}

          <div className="qty">
            <label htmlFor="qty">Qty</label>
            <input
              id="qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              disabled={unavailable}
            />
          </div>

          <div className="actions">
            <button
              className={"btn add" + (added ? " pulse" : "")}
              onClick={onAdd}
              disabled={unavailable}
              aria-disabled={unavailable}
              title={unavailable ? "Unavailable" : "Add to cart"}
            >
              Add to cart
            </button>
            {!isModal && (
              <Link
                to="/cart"
                className={"btn secondary" + (unavailable ? " disabled-link" : "")}
                aria-disabled={unavailable}
                onClick={(e) => {
                  if (unavailable) e.preventDefault();
                }}
              >
                Go to cart
              </Link>
            )}
          </div>

          {p?.description && (
            <div className="desc" dangerouslySetInnerHTML={{ __html: p.description }} />
          )}
        </div>
      </div>
    </div>
  );

  return isModal ? (
    <>
      <Seo title={p ? `${p.name} • Blossom & Buds` : "Product • Blossom & Buds"} />
      <div className="overlay" ref={overlayRef} onMouseDown={onBackdropClick}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={p?.name || "Product"}>
          <button className="close" aria-label="Close" onClick={close}>
            ✕
          </button>
          {err && <div className="alert">{err}</div>}
          {loading ? <div className="loading">Loading…</div> : Content}
        </div>
      </div>
      <style>{modalCss}</style>
    </>
  ) : (
    <div className="page">
      <style>{pageCss}</style>
      <Seo title={p ? `${p.name} • Blossom & Buds` : "Product • Blossom & Buds"} />
      <nav className="crumbs">
        <Link to="/">Home</Link>
        <span>›</span>
        <Link to="/categories">Categories</Link>
        <span>›</span>
        <span className="cur">{p?.name || "Product"}</span>
      </nav>
      {err && <div className="alert">{err}</div>}
      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="page-shell">{Content}</div>
      )}
    </div>
  );
}

/* ------------ styles: modal shell ------------ */
const modalCss = `
.overlay{
  position: fixed; inset:0; z-index: 120;
  background: rgba(0,0,0,.35);
  backdrop-filter: blur(6px) saturate(120%);
  display:grid; place-items:center; padding: 16px;
}
.modal{
  position: relative;
  width: min(100%, 980px);
  max-height: 90vh;
  overflow: auto;
  background:#fff; border:1px solid rgba(0,0,0,.08);
  border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.35);
  animation: pop .18s ease-out both;
  padding: 12px;
}
.close{
  position:absolute; top:10px; right:10px;
  width:36px; height:36px; border-radius:10px; border:1px solid rgba(0,0,0,.08);
  background:#fff; cursor:pointer; font-size:16px;
  box-shadow: 0 10px 26px rgba(0,0,0,.10);
}
.loading{ padding: 24px; }
.alert{ margin:10px; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }

/* unavailability UI */
.wrap-shell{ position: relative; }
.unavail-banner{
  position: sticky;
  top: 4px;
  z-index: 2;
  margin: 6px 0 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff3f5;
  color: #8a0030;
  border: 1px solid rgba(240,93,139,.25);
  font-weight: 800;
}
.is-unavail .sheet{
  filter: blur(1.5px) saturate(0.9);
  opacity: .65;
  pointer-events: none; /* blocks interactions */
}

/* shared content layout */
.sheet{ display:grid; grid-template-columns: 1.05fr 1fr; gap:14px; }
@media (max-width: 900px){ .sheet{ grid-template-columns: 1fr; } }

.carousel{ background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px; overflow:hidden; }
.view{ aspect-ratio: 4 / 3; background:#f7f7f7; }
.view img{ width:100%; height:100%; object-fit:cover; display:block; }
.dots{ display:flex; gap:8px; justify-content:center; padding:8px; }
.dot{ width:9px; height:9px; border-radius:999px; border:1px solid rgba(0,0,0,.25); background:#fff; }
.dot.on{ background: var(--bb-accent); border-color: var(--bb-accent); }

.right{ background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:14px; }
.title{ margin:0 0 6px; font-family:"DM Serif Display", Georgia, serif; font-size:24px; }
.price{ font-weight:900; color: var(--bb-accent); margin-bottom:10px; }

.opt{ margin:10px 0; }
.opt label{ display:block; font-weight:800; font-size:13px; margin-bottom:6px; }
.select{ position:relative; }
.select select{
  width:100%; height:40px; border:1px solid rgba(0,0,0,.10); border-radius:10px; padding:0 28px 0 12px; background:#fff; outline:none;
}
.select .chev{ position:absolute; right:10px; top:8px; font-size:18px; opacity:.65; pointer-events:none; }

.qty{ display:flex; gap:8px; align-items:center; margin:12px 0 4px; }
.qty input{ width:90px; height:38px; border:1px solid rgba(0,0,0,.10); border-radius:10px; padding:0 10px; }

.actions{ display:flex; gap:10px; margin-top:10px; }
.btn{
  display:inline-flex; align-items:center; justify-content:center; height:42px; padding:0 16px; border-radius:12px; border:none; cursor:pointer;
  background: var(--bb-accent); color:#fff; font-weight:900; box-shadow: 0 12px 28px rgba(240,93,139,.34);
}
.btn.secondary{ background: var(--bb-accent-2); color:#2b2b2b; box-shadow: 0 12px 28px rgba(246,195,32,.22); }
.btn.add.pulse{ animation: bump .5s ease; }
.disabled-link{ pointer-events: none; opacity: .7; }

.desc{ margin-top:12px; line-height:1.5; opacity:.95; }
.ph{ width:100%; height:100%; background:#f3f3f3; }

@keyframes pop{ from{ transform: scale(.98); opacity:0 } to { transform:none; opacity:1 } }
@keyframes bump{
  0%{ transform: scale(1); } 35%{ transform: scale(1.06); } 100%{ transform: scale(1); }
}
`;

/* ------------ styles: full page fallback ------------ */
const pageCss = `
.page{ max-width:1200px; margin:0 auto; padding: 12px 16px 24px; color: var(--bb-primary); }
.crumbs{ display:flex; gap:8px; align-items:center; opacity:.85; margin-bottom:8px; }
.crumbs a{ font-weight:700; color: var(--bb-primary); text-decoration:none; }
.page-shell{ }

/* reuse the same unavailability rules */
.wrap-shell{ position: relative; }
.unavail-banner{
  position: sticky;
  top: 4px;
  z-index: 2;
  margin: 6px 0 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff3f5;
  color: #8a0030;
  border: 1px solid rgba(240,93,139,.25);
  font-weight: 800;
}
.is-unavail .sheet{
  filter: blur(1.5px) saturate(0.9);
  opacity: .65;
  pointer-events: none;
}

.alert{ margin:10px 0; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }
`;
