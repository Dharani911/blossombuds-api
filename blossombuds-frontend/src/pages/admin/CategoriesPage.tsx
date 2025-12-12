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

    // 👉 When dropped, make this category the selected one immediately
    setSelectedCatId(catId);

    try {
      await linkProductToCategoryApi(productId, catId);
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

