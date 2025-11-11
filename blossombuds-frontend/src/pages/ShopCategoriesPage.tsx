import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Seo from "../components/Seo";
import ProductQuickView from "../components/ProductQuickView";
import {
  getCategories,
  getCategory,
  listChildCategories,
  listProductsByCategory,
  listProductImages,
  type Category,
  type Product,
  type PageResp,
} from "../api/catalog";

/* Compact product card (slightly bigger, 2-line name) */
function SmallProductCard({ p, onOpen }: { p: Product; onOpen: (id:number)=>void }) {
  const img = p.primaryImageUrl || "";
  const priceText = (() => {
    const v = (p as any)?.price;
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
    } catch {
      return String(v);
    }
  })();

  return (
    <button className="p" onClick={()=>onOpen(p.id)} title={p.name} aria-label={`Open ${p.name}`}>
      <div className="thumb">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="ph" />}
      </div>
      <div className="meta">
        <div className="name" title={p.name}>{p.name}</div>
        {priceText && <div className="price">{priceText}</div>}
      </div>
    </button>
  );
}

export default function ShopCategoriesPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [cats, setCats] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const parents = useMemo(() => (cats || []).filter(c => c.parentId == null), [cats]);
  const selectedParentId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [id]);

  const [subs, setSubs] = useState<Category[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [prodBySub, setProdBySub] = useState<Record<number, Product[]>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});

  // modal state
  const [qvId, setQvId] = useState<number | null>(null);

  // load all categories
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoadingCats(true); setErr(null);
        const all = await getCategories();
        if (!live) return;
        setCats(all || []);
      } catch (e:any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load categories.");
      } finally {
        if (live) setLoadingCats(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // auto-select first parent
  useEffect(() => {
    if (!loadingCats && parents.length > 0 && !selectedParentId) {
      nav(`/categories/${parents[0].id}`, { replace: true });
    }
  }, [loadingCats, parents, selectedParentId, nav]);

  // load subs for selected parent
  useEffect(() => {
    if (!selectedParentId) { setSubs([]); setProdBySub({}); return; }
    let live = true;
    (async () => {
      try {
        setLoadingSubs(true); setErr(null);
        const children = await listChildCategories(selectedParentId);
        if (!live) return;

        const sorted = (children || [])
          .filter(c => c.active !== false)
          .sort((a,b)=>(a.sortOrder ?? 0)-(b.sortOrder ?? 0) || a.name.localeCompare(b.name));

        if (sorted.length === 0) {
          const parent = cats.find(c => c.id === selectedParentId) || await getCategory(selectedParentId);
          if (!live) return;
          setSubs(parent ? [parent as Category] : []);
        } else {
          setSubs(sorted);
        }
      } catch (e:any) {
        if (!live) return;
        setSubs([]);
        setErr(e?.response?.data?.message || "Could not load subcategories.");
      } finally {
        if (live) setLoadingSubs(false);
      }
    })();
    return () => { live = false; };
  }, [selectedParentId, cats]);

  // load products for each sub, fill image if missing
 // inside ShopCategoriesPage, in the "load products for each subcategory" effect:
 useEffect(() => {
   if (subs.length === 0) { setProdBySub({}); return; }
   let live = true;
   (async () => {
     try {
       const entries = await Promise.all(
         subs.map(async sc => {
           const page: PageResp<Product> = await listProductsByCategory(sc.id, 0, 200);

           // ✅ show only products explicitly marked visible (true)
           let rows = (page?.content || []).filter((p: any) => {
             const v = (p?.visible ?? p?.isVisible ?? null);
             const isVisible = v === true;          // only explicit true passes
             const isActive  = p?.active !== false; // keep soft-deleted out
             return isActive && isVisible;
           }) as Product[];

           // featured first, then sortOrder, then name
           rows = rows.sort((a: any, b: any) => {
             const fa = a?.featured ? 1 : 0;
             const fb = b?.featured ? 1 : 0;
             if (fb - fa !== 0) return fb - fa;
             const so = (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0);
             if (so !== 0) return so;
             return String(a?.name || "").localeCompare(String(b?.name || ""));
           });

           // backfill primary image if missing
           await Promise.all(rows.map(async (p, i) => {
             if (!p.primaryImageUrl) {
               try {
                 const imgs = await listProductImages(p.id);
                 if (imgs?.[0]?.url) rows[i].primaryImageUrl = imgs[0].url as any;
               } catch {/* ignore */}
             }
           }));

           return [sc.id, rows] as const;
         })
       );

       if (!live) return;
       const map: Record<number, Product[]> = {};
       const opens: Record<number, boolean> = {};
       for (const [sid, rows] of entries) {
         map[sid] = rows;
         opens[sid] = true;
       }
       setProdBySub(map);
       setOpen(opens);
     } catch {
       if (!live) return;
       setProdBySub({});
     }
   })();
   return () => { live = false; };
 }, [subs]);



  const setSelectedParent = (pid: number) => nav(`/categories/${pid}`);
  const toggle = (sid: number) => setOpen(m => ({ ...m, [sid]: !m[sid] }));

  return (
    <div className="wrap">
      <Seo title="Categories • Blossom & Buds" />
      <style>{css}</style>

      <div className="shell">
        {/* LEFT menu */}
        <aside className="menu card">
          <div className="m-head">Categories</div>
          <div className="m-list">
            {loadingCats && <div className="muted pad">Loading…</div>}
            {!loadingCats && parents.length === 0 && <div className="muted pad">No categories.</div>}
            {!loadingCats && parents.map(c => (
              <button
                key={c.id}
                className={"m-item" + (c.id === selectedParentId ? " active" : "")}
                onClick={() => setSelectedParent(c.id)}
                title={c.name}
              >
                <span className="dot" />
                <span className="lbl">{c.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* RIGHT content */}
        <main className="content">
          {err && <div className="alert">{err}</div>}

          {!selectedParentId && !loadingCats && (
            <div className="pad muted">Select a category to browse products.</div>
          )}

          {selectedParentId && loadingSubs && <div className="pad">Loading…</div>}

          {selectedParentId && !loadingSubs && subs.map(sc => {
            const rows = prodBySub[sc.id] || [];
            const openNow = !!open[sc.id];
            return (
              <section key={sc.id} className="sec card">
                <header
                  className="sec-hd"
                  onClick={() => toggle(sc.id)}
                  role="button"
                  aria-expanded={openNow}
                >
                  <div className="sec-title">
                    <h3>{sc.name}</h3>
                    {sc.description && <p className="muted">{sc.description}</p>}
                  </div>
                  <span className={"caret" + (openNow ? " on" : "")} aria-hidden>▾</span>
                </header>

                {openNow && (
                  rows.length === 0
                    ? <div className="pad muted">No products in this subcategory.</div>
                    : (
                      <div className="grid">
                        {rows.map(p => (
                          <SmallProductCard key={p.id} p={p} onOpen={(pid)=> setQvId(pid)} />
                        ))}
                      </div>
                    )
                )}
              </section>
            );
          })}
        </main>
      </div>

      {qvId != null && (
        <ProductQuickView
          productId={qvId}
          onClose={() => setQvId(null)}
        />
      )}
    </div>
  );
}

/* ───────── styles ───────── */
const css = `
.wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 70vh; }
.shell{
  max-width:1200px; margin:0 auto; padding:12px 12px 20px;
  display:grid; grid-template-columns: 280px 1fr; gap:12px;
}
.menu, .content{ min-width:0; }
@media (max-width: 980px){ .shell{ grid-template-columns: 1fr; } }

.card{ background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:14px; box-shadow:0 12px 34px rgba(0,0,0,.08); overflow:hidden; }
.pad{ padding:12px; }
.muted{ opacity:.8; font-size:12px; }
.alert{ padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); margin-bottom:10px; }

/* left sidebar */
.menu{ position:sticky; top:84px; align-self:start; }
.m-head{
  font-weight:900; font-size:12px; padding:10px 12px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.95));
}
.m-list{ padding:8px; display:grid; gap:6px; max-height: calc(100vh - 180px); overflow:auto; }
.m-item{
  display:flex; align-items:center; gap:8px; padding:10px 12px;
  border-radius:10px; border:1px solid rgba(0,0,0,.06); background:#fff; cursor:pointer;
  transition: background .15s ease, border-color .15s ease, transform .15s ease, box-shadow .15s ease;
  box-shadow: 0 8px 20px rgba(0,0,0,.06);
}
.m-item:hover{ background:#fafafa; transform: translateY(-1px); }
.m-item.active{ background: rgba(246,195,32,.16); border-color: rgba(246,195,32,.35); }
.m-item .dot{ width:8px; height:8px; border-radius:999px; background: var(--bb-accent-2); opacity:.95; }
.m-item .lbl{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:800; }

/* sections */
.sec{ margin-bottom:12px; }
.sec-hd{
  padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  cursor:pointer;
}
.sec-title h3{ margin:0; font-size:16px; font-weight:900; }
.sec-title p{ margin:4px 0 0; font-size:12px; opacity:.85; }
.caret{ transition: transform .18s ease, opacity .18s ease; opacity:.75; }
.caret.on{ transform: rotate(180deg); }

/* product grid + cards */
.grid{ padding:12px; display:grid; gap:12px; grid-template-columns: repeat(4, minmax(0,1fr)); }
@media (max-width: 1200px){ .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 900px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px){ .grid{ grid-template-columns: 1fr; } }

.p{
  display:flex; flex-direction:column; text-decoration:none; color:inherit;
  border:1px solid rgba(0,0,0,.08); border-radius:12px; overflow:hidden; background:#fff;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.p:hover{ transform: translateY(-2px); border-color: rgba(246,195,32,.35); box-shadow: 0 16px 36px rgba(0,0,0,.12); }
.thumb{ aspect-ratio: 1/1; background:#f7f7f7; display:grid; place-items:center; }
.p img{ width:100%; height:100%; object-fit:cover; display:block; }
.ph{ width:100%; height:100%; background: linear-gradient(90deg, #eee, #f8f8f8, #eee); background-size:200% 100%; animation: shimmer 1.15s linear infinite; }
.meta{ padding:10px; display:grid; grid-template-columns: 1fr auto; align-items:center; gap:8px; }
.name{
  font-weight:800; font-size:14px; line-height:1.25;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.price{ font-weight:900; font-size:13px; color: var(--bb-accent); }

@keyframes shimmer{ from{ background-position: 200% 0; } to { background-position: -200% 0; } }
`;
