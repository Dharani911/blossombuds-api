import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import {
  getCategory,
  listChildCategories,
  listProductsByCategory,
  type CategoryNode,
  type Product,
} from "../api/catalog";

/** Expandable product card */
function ExpandableProductCard({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);

  const priceText = useMemo(() => {
    if (p?.price == null) return "";
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(p.price));
    } catch {
      return String(p.price);
    }
  }, [p?.price]);

  return (
    <div className={"pcard" + (open ? " open" : "")}>
      <button className="hit" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="media">
          {p.primaryImageUrl ? (
            <img src={p.primaryImageUrl} alt={p.name} loading="lazy" />
          ) : (
            <div className="ph" aria-hidden />
          )}
        </div>
        <div className="meta">
          <div className="name">{p.name}</div>
          {priceText && <div className="price">{priceText}</div>}
        </div>
      </button>

      {open && (
        <div className="sheet">
          <div className="sheet-inner">
            {/* Left: gallery (if you fetch image list, plug it here) */}
            <div className="left">
              {p.primaryImageUrl ? (
                <img className="hero" src={p.primaryImageUrl} alt={p.name} />
              ) : (
                <div className="ph large" />
              )}
            </div>

            {/* Right: details */}
            <div className="right">
              <h3>{p.name}</h3>
              {priceText && <div className="price-lg">{priceText}</div>}
              {/* If your product response has description, show it. */}
              {(p as any).description && (
                <p className="desc">{(p as any).description}</p>
              )}

              {/* CTA area (wire later to PDP if you have it) */}
              <div className="actions">
                <Link to={`/products/${p.id}`} className="btn">
                  View details
                </Link>
                {/* Optionally: add-to-cart quick action if your API supports */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CategoryListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catId = Number(id);

  const [cat, setCat] = useState<CategoryNode | null>(null);
  const [children, setChildren] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!catId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [c, subs, prods] = await Promise.all([
          getCategory(catId),
          listChildCategories(catId),
          listProductsByCategory(catId, 0, 24),
        ]);
        if (!alive) return;
        setCat(c);
        setChildren(subs);
        setProducts(prods);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.response?.data?.message || "Could not load category.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [catId]);

  const hasChildren = children.length > 0;

  return (
    <div className="catlist-wrap">
      <Seo title={`${cat?.name || "Category"} • Blossom & Buds`} />
      <style>{css}</style>

      {/* Breadcrumb */}
      <div className="crumbs">
        <Link to="/">Home</Link>
        <span>›</span>
        <Link to="/categories">Categories</Link>
        <span>›</span>
        <span className="cur">{cat?.name || "Category"}</span>
      </div>

      {/* Header */}
      <header className="head">
        <div className="title">
          <h1>{cat?.name || "Category"}</h1>
          {cat?.description && <p>{cat.description}</p>}
        </div>
      </header>

      {err && <div className="alert">{err}</div>}

      {/* Subcategory chips */}
      {hasChildren && (
        <div className="chips">
          {children.map((sc) => (
            <button
              key={sc.id}
              className="chip"
              onClick={() => navigate(`/categories/${sc.id}`)}
            >
              {(sc as any).imageUrl ? (
                <img src={(sc as any).imageUrl} alt={sc.name} />
              ) : (
                <span className="dot" />
              )}
              <span>{sc.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      <main className="grid">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => <div className="pcard sk" key={i} />)}

        {!loading && products.length === 0 && (
          <div className="empty">
            No products in <strong>{cat?.name || "this category"}</strong>.
          </div>
        )}

        {!loading &&
          products.map((p) => <ExpandableProductCard key={p.id} p={p} />)}
      </main>
    </div>
  );
}

const css = `
.catlist-wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height:60vh; }
.crumbs{ max-width:1200px; margin:14px auto 0; padding:0 16px; display:flex; align-items:center; gap:8px; opacity:.85; }
.crumbs a{ color: var(--bb-primary); text-decoration:none; font-weight:700; }
.crumbs .cur{ font-weight:800; }

.head{ max-width:1200px; margin:8px auto 6px; padding:0 16px 8px; border-bottom:1px solid rgba(0,0,0,.06); }
.head h1{
  margin:0 0 6px; font-family: "DM Serif Display", Georgia, serif; font-size:28px;
}
.head p{ margin:0 0 8px; opacity:.92; }

.alert{ max-width:1200px; margin:10px auto; padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); }

.chips{ max-width:1200px; margin:10px auto 4px; padding:0 16px; display:flex; flex-wrap:wrap; gap:8px; }
.chip{
  display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; border:1px solid rgba(0,0,0,.08);
  background:#fff; cursor:pointer; box-shadow: 0 8px 26px rgba(0,0,0,.08);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.chip:hover{ transform: translateY(-1px); box-shadow: 0 12px 34px rgba(0,0,0,.10); border-color: rgba(246,195,32,.35); }
.chip img{ width:22px; height:22px; object-fit:cover; border-radius:999px; }
.chip .dot{ width:10px; height:10px; border-radius:999px; background: var(--bb-accent-2); }

.grid{
  max-width:1200px; margin:10px auto 40px; padding:0 16px;
  display:grid; grid-template-columns: repeat(3, 1fr); gap:14px;
}
@media (max-width: 1024px){ .grid{ grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px){ .grid{ grid-template-columns: 1fr; } }

.pcard{
  position:relative; background:#fff; border:1px solid rgba(0,0,0,.06); border-radius:16px; overflow:hidden;
  box-shadow:0 16px 40px rgba(0,0,0,.08); transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease;
}
.pcard:hover{ transform: translateY(-1px); border-color: rgba(246,195,32,.35); box-shadow: 0 22px 54px rgba(0,0,0,.12); }

.pcard .hit{
  display:block; width:100%; text-align:left; background:transparent; border:none; padding:0; cursor:pointer;
}
.pcard .media{ height:200px; overflow:hidden; }
.pcard .media img{ width:100%; height:100%; object-fit:cover; display:block; }
.pcard .ph{ width:100%; height:100%; background: radial-gradient(1000px 180px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff); }

.pcard .meta{ padding:10px 12px 12px; display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
.pcard .name{ font-weight:800; color: var(--bb-primary); }
.pcard .price{ font-weight:900; color: var(--bb-accent); }

.pcard .sheet{
  border-top:1px solid rgba(0,0,0,.06); background:#fff; animation: drop .24s cubic-bezier(.2,.8,.2,1) both;
}
.pcard .sheet-inner{
  display:grid; grid-template-columns: 1fr 1.1fr; gap:14px; padding:12px;
}
@media (max-width: 820px){ .pcard .sheet-inner{ grid-template-columns: 1fr; } }

.pcard .left .hero{ width:100%; border-radius:12px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
.pcard .left .large.ph{ height:260px; border-radius:12px; }

.pcard .right h3{ margin:0 0 6px; font-family: "DM Serif Display", Georgia, serif; }
.pcard .right .price-lg{ font-weight:900; color: var(--bb-accent); margin-bottom:8px; }
.pcard .right .desc{ margin:0 0 12px; opacity:.95; }

.pcard .actions{ display:flex; gap:10px; }
.pcard .btn{
  height:38px; padding:0 14px; border:none; border-radius:12px; font-weight:900; cursor:pointer;
  background: var(--bb-accent); color:#fff; box-shadow: 0 12px 28px rgba(240,93,139,.34);
}

.sk{
  height:260px; border-radius:16px; background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size:200% 100%; animation: shimmer 1.15s linear infinite;
}

@keyframes drop{ from{ opacity:0; transform: translateY(-6px);} to{ opacity:1; transform:none;} }
@keyframes shimmer{ from{ background-position: 200% 0; } to { background-position: -200% 0; } }
`;
