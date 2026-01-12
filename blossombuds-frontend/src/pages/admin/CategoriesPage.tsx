// src/pages/admin/CategoriesPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  listAllCategories,
  listProducts,
  listProductsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  linkProductToCategoryApi,
  unlinkProductFromCategoryApi,
  type Category,
  type Product,
  type Page,
} from "../../api/adminCatalog";

/* Theme */
const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const INK = "rgba(0,0,0,.08)";

export default function CategoriesPage() {
  // categories
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  // selection
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const selectedCatIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedCatIdRef.current = selectedCatId;
  }, [selectedCatId]);

  // products
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingAllProducts, setLoadingAllProducts] = useState(true);
  const [catProducts, setCatProducts] = useState<Product[]>([]);
  const [loadingCatProducts, setLoadingCatProducts] = useState(false);
    const [assignedCounts, setAssignedCounts] = useState<Record<number, number>>({});

      const [assignedCatsByPid, setAssignedCatsByPid] = useState<Record<number, string[]>>({});

    const [loadingAssignedScan, setLoadingAssignedScan] = useState(false);
    const [assignedUpdatedAt, setAssignedUpdatedAt] = useState<Date | null>(null);

  // ui
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; data?: Category; parentId?: number }>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // drag state
  const [draggingPid, setDraggingPid] = useState<number | null>(null);
  const [dragOverCat, setDragOverCat] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  type AssignFilter = "all" | "assigned" | "unassigned";
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");


  // ---------- Load categories once ----------
  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingCats(true);
      setCatsErr(null);
      try {
        const data = await listAllCategories();
        const rows = Array.isArray(data) ? data : [];
        if (!live) return;
        setCats(rows);
        if (!selectedCatId && rows.length) setSelectedCatId(rows[0].id!);

      } catch (e: any) {
        if (!live) return;
        setCats([]);
        setCatsErr(e?.response?.data?.message || "Failed to load categories");
      } finally {
        if (live) setLoadingCats(false);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Load all products once (page 0, size 500) ----------
  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingAllProducts(true);
      try {
        const page: any = await listProducts(0, 500);
        if (!live) return;
        setAllProducts(Array.isArray(page?.content) ? page.content : []);
      } catch {
        if (!live) return;
        setAllProducts([]);
      }
         finally {
        if (live) setLoadingAllProducts(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // ---------- Load products for selected category ----------
  useEffect(() => {
    if (!selectedCatId) { setCatProducts([]); return; }
    let live = true;
    (async () => {
      setLoadingCatProducts(true);
      try {
        const prods = await listProductsByCategory(selectedCatId, 0, 300);
        if (!live) return;
        setCatProducts(prods);
      } catch (e: any) {
        if (!live) return;
        setCatProducts([]);
        setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to load category products" });
      }
       finally {
        if (live) setLoadingCatProducts(false);
      }
    })();
    return () => { live = false; };
  }, [selectedCatId]);

    // ✅ Build global "assigned anywhere" map (background scan)
    useEffect(() => {
      if (!cats || cats.length === 0) return;

      let live = true;
      (async () => {
        setLoadingAssignedScan(true);
        try {
          const tasks = cats
            .filter(c => !!c.id)
            .map(c => () => fetchAllProductsForCategory(c.id!));

          const allLists = await runWithLimit(tasks, 5); // limit=5 is a good balance

          if (!live) return;

                  const counts: Record<number, number> = {};
                  const catsByPid: Record<number, Set<string>> = {};

                  for (let idx = 0; idx < allLists.length; idx++) {
                    const catName = cats[idx]?.name || "Category";
                    const list = allLists[idx] || [];

                    for (const p of list) {
                      if (!p?.id) continue;

                      counts[p.id] = (counts[p.id] || 0) + 1;

                      if (!catsByPid[p.id]) catsByPid[p.id] = new Set<string>();
                      catsByPid[p.id].add(catName);
                    }
                  }

                  setAssignedCounts(counts);

                  // convert Set -> array (sorted for stable display)
                  const out: Record<number, string[]> = {};
                  Object.entries(catsByPid).forEach(([pid, set]) => {
                    out[Number(pid)] = Array.from(set).sort((a, b) => a.localeCompare(b));
                  });

                  setAssignedCatsByPid(out);
                  setAssignedUpdatedAt(new Date());

        } catch {
          if (!live) return;
          setAssignedCounts({});
        } finally {
          if (live) setLoadingAssignedScan(false);
        }
      })();

      return () => { live = false; };
    }, [cats]);


  // ---------- Filtering for the "All products" search ----------
  const filteredAll = useMemo(() => {
    const t = q.trim().toLowerCase();

    // 1) text filter
    let rows = !t
      ? allProducts
      : allProducts.filter(p =>
          p.name?.toLowerCase().includes(t) ||
          (p.slug || "").toLowerCase().includes(t)
        );

    // 2) assigned/unassigned filter
    rows = rows.filter(p => {
      const cats = assignedCatsByPid[p.id!] || [];
      const isAssigned = cats.length > 0;

      if (assignFilter === "assigned") return isAssigned;
      if (assignFilter === "unassigned") return !isAssigned;
      return true; // all
    });

    return rows;
  }, [allProducts, q, assignFilter, assignedCatsByPid]);
const assignCounts = useMemo(() => {
  const total = allProducts.length;

  let assigned = 0;
  for (const p of allProducts) {
    const cats = assignedCatsByPid[p.id!] || [];
    if (cats.length > 0) assigned++;
  }

  return {
    total,
    assigned,
    unassigned: Math.max(total - assigned, 0),
  };
}, [allProducts, assignedCatsByPid]);



  const assignedIds = useMemo(() => {
      return new Set(catProducts.map(p => p.id!).filter(Boolean));
    }, [catProducts]);

  // ---------- CRUD ----------
  async function refreshCategories() {
    try {
      const data = await listAllCategories();
      const rows = Array.isArray(data) ? data : [];
      setCats(rows);
      if (selectedCatId && !rows.find(c => c.id === selectedCatId)) {
        setSelectedCatId(rows[0]?.id ?? null);
      }

    } catch {
      /* keep old state on refresh failure */
    }
  }
    // --- tiny concurrency limiter (so we don't hammer API) ---
    async function runWithLimit<T>(tasks: Array<() => Promise<T>>, limit = 5): Promise<T[]> {
      const results: T[] = [];
      let i = 0;

      const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
        while (i < tasks.length) {
          const idx = i++;
          results[idx] = await tasks[idx]();
        }
      });

      await Promise.all(workers);
      return results;
    }

    // --- fetch ALL products of a category by paging (safe) ---
    async function fetchAllProductsForCategory(catId: number) {
      const pageSize = 300;
      const maxPages = 20; // safety guard
      let page = 0;
      let all: Product[] = [];

      while (page < maxPages) {
        const chunk = await listProductsByCategory(catId, page, pageSize);
        all = all.concat(chunk || []);
        if (!chunk || chunk.length < pageSize) break;
        page++;
      }
      return all;
    }


  async function save(form: Partial<Category>) {
    setBusy(true);
    try {
      if (modal?.mode === "create") {
        await createCategory({
          name: form.name?.trim() || "",
          slug: (form.slug ?? "").trim(),
          description: (form.description ?? "").trim(),
          active: form.active ?? true,
          ...(form as any).parentId !== undefined ? { parentId: (form as any).parentId } : {},
        } as any);
        await refreshCategories();
        setToast({ kind: "ok", msg: "Category created" });
      } else if (modal?.mode === "edit" && modal.data?.id) {
        const updated = await updateCategory(modal.data.id, {
          name: form.name,
          slug: form.slug,
          description: form.description,
          active: form.active,
          ...(form as any).parentId !== undefined ? { parentId: (form as any).parentId } : {},
        } as any);
        setCats(prev => prev.map(c => (c.id === updated.id ? updated : c)));
        setToast({ kind: "ok", msg: "Category updated" });
      }
      setModal(null);
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(cat: Category) {
    if (!confirm(`Delete category “${cat.name}”?`)) return;
    try {
      await deleteCategory(cat.id!);
      await refreshCategories();
      if (selectedCatId === cat.id) setSelectedCatId(null);
      setToast({ kind: "ok", msg: "Category deleted" });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Delete failed" });
    }
  }

  // ---------- Drag & Drop (product -> category) ----------
  function createGhost(name: string) {
    const el = document.createElement("div");
    el.className = "drag-ghost";
    el.textContent = name;
    document.body.appendChild(el);
    dragGhostRef.current = el;
    return el;
  }

  function cleanupGhost() {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }

  function onDragStartProduct(e: React.DragEvent, product: Product) {
    e.dataTransfer.setData("text/plain", String(product.id));
    e.dataTransfer.effectAllowed = "move";
    setDraggingPid(product.id);

    // Custom drag image: neat pill with product name
    const ghost = createGhost(product.name);
    const rect = ghost.getBoundingClientRect();
    e.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
  }

  function onDragEndProduct() {
    setDraggingPid(null);
    setDragOverCat(null);
    cleanupGhost();
  }

  function onDragOverCategory(e: React.DragEvent, catId: number) {
    e.preventDefault();                // allow drop -> avoids the red disabled cursor
    e.dataTransfer.dropEffect = "move";
    if (dragOverCat !== catId) setDragOverCat(catId);
  }

  function onDragEnterCategory(_e: React.DragEvent, catId: number) {
    if (dragOverCat !== catId) setDragOverCat(catId);
  }

  function onDragLeaveCategory(e: React.DragEvent, catId: number) {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      if (dragOverCat === catId) setDragOverCat(null);
    }
  }

  async function onDropToCategory(e: React.DragEvent, catId: number) {
    e.preventDefault();
    const pidRaw = e.dataTransfer.getData("text/plain");
    const productId = Number(pidRaw);
    setDragOverCat(null);
    cleanupGhost();

    if (!productId) return;

    // 👉 When dropped, make this category the selected one immediately
    setSelectedCatId(catId);

    try {
      await linkProductToCategoryApi(productId, catId);
                  const catName = cats.find(c => c.id === catId)?.name || "Category";

                  setAssignedCounts(prev => ({
                    ...prev,
                    [productId]: (prev[productId] || 0) + 1,
                  }));

                  setAssignedCatsByPid(prev => {
                    const next = { ...prev };
                    const cur = new Set(next[productId] || []);
                    cur.add(catName);
                    next[productId] = Array.from(cur).sort((a, b) => a.localeCompare(b));
                    return next;
                  });

                  setAssignedUpdatedAt(new Date());


      setToast({ kind: "ok", msg: "Product linked" });

      // If we are still on the same category, refresh the list to show the new product
      if (selectedCatIdRef.current === catId) {
        const prods = await listProductsByCategory(catId, 0, 300);
        setCatProducts(prods);
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Link failed" });
    } finally {
      setDraggingPid(null);
    }
  }

  async function unlink(productId: number) {
    if (!selectedCatId) return;
    const old = catProducts;
    setCatProducts(prev => prev.filter(x => x.id !== productId));
    try {
      await unlinkProductFromCategoryApi(productId, selectedCatId);
                 const catName = cats.find(c => c.id === selectedCatId)?.name || "Category";

                 setAssignedCounts(prev => {
                   const next = { ...prev };
                   const cur = next[productId] || 0;
                   if (cur <= 1) delete next[productId];
                   else next[productId] = cur - 1;
                   return next;
                 });

                 setAssignedCatsByPid(prev => {
                   const next = { ...prev };
                   const cur = new Set(next[productId] || []);
                   cur.delete(catName);

                   if (cur.size === 0) delete next[productId];
                   else next[productId] = Array.from(cur).sort((a, b) => a.localeCompare(b));

                   return next;
                 });

                 setAssignedUpdatedAt(new Date());


      setToast({ kind: "ok", msg: "Product unlinked" });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Unlink failed" });
      setCatProducts(old);
    }
  }

  return (
    <div className="cat-wrap">
      <style>{css}</style>

      <div className="hd">
        <div>
          <h2>Categories</h2>
          <p className="muted">Manage categories and assign products by drag & drop.</p>
        </div>
        <div className="actions">
          <div className="search">
            <div className="box">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search all products…"
                aria-label="Search products"
              />
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
          <button
            className="btn"
            onClick={() => setModal({ mode: "create", parentId: selectedCatId || undefined })}
          >
            Add category
          </button>
        </div>
      </div>

      {toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={() => setToast(null)}>
          {toast.msg}
        </div>
      )}

      <div className="layout">
        {/* Left: categories list */}
        <div
          className="left card"
          onDragOver={(e) => {
            // keep cursor as "move" even between rows
            if (draggingPid) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
          }}>
          <div className="left-hd">Categories</div>

          {loadingCats ? (
            <div className="pad">Loading categories…</div>
          ) : catsErr ? (
            <div className="pad alert bad">{catsErr}</div>
          ) : cats.length === 0 ? (
            <div className="pad muted">No categories yet.</div>
          ) : (
            <div className="clist">
              {cats.map((c) => {
                const sel = selectedCatId === c.id;
                const hov = dragOverCat === c.id;
                return (
                  <div
                    key={c.id}
                    className={"crow" + (sel ? " sel" : "") + (hov ? " dragover" : "")}
                    onClick={() => setSelectedCatId(c.id!)}
                    onDragOver={(e) => onDragOverCategory(e, c.id!)}
                    onDragEnter={(e) => onDragEnterCategory(e, c.id!)}
                    onDragLeave={(e) => onDragLeaveCategory(e, c.id!)}
                    onDrop={(e) => onDropToCategory(e, c.id!)}
                    title="Drop a product here to assign"
                  >
                    <div className="cmeta">
                      <div className="cname">{c.name}</div>
                      <div className="muted tiny">{c.slug || "—"} · {c.active ? "Active" : "Disabled"}</div>
                    </div>
                    <div className="row-actions">
                      <button
                        className="ghost sm"
                        onClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", data: c }); }}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost sm bad"
                        onClick={(e) => { e.stopPropagation(); remove(c); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: products panes */}
        <div className="right card">
          <div className="tabs">
            <div className="tabs-left">
              <strong>
                Products in “{cats.find(c => c.id === selectedCatId)?.name || "—"}”
              </strong>
            </div>
            <div className="tabs-right muted">Drag from “All products” and drop on a category to assign.</div>
          </div>

          <div className="split">
            <div
              className="pane"
              onDragOver={(e) => {
                if (draggingPid) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
              }}
            >
              <div className="pane-hd pane-hd-col">
                <div className="pane-hd-top">
                  <div className="pane-hd-left">
                    <span className="pane-hd-title">All products</span>
                    <span className="pane-hd-count">({filteredAll.length})</span>
                  </div>
                </div>

                <div className="pill-row">
                  <button className={"pill " + (assignFilter === "all" ? "active" : "")} onClick={() => setAssignFilter("all")}>
                    All
                  </button>
                  <button className={"pill " + (assignFilter === "assigned" ? "active" : "")} onClick={() => setAssignFilter("assigned")}>
                    Assigned
                  </button>
                  <button className={"pill " + (assignFilter === "unassigned" ? "active" : "")} onClick={() => setAssignFilter("unassigned")}>
                    Unassigned
                  </button>
                </div>
              </div>



              {loadingAllProducts ? (
                <div className="pad">Loading products…</div>
              ) : (
                <div className="plist">
                  {filteredAll.map(p => {
                            const catNames = assignedCatsByPid[p.id!] || [];
                            const count = catNames.length;
                            const isAssigned = count > 0;

                            const badgeText = loadingAssignedScan
                              ? "Checking…"
                              : !isAssigned
                                ? "Unassigned"
                                : count === 1
                                  ? catNames[0]
                                  : `${catNames[0]} +${count - 1}`;

                            const tooltipText = isAssigned ? catNames.join(", ") : "Not assigned to any category";


                    return (
                      <div
                        key={p.id}
                        className={"pitem compact" + (draggingPid === p.id ? " dragging" : "")}
                        draggable
                        onDragStart={(e) => onDragStartProduct(e, p)}
                        onDragEnd={onDragEndProduct}
                        title="Drag into a category"
                      >
                        <div className="pcol">
                          <div className="pname" title={p.name}>{p.name}</div>

                          <div className="pmeta-row">
                            <span className="pid">#{p.id}</span>
                            <span className="price">₹{new Intl.NumberFormat("en-IN").format(p.price)}</span>

                            {(() => {
                              const catNames = assignedCatsByPid[p.id!] || [];
                              const count = catNames.length;
                              const isAssigned = count > 0;

                              const badgeText = loadingAssignedScan
                                ? "Checking…"
                                : !isAssigned
                                  ? "Unassigned"
                                  : count === 1
                                    ? catNames[0]
                                    : `${catNames[0]} +${count - 1}`;

                              const tooltipText = isAssigned ? catNames.join(", ") : "Not assigned to any category";

                              return (
                                <span
                                  className={"badge " + (isAssigned ? "ok" : "muted")}
                                  title={tooltipText}
                                >
                                  {badgeText}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="drag-grip" aria-hidden="true">⋮⋮</div>
                      </div>

                    );
                  })}


                  {filteredAll.length === 0 && <div className="pad muted">No matches.</div>}
                </div>
              )}
            </div>

            <div className="pane">
              <div className="pane-hd">Assigned to category</div>
              {!selectedCatId ? (
                <div className="pad muted">Select a category from the left.</div>
              ) : loadingCatProducts ? (
                <div className="pad">Loading…</div>
              ) : (
                <div className="plist">
                  {catProducts.map((p) => (
                    <div key={p.id} className="pitem pitem-row">
                      <div className="pmeta">
                        <div className="pname" title={p.name}>{p.name}</div>
                        {p.slug && <div className="muted tiny">/{p.slug}</div>}
                      </div>
                      <div className="pright">
                        <span className="pid">#{p.id}</span>
                        <button className="ghost sm bad" onClick={() => unlink(p.id!)}>Unlink</button>
                      </div>
                    </div>
                  ))}
                  {catProducts.length === 0 && <div className="pad muted">No products in this category.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <CategoryModal
          mode={modal.mode}
          initial={modal.data}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={save}
          parents={cats}
          defaultParentId={modal.parentId}
        />
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
function CategoryModal({
  mode,
  initial,
  busy,
  onClose,
  onSave,
  parents,
  defaultParentId
}: {
  mode: "create" | "edit";
  initial?: Category;
  busy: boolean;
  onClose: () => void;
  onSave: (form: Partial<Category>) => void;
  parents: Category[];
  defaultParentId?: number;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [parentId, setParentId] = useState<number | "">((initial as any)?.parentId ?? (defaultParentId ?? ""));

  useEffect(() => {
    if (!initial && mode === "create") setSlug(slugify(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mode]);

  const parentOptions = parents.filter(p => p.id !== initial?.id);

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <strong>{mode === "create" ? "Add Category" : "Edit Category"}</strong>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-bd">
          <div className="grid2">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garlands" />
            </label>
            <label>
              <span>Slug</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="garlands" />
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>

          <div className="grid2">
            <label>
              <span>Parent</span>
              <select
                value={parentId === "" ? "" : String(parentId)}
                onChange={(e) => setParentId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">— None (top level) —</option>
                {parentOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="check" style={{ alignItems: "end" }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span>Active</span>
            </label>
          </div>
        </div>
        <div className="modal-ft">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={busy || !name.trim()}
            onClick={() =>
              onSave({
                id: initial?.id,
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim(),
                active,
                // backend may accept it; if not, it’s ignored
                parentId: parentId === "" ? null : parentId,
              })
            }
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- utils + styles ---------- */
function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* ═══════════════════════════ PREMIUM CATEGORIES PAGE STYLES ═══════════════════════════ */
const css = `
.cat-wrap {
  padding: 24px;
  color: ${PRIMARY};
  max-width: 1500px;
  margin: 0 auto;
  min-height: 100vh;
}

/* ═══════════════════════════ HEADER ═══════════════════════════ */
.hd {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  position: relative;
}

.hd::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD}, #9BB472);
  border-radius: 3px 3px 0 0;
}

.hd h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hd h2::before {
  content: "📁 ";
  -webkit-text-fill-color: initial;
}

.muted {
  opacity: 0.6;
  font-size: 13px;
  margin-top: 6px;
}

.tiny {
  font-size: 11px;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* ═══════════════════════════ SEARCH ═══════════════════════════ */
.search {
  display: flex;
  align-items: center;
}

.search .box {
  position: relative;
  width: 280px;
}

.search input {
  width: 100%;
  height: 44px;
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 0 44px 0 16px;
  outline: none;
  background: #fff;
  font-size: 14px;
  transition: all 0.2s ease;
}

.search input:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.search svg {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
  pointer-events: none;
}

/* ═══════════════════════════ LAYOUT ═══════════════════════════ */
.layout {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

/* ═══════════════════════════ CARDS ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 48px rgba(0,0,0,0.06);
  overflow: hidden;
}

/* ═══════════════════════════ LEFT COLUMN (Categories) ═══════════════════════════ */
.left {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  min-height: 300px;
}

.left-hd {
  padding: 16px 20px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  font-weight: 800;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.left-hd::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, ${ACCENT}, ${GOLD});
  border-radius: 2px;
}

.pad {
  padding: 20px;
}

.alert.bad {
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
  border: 1px solid rgba(198,40,40,0.2);
  color: #b71c1c;
  border-radius: 12px;
}

/* ═══════════════════════════ CATEGORY LIST ═══════════════════════════ */
.clist {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.crow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid ${INK};
  cursor: pointer;
  transition: all 0.2s ease;
}

.crow:last-child {
  border-bottom: none;
}

.crow:hover {
  background: #fafafa;
}

.crow.sel {
  background: linear-gradient(90deg, rgba(246,195,32,0.12) 0%, rgba(255,255,255,0) 100%);
  border-left: 4px solid ${GOLD};
  padding-left: 16px;
}

.crow.dragover {
  background: linear-gradient(135deg, rgba(240,93,139,0.06) 0%, rgba(255,255,255,0) 100%);
  outline: 2px dashed ${ACCENT};
  outline-offset: -4px;
}

.cmeta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cname {
  font-weight: 700;
  font-size: 14px;
}

.row-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.crow:hover .row-actions {
  opacity: 1;
}

/* ═══════════════════════════ RIGHT COLUMN ═══════════════════════════ */
.right {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  min-height: 300px;
}

.tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
}

.tabs-left strong {
  font-weight: 800;
  font-size: 15px;
}

.tabs-right {
  font-size: 12px;
}

/* ═══════════════════════════ SPLIT PANES ═══════════════════════════ */
.split {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.pane {
  border: 1px solid ${INK};
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fafafa;
}

.pane-hd {
  padding: 12px 16px;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #555;
  background: #fff;
  border-bottom: 1px solid ${INK};
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-hd::before {
  content: "";
  width: 3px;
  height: 14px;
  background: linear-gradient(180deg, ${ACCENT}, ${GOLD});
  border-radius: 2px;
}

/* ═══════════════════════════ PRODUCT LIST ═══════════════════════════ */
.plist {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 10px;
  padding: 12px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: #fff;
}

/* ═══════════════════════════ PRODUCT ITEM (Draggable) ═══════════════════════════ */
.pitem {
  border: 1px solid ${INK};
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  transition: all 0.2s ease;
}

.pitem:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

.pitem.compact {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: grab;
}

.pitem.compact:active {
  cursor: grabbing;
}

.pitem.dragging {
  opacity: 0.4;
  transform: scale(0.98);
  box-shadow: none;
}

.pname {
  font-weight: 700;
  white-space: normal;
  flex: 1;
  min-width: 0;
  color: ${PRIMARY};
}

.pright {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.pid {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 8px;
  background: #f0f0f0;
  color: #666;
}

.price {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(246,195,32,0.15) 0%, rgba(255,215,0,0.1) 100%);
  color: #92400e;
}

/* ═══════════════════════════ ASSIGNED LIST ROW ═══════════════════════════ */
.pitem-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}

.pmeta {
  min-width: 0;
  display: grid;
  gap: 4px;
}

/* ═══════════════════════════ DRAG GHOST ═══════════════════════════ */
.drag-ghost {
  position: fixed;
  top: -9999px;
  left: -9999px;
  pointer-events: none;
  padding: 10px 16px;
  background: linear-gradient(135deg, #fff 0%, #fafafa 100%);
  border: 1px solid ${INK};
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2);
  font-weight: 700;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══════════════════════════ BUTTONS ═══════════════════════════ */
.btn {
  height: 44px;
  padding: 0 20px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(240,93,139,0.3);
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(240,93,139,0.4);
}

.ghost {
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid ${INK};
  background: #fff;
  color: ${PRIMARY};
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.15s ease;
}

.ghost:hover {
  background: #fafafa;
  border-color: rgba(0,0,0,0.15);
}

.ghost.bad {
  border-color: rgba(198,40,40,0.3);
  color: #c62828;
}

.ghost.bad:hover {
  background: rgba(198,40,40,0.06);
}

.ghost.sm,
.btn.sm {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
}

/* ═══════════════════════════ MODAL ═══════════════════════════ */
.modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  padding: 20px;
  overflow: auto;
}

.modal {
  width: 680px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  border: 1px solid ${INK};
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 40px 120px rgba(0,0,0,0.3);
  animation: modalIn 0.3s ease-out;
}

@keyframes modalIn {
  from { transform: scale(0.92) translateY(30px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

.modal-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(135deg, rgba(246,195,32,0.08) 0%, #fff 100%);
}

.modal-hd strong {
  font-size: 18px;
  font-weight: 800;
}

.modal-bd {
  padding: 24px;
  overflow: auto;
  flex: 1 1 auto;
  display: grid;
  gap: 16px;
}

.modal-ft {
  padding: 16px 24px;
  border-top: 1px solid ${INK};
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
}

.x {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border: none;
  border-radius: 12px;
  font-size: 20px;
  cursor: pointer;
  color: #888;
  transition: all 0.2s ease;
}

.x:hover {
  background: ${ACCENT};
  color: #fff;
  transform: rotate(90deg);
}

/* ═══════════════════════════ FORM ═══════════════════════════ */
.grid2 {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr 1fr;
}

.grid2 label,
.modal-bd label {
  display: grid;
  gap: 8px;
}

.modal-bd label > span {
  font-size: 12px;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

input,
textarea,
select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid ${INK};
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

input:focus,
textarea:focus,
select:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 3px rgba(240,93,139,0.12);
}

.check {
  display: flex;
  gap: 10px;
  align-items: center;
}

.check input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: ${ACCENT};
}

/* ═══════════════════════════ TOAST ═══════════════════════════ */
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 200;
  padding: 14px 20px;
  border-radius: 14px;
  color: #fff;
  font-weight: 600;
  animation: toastSlide 2.8s ease forwards;
}

.toast.ok {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  box-shadow: 0 10px 32px rgba(240,93,139,0.4);
}

.toast.bad {
  background: linear-gradient(135deg, #c62828 0%, #e53935 100%);
  box-shadow: 0 10px 32px rgba(198,40,40,0.35);
}
/* ✅ Global assigned/unassigned style (All products pane) */
.pitem.assigned {
  border-color: rgba(155, 180, 114, 0.35);
  background: linear-gradient(135deg, rgba(155,180,114,0.08) 0%, #fff 60%);
}

.pitem.unassigned {
  border-color: rgba(0,0,0,0.10);
}

.badge {
  font-size: 11px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.10);
  background: #f6f6f6;
  color: #666;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge.ok {
  background: rgba(155,180,114,0.16);
  border-color: rgba(155,180,114,0.35);
  color: #2f4b12;
}

.badge.muted {
  background: rgba(240,93,139,0.10);
  border-color: rgba(240,93,139,0.25);
  color: #8a2b47;
}
/* ✅ Product bubble layout: name on top, meta chips below */
.pitem.compact {
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  cursor: grab;
}

.pcol {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Name: clean + clamp */
.pname {
  font-weight: 800;
  font-size: 14px;
  line-height: 1.25;
  color: ${PRIMARY};
  min-width: 0;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Chips row */
.pmeta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Keep pid/price/badge as chips */
.pid,
.price,
.badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  border-radius: 10px;
  padding: 0 10px;
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Badge variants */
.badge.ok {
  background: rgba(155, 180, 114, 0.18);
  border: 1px solid rgba(155, 180, 114, 0.25);
  color: #2f4b12;
  font-weight: 800;
}

.badge.muted {
  background: rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.06);
  color: #666;
  font-weight: 800;
}

/* Nice little drag grip */
.drag-grip {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid ${INK};
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa09a;
  font-weight: 900;
  user-select: none;
}

.drag-grip:hover {
  background: #fafafa;
  color: ${PRIMARY};
}
.pane-hd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pill-group {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 8px;
  padding: 4px;
  background: #fff;
  border: 1px solid ${INK};
  border-radius: 999px;
  max-width: 100%;
  overflow-x: auto;          /* ✅ scroll instead of hiding */
  -webkit-overflow-scrolling: touch;
}

.pill-group::-webkit-scrollbar { height: 0; }


.pill {
  border: none;
  background: transparent;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 800;
  font-size: 12px;
  color: #666;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.pill:hover {
  background: rgba(0,0,0,0.04);
  color: ${PRIMARY};
}

.pill.active {
  background: linear-gradient(135deg, ${GOLD} 0%, #ffe066 100%);
  color: #5d4800;
  box-shadow: 0 6px 18px rgba(246,195,32,0.25);
}

.pill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pill-n {
  height: 22px;
  min-width: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.06);
  color: ${PRIMARY};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 900;
}

.pill.active .pill-n {
  background: rgba(255,255,255,0.6);
  color: #5d4800;
}

/* Pane header becomes a small column: title row + pills row */
.pane-hd.pane-hd-col {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;

}

.pane-hd-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Pills line under header */
.pill-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;            /* ✅ pills wrap on small width */
}

/* Pill button */
.pill {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,0.10);
  background: #fff;
  color: rgba(74,79,65,0.75);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover {
  border-color: rgba(0,0,0,0.18);
  transform: translateY(-1px);
}

.pill.active {
  background: rgba(240,93,139,0.12);
  border-color: rgba(240,93,139,0.35);
  color: #4A4F41;
}
/* Your column header (title row + pills row) */
.pane-hd.pane-hd-col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

/* IMPORTANT: disable the old accent bar on the column wrapper */
.pane-hd.pane-hd-col::before {
  content: none !important;
}

/* Put the accent bar inside the TOP row so it stays on same line */
.pane-hd-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Add the accent bar here instead */
.pane-hd-top::before {
  content: "";
  width: 3px;
  height: 14px;
  background: linear-gradient(180deg, #F05D8B, #F6C320);
  border-radius: 2px;
  flex: 0 0 auto;
}

/* Title + count in ONE line */
.pane-hd-left {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
}

.pane-hd-title {
  font-weight: 800;
}

.pane-hd-count {
  font-size: 12px;
  opacity: 0.65;
  font-weight: 700;
}

/* Pills under header */
.pill-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.10);
  background: #fff;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}

.pill.active {
  background: rgba(240,93,139,0.12);
  border-color: rgba(240,93,139,0.35);
}
/* Put the accent bar visually, without consuming space */
.pane-hd-top{
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;            /* gap between left block & right block */
  padding-left: 12px;   /* space reserved for the bar */
}

.pane-hd-top::before{
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 14px;
  background: linear-gradient(180deg, #F05D8B, #F6C320);
  border-radius: 2px;
}


@keyframes toastSlide {
  0% { transform: translateY(24px); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  85% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(12px); opacity: 0; }
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1100px) {
  .cat-wrap {
    padding: 16px;
  }

  .hd {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .actions {
    flex-wrap: wrap;
  }

  .search .box {
    width: 100%;
  }
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }

  .left,
  .right {
    flex: none;
    width: 100%;
    max-height: none;
  }

  .left {
    max-height: 400px;
  }

  .split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal,
  .toast,
  .pitem,
  .crow {
    animation: none !important;
    transition: none !important;
  }
}
`;

