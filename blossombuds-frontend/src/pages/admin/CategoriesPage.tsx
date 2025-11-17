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
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const INK     = "rgba(0,0,0,.08)";

export default function CategoriesPage() {
  // categories
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  // selection
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  // products
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingAllProducts, setLoadingAllProducts] = useState(true);
  const [catProducts, setCatProducts] = useState<Product[]>([]);
  const [loadingCatProducts, setLoadingCatProducts] = useState(false);

  // ui
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; data?: Category; parentId?: number }>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "bad"; msg: string } | null>(null);

  // drag state
  const [draggingPid, setDraggingPid] = useState<number | null>(null);
  const [dragOverCat, setDragOverCat] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  // ---------- Load categories once ----------
  useEffect(() => {
    let live = true;
    (async () => {
      setLoadingCats(true);
      setCatsErr(null);
      try {
        const data = await listAllCategories(); // returns Category[]
        if (!live) return;
        setCats(Array.isArray(data) ? data : []);
        if (!selectedCatId && data.length) setSelectedCatId(data[0].id!);
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
        const page: Page<Product> = await listProducts(0, 500);
        if (!live) return;
        setAllProducts(page.content || []);
      } catch {
        if (!live) return;
        setAllProducts([]);
      } finally {
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
      } finally {
        if (live) setLoadingCatProducts(false);
      }
    })();
    return () => { live = false; };
  }, [selectedCatId]);

  // ---------- Filtering for the "All products" search ----------
  const filteredAll = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return allProducts;
    return allProducts.filter(p =>
      p.name?.toLowerCase().includes(t) ||
      (p.slug || "").toLowerCase().includes(t)
    );
  }, [allProducts, q]);

  // ---------- CRUD ----------
  async function refreshCategories() {
    try {
      const data = await listAllCategories();
      setCats(Array.isArray(data) ? data : []);
      if (selectedCatId && !data.find(c => c.id === selectedCatId)) {
        setSelectedCatId(data[0]?.id ?? null);
      }
    } catch {
      /* keep old state on refresh failure */
    }
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

    // optimistic add if dropping into the currently selected category
    if (selectedCatId === catId) {
      const p = allProducts.find(x => x.id === productId);
      if (p && !catProducts.some(x => x.id === p.id)) {
        setCatProducts(prev => [p, ...prev]);
      }
    }
    try {
      await linkProductToCategoryApi(productId, catId);
      setToast({ kind: "ok", msg: "Product linked" });
      if (selectedCatId === catId) {
        const prods = await listProductsByCategory(catId, 0, 300);
        setCatProducts(prods);
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Link failed" });
      if (selectedCatId === catId) {
        setCatProducts(prev => prev.filter(x => x.id !== productId));
      }
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
              <div className="pane-hd">All products</div>
              {loadingAllProducts ? (
                <div className="pad">Loading products…</div>
              ) : (
                <div className="plist">
                  {filteredAll.map(p => (
                    <div
                      key={p.id}
                      className={"pitem compact" + (draggingPid === p.id ? " dragging" : "")}
                      draggable
                      onDragStart={(e) => onDragStartProduct(e, p)}
                      onDragEnd={onDragEndProduct}
                      title="Drag into a category"
                    >
                      <div className="pname" title={p.name}>{p.name}</div>
                      <div className="pright">
                        <span className="pid">#{p.id}</span>
                        <span className="price">₹{new Intl.NumberFormat("en-IN").format(p.price)}</span>
                      </div>
                    </div>
                  ))}
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
  // @ts-expect-error parentId may exist in your DTO; harmless if backend ignores it
  const [parentId, setParentId] = useState<number | "">( (initial as any)?.parentId ?? (defaultParentId ?? "") );

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
                // @ts-expect-error backend may accept it; if not, it’s ignored
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

const css = `
.cat-wrap{ padding: 12px; color:${PRIMARY}; }
.hd{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; margin-bottom:12px; }
.hd h2{ margin:0; font-family: "DM Serif Display", Georgia, serif; }
.muted{ opacity:.75; font-size:12px; }
.tiny{ font-size:11px; }
.actions{ display:flex; gap:10px; align-items:center; }
.search{ display:flex; align-items:center; gap:8px; }
.search .box{ position:relative; flex:1 1 260px; }
.search input{
  width:100%; height:38px;
  border:1px solid ${INK};
  border-radius:12px; padding:0 36px 0 12px; outline:none; background:#fff;
}
.search svg{ position:absolute; right:10px; top:50%; transform: translateY(-50%); opacity:.7; pointer-events:none; }

.layout{ display:grid; grid-template-columns: 320px 1fr; gap:12px; }
.card{ border:1px solid ${INK}; border-radius:14px; background:#fff; box-shadow:0 12px 36px rgba(0,0,0,.08); overflow:hidden; }
.left-hd, .tabs{ padding:10px 12px; border-bottom:1px solid ${INK}; background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.92)); }
.pad{ padding:12px; }

/* Categories */
.clist{ display:grid; }
.crow{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:10px 12px; border-bottom:1px solid ${INK}; cursor:pointer;
  transition: background .15s ease, box-shadow .15s ease;
}
.crow:last-child{ border-bottom:none; }
.crow:hover{ background:#fafafa; }
.crow.sel{ background:rgba(246,195,32,.12); border-left:3px solid ${GOLD}; }
.crow.dragover{
  background: rgba(240,93,139,.06);
  outline: 2px dashed ${ACCENT};
  outline-offset: -4px;
  box-shadow: inset 0 0 0 2px rgba(240,93,139,.08);
}
.cname{ font-weight:800; }
.row-actions{ display:flex; gap:6px; }

/* Products panes */
.tabs{ display:flex; align-items:center; justify-content:space-between; }
.split{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding:10px; }
.pane{ border:1px dashed ${INK}; border-radius:12px; overflow:hidden; }
.pane-hd{ padding:8px 10px; font-weight:800; background:#fff; border-bottom:1px solid ${INK}; }
.plist{ display:grid; gap:8px; padding:10px; }

/* Product item (compact) */
.pitem{
  border:1px solid ${INK}; border-radius:10px; background:#fff;
  box-shadow:0 8px 20px rgba(0,0,0,.06);
}
.pitem.compact{
  padding:8px 10px;
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  cursor:grab;
}
.pitem.compact:active{ cursor:grabbing; }
.pitem.dragging{
  filter: blur(2px);
  opacity:.6;
  transform:none; /* no tilt */
}
.pname{
  font-weight:800;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.pright{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
.pid{
  font-size:12px; line-height:1;
  padding:3px 6px; border-radius:8px;
  border:1px solid rgba(0,0,0,.10);
  background:#fafafa;
}
.price{
  font-size:12.5px; font-weight:700;
  padding:3px 8px; border-radius:999px;
  background: rgba(246,195,32,.12);
  border:1px solid rgba(246,195,32,.35);
}

/* Assigned list row layout */
.pitem-row{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px;
}
.pmeta{ min-width:0; display:grid; gap:2px; }

/* Drag ghost (custom drag image) */
.drag-ghost{
  position: fixed; top: -9999px; left: -9999px;
  pointer-events:none;
  padding:6px 10px;
  background:#fff;
  border:1px solid ${INK};
  border-radius:10px;
  box-shadow:0 12px 32px rgba(0,0,0,.18);
  font-weight:800;
  max-width:320px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* Buttons */
.btn{
  height:38px;width: wrap; padding:0 14px; border:none; border-radius:12px; cursor:pointer;
  background:${ACCENT}; color:#fff; font-weight:900;
  box-shadow: 0 10px 28px rgba(240,93,139,.35);
}
.ghost{
  height:32px;width:wrap; padding:0 10px; border-radius:10px; border:1px solid ${INK};
  background:#fff; color:${PRIMARY}; cursor:pointer;
}
.ghost.bad{ border-color: rgba(240,93,139,.5); color:#b0003a; }
.ghost.sm, .btn.sm{ height:28px; padding: 0 10px; border-radius:8px; font-size:12.5px; }

/* modal */
.modal-wrap{
  position: fixed; inset:0; z-index: 100;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,.28); backdrop-filter: blur(2px);
  padding:16px; overflow:auto;
}
.modal{
  width: 620px; max-width: calc(100vw - 24px);
  max-height: calc(100vh - 32px);
  display:flex; flex-direction:column;
  border:1px solid ${INK}; border-radius:16px; background:#fff;
  box-shadow:0 24px 80px rgba(0,0,0,.22);
}
.modal-hd{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; border-bottom:1px solid ${INK}; }
.modal-bd{ padding:12px; overflow:auto; flex:1 1 auto; display:grid; gap:10px; }
.modal-ft{ padding:10px 12px; border-top:1px solid ${INK}; display:flex; gap:10px; justify-content:flex-end; }
.x{ background:#fff; border:1px solid ${INK}; border-radius:8px; width:32px; height:32px; font-size:18px; cursor:pointer; }
.grid2{ display:grid; gap:10px; grid-template-columns: 1fr 1fr; }
.grid2 label, .modal-bd label{ display:grid; gap:6px; }
input, textarea, select{ width:100%; box-sizing:border-box; border:1px solid ${INK}; border-radius:10px; padding:10px; }
.check{ display:flex; gap:8px; align-items:center; }

/* toast */
.toast{
  position: fixed; right:14px; bottom:14px; z-index:101;
  padding:10px 12px; border-radius:12px; color:#fff; animation: toast .22s ease both;
}
.toast.ok{ background: #4caf50; }
.toast.bad{ background: #d32f2f; }
@keyframes toast{ from{ transform: translateY(8px); opacity:0 } to{ transform:none; opacity:1 } }
`;
