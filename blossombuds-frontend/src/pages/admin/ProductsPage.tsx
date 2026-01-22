// src/pages/admin/ProductsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { validateImageFile } from "../../utils/imageValidations";

import {
  listProducts,
  createProduct,
  updateProduct,            // used for visibility toggle
  deleteProduct,
  setProductFeatured,
  listProductImages,
  uploadProductImage,
  updateImageMeta,
  deleteProductImage,
  setPrimaryImage,
  listOptions,
  createOption,
  updateOption,
  deleteOption,
  listOptionValues,
  createOptionValue,
  updateOptionValue,
  deleteOptionValue,
  type Product,
  type ProductDto,
  type ProductImage,
  type Page,
  slugifyName,
} from "../../api/adminCatalog";

/* ---------- Theme ---------- */
const PRIMARY = "#2F2F2F";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const MINT = "#73C2A7";
const INK = "rgba(0,0,0,.08)";

/* ---------- Tiny UI bits ---------- */
function Toggle({
  checked,
  onChange,
  title,
  disabled,
  tone = "mint", // "mint" | "pink"
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  title?: string;
  disabled?: boolean;
  tone?: "mint" | "pink";
}) {
  return (
    <button
      className={"switch" + (checked ? " on" : "") + " " + tone}
      onClick={() => !disabled && onChange(!checked)}
      title={title}
      aria-label={title || (checked ? "On" : "Off")}
      type="button"
      disabled={disabled}
    >
      <span className="knob" />
    </button>
  );
}

function fmtRange(from: number, to: number, total: number) {
  if (total === 0) return "0 results";
  return `${from}–${to} of ${new Intl.NumberFormat("en-IN").format(total)}`;
}

function StarButton({
  on,
  saving,
  onClick,
  title,
}: {
  on: boolean;
  saving?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={"star-btn" + (on ? " on" : "") + (saving ? " saving" : "")}
      onClick={onClick}
      title={title || (on ? "Unfeature" : "Feature")}
      aria-label={title || (on ? "Unfeature" : "Feature")}
      type="button"
      disabled={saving}
    >
      <span className="star-shape" aria-hidden>★</span>
      <span className="sr">{on ? "Featured" : "Make featured"}</span>
      {saving && <span className="spin" aria-hidden />}
    </button>
  );
}
function DiscountButton({
  on,
  saving,
  onClick,
  title,
}: {
  on: boolean;              // ✅ just on/off
  saving?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      className={"pct-btn" + (on ? " on" : "") + (saving ? " saving" : "")}
      onClick={onClick}
      title={title || (on ? "Disable discount" : "Enable discount")}
      aria-label={title || (on ? "Disable discount" : "Enable discount")}
      type="button"
      disabled={saving}
    >
      <span className="pct-shape" aria-hidden>%</span>

      {saving && <span className="spin" aria-hidden />}
    </button>
  );
}


export default function ProductsPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Page<Product> | null>(null);
  const [q, setQ] = useState("");

  const [modal, setModal] = useState<null | { mode: "add" | "edit"; data?: Product }>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<null | { kind: "ok" | "bad", msg: string }>(null);
  const dismissToast = () => setToast(null);

  // Separate per-row locks
  const [busyFeature, setBusyFeature] = useState<Record<number, boolean>>({});
  const [busyVisible, setBusyVisible] = useState<Record<number, boolean>>({});
  const [busyStock, setBusyStock] = useState<Record<number, boolean>>({});
  const [busyDiscount, setBusyDiscount] = useState<Record<number, boolean>>({});
  const isLocked = (id: number) =>
    !!busyFeature[id] || !!busyVisible[id] || !!busyStock[id] || !!busyDiscount[id];



  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const pg = await listProducts(page, size);
        if (!alive) return;
        setData(pg);
      } catch (e: any) {
        setErr(e?.response?.data?.message || "Failed to load products.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [page, size]);

  const filtered = useMemo(() => {
    const items = (data?.content || []);
    const qq = q.toLowerCase().trim();
    return items.filter(p =>
      !qq ||
      p.name.toLowerCase().includes(qq) ||
      (p.slug || "").toLowerCase().includes(qq)
    );
  }, [data, q]);

  const totalPages = data?.totalPages ?? 0;

  async function reload() {
    const pg = await listProducts(page, size);
    setData(pg);
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this product? This is a soft delete (marks as inactive).")) return;
    try {
      await deleteProduct(id);
      setToast({ kind: "ok", msg: "Product deleted" });
      await reload();
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Delete failed" });
    }
  }
  async function onToggleStock(p: Product, next: boolean) {
    if (isLocked(p.id)) return;

    setBusyStock(m => ({ ...m, [p.id]: true }));

    const prev = Boolean((p as any).inStock ?? (p as any).isInStock ?? true);

    // optimistic UI
    setData(d => d
      ? ({ ...d, content: d.content.map(x => x.id === p.id ? ({ ...x, inStock: next } as any) : x) })
      : d
    );

    try {
      const updated = await updateProduct(p.id, { inStock: next } as any);
      const server = Boolean((updated as any).inStock ?? (updated as any).isInStock ?? next);

      setData(d => d
        ? ({ ...d, content: d.content.map(x => x.id === p.id ? ({ ...x, inStock: server } as any) : x) })
        : d
      );

      setToast({ kind: "ok", msg: server ? "Marked in stock" : "Marked out of stock" });
    } catch (e: any) {
      // revert
      setData(d => d
        ? ({ ...d, content: d.content.map(x => x.id === p.id ? ({ ...x, inStock: prev } as any) : x) })
        : d
      );
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to update stock" });
    } finally {
      setBusyStock(m => ({ ...m, [p.id]: false }));
    }
  }
async function onToggleDiscount(p: Product, nextExclude: boolean) {
  if (isLocked(p.id)) return;

  setBusyDiscount(m => ({ ...m, [p.id]: true }));

  const prevExclude = Boolean((p as any).excludeFromGlobalDiscount);

  // optimistic
  setData(d => d
    ? ({
        ...d,
        content: d.content.map(x =>
          x.id === p.id ? ({ ...x, excludeFromGlobalDiscount: nextExclude } as any) : x
        ),
      })
    : d
  );

  try {
    const updated = await updateProduct(p.id, { excludeFromGlobalDiscount: nextExclude } as any);
    const serverExclude = Boolean((updated as any).excludeFromGlobalDiscount ?? nextExclude);

    setData(d => d
      ? ({
          ...d,
          content: d.content.map(x =>
            x.id === p.id ? ({ ...x, excludeFromGlobalDiscount: serverExclude } as any) : x
          ),
        })
      : d
    );

    setToast({
      kind: "ok",
      msg: serverExclude ? "Excluded from global sale" : "Included in global sale",
    });
  } catch (e: any) {
    // revert
    setData(d => d
      ? ({
          ...d,
          content: d.content.map(x =>
            x.id === p.id ? ({ ...x, excludeFromGlobalDiscount: prevExclude } as any) : x
          ),
        })
      : d
    );
    setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to toggle discount" });
  } finally {
    setBusyDiscount(m => ({ ...m, [p.id]: false }));
  }
}




  // Toggle VISIBLE — use updateProduct(id, { visible: ... })
  async function onToggleVisible(p: Product, nextVisible: boolean) {
    if (isLocked(p.id)) return;
    setBusyVisible(m => ({ ...m, [p.id]: true }));
    // optimistic
    const prevVisible = Boolean((p as any).visible ?? (p as any).isVisible);
    setData(d => d ? ({ ...d, content: d.content.map(x => x.id === p.id ? { ...x, visible: nextVisible } : x) }) : d);
    try {
      const updated = await updateProduct(p.id, { visible: nextVisible } as any);
      const serverVisible = Boolean((updated as any).visible ?? (updated as any).isVisible ?? nextVisible);
      setData(d => d ? ({ ...d, content: d.content.map(x => x.id === p.id ? { ...x, visible: serverVisible } : x) }) : d);
      setToast({ kind: "ok", msg: serverVisible ? "Product is now visible" : "Product hidden" });
    } catch (e: any) {
      // revert
      setData(d => d ? ({ ...d, content: d.content.map(x => x.id === p.id ? { ...x, visible: prevVisible } : x) }) : d);
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to toggle visibility" });
    } finally {
      setBusyVisible(m => ({ ...m, [p.id]: false }));
    }
  }

  // Persist featured flag from the list
  async function onToggleFeatured(p: Product) {
    if (isLocked(p.id)) return;
    setBusyFeature(m => ({ ...m, [p.id]: true }));
    try {
      const desired = !p.featured;
      const updated = await setProductFeatured(p.id, desired);
      setData(d =>
        d ? ({ ...d, content: d.content.map(x => x.id === p.id ? { ...x, featured: !!updated.featured } : x) }) : d
      );
      setToast({ kind: "ok", msg: (!!updated.featured ? "Marked as featured" : "Removed from featured") });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to update featured flag" });
    } finally {
      setBusyFeature(m => ({ ...m, [p.id]: false }));
    }
  }
  const total = data?.totalElements ?? 0;
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <div className="prod-wrap">
      <style>{css}</style>

      <div className="bar">
        <div className="bar-left">
          <h2>Products</h2>
          <p>Search and manage products.</p>
        </div>
        <div className="bar-right">
          <div className="search">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name or slug…"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
          <button className="btn" onClick={() => setModal({ mode: "add" })}>+ Add product</button>
        </div>
      </div>

      {err && <div className="alert bad">{err}</div>}

      <div className="card">
        {loading ? <SkeletonTable rows={6} /> : (
          <table className="grid">
            <thead>
              <tr>
                {[
                  <th key="id" style={{ width: 70 }}>ID</th>,
                  <th key="name">Name</th>,
                  <th key="slug">Slug</th>,
                  <th key="price" style={{ width: 120, textAlign: "right" }}>Price</th>,
                  <th key="flags" style={{ width: 200 }}>Flags</th>,
                  <th key="stock" style={{ width: 140 }}>Stock</th>,
                  <th key="actions" style={{ width: 340 }}></th>,

                ]}
              </tr>
            </thead>

            <tbody>
              {filtered.map(row => {
                const isVisible = Boolean((row as any).visible ?? (row as any).isVisible);
                const inStock = Boolean((row as any).inStock ?? (row as any).isInStock ?? true);
                const exclude = Boolean((row as any).excludeFromGlobalDiscount);
                const discountOn = !exclude; // discount applies when NOT excluded



                return (
                  <tr key={row.id}>
                    <td>#{row.id}</td>
                    <td className="strong">{row.name}</td>
                    <td className="muted">{row.slug || "-"}</td>
                    <td style={{ textAlign: "right" }}>₹{new Intl.NumberFormat("en-IN").format(Number(row.price || 0))}</td>
                    <td>
                      <span className={"pill " + (isVisible ? "ok" : "off")}>
                        {isVisible ? "Visible" : "Hidden"}
                      </span>
                      {!!row.featured && <span className="pill gold">Featured</span>}
                      {row.active === false && <span className="pill off">Inactive</span>}
                      {discountOn && <span className="pill pink">Discount</span>}

                    </td>
                    <td>
                      <span className={"pill " + (inStock ? "ok" : "off")}>
                        {inStock ? "In stock" : "Out"}
                      </span>
                    </td>

                    <td className="actions">
                      <div className="flag-actions">
                        <div className="flag">
                          <small>Featured</small>
                          <StarButton
                            on={!!row.featured}
                            saving={!!busyFeature[row.id]}
                            onClick={() => onToggleFeatured(row)}
                            title={row.featured ? "Unfeature" : "Feature"}
                          />
                        </div>
                        <div className="flag">
                          <small>Discount</small>
                          <DiscountButton
                            on={discountOn}
                            saving={!!busyDiscount[row.id]}
                            onClick={() => onToggleDiscount(row, !exclude)}
                            title={discountOn ? "Discount ON" : "Discount OFF"}
                          />


                        </div>

                        <div className="flag">
                          <small>Visible</small>
                          <Toggle tone="pink"
                            checked={isVisible}
                            onChange={(val) => onToggleVisible(row, val)}
                            title={isVisible ? "Hide" : "Show"}
                            disabled={isLocked(row.id)}
                          />
                        </div>

                        <div className="flag">
                          <small>Stock</small>
                          <Toggle tone="mint"
                            checked={inStock}
                            onChange={(val) => onToggleStock(row, val)}
                            title={inStock ? "Mark out of stock" : "Mark in stock"}
                            disabled={isLocked(row.id)}
                          />
                        </div>
                      </div>

                      <button className="ghost" onClick={() => setModal({ mode: "edit", data: row })}>Edit</button>
                      <button className="ghost bad" onClick={() => onDelete(row.id)}>Delete</button>
                    </td>

                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "28px 0" }}>No products match your search.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {/* Pagination */}
      <div className="card">
        <div className="pager">
          <div className="muted">{fmtRange(from, to, total)}</div>
          <div className="pgbtns">
            <button className="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="ghost" disabled={data ? (page + 1) >= data.totalPages : true} onClick={() => setPage(p => p + 1)}>Next</button>
            <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
              {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}/page</option>)}
            </select>
          </div>
        </div>
      </div>



      {/* Modal with tabs (Details + Images + Options) */}
      {modal && (
        <ProductModal
          initial={modal.data}
          mode={modal.mode}
          busy={busy}
          onClose={() => setModal(null)}
          onReload={reload}
          onCreated={(p) => setModal({ mode: "edit", data: p })}
          setToast={setToast}
          toast={toast}
          dismissToast={dismissToast}
        />
      )}

      {/* Toast (only when modal is NOT open) */}
      {!modal && toast && (
        <div className={"toast " + toast.kind} onAnimationEnd={dismissToast}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
function ProductModal({
  initial, mode, onClose, busy, onReload, onCreated, setToast,
  toast, dismissToast
}: {
  initial?: Product | null;
  mode: "add" | "edit";
  busy?: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
  onCreated: (p: Product) => void;
  setToast: React.Dispatch<React.SetStateAction<{ kind: "ok" | "bad", msg: string } | null>>;
  toast?: { kind: "ok" | "bad", msg: string } | null;
  dismissToast?: () => void;
}) {
  const [tab, setTab] = useState<"details" | "images" | "options">("details");

  // DETAILS
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [price, setPrice] = useState<number | "">(initial?.price as number ?? "");
  const [description, setDescription] = useState(initial?.description || "");
  const [visible, setVisible] = useState<boolean>(Boolean(initial?.visible ?? (initial as any)?.isVisible ?? true));
  const [featured, setFeatured] = useState<boolean>(!!initial?.featured);
  const [featuredRank, setFeaturedRank] = useState<number | "">(((initial as any)?.featuredRank) ?? "");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const id = initial?.id;
const [inStock, setInStock] = useState<boolean>(
  Boolean((initial as any)?.inStock ?? (initial as any)?.isInStock ?? true)
);
const [excludeFromGlobalDiscount, setExcludeFromGlobalDiscount] = useState<boolean>(
  Boolean((initial as any)?.excludeFromGlobalDiscount ?? false)
);


  useEffect(() => {
    if (mode === "add" || !slug) setSlug(slugifyName(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function saveDetails(advanceToImages?: boolean) {
    if (mode === "edit" && id) {
      const wasFeatured = !!initial?.featured;
      if (featured !== wasFeatured) {
        try {
          await setProductFeatured(id, featured);
        } catch (e: any) {
          setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to update Featured" });
          return;
        }
      }
    }

    const dto: ProductDto = {
      id,
      name: name.trim(),
      slug: slug ? slug.trim() : undefined,
      description: description || undefined,
      price: Number(price) || 0,
      visible,
      featured,
      inStock,
      excludeFromGlobalDiscount,
      ...(featured ? { featuredRank: featuredRank === "" ? null : Number(featuredRank) } : { featuredRank: null }),
    } as any;


    try {
      if (mode === "add") {
        const created = await createProduct(dto);
        setToast({ kind: "ok", msg: "Product created" });
        onCreated(created);
        await onReload();
        if (advanceToImages) setTab("images");
      } else if (id) {
        await updateProduct(id, dto);
        setToast({ kind: "ok", msg: "Product updated" });
        await onReload();
        if (advanceToImages) setTab("images");
      }
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Save failed" });
    }
  }

  const canOpenImages = Boolean(initial?.id);
  const canOpenOptions = Boolean(initial?.id);

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-hd">
          <div className="title">
            {mode === "add" && !initial?.id ? "Add product" : `Edit product #${initial?.id}`}
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tabs">
          <button className={"tab" + (tab === "details" ? " active" : "")} onClick={() => setTab("details")}>Details</button>
          <button className={"tab" + (tab === "images" ? " active" : "")} disabled={!canOpenImages} onClick={() => setTab("images")}>Images</button>
          <button className={"tab" + (tab === "options" ? " active" : "")} disabled={!canOpenOptions} onClick={() => setTab("options")}>Options</button>
        </div>

        {tab === "details" && (
          <>
            <div className="modal-bd">
              <div className="form">
                <div className="grid2">
                  <label>
                    <span>Name</span>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="eg. Peach Rose Bouquet" />
                  </label>
                  <label>
                    <span>Price (₹)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </label>
                </div>

                <label>
                  <span>Description</span>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
                </label>

                <div className="switches">
                  <label className="check">
                    <Toggle checked={visible} onChange={setVisible} title={visible ? "Hide" : "Show"} />
                    <span>Visible</span>
                  </label>

                  <label className="check">
                    <StarButton on={featured} onClick={() => setFeatured(!featured)} title={featured ? "Unfeature" : "Feature"} />
                    <span>Featured</span>
                  </label>

                  <label className="check">
                    <Toggle checked={inStock} onChange={setInStock} title={inStock ? "In stock" : "Out of stock"} />
                    <span>In stock</span>
                  </label>
                        <label className="check">
                        <label className="check">
                          <Toggle
                            checked={!excludeFromGlobalDiscount} // checked means Discount ON
                            onChange={(val) => setExcludeFromGlobalDiscount(!val)} // ON => exclude=false
                            title={!excludeFromGlobalDiscount ? "Discount ON" : "Discount OFF"}
                          />
                          <span>Discount</span>
                        </label>

</label>





                  {featured && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>Rank</span>
                      <input
                        type="number"
                        min={0}
                        value={featuredRank === "" ? "" : Number(featuredRank)}
                        onChange={(e) => setFeaturedRank(e.target.value === "" ? "" : Number(e.target.value))}
                        style={{ width: 90 }}
                      />
                    </label>
                  )}
                </div>

                <button className="link" type="button" onClick={() => setShowAdvanced(v => !v)}>
                  {showAdvanced ? "Hide" : "Show"} advanced
                </button>

                {showAdvanced && (
                  <label>
                    <span>Slug</span>
                    <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated-from-name" />
                    <small className="muted">Used in SEO & URLs; keep lowercase with hyphens.</small>
                  </label>
                )}
              </div>
            </div>

            <div className="modal-ft">
              <button className="ghost" onClick={onClose}>Close</button>
              {mode === "add" && !initial?.id ? (
                <button className="btn" disabled={!name.trim()} onClick={() => saveDetails(true)}>
                  Create & go to Images
                </button>
              ) : (
                <>
                  <button className="ghost" onClick={() => saveDetails(false)}>Save details</button>
                  <button className="btn" onClick={() => saveDetails(true)}>Save & go to Images</button>
                </>
              )}
            </div>
          </>
        )}

        {tab === "images" && !!initial?.id && (
          <ImagesTab
            productId={initial.id}
            onDone={onClose}
            onChanged={onReload}
            onNext={() => setTab("options")}
            setToast={setToast}
          />
        )}

        {tab === "options" && !!initial?.id && (
          <OptionsTab productId={initial.id} setToast={setToast} onDone={onClose} />
        )}

        {toast && (
          <div className={"toast in-modal " + toast.kind} onAnimationEnd={dismissToast}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Images Tab ---------------------- */
type ImagesTabProps = {
  productId: number;
  onDone: () => void;
  onChanged: () => Promise<void>;
  onNext?: () => void;
  setToast: React.Dispatch<React.SetStateAction<{ kind: "ok" | "bad"; msg: string } | null>>;
};

const BRAND_LOGO_URL = "/BB_logo.png";

export function ImagesTab({ productId, onDone, onChanged, onNext, setToast }: ImagesTabProps) {
  const [items, setItems] = React.useState<ProductImage[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const [queue, setQueue] = React.useState<
    { id: string; name: string; previewUrl: string; error?: string; pct?: number }[]
  >([]);


  const MAX = 10;

  React.useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const imgs = await listProductImages(productId);
        if (!live) return;
        setItems(imgs);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      queue.forEach((q) => { if (q.previewUrl.startsWith("blob:")) URL.revokeObjectURL(q.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function refresh() {
    const imgs = await listProductImages(productId);
    setItems(imgs);
    await onChanged();
  }





  async function onUploadSelected(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;

    const all = Array.from(filesList);
    const existing = items?.length || 0;
    const alreadyQueued = queue.length;

    // Enforce total max images (existing + queued + new)
    const remainingSlots = MAX - (existing + alreadyQueued);
    if (remainingSlots <= 0) {
      setToast({ kind: "bad", msg: `You already have the maximum of ${MAX} images.` });
      return;
    }

    // Only consider up to remainingSlots files
    const candidateFiles = all.slice(0, remainingSlots);

    const valid: File[] = [];
    const errors: string[] = [];

    for (const f of candidateFiles) {
      const err = validateImageFile(f, {
        label: "product image",
        // you can customize allowedExt / blockedExt / maxMb here if needed
      });

      if (err) {
        errors.push(`“${f.name}”: ${err}`);
      } else {
        valid.push(f);
      }
    }

    if (errors.length > 0) {
      // Show just the first error to keep UI clean
      setToast({ kind: "bad", msg: errors[0] });
    }

    if (valid.length === 0) {
      return; // nothing to upload
    }

    // Simple optimistic previews
    const optimistic = valid.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      pct: 1,
    }));

    setQueue((q) => [...q, ...optimistic]);
    setBusy(true);

    try {
      let sortBase = items?.length || 0;

      for (let i = 0; i < valid.length; i++) {
        const f = valid[i];
        const tempId = optimistic[i].id;

        try {
          await uploadProductImage(
            productId,
            f,
            undefined,      // alt text (optional)
            sortBase++,     // sort order
            (pct) => {
              setQueue((q) =>
                q.map((x) =>
                  x.id === tempId ? { ...x, pct } : x
                )
              );
            }
          );

          // Remove from queue after success + cleanup blob URL
          setQueue((q) => {
            const found = q.find((x) => x.id === tempId);
            if (found?.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(found.previewUrl);
            }
            return q.filter((x) => x.id !== tempId);
          });
        } catch (e: any) {
          const msg =
            e?.response?.data?.message ||
            e?.message ||
            "Upload failed";

          setQueue((q) =>
            q.map((x) =>
              x.id === tempId ? { ...x, error: msg } : x
            )
          );
        }
      }

      await refresh();
      setToast({ kind: "ok", msg: `Uploaded ${valid.length} image(s)` });
    } finally {
      setBusy(false);
    }
  }



  function moveUp(idx: number) { if (!items || idx <= 0) return; reorder(idx, idx - 1); }
  function moveDown(idx: number) { if (!items || idx >= items.length - 1) return; reorder(idx, idx + 1); }

  async function reorder(a: number, b: number) {
    if (!items) return;
    const next = items.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setItems(next.map((it, i) => ({ ...it, sortOrder: i })));
    try { await Promise.all(next.map((it, i) => updateImageMeta(productId, it.id, { sortOrder: i }))); }
    catch { setToast({ kind: "bad", msg: "Reorder failed" }); }
  }

  async function markPrimary(img: ProductImage) {
    try { await setPrimaryImage(productId, img.id); await refresh(); setToast({ kind: "ok", msg: "Primary image set" }); }
    catch { setToast({ kind: "bad", msg: "Could not set primary" }); }
  }

  async function remove(img: ProductImage) {
    if (!confirm("Remove this image?")) return;
    try { await deleteProductImage(productId, img.id); await refresh(); setToast({ kind: "ok", msg: "Image removed" }); }
    catch { setToast({ kind: "bad", msg: "Delete failed" }); }
  }

  const count = (items?.length || 0) + queue.length;

  return (
    <>
      <div className="modal-bd">
        <div className="imgbar">
          <div>
            <div className="count">{count}/{MAX} images</div>
            <div className="hint">
              Any image up to ~10MB (JPG, PNG, WebP). Server applies watermark.
            </div>

          </div>
          <label className={"upload" + (count >= MAX ? " disabled" : "")}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || count >= MAX}
              onChange={(e) => onUploadSelected(e.target.files)}
            />

            Upload
          </label>
        </div>

        {loading ? (
          <div className="loading"><div className="bar" /></div>
        ) : (
          <div className="gallery">
            {queue.map((q) => (
              <div key={q.id} className="tile" aria-busy={true}>
                <div className="thumb">
                  {q.previewUrl ? <img src={q.previewUrl} alt={q.name} /> : <span className="muted">Preparing…</span>}
                </div>
                <div className="row">
                  <button className="ghost small" disabled>↑</button>
                  <button className="ghost small" disabled>↓</button>
                  <button className="ghost small" disabled title="Make primary">★</button>
                  <button
                    className="ghost small bad"
                    onClick={() => setQueue(qq => {
                      const f = qq.find(x => x.id === q.id);
                      if (f?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(f.previewUrl);
                      return qq.filter(x => x.id !== q.id);
                    })}
                  >Cancel</button>
                </div>
                <div className="meta">
                  <div className="progress"><div style={{ width: `${Math.min(q.pct || 1, 100)}%` }} /></div>
                  <span className="muted">{q.error ? "Failed" : "Uploading…"}</span>
                </div>
              </div>
            ))}

            {(items || []).map((img, idx) => (
              <div key={(img as any).id} className="tile">
                <div className="thumb">
                  {(() => {
                    const src = (img as any).watermarkVariantUrl || (img as any).url || "";
                    return src ? <img src={src} alt={(img as any).altText || ""} /> : <span className="muted">No image</span>;
                  })()}
                </div>
                <div className="row">
                  <button className="ghost small" onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                  <button className="ghost small" onClick={() => moveDown(idx)} disabled={idx === (items!.length - 1)}>↓</button>
                  <button className="ghost small" onClick={() => markPrimary(img)} title="Make primary">★</button>
                  <button className="ghost small bad" onClick={() => remove(img)}>Delete</button>
                </div>
                <div className="meta">
                  <span className="muted">#{(img as any).id}</span>
                  {idx === 0 && <span className="pill ok" style={{ marginLeft: 6 }}>Primary</span>}
                </div>
              </div>
            ))}

            {queue.length === 0 && (items || []).length === 0 && (
              <div className="empty">No images yet. Upload up to 10.</div>
            )}
          </div>
        )}
      </div>

      <div className="modal-ft">
        <button className="ghost" onClick={onDone}>Done</button>
        <button
          className="btn"
          onClick={async () => {
            await onChanged();
            onNext?.();
          }}
        >
          Save & go to Options
        </button>
      </div>
    </>
  );
}

/* ---------------------- Options Tab (NO Active toggles, only Visible) ---------------------- */
function OptionsTab({
  productId,
  setToast,
  onDone,
}: {
  productId: number;
  setToast: React.Dispatch<React.SetStateAction<{ kind: "ok" | "bad"; msg: string } | null>>;
  onDone?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<import("../../api/adminCatalog").ProductOption[] | null>(null);
  const [valuesMap, setValuesMap] = useState<Record<number, import("../../api/adminCatalog").ProductOptionValue[]>>({});
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"select" | "multiselect" | "text">("select");
  const [newRequired, setNewRequired] = useState(false);
  const [newMax, setNewMax] = useState<number | undefined>(undefined);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const options = await listOptions(productId);
        if (!live) return;
        setOpts(options);

        const maps: Record<number, any[]> = {};
        for (const o of options) {
          maps[o.id] = await listOptionValues(o.id);
        }
        if (!live) return;
        setValuesMap(maps);
      } catch (e: any) {
        setToast({ kind: "bad", msg: e?.response?.data?.message || "Failed to load options" });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [productId]);

  async function refreshOne(optionId: number) {
    try {
      const vals = await listOptionValues(optionId);
      setValuesMap((m) => ({ ...m, [optionId]: vals }));
    } catch { }
  }

  async function onCreateOption() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createOption(productId, {
        name: newName.trim(),
        inputType: newType,
        required: newRequired,
        maxSelect: newType === "multiselect" ? (newMax ?? 2) : undefined,
        sortOrder: (opts?.length || 0),
        visible: true,
      });
      setOpts((o) => ([...(o || []), created]));
      setValuesMap((m) => ({ ...m, [created.id]: [] }));
      setNewName("");
      setNewType("select");
      setNewRequired(false);
      setNewMax(undefined);
      setToast({ kind: "ok", msg: "Option created" });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Create failed" });
    } finally {
      setCreating(false);
    }
  }

  async function onPatchOption(o: any, patch: Partial<typeof o>) {
    try {
      const updated = await updateOption(o.id, patch as any);
      setOpts((list) => (list || []).map((x) => (x.id === o.id ? updated : x)));
      setToast({ kind: "ok", msg: "Option updated" });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Update failed" });
    }
  }

  async function onDeleteOption(o: any) {
    if (!confirm(`Delete option “${o.name}”?`)) return;
    try {
      await deleteOption(o.id);
      setOpts((list) => (list || []).filter((x) => x.id !== o.id));
      setToast({ kind: "ok", msg: "Option deleted" });
    } catch {
      setToast({ kind: "bad", msg: "Delete failed" });
    }
  }

  async function addValue(optionId: number, valueLabel: string, priceDelta?: number | null, valueCode?: string | null) {
    try {
      const created = await createOptionValue(optionId, {
        valueLabel,
        priceDelta: priceDelta ?? null,
        valueCode: valueCode ?? null,
        sortOrder: (valuesMap[optionId]?.length || 0),
        visible: true,
      });
      await refreshOne(optionId);
      setToast({ kind: "ok", msg: "Value added" });
      return created;
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || "Add failed" });
    }
  }

  async function patchValue(optionId: number, valueId: number, patch: any) {
    try {
      await updateOptionValue(optionId, valueId, patch);
      await refreshOne(optionId);
      setToast({ kind: "ok", msg: "Value updated" });
    } catch {
      setToast({ kind: "bad", msg: "Update failed" });
    }
  }

  async function removeValue(optionId: number, valueId: number) {
    if (!confirm("Delete this value?")) return;
    try {
      await deleteOptionValue(optionId, valueId);
      await refreshOne(optionId);
      setToast({ kind: "ok", msg: "Value deleted" });
    } catch {
      setToast({ kind: "bad", msg: "Delete failed" });
    }
  }

  return (
    <>
      <div className="modal-bd options-bd">
        {/* Create new option */}
        <div className="optwrap">
          <div className="row">
            <strong>Create option</strong>
          </div>
          <div className="split">
            <label>
              <span>Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="eg. Length / Color / Clip Type" />
            </label>
            <label>
              <span>Input type</span>
              <select value={newType} onChange={(e) => setNewType(e.target.value as any)}>
                <option value="select">Select (single)</option>
                <option value="multiselect">Multi-select</option>
                <option value="text">Free text</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              <span>Required</span>
            </label>
            {newType === "multiselect" && (
              <label>
                <span>Max select</span>
                <input
                  type="number"
                  min={1}
                  value={newMax ?? 2}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                />
              </label>
            )}
            <div style={{ alignSelf: "end" }}>
              <button className="btn" disabled={!newName.trim() || creating} onClick={onCreateOption}>
                {creating ? "Creating…" : "Add option"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing options */}
        {loading ? (
          <div className="loading"><div className="bar" /></div>
        ) : (
          <div className="stack">
            {(opts || []).map((o) => (
              <div key={o.id} className="optcard">
                <div className="row">
                  <div>
                    <div className="title">
                      {o.name}{" "}
                      <span className="tag">{o.inputType}</span>
                      {o.required && <span className="tag gold">required</span>}
                    </div>
                    <div className="micro">Sort: {o.sortOrder ?? 0} · Max: {o.maxSelect ?? (o.inputType === "multiselect" ? 2 : 1)}</div>
                  </div>
                  {/* Only Visible toggle (Active removed) */}
                  <div className="row-actions">
                    <div title={(o as any)?.visible === false ? "Show option" : "Hide option"}>
                      <small style={{ marginRight: 6 }}>Visible</small>
                      <Toggle
                        checked={(o as any)?.visible !== false}
                        onChange={(val) => onPatchOption(o, { visible: val })}
                        title={(o as any)?.visible === false ? "Show" : "Hide"}
                      />
                    </div>
                    <button className="ghost bad" onClick={() => onDeleteOption(o)}>Delete</button>
                  </div>
                </div>

                {/* Quick edit of name/flags */}
                <div className="inset">
                  <div className="split">
                    <label>
                      <span>Rename</span>
                      <input defaultValue={o.name} onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val && val !== o.name) onPatchOption(o, { name: val });
                      }} />
                    </label>

                    {o.inputType === "multiselect" && (
                      <label>
                        <span>Max select</span>
                        <input
                          type="number"
                          min={1}
                          defaultValue={o.maxSelect ?? 2}
                          onBlur={(e) => onPatchOption(o, { maxSelect: Number(e.target.value) || 1 })}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Values table */}
                <div className="values">
                  <div className="row" style={{ marginBottom: 8 }}>
                    <strong>Values</strong>
                    <span className="micro">({valuesMap[o.id]?.length || 0})</span>
                  </div>

                  <div className="table-like">
                    <div className="thead">
                      <div>Label</div>
                      <div>Code</div>
                      <div>Price Δ</div>
                      <div>Sort</div>
                      <div>Visible</div>
                      <div></div>
                    </div>

                    {(valuesMap[o.id] || []).map((v) => (
                      <div key={v.id} className="trow">
                        <div>
                          <input defaultValue={v.valueLabel} onBlur={(e) => patchValue(o.id, v.id, { valueLabel: e.target.value })} />
                        </div>
                        <div>
                          <input defaultValue={v.valueCode ?? ""} onBlur={(e) => patchValue(o.id, v.id, { valueCode: e.target.value || null })} />
                        </div>
                        <div>
                          <input
                            type="number" inputMode="decimal"
                            defaultValue={v.priceDelta ?? ""}
                            onBlur={(e) => patchValue(o.id, v.id, { priceDelta: e.target.value === "" ? null : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            defaultValue={v.sortOrder ?? 0}
                            onBlur={(e) => patchValue(o.id, v.id, { sortOrder: Number(e.target.value) || 0 })}
                          />
                        </div>
                        {/* Only Visible toggle (Active removed) */}
                        <div>
                          <Toggle
                            checked={(v as any)?.visible !== false}
                            onChange={(val) => patchValue(o.id, v.id, { visible: val })}
                            title={(v as any)?.visible === false ? "Show value" : "Hide value"}
                          />
                        </div>
                        <div className="right">
                          <button className="ghost bad" onClick={() => removeValue(o.id, v.id)}>Delete</button>
                        </div>
                      </div>
                    ))}

                    {/* Add new value inline */}
                    <div className="trow">
                      <div><input placeholder="New value label" id={`new-lbl-${o.id}`} /></div>
                      <div><input placeholder="Code (optional)" id={`new-code-${o.id}`} /></div>
                      <div><input type="number" inputMode="decimal" placeholder="0.00" id={`new-price-${o.id}`} /></div>
                      <div className="muted">auto</div>
                      <div className="muted">visible</div>
                      <div className="right">
                        <button
                          className="btn"
                          onClick={() => {
                            const lbl = (document.getElementById(`new-lbl-${o.id}`) as HTMLInputElement)?.value.trim();
                            if (!lbl) return;
                            const code = (document.getElementById(`new-code-${o.id}`) as HTMLInputElement)?.value.trim() || null;
                            const priceRaw = (document.getElementById(`new-price-${o.id}`) as HTMLInputElement)?.value;
                            const delta = priceRaw === "" ? null : Number(priceRaw);
                            addValue(o.id, lbl, delta, code);
                            (document.getElementById(`new-lbl-${o.id}`) as HTMLInputElement).value = "";
                            (document.getElementById(`new-code-${o.id}`) as HTMLInputElement).value = "";
                            (document.getElementById(`new-price-${o.id}`) as HTMLInputElement).value = "";
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ))}
            {(opts || []).length === 0 && <div className="empty">No options created yet.</div>}
          </div>
        )}
      </div>

      <div className="modal-ft">
        <button className="ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top</button>
        <button
          className="btn"
          onClick={() => {
            setToast({ kind: "ok", msg: "Options saved" });
            onDone?.();
          }}
        >
          Done
        </button>
      </div>
    </>
  );
}

/* ---------- Skeleton (list) ---------- */
function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="sk-wrap">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sk-row">
          <div className="sk sk-id" />
          <div className="sk sk-wide" />
          <div className="sk sk-mid" />
          <div className="sk sk-price" />
          <div className="sk sk-flags" />
          <div className="sk sk-actions" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════ PREMIUM PRODUCTS PAGE STYLES ═══════════════════════════ */
const css = `
:root { color-scheme: light; }

/* ═══════════════════════════ PAGE WRAPPER ═══════════════════════════ */
.prod-wrap {
  padding: 24px;
  color: ${PRIMARY};
  max-width: 1500px;
  margin: 0 auto;
  min-height: 100vh;
}

/* ═══════════════════════════ HEADER BAR ═══════════════════════════ */
.bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  padding: 20px 24px;
  border: 1px solid ${INK};
  border-radius: 20px;
  background: linear-gradient(135deg, #fff 0%, rgba(246,195,32,0.04) 100%);
  box-shadow: 0 16px 48px rgba(0,0,0,0.08);
  position: relative;
}

.bar::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 3px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD}, ${MINT});
  border-radius: 3px 3px 0 0;
}

.bar h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, ${PRIMARY} 0%, #6b7058 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.bar p {
  margin: 6px 0 0;
  font-size: 14px;
  opacity: 0.7;
}

.bar-left {
  display: flex;
  flex-direction: column;
}

.bar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* ═══════════════════════════ SEARCH INPUT ═══════════════════════════ */
.search {
  position: relative;
  display: flex;
  align-items: center;
  width: 360px;
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

/* ═══════════════════════════ BUTTONS ═══════════════════════════ */
.btn {
  border: none;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  box-shadow: 0 8px 24px rgba(240,93,139,0.3);
  height: 44px;
  padding: 0 20px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(240,93,139,0.4);
}

.ghost {
  height: 38px;
  padding: 0 14px;
  border: 1px solid ${INK};
  background: #fff;
  border-radius: 12px;
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
  color: #c62828;
  border-color: rgba(198,40,40,0.25);
}

.ghost.bad:hover {
  background: rgba(198,40,40,0.06);
}

.ghost.small {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.ghost.sm {
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
}

.link {
  background: transparent;
  border: none;
  color: ${ACCENT};
  text-decoration: none;
  font-weight: 700;
  padding: 4px 0;
  cursor: pointer;
  width: max-content;
}

.link:hover {
  text-decoration: underline;
}

/* ═══════════════════════════ ALERTS ═══════════════════════════ */
.alert.bad {
  margin: 12px 0;
  padding: 14px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
  border: 1px solid rgba(198,40,40,0.2);
  color: #b71c1c;
  font-weight: 500;
}

/* ═══════════════════════════ CARD / TABLE CONTAINER ═══════════════════════════ */
.card {
  border: 1px solid ${INK};
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0,0,0,0.08);
  overflow: hidden;
  margin-bottom: 16px;
}

/* ═══════════════════════════ TABLE ═══════════════════════════ */
.grid {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.grid thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 16px 18px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
  border-bottom: 1px solid ${INK};
}

.grid tbody td {
  padding: 16px 18px;
  border-top: 1px solid ${INK};
  vertical-align: middle;
  font-size: 14px;
}

.grid tbody tr {
  transition: background 0.15s ease;
}

.grid tbody tr:hover {
  background: linear-gradient(90deg, rgba(246,195,32,0.04) 0%, rgba(255,255,255,0) 100%);
}

.strong {
  font-weight: 700;
  color: ${PRIMARY};
}

.muted {
  opacity: 0.6;
  font-size: 13px;
}

/* ═══════════════════════════ STATUS PILLS ═══════════════════════════ */
.pill {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: 13px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-right: 6px;
}

.pill.ok {
  background: linear-gradient(135deg, rgba(67,233,123,0.15) 0%, rgba(56,249,215,0.15) 100%);
  color: #065f46;
}

.pill.off {
  background: rgba(0,0,0,0.06);
  color: #666;
}

.pill.gold {
  background: linear-gradient(135deg, rgba(246,195,32,0.25) 0%, rgba(255,215,0,0.2) 100%);
  color: #92400e;
}

/* ═══════════════════════════ STAR BUTTON ═══════════════════════════ */
.star-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  min-width: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid ${INK};
  background: #fff;
  cursor: pointer;
  font-weight: 900;
  transition: all 0.15s ease;
}

.star-btn:hover {
  border-color: rgba(246,195,32,0.4);
  background: rgba(246,195,32,0.04);
}

.star-btn .sr {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.star-btn .star-shape {
  font-size: 18px;
  line-height: 1;
  color: #ccc;
  transition: transform 0.15s ease, color 0.15s ease;
}

.star-btn:hover .star-shape {
  transform: scale(1.1);
}

.star-btn.on {
  border-color: rgba(246,195,32,0.6);
  background: linear-gradient(135deg, rgba(246,195,32,0.12) 0%, rgba(255,215,0,0.08) 100%);
}

.star-btn.on .star-shape {
  color: #d4a500;
}

.star-btn .spin {
  width: 14px;
  height: 14px;
  margin-left: 6px;
  border-radius: 50%;
  border: 2px solid rgba(0,0,0,0.08);
  border-top-color: ${GOLD};
  animation: rot 0.7s linear infinite;
}

.star-btn.saving {
  opacity: 0.6;
  cursor: wait;
}

@keyframes rot {
  to { transform: rotate(360deg); }
}

/* ═══════════════════════════ TOGGLE SWITCH ═══════════════════════════ */
.switch {
  position: relative;
  width: 48px;
  height: 26px;
  border-radius: 13px;
  border: 1px solid ${INK};
  background: #f0f0f0;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s ease;
}

.switch .knob {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #aaa;
  transition: transform 0.2s ease, background 0.2s ease;
}

.switch.on {
  background: linear-gradient(135deg, rgba(115,194,167,0.2) 0%, rgba(115,194,167,0.1) 100%);
  border-color: rgba(115,194,167,0.4);
}

.switch.on .knob {
  transform: translateX(22px);
  background: ${MINT};
}

/* ═══════════════════════════ ACTIONS COLUMN ═══════════════════════════ */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.actions .ghost {
  height: 34px;
  padding: 0 12px;
}

/* ═══════════════════════════ PAGINATION ═══════════════════════════ */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-top: 1px solid ${INK};
  background: #fafafa;
}

.pgbtns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager select {
  height: 36px;
  border: 1px solid ${INK};
  border-radius: 10px;
  padding: 0 12px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
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
  width: 920px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  border: 1px solid ${INK};
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 40px 120px rgba(0,0,0,0.3);
  animation: modalIn 0.3s ease-out;
  overflow: hidden;
}

@keyframes modalIn {
  from { transform: scale(0.92) translateY(30px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

/* ═══════════════════════════ MODAL HEADER ═══════════════════════════ */
.modal-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(135deg, rgba(246,195,32,0.1) 0%, rgba(255,255,255,0.98) 100%);
  position: relative;
}

.modal-hd::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 2px;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD}, ${MINT});
  border-radius: 2px 2px 0 0;
}

.modal-hd .title {
  font-weight: 800;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-hd .title::before {
  content: "🌸";
  font-size: 22px;
}

.modal-hd .x {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border: none;
  border-radius: 12px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: #888;
  transition: all 0.2s ease;
}

.modal-hd .x:hover {
  background: ${ACCENT};
  color: #fff;
  transform: rotate(90deg);
}

/* ═══════════════════════════ MODAL BODY ═══════════════════════════ */
.modal-bd {
  padding: 24px;
  overflow: auto;
  flex: 1 1 auto;
  background: linear-gradient(180deg, #fafafa 0%, #fff 50px);
}

/* ═══════════════════════════ MODAL FOOTER ═══════════════════════════ */
.modal-ft {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid ${INK};
  position: sticky;
  bottom: 0;
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
}

.modal-ft .ghost {
  height: 42px;
  padding: 0 18px;
  border-radius: 14px;
}

.modal-ft .btn {
  height: 42px;
  padding: 0 22px;
}

/* ═══════════════════════════ TABS ═══════════════════════════ */
.tabs {
  display: flex;
  gap: 6px;
  padding: 16px 24px;
  border-bottom: 1px solid ${INK};
  background: linear-gradient(180deg, #fafafa 0%, #fff 100%);
}

.tab {
  height: 40px;
  padding: 0 20px;
  border-radius: 20px;
  border: 1px solid ${INK};
  background: #fff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab::before {
  font-size: 14px;
}

.tab:first-child::before { content: "📝"; }
.tab:nth-child(2)::before { content: "🖼️"; }
.tab:nth-child(3)::before { content: "⚙️"; }

.tab:hover {
  background: #f5f5f5;
  border-color: rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.tab.active {
  background: linear-gradient(135deg, ${GOLD} 0%, #ffe066 100%);
  border-color: transparent;
  color: #5d4800;
  box-shadow: 0 4px 16px rgba(246,195,32,0.3);
}

.tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.tab:disabled:hover {
  background: #fff;
  border-color: ${INK};
}

/* ═══════════════════════════ FORM ═══════════════════════════ */
.form {
  display: grid;
  gap: 20px;
}

.form .grid2 {
  display: grid;
  grid-template-columns: 1.5fr 0.5fr;
  gap: 20px;
}

.form label {
  display: grid;
  gap: 10px;
}

.form label > span {
  font-size: 12px;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form label > span::before {
  content: "";
  width: 3px;
  height: 12px;
  background: linear-gradient(180deg, ${ACCENT}, ${GOLD});
  border-radius: 2px;
}

.form input,
.form textarea {
  height: 46px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid ${INK};
  outline: none;
  resize: vertical;
  font-size: 15px;
  transition: all 0.2s ease;
  background: #fff;
}

.form input::placeholder,
.form textarea::placeholder {
  color: #aaa;
}

.form input:hover,
.form textarea:hover {
  border-color: rgba(0,0,0,0.15);
}

.form input:focus,
.form textarea:focus {
  border-color: ${ACCENT};
  box-shadow: 0 0 0 4px rgba(240,93,139,0.1);
  background: #fff;
}

.form textarea {
  height: auto;
  min-height: 120px;
  line-height: 1.6;
}

/* ═══════════════════════════ SWITCHES SECTION ═══════════════════════════ */
.switches {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(246,195,32,0.06) 0%, rgba(115,194,167,0.04) 100%);
  border-radius: 16px;
  border: 1px dashed ${INK};
}

.form .check {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form .check > span {
  font-weight: 600;
  font-size: 14px;
}

.form small.muted {
  opacity: 0.55;
  font-size: 12px;
  line-height: 1.4;
}

/* ═══════════════════════════ ADVANCED SECTION ═══════════════════════════ */
.link {
  background: transparent;
  border: none;
  color: ${ACCENT};
  font-weight: 700;
  font-size: 13px;
  padding: 8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.link::before {
  content: "⚙️";
  font-size: 14px;
}

.link:hover {
  color: #d4466e;
  text-decoration: underline;
}

/* ═══════════════════════════ IMAGES TAB ═══════════════════════════ */
.imgbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px dashed ${INK};
  border-radius: 14px;
  background: #fafafa;
}

.imgbar .count {
  font-weight: 800;
  font-size: 16px;
}

.imgbar .hint {
  font-size: 12px;
  opacity: 0.6;
}

.upload {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(240,93,139,0.3);
  transition: all 0.2s ease;
}

.upload:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(240,93,139,0.35);
}

.upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.tile {
  border: 1px solid ${INK};
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  transition: all 0.2s ease;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.1);
}

.thumb {
  aspect-ratio: 1 / 1;
  background: #f5f5f5;
  line-height: 0;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tile .row {
  display: flex;
  gap: 6px;
  padding: 10px;
  justify-content: center;
  background: #fafafa;
}

.tile .meta {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid ${INK};
}

.progress {
  height: 6px;
  border-radius: 3px;
  background: #e0e0e0;
  overflow: hidden;
}

.progress > div {
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, ${ACCENT}, ${GOLD});
  transition: width 0.3s ease;
}

.empty {
  text-align: center;
  padding: 32px;
  opacity: 0.6;
  font-size: 14px;
}

.loading {
  padding: 32px;
  text-align: center;
}

.loading .bar {
  width: 60px;
  height: 4px;
  margin: 0 auto;
  border-radius: 2px;
  background: linear-gradient(90deg, #e0e0e0, ${ACCENT}, #e0e0e0);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ═══════════════════════════ OPTIONS TAB ═══════════════════════════ */
.options-bd {
  max-height: calc(80vh - 160px);
}

.optwrap {
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 16px;
  background: #fff;
  margin-bottom: 16px;
}

.optcard {
  border: 1px solid ${INK};
  border-radius: 14px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0,0,0,0.04);
}

.stack {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.inset {
  border-top: 1px dashed ${INK};
  margin-top: 12px;
  padding-top: 14px;
}

.title {
  font-weight: 800;
}

.micro {
  font-size: 12px;
  opacity: 0.6;
}

.tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 8px;
  background: rgba(0,0,0,0.05);
}

.tag.off {
  background: rgba(0,0,0,0.08);
}

.tag.gold {
  background: rgba(246,195,32,0.2);
}

.values {
  margin-top: 12px;
}

.table-like {
  display: grid;
  gap: 8px;
  overflow-x: auto;
}

.table-like .thead,
.table-like .trow {
  display: grid;
  grid-template-columns: 1.4fr 0.9fr 0.7fr 0.5fr 0.7fr 0.7fr;
  gap: 10px;
  align-items: center;
}

.table-like .thead {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #888;
  padding: 8px 0;
}

.table-like .trow input {
  height: 36px;
  border: 1px solid ${INK};
  border-radius: 10px;
  padding: 0 10px;
  min-width: 0;
  font-size: 13px;
}

.table-like .right {
  display: flex;
  justify-content: flex-end;
}

/* ═══════════════════════════ SKELETON ═══════════════════════════ */
.sk-wrap {
  padding: 16px;
}

.sk-row {
  display: grid;
  grid-template-columns: 70px 1.3fr 1fr 120px 200px 340px;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
}

.sk {
  height: 20px;
  border-radius: 10px;
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size: 200% 100%;
  animation: wave 1.2s linear infinite;
}

.sk-id { width: 48px; }
.sk-wide { height: 22px; }
.sk-mid { width: 60%; }
.sk-price { width: 80px; margin-left: auto; }
.sk-flags { width: 180px; }
.sk-actions { height: 32px; width: 200px; margin-left: auto; }
.flag-actions{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}
.flag{
  display:flex;
  align-items:center;
  gap:8px;
  padding:6px 8px;
  border:1px dashed rgba(0,0,0,.10);
  border-radius:12px;
  background:#fff;
}
.flag small{
  font-size:11px;
  font-weight:800;
  opacity:.65;
  text-transform:uppercase;
  letter-spacing:.4px;
}

@keyframes wave {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ═══════════════════════════ TOAST ═══════════════════════════ */
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  padding: 14px 20px;
  border-radius: 14px;
  color: #fff;
  font-weight: 600;
  animation: toastSlide 2.8s ease forwards;
  z-index: 200;
}

.toast.ok {
  background: linear-gradient(135deg, ${ACCENT} 0%, #ff8ba7 100%);
  box-shadow: 0 10px 32px rgba(240,93,139,0.4);
}

.toast.bad {
  background: linear-gradient(135deg, #c62828 0%, #e53935 100%);
  box-shadow: 0 10px 32px rgba(198,40,40,0.35);
}

.toast.in-modal {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 101;
}
.pill.off { background: rgba(0,0,0,0.06); color:#666; }
.pill.off {
  background: rgba(198,40,40,0.10);
  color: #b71c1c;
}
.switch.pink.on{
  background: linear-gradient(135deg, rgba(240,93,139,0.18) 0%, rgba(240,93,139,0.08) 100%);
  border-color: rgba(240,93,139,0.35);
}
.switch.pink.on .knob{ background: #F05D8B; }

.switch.mint.on{
  background: linear-gradient(135deg, rgba(115,194,167,0.2) 0%, rgba(115,194,167,0.1) 100%);
  border-color: rgba(115,194,167,0.4);
}
.switch.mint.on .knob{ background: #73C2A7; }

@keyframes toastSlide {
  0% { transform: translateY(24px); opacity: 0; }
  10% { transform: translateY(0); opacity: 1; }
  85% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(12px); opacity: 0; }
}

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width: 1024px) {
  .prod-wrap {
    padding: 16px;
  }

  .bar {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .bar-right {
    flex-wrap: wrap;
  }

  .search {
    width: 100%;
    max-width: 400px;
  }

  .grid thead th,
  .grid tbody td {
    padding: 12px 14px;
  }

  .form .grid2 {
    grid-template-columns: 1fr;
  }
}
/* ═══════════════════════════ DISCOUNT BUTTON ═══════════════════════════ */
.pct-btn{
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  min-width: 70px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid rgba(0,0,0,.08);
  background: #fff;
  cursor: pointer;
  font-weight: 800;
  transition: all .15s ease;
}
.pct-btn:hover{
  border-color: rgba(240,93,139,0.35);
  background: rgba(240,93,139,0.04);
}
.pct-btn .pct-shape{
  font-size: 16px;
  line-height: 1;
  color: #bbb;
  transition: transform .15s ease, color .15s ease;
}
.pct-btn:hover .pct-shape{ transform: scale(1.08); }
.pct-btn {
  font-size: 12px;
  opacity: .8;
  min-width: 42px;
    gap: 0;
    justify-content: center;
}
.pct-btn.on{
  border-color: rgba(240,93,139,0.45);
  background: linear-gradient(135deg, rgba(240,93,139,0.10) 0%, rgba(255,139,167,0.06) 100%);
}
.pct-btn.on .pct-shape{ color: #F05D8B; }
.pct-btn.saving{ opacity: .6; cursor: wait; }

/* extra pill */
.pill.pink{
  background: linear-gradient(135deg, rgba(240,93,139,0.16) 0%, rgba(240,93,139,0.08) 100%);
  color: #8a2345;
}

@media (max-width: 768px) {
  .modal {
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .gallery {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal,
  .toast,
  .btn,
  .tile {
    animation: none !important;
    transition: none !important;
  }
}
`;
