// src/pages/ShopCategoriesPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Seo from "../components/Seo";
import ProductQuickView from "../components/ProductQuickView";
import {
  getCategories,
  getCategory,
  listChildCategories,
  listProductsByCategory,
  listProductImages,
  listProductsPage, // ✅ NEW: for “All Products” landing
  type Category,
  type Product,
  type PageResp,
} from "../api/catalog";

/* ----------------------------- Keywords (search-only) ----------------------------- */
const KEYWORDS: { label: string; value: string }[] = [
  { label: "Malli", value: "malli" },
  { label: "Jasmine", value: "jasmine" },
  { label: "Kanakamaram", value: "kanakamaram" },
  { label: "Pichi Poo", value: "pichi poo" },
  { label: "Mullai", value: "mullai" },
  { label: "Lotus", value: "lotus" },
  { label: "Rose", value: "rose" },
  { label: "December Poo", value: "december poo" },
  { label: "Bloom", value: "bloom" },
];

/* ----------------------------- Small Product Card ----------------------------- */
function SmallProductCard({ p, onOpen }: { p: Product; onOpen: (id: number) => void }) {
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
        <div className="name" title={p.name}>
          {p.name}
        </div>
        {priceText && <div className="price">{priceText}</div>}
      </div>

      <button
        className="btn add"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(p.id);
        }}
        aria-label={`Open ${p.name}`}
      >
        Add to cart
      </button>
    </article>
  );
}

/* ----------------------------- Helpers ----------------------------- */
const norm = (s: any) => String(s ?? "").toLowerCase().trim();
const uniqById = (arr: Category[]) => {
  const m = new Map<number, Category>();
  for (const c of arr || []) {
    const id = Number((c as any)?.id);
    if (!id) continue;
    if (!m.has(id)) m.set(id, c);
  }
  return Array.from(m.values());
};

export default function ShopCategoriesPage() {
  const { id } = useParams();
  const nav = useNavigate();

  // ✅ NEW: allow /categories/all (or no id) to mean “All Products”
  const allMode = !id || id === "all";

  const selectedParentId = useMemo(() => {
    if (allMode) return undefined;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [id, allMode]);

  // data
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // selected parent full record (optional description)
  const [selParent, setSelParent] = useState<Category | null>(null);

  // tree maps (used when NOT in allMode)
  const [childrenMap, setChildrenMap] = useState<Record<number, Category[]>>({});
  const [productsMap, setProductsMap] = useState<Record<number, Product[]>>({});
  const [openNode, setOpenNode] = useState<Record<number, boolean>>({});
  const [loadingTree, setLoadingTree] = useState(false);

  // ✅ NEW: All products cache (used when allMode)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // UI states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [q, setQ] = useState("");
  const [catPick, setCatPick] = useState<number | "all">("all");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");

  // quick view
  const [qvId, setQvId] = useState<number | null>(null);

  // categories: parents (top-level)
  const parents = useMemo(() => (cats || []).filter((c) => c.parentId == null && c.active !== false), [cats]);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const mq = window.matchMedia("(max-width: 980px)");
  const onChange = () => setIsMobile(mq.matches);
  onChange();
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}, []);

  // load all categories once
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

  // ✅ NEW: default landing should show ALL products
  useEffect(() => {
    if (!loadingCats && allMode && id !== "all") {
      nav(`/categories/all`, { replace: true });
    }
  }, [allMode, id, loadingCats, nav]);

  // fetch selected parent (full) when not allMode
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

  // helpers
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

  const loadProducts = useCallback(async (catId: number): Promise<Product[]> => {
    const page: PageResp<Product> = await listProductsByCategory(catId, 0, 200);
    let rows = (page?.content || []).filter((p: any) => {
      const v = p?.visible ?? p?.isVisible ?? null;
      const isVisible = v === true || v == null;
      const isActive = p?.active !== false;
      return isActive && isVisible;
    }) as Product[];

    rows = rows.sort((a: any, b: any) => {
      const fa = a?.featured ? 1 : 0;
      const fb = b?.featured ? 1 : 0;
      if (fb - fa !== 0) return fb - fa;
      const so = (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0);
      if (so !== 0) return so;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

      await Promise.all(
      rows.map(async (p, i) => {
        if (!p.primaryImageUrl) {
          try {
            const imgs = await listProductImages(p.id);
            if (imgs?.[0]?.url) rows[i].primaryImageUrl = imgs[0].url as any;
          } catch {}
        }
      })
    );

    return rows;
  }, []);

  // ✅ NEW: load ALL products progressively when allMode (no empty loading page)
  // ✅ Load ALL products progressively when allMode (FAST first paint, no empty screen)
  useEffect(() => {
    let live = true;

    async function loadAllProgressive() {
      if (!allMode) return;

      setLoadingAll(true);

      try {
        const size = 60;      // ✅ faster first response than 120
        const maxPages = 20;  // ✅ still enough coverage
        const seen = new Set<number>();

        // keep already loaded items (if user navigates away/back)
        setAllProducts((prev) => {
          for (const p of prev) if (p?.id) seen.add(p.id);
          return prev;
        });

        for (let page = 0; page < maxPages; page++) {
          if (!live) return;

          const resp = await listProductsPage(page, size);
          const rows = (resp?.content || []) as Product[];
          if (!rows.length) break;

          // filter + dedupe this batch
          const batch: Product[] = [];
          for (const p of rows as any[]) {
            const v = p?.visible ?? p?.isVisible ?? null;
            const isVisible = v === true || v == null;
            const isActive = p?.active !== false;
            if (!isActive || !isVisible) continue;

            if (!p?.id || seen.has(p.id)) continue;
            seen.add(p.id);
            batch.push(p as Product);
          }

          // ✅ 1) Paint IMMEDIATELY (keep arrival order: first loaded shows first)
          if (!live) return;
          if (batch.length) {
            setAllProducts((prev) => [...prev, ...batch]);
          }

          // ✅ 2) Backfill images AFTER paint (don’t block UI)
          if (batch.length) {
            Promise.all(
              batch.map(async (p) => {
                if (!p.primaryImageUrl) {
                  try {
                    const imgs = await listProductImages(p.id);
                    if (imgs?.[0]?.url) p.primaryImageUrl = imgs[0].url as any;
                  } catch {}
                }
              })
            ).then(() => {
              if (!live) return;
              // trigger rerender so images appear
              setAllProducts((prev) => [...prev]);
            });
          }

          // stop if last page
          if (rows.length < size) break;
        }
      } catch {
        // do not wipe existing products; just stop loading
      } finally {
        if (live) setLoadingAll(false);
      }
    }

    loadAllProgressive();
    return () => {
      live = false;
    };
  }, [allMode]);



  // build tree for selected parent (incremental) when NOT allMode
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

      setChildrenMap({});
      setProductsMap({});
      setOpenNode({ [selectedParentId]: true });

      try {
        const [level1, rootProds] = await Promise.all([
          loadChildren(selectedParentId),
          loadProducts(selectedParentId),
        ]);
        if (!live) return;

        setChildrenMap((prev) => ({ ...prev, [selectedParentId]: level1 }));
        setProductsMap((prev) => ({ ...prev, [selectedParentId]: rootProds }));

        await Promise.all(
          level1.map(async (c1) => {
            if (!live) return;

            const [c1Prods, level2] = await Promise.all([loadProducts(c1.id), loadChildren(c1.id)]);
            if (!live) return;

            setProductsMap((prev) => ({ ...prev, [c1.id]: c1Prods }));
            setChildrenMap((prev) => ({ ...prev, [c1.id]: level2 }));
            setOpenNode((prev) => ({ ...prev, [c1.id]: true }));

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

    if (!allMode) buildTree();
    return () => {
      live = false;
    };
  }, [selectedParentId, loadChildren, loadProducts, allMode]);

  // derived: categories for dropdown (only meaningful when NOT allMode)
  const categoryOptions = useMemo(() => {
    if (!selectedParentId) return [];
    const level1 = childrenMap[selectedParentId] || [];
    const level2 = level1.flatMap((c1) => childrenMap[c1.id] || []);
    const all = uniqById([selParent as any, ...level1, ...level2].filter(Boolean));
    return all.sort((a, b) => {
      if (a.id === selectedParentId) return -1;
      if (b.id === selectedParentId) return 1;
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [selectedParentId, childrenMap, selParent]);

  // UI actions
  const setSelectedParent = (pid: number) => {
    setCatPick("all");
    setQ("");
    setMinPrice("");
    setMaxPrice("");
    nav(`/categories/${pid}`);
  };

  const goAll = () => {
    setCatPick("all");
    setQ("");
    setMinPrice("");
    setMaxPrice("");
    nav(`/categories/all`);
  };

  const toggleNode = (cid: number) => setOpenNode((m) => ({ ...m, [cid]: !m[cid] }));
  const applyKeyword = (kw: string) => setQ((prev) => (norm(prev) === norm(kw) ? "" : kw));
  const clearFilters = () => {
    setQ("");
    setCatPick("all");
    setMinPrice("");
    setMaxPrice("");
  };

  // flatten products
  const allLoadedProducts = useMemo(() => {
    if (allMode) return allProducts;

    if (!selectedParentId) return [];
    const ids = new Set<number>();
    const out: Product[] = [];

    const keys = Object.keys(productsMap).map((k) => Number(k));
    for (const k of keys) {
      const rows = productsMap[k] || [];
      for (const p of rows) {
        if (!p?.id) continue;
        if (ids.has(p.id)) continue;
        ids.add(p.id);
        out.push(p);
      }
    }

    out.sort((a: any, b: any) => {
      const fa = a?.featured ? 1 : 0;
      const fb = b?.featured ? 1 : 0;
      if (fb - fa !== 0) return fb - fa;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

    return out;
  }, [productsMap, selectedParentId, allMode, allProducts]);

  const priceBounds = useMemo(() => {
    const nums = allLoadedProducts
      .map((p: any) => Number(p?.price))
      .filter((n) => Number.isFinite(n) && n >= 0) as number[];
    if (nums.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }, [allLoadedProducts]);

  const filteredProducts = useMemo(() => {
    const tq = norm(q);
    const min = minPrice === "" ? undefined : Number(minPrice);
    const max = maxPrice === "" ? undefined : Number(maxPrice);
    const hasMin = min != null && Number.isFinite(min);
    const hasMax = max != null && Number.isFinite(max);

    return allLoadedProducts.filter((p: any) => {
      if (tq) {
        const hay = `${norm(p?.name)} ${norm(p?.slug)} ${norm(p?.description)}`;
        if (!hay.includes(tq)) return false;
      }
      const price = Number(p?.price);
      if (Number.isFinite(price)) {
        if (hasMin && price < (min as number)) return false;
        if (hasMax && price > (max as number)) return false;
      }

      // category filtering:
      // - In ALL mode: choosing a category should navigate to that category view (so we don't filter locally)
      // - In category mode: we filter by "which node list the product came from"
      if (!allMode && catPick !== "all") {
        const rows = productsMap[Number(catPick)] || [];
        const inThat = rows.some((x) => x.id === p.id);
        if (!inThat) return false;
      }

      return true;
    });
  }, [allLoadedProducts, q, minPrice, maxPrice, catPick, productsMap, allMode]);

  const shownCount = filteredProducts.length;

  // close filter popover on outside click
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!filtersOpen) return;
      const t = e.target as any;
      if (popRef.current && !popRef.current.contains(t)) setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filtersOpen]);

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

    const sectionFiltered = prods.filter((p: any) => filteredProducts.some((fp) => fp.id === p.id));

    return (
      <section className={"sec card depth-" + depth}>
        {showHeader && (
          <header className="sec-hd" onClick={() => toggleNode(catId)} role="button" aria-expanded={isOpen}>
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
            {sectionFiltered.length > 0 && (
              <div className="grid">
                {sectionFiltered.map((p) => (
                  <SmallProductCard key={p.id} p={p} onOpen={(pid) => setQvId(pid)} />
                ))}
              </div>
            )}

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

            {sectionFiltered.length === 0 && children.length === 0 && !loadingTree && (
              <div className="pad muted">No products here yet.</div>
            )}
          </div>
        )}
      </section>
    );
  }

  const priceMinPh = priceBounds.min ? `${priceBounds.min}` : "0";
  const priceMaxPh = priceBounds.max ? `${priceBounds.max}` : "0";

  return (
    <div className="wrap">
      <Seo title="Categories • Blossom Buds" />
      <style>{css}</style>

      <div className="shell">
        {/* LEFT menu (desktop only) */}
        <aside className="menu card">
          <div className="m-head">Categories</div>
          <div className="m-list">
            {loadingCats && <div className="muted pad">Loading…</div>}

            {!loadingCats && (
              <>
                {/* ✅ NEW: “All” option */}
                <button
                  className={"m-item" + (allMode ? " active" : "")}
                  onClick={goAll}
                  title="All products"
                  type="button"
                >
                  <span className="dot" />
                  <span className="lbl">All</span>
                </button>

                {parents.length === 0 && <div className="muted pad">No categories.</div>}

                {parents.map((c) => (
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
              </>
            )}
          </div>
        </aside>

        {/* RIGHT content */}
        <main className="content">
          {/* Topbar */}
          <div className="topbar">
            {isMobile && (
              <button className="drawer-btn" onClick={() => setDrawerOpen(true)} type="button">
                ☰ Categories
              </button>
            )}


            <div className="searchbar" role="search">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16.5 16.5 21 21"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search flowers… (e.g., malli, jasmine)"
                aria-label="Search products"
              />
              {q && (
                <button className="iconbtn" type="button" onClick={() => setQ("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </div>

            <button
              className={"filter-btn" + ((catPick !== "all" || minPrice !== "" || maxPrice !== "") ? " on" : "")}
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
            >
              Filters
              <span className="count">{catPick !== "all" || minPrice !== "" || maxPrice !== "" ? "•" : ""}</span>
            </button>

            {/* filter popover */}
            {filtersOpen && (
              <div className="pop" ref={popRef} role="dialog" aria-label="Filters">
                <div className="pop-hd">
                  <strong>Filters</strong>
                  <button className="iconbtn" type="button" onClick={() => setFiltersOpen(false)} aria-label="Close">
                    ×
                  </button>
                </div>

                <div className="pop-bd">
                  {/* ✅ Category dropdown behavior:
                      - In ALL mode: selecting a category navigates to that category view.
                      - In category mode: it filters locally. */}
                  <label className="fld">
                    <span>Category</span>
                    <select
                      value={catPick === "all" ? "all" : String(catPick)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          setCatPick("all");
                          if (allMode) goAll();
                          return;
                        }
                        const cid = Number(v);
                        if (allMode) {
                          setFiltersOpen(false);
                          setCatPick("all");
                          nav(`/categories/${cid}`);
                        } else {
                          setCatPick(cid);
                        }
                      }}
                    >
                      <option value="all">All products</option>

                      {/* In ALL mode, show top-level parents only (clean UX) */}
                      {allMode &&
                        parents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}

                      {/* In category mode, show full nested options (as before) */}
                      {!allMode &&
                        categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id === selectedParentId ? `All in “${c.name}”` : c.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="row2">
                    <label className="fld">
                      <span>Min</span>
                      <input
                        inputMode="numeric"
                        value={minPrice === "" ? "" : String(minPrice)}
                        onChange={(e) => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={priceMinPh}
                      />
                    </label>
                    <label className="fld">
                      <span>Max</span>
                      <input
                        inputMode="numeric"
                        value={maxPrice === "" ? "" : String(maxPrice)}
                        onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={priceMaxPh}
                      />
                    </label>
                  </div>

                  <div className="pop-ft">
                    <button className="ghost" type="button" onClick={clearFilters}>
                      Clear
                    </button>
                    <button className="btn" type="button" onClick={() => setFiltersOpen(false)}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keywords row */}
          <div className="kwrow" aria-label="Quick keywords">
            {KEYWORDS.map((k) => (
              <button
                key={k.value}
                className={"pill" + (norm(q) === norm(k.value) ? " on" : "")}
                type="button"
                onClick={() => applyKeyword(k.value)}
                title={`Search: ${k.value}`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {err && <div className="alert">{err}</div>}

          {/* ✅ ALL MODE: show all products grid */}
          {allMode && (
            <>
              <section className="parent-desc card">
                <div className="pd-in">
                  <div className="pd-top">
                    <div>
                      <h2>All Products</h2>
                      <p className="muted">Browse everything. Use search/keywords or filters to narrow down.</p>
                    </div>
                    <div className="pd-right">
                      <span className="badge">{shownCount} items</span>
                    </div>
                  </div>
                </div>
              </section>

              {loadingAll && filteredProducts.length > 0 && (
                <div className="muted" style={{ padding: "8px 2px" }}>Loading more…</div>
              )}


              <section className="card">
                <div className="grid">
                  {/* show loaded items immediately */}
                  {filteredProducts.map((p) => (
                    <SmallProductCard key={p.id} p={p} onOpen={(pid) => setQvId(pid)} />
                  ))}

                  {/* ✅ skeletons while loading (no empty page) */}
                  {(loadingAll || loadingCats) &&
                    Array.from({ length: Math.max(6, 12 - filteredProducts.length) }).map((_, i) => (
                      <div className="sk-card" key={`sk-${i}`} />
                    ))}
                </div>
              </section>

              {/* empty state only when NOT loading */}
              {!loadingAll && !loadingCats && filteredProducts.length === 0 && (
                <section className="card pad muted">
                  No products match your search/filters. Try clearing filters or searching a different keyword.
                </section>
              )}


            </>
          )}

          {/* CATEGORY MODE: show tree view */}
          {!allMode && selectedParentId && selParent && (
            <>
              <section className="parent-desc card">
                <div className="pd-in">
                  <div className="pd-top">
                    <div>
                      <h2>{selParent.name}</h2>
                      {!!selParent.description && <p className="muted">{selParent.description}</p>}
                    </div>
                    <div className="pd-right">
                      <span className="badge">{shownCount} items</span>
                    </div>
                  </div>
                </div>
              </section>

              {loadingTree && <section className="card pad muted">Loading products…</section>}

              <Section catId={selParent.id} title={selParent.name} desc={selParent.description ?? null} depth={0} showHeader={false} />

              {!loadingTree && shownCount === 0 && (
                <section className="card pad muted">
                  No products match your search/filters. Try clearing filters or searching a different keyword.
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile categories drawer */}
      {isMobile && drawerOpen && (
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
              {!loadingCats && (
                <>
                  {/* ✅ NEW: All option */}
                  <button
                    className={"aside-item" + (allMode ? " on" : "")}
                    onClick={() => {
                      goAll();
                      setDrawerOpen(false);
                    }}
                    title="All products"
                    type="button"
                  >
                    <span className="dot" />
                    <span className="lbl">All</span>
                    {allMode && <span className="pillmini">Current</span>}
                  </button>

                  {parents.map((c) => (
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
                      {c.id === selectedParentId && <span className="pillmini">Current</span>}
                    </button>
                  ))}
                </>
              )}
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
.wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 70vh; }
.shell{
  max-width:1200px; margin:0 auto; padding:12px 12px 20px;
  display:grid; grid-template-columns: 248px 1fr; gap:12px;
}
.menu, .content{ min-width:0; }
@media (max-width: 980px){
  .shell{ grid-template-columns: 1fr; }
  .menu{ display:none !important; }
}

/* Cards & base */
.card{ background:#fff; border:1px solid rgba(0,0,0,.08); border-radius:14px; box-shadow:0 10px 28px rgba(0,0,0,.08); overflow:hidden; }
.pad{ padding:12px; }
.muted{ opacity:.82; font-size:12px; }
.alert{ padding:10px 12px; border-radius:12px; background:#fff3f5; color:#b0003a; border:1px solid rgba(240,93,139,.25); margin-bottom:10px; }

/* Desktop left */
.menu{ position:sticky; top:76px; align-self:start; }
.m-head{
  font-weight:900; font-size:12px; padding:8px 10px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.95));
}
.m-list{ padding:8px; display:grid; gap:6px; max-height: calc(100vh - 160px); overflow:auto; }
.m-item{
  display:flex; align-items:center; gap:8px; padding:8px 10px;
  border-radius:10px; border:1px solid rgba(0,0,0,.06); background:#fff; cursor:pointer;
  transition: background .12s ease, border-color .12s ease, transform .12s ease, box-shadow .12s ease;
}
.m-item:hover{ background:#fafafa; transform: translateY(-1px); }
.m-item.active{ background: rgba(246,195,32,.16); border-color: rgba(246,195,32,.35); }
.m-item .dot{ width:7px; height:7px; border-radius:999px; background: var(--bb-accent-2); opacity:.95; }
.m-item .lbl{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:800; font-size:13px; }

/* Topbar */
.topbar{
  display:grid;
  grid-template-columns: auto 1fr auto;
  gap:10px;
  align-items:center;
  margin-bottom:10px;
  position:relative;
  z-index:6;
}
@media (max-width: 520px){
  .topbar{
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search search"
      "drawer filters";
  }
  .drawer-btn{ grid-area: drawer; }
  .filter-btn{ grid-area: filters; }
  .searchbar{ grid-area: search; }
}
.drawer-btn{
  height:36px; padding:0 12px; border-radius:12px; border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-weight:900; box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.searchbar{
  height:36px;
  display:flex; align-items:center; gap:8px;
  border:1px solid rgba(0,0,0,.10);
  border-radius:12px;
  background:#fff;
  padding:0 10px;
  box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.searchbar svg{ opacity:.55; flex: 0 0 auto; }
.searchbar input{
  border:none; outline:none; background:transparent;
  width:100%; font-weight:800; font-size:13px;
  color: var(--bb-primary);
}
.iconbtn{
  width:28px; height:28px; border-radius:10px;
  border:1px solid rgba(0,0,0,.10); background:#fff; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; line-height:1;
}
.filter-btn{
  height:36px; padding:0 12px; border-radius:12px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-weight:900;
  box-shadow: 0 6px 16px rgba(0,0,0,.06);
  display:flex; align-items:center; gap:8px;
}
.filter-btn.on{ border-color: rgba(240,93,139,.45); box-shadow: 0 6px 18px rgba(240,93,139,.14); }
.filter-btn .count{ opacity:.75; }

/* Filter popover */
.pop{
  position:absolute;
  right:0;
  top:44px;
  width:min(420px, 92vw);
  background:#fff;
  border:1px solid rgba(0,0,0,.10);
  border-radius:14px;
  box-shadow: 0 18px 60px rgba(0,0,0,.18);
  overflow:hidden;
}
.pop-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 12px;
  border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), #fff 70%);
}
.pop-bd{ padding:12px; display:grid; gap:12px; }
.fld{ display:grid; gap:6px; }
.fld span{ font-size:12px; font-weight:900; opacity:.85; }
.fld input, .fld select{
  height:38px; border-radius:12px; border:1px solid rgba(0,0,0,.12);
  padding:0 12px; font-weight:800; outline:none;
}
.fld input:focus, .fld select:focus{
  border-color: rgba(240,93,139,.55);
  box-shadow: 0 0 0 3px rgba(240,93,139,.12);
}
.row2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
.pop-ft{ display:flex; justify-content:flex-end; gap:10px; padding-top:4px; }
.ghost{
  height:36px; padding:0 12px; border-radius:12px;
  border:1px solid rgba(0,0,0,.12); background:#fff; cursor:pointer; font-weight:900;
}
.btn{
  height:36px; padding:0 12px; border-radius:12px;
  border:none; cursor:pointer; font-weight:900;
  background: var(--bb-accent); color:#fff;
  box-shadow: 0 12px 28px rgba(240,93,139,.28);
}

/* Keywords row */
.kwrow{
  display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none;
  padding:2px; margin: 0 0 10px;
}
.kwrow::-webkit-scrollbar{ display:none; }
.pill{
  flex:0 0 auto;
  height:30px; padding:0 12px;
  border-radius:999px; border:1px solid rgba(0,0,0,.10);
  background:#fff; cursor:pointer; font-weight:900; font-size:12px;
  white-space:nowrap;
  box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.pill.on{ border-color: rgba(240,93,139,.55); box-shadow: 0 10px 22px rgba(240,93,139,.16); }

/* Parent block */
.parent-desc .pd-in{ padding:12px; }
.pd-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.parent-desc h2{ margin:0 0 6px; font-size:18px; font-weight:900; }
.parent-desc p{ margin:0; }
.badge{
  font-size:12px; font-weight:900;
  padding:6px 10px; border-radius:999px;
  background: rgba(246,195,32,.18);
  border: 1px solid rgba(246,195,32,.25);
  white-space:nowrap;
}

/* sections */
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
.grid{
  padding:12px;
  display:grid;
  gap:12px;
  grid-template-columns: repeat(4, minmax(0,1fr));
}
@media (max-width: 1200px){ .grid{ grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 900px){  .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; padding:10px; } }
@media (max-width: 360px){ .grid{ grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; padding:10px; } }

/* Compact card */
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

.media{ position:relative; background:#f7f7f7; }
.media img{
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit:cover; object-position:center;
  display:block;
  aspect-ratio:1/1;
}
.media::before{ content:""; display:block; padding-top:100%; }
.media::after{
  content:""; position:absolute; inset:0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.06));
  opacity:0; transition: opacity .18s ease; pointer-events:none;
}
.ft-card:hover .media::after{ opacity:1; }

.meta{ padding:8px 10px 0; display:grid; gap:2px; min-height:52px; }
.name{
  font-weight:900; color: var(--bb-primary);
  display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow:hidden;
  font-size:13px;
  overflow-wrap:anywhere; word-break: break-word;
  min-height: 2.5em;
}
.price{ font-weight:900; color: var(--bb-accent); font-size:13px; }

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
.ph{
  width:100%; aspect-ratio: 1 / 1;
  background: radial-gradient(1000px 240px at -200px 50%, #ffe9a8, #ffd3e1 60%, #fff);
}

/* Mobile categories drawer */
.cat-aside{
  position:fixed; inset:0; z-index:420;
  background: rgba(0,0,0,.35);
  -webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
}
.aside-panel{
  position:absolute; top:0; left:0;
  height:100dvh; width:min(78vw, 320px);
  background:#fff; border-right:1px solid rgba(0,0,0,.08);
  box-shadow: 12px 0 32px rgba(0,0,0,.18);
  border-top-right-radius:14px; border-bottom-right-radius:14px;
  display:flex; flex-direction:column; overflow:hidden;
  transform: translateX(-10px); opacity:0;
  animation: slideIn .18s ease-out forwards;
  touch-action: pan-y;
}
@keyframes slideIn { to { transform:none; opacity:1; } }

.aside-hd{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:12px; border-bottom:1px solid rgba(0,0,0,.06);
  background: linear-gradient(180deg, rgba(246,195,32,.10), #fff 70%);
  flex-shrink: 0;
}
.aside-hd strong{ font-size:14px; }
.aside-hd .x{
  background:transparent; border:1px solid rgba(0,0,0,.12);
  border-radius:10px; height:30px; width:30px; cursor:pointer;
}
.aside-body{
  flex: 1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding: 8px; display:flex; flex-direction:column; gap:8px;
}
.aside-item{
  display:flex; align-items:center; gap:8px;
  padding:10px; border:1px solid rgba(0,0,0,.08);
  border-radius:12px; background:#fff; cursor:pointer;
}
.aside-item.on{ border-color: var(--bb-accent); box-shadow: 0 8px 22px rgba(240,93,139,.12); }
.aside-item .dot{ width:8px; height:8px; border-radius:999px; background: var(--bb-accent-2); flex-shrink:0; }
.aside-item .lbl{ font-weight:900; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
.pillmini{ font-size:11px; padding:2px 6px; border-radius:999px; background: rgba(246,195,32,.18); }

.sk-card{
  height: 240px;
  border-radius: 12px;
  border:1px solid rgba(0,0,0,.06);
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size: 200% 100%;
  animation: shimmer 1.15s linear infinite;
}
@keyframes shimmer{
  from{ background-position: 200% 0; }
  to{ background-position: -200% 0; }
}


@media (min-width: 981px){
  .cat-aside{ display:none !important; }
}
/* Drawer button should exist only on mobile (desktop already has sidebar) */
@media (min-width: 981px){
  .drawer-btn{ display:none !important; }
}
.topbar{
  display:grid;
  grid-template-columns: 1fr auto; /* ✅ desktop: only search + filters */
  gap:10px;
  align-items:center;
  margin-bottom:10px;
  position:relative;
  z-index:6;
}

@media (max-width: 520px){
  .topbar{
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search search"
      "drawer filters";
  }
  .drawer-btn{ grid-area: drawer; }
  .filter-btn{ grid-area: filters; }
  .searchbar{ grid-area: search; }
}
/* Keywords row */
.kwrow{
  display:flex;
  gap:8px;
  padding:2px;
  margin: 0 0 10px;
  flex-wrap: nowrap;             /* default: desktop scroll row */
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}
.kwrow::-webkit-scrollbar{ display:none; }

.pill{
  flex:0 0 auto;
  height:30px;
  padding:0 12px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.10);
  background:#fff;
  cursor:pointer;
  font-weight:900;
  font-size:12px;
  white-space:nowrap;
  box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.pill.on{ border-color: rgba(240,93,139,.55); box-shadow: 0 10px 22px rgba(240,93,139,.16); }

/* ✅ Mobile: show ALL pills (wrap, no scroll) */
@media (max-width: 520px){
  .kwrow{
    overflow-x: visible;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap:8px;
  }
  .pill{
    flex: 0 0 auto;              /* keep pill size natural */
  }
}
.topbar{
  display:grid;
  grid-template-columns: 1fr auto; /* ✅ desktop: only search + filters */
  gap:10px;
  align-items:center;
  margin-bottom:10px;
  position:relative;
  z-index:6;
}
/* Topbar */
.topbar{
  display:grid;
  gap:10px;
  align-items:center;
  margin-bottom:10px;
  position:relative;
  z-index:6;
}

/* ✅ Desktop (sidebar visible, no drawer button) */
@media (min-width: 981px){
  .topbar{
    grid-template-columns: 1fr auto; /* search + filters */
  }
}

/* ✅ Tablet / iPad (sidebar hidden, drawer button present) */
@media (min-width: 521px) and (max-width: 980px){
  .topbar{
    grid-template-columns: auto 1fr auto; /* drawer + search + filters */
  }
}

/* ✅ Mobile (stacked layout) */
@media (max-width: 520px){
  .topbar{
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search search"
      "drawer filters";
  }
  .drawer-btn{ grid-area: drawer; }
  .filter-btn{ grid-area: filters; }
  .searchbar{ grid-area: search; }
}

/* Make sure search can shrink nicely on tablet */
.searchbar{ min-width: 0; }
.searchbar input{ min-width: 0; }

/* Slightly tighter controls on tablet (looks cleaner on iPad) */
@media (min-width: 521px) and (max-width: 980px){
  .drawer-btn, .filter-btn{
    height:34px;
    padding:0 10px;
    border-radius:12px;
    font-size:12.5px;
    white-space:nowrap;
  }
  .searchbar{
    height:34px;
    border-radius:12px;
  }
}



`;
