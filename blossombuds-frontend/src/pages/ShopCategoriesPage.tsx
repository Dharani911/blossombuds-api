// src/pages/ShopCategoriesPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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

/* ----------------------------- Small Product Card ----------------------------- */
/* Compact product card — matches FeaturedPage tile */
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
    <article
      className="ft-card"
      tabIndex={0}
      onClick={() => onOpen(p.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(p.id);
      }}
      aria-label={`${p.name}${priceText ? `, ${priceText}` : ""}`}
    >
      <div className="media">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <div className="ph" aria-hidden />}
      </div>

      <div className="meta">
        <div className="name" title={p.name}>{p.name}</div>
        {priceText && <div className="price">{priceText}</div>}
      </div>

      <button
        className="btn add"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(p.id); // open Quick View from here
        }}
        aria-label={`Open ${p.name}`}
      >
        Add to cart
      </button>
    </article>
  );
}


export default function ShopCategoriesPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [cats, setCats] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const parents = useMemo(() => (cats || []).filter((c) => c.parentId == null), [cats]);
  const selectedParentId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [id]);

  // mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);


  // maps for hierarchical rendering
  const [childrenMap, setChildrenMap] = useState<Record<number, Category[]>>({});
  const [productsMap, setProductsMap] = useState<Record<number, Product[]>>({});
  const [openNode, setOpenNode] = useState<Record<number, boolean>>({});
  const [loadingTree, setLoadingTree] = useState(false);
  // parent (selected) full record for description block
  const [selParent, setSelParent] = useState<Category | null>(null);

  // quick view
  const [qvId, setQvId] = useState<number | null>(null);

  // load all categories (flat list)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoadingCats(true);
        setErr(null);
        const all = await getCategories();
        if (!live) return;
        setCats(all || []);
      } catch (e: any) {
        if (!live) return;
        setErr(e?.response?.data?.message || "Could not load categories.");
      } finally {
        if (live) setLoadingCats(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // auto-select first parent
  useEffect(() => {
    if (!loadingCats && parents.length > 0 && !selectedParentId) {
      nav(`/categories/${parents[0].id}`, { replace: true });
    }
  }, [loadingCats, parents, selectedParentId, nav]);

  // fetch selected parent (full) for description block
  useEffect(() => {
    let live = true;
    (async () => {
      if (!selectedParentId) {
        setSelParent(null);
        return;
      }
      const inList = cats.find((c) => c.id === selectedParentId) || null;
      if (inList?.description != null) {
        setSelParent(inList);
        return;
      }
      try {
        const fetched = await getCategory(selectedParentId);
        if (!live) return;
        setSelParent(fetched || inList || null);
      } catch {
        if (!live) return;
        setSelParent(inList || null);
      }
    })();
    return () => {
      live = false;
    };
  }, [selectedParentId, cats]);

  // helper: load children for a category id
  const loadChildren = useCallback(async (catId: number): Promise<Category[]> => {
    const kids = await listChildCategories(catId);
    const sorted = (kids || [])
      .filter((c) => c.active !== false)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      );
    return sorted;
  }, []);

  // helper: load products for a category id
  const loadProducts = useCallback(async (catId: number): Promise<Product[]> => {
    const page: PageResp<Product> = await listProductsByCategory(catId, 0, 200);
    let rows = (page?.content || []).filter((p: any) => {
      const v = p?.visible ?? p?.isVisible ?? null;
      const isVisible = v === true;
      const isActive = p?.active !== false;
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
    await Promise.all(
      rows.map(async (p, i) => {
        if (!p.primaryImageUrl) {
          try {
            const imgs = await listProductImages(p.id);
            if (imgs?.[0]?.url) rows[i].primaryImageUrl = imgs[0].url as any;
          } catch {
            /* ignore */
          }
        }
      })
    );

    return rows;
  }, []);

    // Load level-1 children and their products; for each child, also load grandchildren (and their products)
    useEffect(() => {
      let live = true;

      async function buildTree() {
        if (!selectedParentId) {
          if (!live) return;
          setChildrenMap({});
          setProductsMap({});
          setOpenNode({});
          setLoadingTree(false);
          return;
        }

        if (!live) return;
        setLoadingTree(true);

        // clear previous tree for new parent
        setChildrenMap({});
        setProductsMap({});
        setOpenNode({ [selectedParentId]: true }); // root open

        try {
          // 🔹 1) Load level-1 children + root products in parallel
          const [level1, rootProds] = await Promise.all([
            loadChildren(selectedParentId),
            loadProducts(selectedParentId),
          ]);
          if (!live) return;

          // update root immediately → user sees products quickly
          setChildrenMap((prev) => ({ ...prev, [selectedParentId]: level1 }));
          setProductsMap((prev) => ({ ...prev, [selectedParentId]: rootProds }));

          // 🔹 2) For each child, load its products + its children in parallel
          await Promise.all(
            level1.map(async (c1) => {
              if (!live) return;

              const [c1Prods, level2] = await Promise.all([
                loadProducts(c1.id),
                loadChildren(c1.id),
              ]);
              if (!live) return;

              // update as soon as each child finishes → incremental display
              setProductsMap((prev) => ({ ...prev, [c1.id]: c1Prods }));
              setChildrenMap((prev) => ({ ...prev, [c1.id]: level2 }));
              setOpenNode((prev) => ({ ...prev, [c1.id]: true }));

              // 🔹 3) For each grandchild, just load products
              if (level2.length > 0) {
                await Promise.all(
                  level2.map(async (c2) => {
                    if (!live) return;

                    const c2Prods = await loadProducts(c2.id);
                    if (!live) return;

                    setProductsMap((prev) => ({ ...prev, [c2.id]: c2Prods }));
                    setOpenNode((prev) => ({ ...prev, [c2.id]: false }));
                  })
                );
              }
            })
          );
        } catch {
          if (!live) return;
          setChildrenMap({});
          setProductsMap({});
        } finally {
          if (live) setLoadingTree(false);
        }
      }

      buildTree();

      return () => {
        live = false;
      };
    }, [selectedParentId, loadChildren, loadProducts]);



  const setSelectedParent = (pid: number) => nav(`/categories/${pid}`);
  const toggleNode = (cid: number) => setOpenNode((m) => ({ ...m, [cid]: !m[cid] }));

  /* ----------------------------- Section (recursive) ----------------------------- */
  function Section({
    catId,
    title,
    desc,
    depth = 0,
    showHeader = true,
  }: {
    catId: number;
    title?: string;
    desc?: string | null;
    depth?: number;
    showHeader?: boolean;
  }) {
    const isOpen = !!openNode[catId];
    const children = childrenMap[catId] || [];
    const prods = productsMap[catId] || [];

    return (
      <section className={"sec card depth-" + depth}>
        {showHeader && (
          <header
            className="sec-hd"
            onClick={() => toggleNode(catId)}
            role="button"
            aria-expanded={isOpen}
          >
            <div className="sec-title">
              <h3>{title || `Category #${catId}`}</h3>
              {!!desc && <p className="muted">{desc}</p>}
            </div>
            <span className={"caret" + (isOpen ? " on" : "")} aria-hidden>
              ▾
            </span>
          </header>
        )}

        {(!showHeader || isOpen) && (
          <div className="sec-body">
            {/* products (if any) */}
            {prods.length > 0 && (
              <div className="grid">
                {prods.map((p) => (
                  <SmallProductCard key={p.id} p={p} onOpen={(pid) => setQvId(pid)} />
                ))}
              </div>
            )}

            {/* children */}
            {children.length > 0 && (
              <div className="children">
                {children.map((child) => (
                  <Section
                    key={child.id}
                    catId={child.id}
                    title={child.name}
                    desc={child.description ?? null}
                    depth={Math.min(depth + 1, 3)}
                    showHeader={true}
                  />
                ))}
              </div>
            )}

                        {prods.length === 0 && children.length === 0 && !loadingTree && (
                          <div className="pad muted">No products here yet.</div>
                        )}


          </div>
        )}
      </section>
    );
  }

  return (
    <div className="wrap">
      <Seo title="Categories • Blossom Buds" />
      <style>{css}</style>

      <div className="shell">
        {/* LEFT menu (desktop only, TIGHT) */}
        <aside className="menu card">
          <div className="m-head">Categories</div>
          <div className="m-list">
            {loadingCats && <div className="muted pad">Loading…</div>}
            {!loadingCats && parents.length === 0 && <div className="muted pad">No categories.</div>}
            {!loadingCats &&
              parents.map((c) => (
                <button
                  key={c.id}
                  className={"m-item" + (c.id === selectedParentId ? " active" : "")}
                  onClick={() => setSelectedParent(c.id)}
                  title={c.name}
                  type="button"
                >
                  <span className="dot" />
                  <span className="lbl">{c.name}</span>
                </button>
              ))}
          </div>
        </aside>

        {/* RIGHT content */}
        <main className="content">
          {/* Mobile: trigger drawer + quick chips */}
          <div className="cat-mobilebar">
           <button
             className="drawer-btn"
             onClick={() => setDrawerOpen(true)}
             type="button"
           >
             ☰ All Categories
           </button>
          </div>

          {err && <div className="alert">{err}</div>}

          {!selectedParentId && !loadingCats && (
            <div className="pad muted">Select a category to browse products.</div>
          )}

          {/* Parent description block (no duplicate header below) */}
                    {/* Parent description block (no duplicate header below) */}
                    {selectedParentId && selParent && (
                      <>
                        <section className="parent-desc card">
                          <div className="pd-in">
                            <h2>{selParent.name}</h2>
                            {!!selParent.description && <p className="muted">{selParent.description}</p>}
                          </div>
                        </section>

                        {/* Small loader while tree is still being built, but keep content visible */}
                        {loadingTree && (
                          <section className="card pad muted">
                            Loading products…
                          </section>
                        )}

                        {/* Root of the tree – will handle the “no root products, only subcategories” case */}
                        <Section
                          catId={selParent.id}
                          title={selParent.name}
                          desc={selParent.description ?? null}
                          depth={0}
                          showHeader={false}
                        />
                      </>
                    )}


        </main>
      </div>

      {/* Mobile ASIDE drawer (tight + scrollable) */}
      {drawerOpen && (
        <div
          className="cat-aside"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <aside className="aside-panel" role="document">
            <div className="aside-hd">
              <strong>Categories</strong>
              <button className="x" onClick={() => setDrawerOpen(false)} aria-label="Close" type="button">
                ×
              </button>
            </div>

            <div className="aside-body">
              {loadingCats && <div className="muted pad">Loading…</div>}
              {!loadingCats &&
                parents.map((c) => (
                  <button
                    key={c.id}
                    className={"aside-item" + (c.id === selectedParentId ? " on" : "")}
                    onClick={() => {
                      setSelectedParent(c.id);
                      setDrawerOpen(false);
                    }}
                    title={c.name}
                    type="button"
                  >
                    <span className="dot" />
                    <span className="lbl">{c.name}</span>
                    {c.id === selectedParentId && <span className="pill">Current</span>}
                  </button>
                ))}
            </div>
          </aside>
        </div>
      )}

      {/* Quick View Modal */}
      {qvId != null && <ProductQuickView productId={qvId} onClose={() => setQvId(null)} />}
    </div>
  );
}

/* ----------------------------- Styles ----------------------------- */
const css = `
/* Page shell */
.wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 70vh; }
.shell{
  max-width:1200px; margin:0 auto; padding:12px 12px 20px;
  display:grid; grid-template-columns: 248px 1fr; gap:12px;   /* ✅ tighter desktop menu */
}
.menu, .content{ min-width:0; }

/* Hide left menu on small screens; show content full-width */
@media (max-width: 980px){
  .shell{ grid-template-columns: 1fr; }
  .menu{ display:none !important; }
}

/* Cards & utilities */
.card{ background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.08); overflow:hidden; }
.pad{ padding:12px; }
.muted{ opacity:.8; font-size:12px; }
.alert{ padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); margin-bottom:10px; }

/* Desktop left sidebar (TIGHT) */
.menu{ position:sticky; top:76px; align-self:start; }
.m-head{
  font-weight:900; font-size:12px; padding:8px 10px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.95));
}
.m-list{ padding:8px; display:grid; gap:6px; max-height: calc(100vh - 160px); overflow:auto; }
.m-item{
  display:flex; align-items:center; gap:8px; padding:8px 10px;      /* ✅ smaller padding */
  border-radius:10px; border:1px solid rgba(0,0,0,.06); background:#fff; cursor:pointer;
  transition: background .12s ease, border-color .12s ease, transform .12s ease, box-shadow .12s ease;
}
.m-item:hover{ background:#fafafa; transform: translateY(-1px); }
.m-item.active{ background: rgba(246,195,32,.16); border-color: rgba(246,195,32,.35); }
.m-item .dot{ width:7px; height:7px; border-radius:999px; background: var(--bb-accent-2); opacity:.95; }
.m-item .lbl{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:800; font-size:13px; }

/* Mobile top bar */
.cat-mobilebar{
  display:none;
  margin-bottom:10px;
  gap:8px;
  align-items:center;
}
@media (max-width: 980px){
  .cat-mobilebar{ display:flex; flex-wrap:wrap; }
}
.drawer-btn{
  height:34px; padding:0 12px; border-radius:10px; border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-weight:900; box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.chips{
  display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
  padding:2px; flex: 1 1 auto; min-height:36px;
}
.chips::-webkit-scrollbar{ display:none; }
.chip{
  flex:0 0 auto; height:30px; padding:0 12px; border-radius:999px;
  border:1px solid rgba(0,0,0,.1); background:#fff; font-weight:800; cursor:pointer;
  white-space:nowrap; font-size:12px;
}
.chip.on{ border-color: var(--bb-accent); box-shadow: 0 6px 16px rgba(240,93,139,.16); }

/* Parent description block */
.parent-desc .pd-in{ padding:12px; }
.parent-desc h2{ margin:0 0 6px; font-size:18px; font-weight:900; }
.parent-desc p{ margin:0; }

/* sections (hierarchy) */
.sec{ margin-bottom:10px; }
.sec-hd{
  padding:8px 10px; border-bottom:1px solid rgba(0,0,0,.06);
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  cursor:pointer;
}
.sec-title h3{ margin:0; font-size:15px; font-weight:900; }
.sec-title p{ margin:4px 0 0; font-size:12px; opacity:.85; }
.caret{ transition: transform .18s ease, opacity .18s ease; opacity:.75; }
.caret.on{ transform: rotate(180deg); }
.children{ padding: 6px 6px 10px; display:grid; gap:10px; }

/* product grid + cards */
/* ✅ Mobile: perfect two-up grid with no overflow */
.grid{
  padding:10px; display:grid; gap:10px;
  grid-template-columns: repeat(4, minmax(0,1fr));
}
@media (max-width: 1200px){ .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 900px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px){
  .grid{
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap:9px;
    padding:8px;
  }
}
@media (max-width: 560px){
  .grid{
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 10px;
    padding: 8px;
    align-items: stretch;           /* ✅ make tracks stretch to same height */
    grid-auto-rows: 1fr;            /* ✅ each cell gets equal row height */
  }
}

.p{
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  border:1px solid rgba(0,0,0,.08);
  border-radius:12px;
  overflow:hidden;
  background:#fff;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.p:hover{ transform: translateY(-1px); border-color: rgba(246,195,32,.35); box-shadow: 0 12px 28px rgba(0,0,0,.10); }
.thumb{
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;            /* modern lock */
  background: #f7f7f7;
  overflow: hidden;                /* clip any overflow */
  border-top-left-radius: 12px;    /* match card radius if needed */
  border-top-right-radius: 12px;
}
@supports not (aspect-ratio: 1 / 1){
  .thumb::before{
    content: "";
    display: block;
    padding-top: 100%;             /* 1:1 square reserve */
  }
}
.thumb > img{
  position: absolute;              /* ✅ fixes the “not fixed” jump */
  inset: 0;                        /* top/right/bottom/left: 0 */
  width: 100%;
  height: 100%;
  object-fit: cover;               /* fill box without distortion */
  object-position: center;         /* center crop */
  display: block;                  /* remove inline-gap */
  transform: translateZ(0);        /* smoother on mobile GPUs */
  will-change: transform;          /* micro-optimization */
}
.p img{ width:100%; height:100%; object-fit:cover; display:block; }
.ph{
  width:100%; height:100%;
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size:200% 100%; animation: shimmer 1.15s linear infinite;
}
.meta{
  margin-top: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 58px;
}
.name{
  font-weight: 900;
  font-size: 13px;
  line-height: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;         /* long single words wrap */
  word-break: break-word;
  min-height: 2.5em;               /* reserves space for 2 lines */
}
.price{
  font-weight:900;
  font-size:12.5px;
  color: var(--bb-accent);

}

@keyframes shimmer{ from{ background-position: 200% 0; } to { background-position: -200% 0; } }

/* ---------- Mobile aside drawer (LEFT, subtle & scrollable) ---------- */
.cat-aside{
  position:fixed; inset:0; z-index:420;
  background: rgba(0,0,0,.35);
  -webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
}
.aside-panel{
  position:absolute;
  top:0; left:0;
  height:100dvh; width:min(78vw, 320px);              /* ✅ subtle width */
  background:#fff; border-right:1px solid rgba(0,0,0,.08);
  box-shadow: 12px 0 32px rgba(0,0,0,.18);
  border-top-right-radius:14px; border-bottom-right-radius:14px;
  display:flex; flex-direction:column; overflow:hidden;
  transform: translateX(-10px); opacity:0;
  animation: slideIn .18s ease-out forwards;
  touch-action: pan-y;                                  /* scrollable */
}
@keyframes slideIn { to { transform:none; opacity:1; } }

.aside-hd{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), #fff 70%);
}
.aside-hd strong{ font-size:14px; }
.aside-hd .x{
  background:transparent; border:1px solid rgba(0,0,0,.12);
  border-radius:10px; height:30px; width:30px; cursor:pointer;
}



.aside-item.on{ border-color: var(--bb-accent); box-shadow: 0 8px 22px rgba(240,93,139,.12); }
.aside-item .dot{ width:8px; height:8px; border-radius:999px; background: var(--bb-accent-2); }
.aside-item .lbl{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:800; font-size:13px; }
.pill{ font-size:11px; padding:2px 6px; border-radius:999px; background: rgba(246,195,32,.18); }

/* Ensure drawer elements only apply on small screens */
@media (min-width: 981px){
  .cat-mobilebar{ display:none !important; }
  .cat-aside{ display:none !important; }
}

/* ---------- Grid (keep two-up on phones) ---------- */
.grid{
  padding:12px;
  display:grid;
  gap:12px;
  grid-template-columns: repeat(4, minmax(0,1fr));
}
@media (max-width: 1200px){ .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 900px){  .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
/* ✅ two per row on small phones */
@media (max-width: 560px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; } }
@media (max-width: 360px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; } }

/* ---------- Compact card (mirrors FeaturedPage) ---------- */
.ft-card{
  display:flex; flex-direction:column;
  border-radius:12px; overflow:hidden; background:#fff;
  border:1px solid rgba(0,0,0,.06);
  box-shadow: 0 8px 22px rgba(0,0,0,.10);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  outline:none; min-height:0; height:100%;
}
.ft-card:hover{ transform: translateY(-2px); box-shadow: 0 12px 34px rgba(0,0,0,.16); border-color: rgba(246,195,32,.35); }
.ft-card:focus-visible{ box-shadow: 0 0 0 3px rgba(246,195,32,.45), 0 12px 34px rgba(0,0,0,.16); }

/* Media — exact square, image pinned (no jump) */
.media{ position:relative; background:#f7f7f7; }
.media img{
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit:cover; object-position:center;
  display:block;
  aspect-ratio:1/1;
}
.media::before{
  content:""; display:block; padding-top:100%; /* reserve 1:1 space */
}
/* Optional subtle overlay on hover (kept minimal) */
.media::after{
  content:""; position:absolute; inset:0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.06));
  opacity:0; transition: opacity .18s ease; pointer-events:none;
}
.ft-card:hover .media::after{ opacity:1; }

/* Meta — tight, consistent height */
.meta{ padding:8px 10px 0; display:grid; gap:2px; min-height:52px; }
.name{
  font-weight:900; line-height:2.25; color: var(--bb-primary);
  display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
  font-size:13px;
  overflow-wrap:anywhere;         /* ✅ long single words wrap */
  word-break: break-word;
  min-height: 2.5em;              /* keep rows aligned */
}
.price{ font-weight:900; color: var(--bb-accent); font-size:13px; }

/* CTA — small, like Featured */
.btn.add{
  height:32px; margin:8px 10px 10px;
  border-radius:10px; border:none; font-weight:900; cursor:pointer;
  background: var(--bb-accent); color:#fff;
  box-shadow: 0 10px 24px rgba(240,93,139,.24);
  transition: transform .06s ease, box-shadow .18s ease;
  font-size:12.5px;
}
.btn.add:hover{ transform: translateY(-1px); box-shadow: 0 14px 32px rgba(240,93,139,.30); }
.btn.add:active{ transform: translateY(0); }
@media (max-width: 480px){
  .btn.add{ height:30px; font-size:12px; margin:6px 8px 8px; }
}

/* Placeholder (while images resolve) */
.ph{
  width:100%; aspect-ratio: 1 / 1;
  background: radial-gradient(1000px 240px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff);
}
/* Mobile top bar */
.cat-mobilebar{
  display:none;
  margin-bottom:10px;
  gap:8px;
  align-items:center;
  position: relative;             /* ✅ added */
  z-index: 5;                     /* ✅ ensure it's above aside/menu */
  background: #fff;               /* ✅ avoid overlap with sticky aside */
  padding: 8px;                   /* ✅ added padding to prevent tight clipping */
}
@media (max-width: 980px){
  .cat-mobilebar{ display:flex; flex-wrap:wrap; }
}
.drawer-btn{
  height:34px; padding:0 12px; border-radius:10px; border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-weight:900; box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.chips{
  display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
  padding:2px; flex: 1 1 auto; min-height:36px;
  scroll-padding-inline: 8px;           /* ✅ better scroll feel on mobile */
}
.chips::-webkit-scrollbar{ display:none; }
.chip{
  flex:0 0 auto; height:30px; padding:0 12px; border-radius:999px;
  border:1px solid rgba(0,0,0,.1); background:#fff; font-weight:800; cursor:pointer;
  white-space:nowrap; font-size:12px;
}
.chip.on{ border-color: var(--bb-accent); box-shadow: 0 6px 16px rgba(240,93,139,.16); }

/* Ensure chips are not pushed behind content on small screens */
@media (max-width: 980px){
  .content {
    padding-top: 4px;             /* ✅ extra spacing below mobile bar */
  }
}
/* ---------- Mobile aside drawer (LEFT, subtle & scrollable) ---------- */
.cat-aside {
  position: fixed;
  inset: 0;
  z-index: 420;
  background: rgba(0,0,0,.35);
  -webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
}

.aside-panel {
  position: absolute;
  top: 0;
  left: 0;
  height: 100dvh;
  width: min(78vw, 320px);
  background: #fff;
  border-right: 1px solid rgba(0,0,0,.08);
  box-shadow: 12px 0 32px rgba(0,0,0,.18);
  border-top-right-radius: 14px;
  border-bottom-right-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(-10px);
  opacity: 0;
  animation: slideIn .18s ease-out forwards;
  touch-action: pan-y;
}

@keyframes slideIn {
  to {
    transform: none;
    opacity: 1;
  }
}

.aside-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), #fff 70%);
  flex-shrink: 0;
}

.aside-hd strong {
  font-size: 14px;
}

.aside-hd .x {
  background: transparent;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 10px;
  height: 30px;
  width: 30px;
  cursor: pointer;
}


.aside-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}
.aside-item.on {
  border-color: var(--bb-accent);
  box-shadow: 0 8px 22px rgba(240,93,139,.12);
}
.aside-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--bb-accent-2);
}
.aside-item .lbl {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 800;
  font-size: 13px;
}
.pill {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(246,195,32,.18);
}


.aside-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;                /* 🔽 reduced vertical space */
  gap: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 40px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    height:auto;
    line-height: 1.3;
}
.aside-body {
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px; /* compact vertical spacing between items */
  max-height: calc(100dvh - 60px);
}
.aside-item {
   display: flex;
   align-items: center;
   padding: 4px 8px;
   gap: 6px;
   border: 1px solid rgba(0, 0, 0, 0.08);
   border-radius: 8px;
   background: #fff;
   cursor: pointer;
   font-size: 13px;
   line-height: 1.2;
   transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
   height: auto; /* ensures it only wraps its content */
 }
 .aside-item:hover {
   background: #f9f9f9;
 }
 .aside-item.on {
   border-color: var(--bb-accent);
   box-shadow: 0 4px 12px rgba(240, 93, 139, 0.12);
 }
 .aside-item .dot {
   width: 6px;
   height: 6px;
   border-radius: 999px;
   background: var(--bb-accent-2);
   flex-shrink: 0;
 }
 .aside-item .lbl {
   font-weight: 700;
   font-size: 15px;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
   flex-grow: 1;
   line-height: 1.5;
   color: var(--bb-primary);
 }
.pill {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(246, 195, 32, 0.18);
  color: var(--bb-primary); /* ✅ optional for consistency */
}

`;
