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
const ACCENT  = "#F05D8B";
const GOLD    = "#F6C320";
const MINT    = "#73C2A7";
const INK     = "rgba(0,0,0,.08)";

/* ---------- Tiny UI bits ---------- */
function Toggle({
  checked,
  onChange,
  title,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={"switch" + (checked ? " on" : "")}
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
function fmtRange(from:number, to:number, total:number){
  if (total===0) return "0 results";
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

export default function ProductsPage(){
  const [page, setPage]   = useState(0);
  const [size, setSize]   = useState(12);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string|null>(null);
  const [data, setData]       = useState<Page<Product> | null>(null);
  const [q, setQ]             = useState("");

  const [modal, setModal] = useState<null | { mode:"add" | "edit"; data?: Product }>(null);
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState<null | { kind:"ok"|"bad", msg:string }>(null);
  const dismissToast = () => setToast(null);

  // Separate per-row locks
  const [busyFeature, setBusyFeature] = useState<Record<number, boolean>>({});
  const [busyVisible, setBusyVisible] = useState<Record<number, boolean>>({});
  const isLocked = (id: number) => !!busyFeature[id] || !!busyVisible[id];

  useEffect(()=>{ let alive=true;
    (async()=>{
      setLoading(true); setErr(null);
      try{
        const pg = await listProducts(page, size);
        if (!alive) return;
        setData(pg);
      }catch(e:any){
        setErr(e?.response?.data?.message || "Failed to load products.");
      }finally{
        if (alive) setLoading(false);
      }
    })();
    return ()=>{ alive=false; };
  }, [page, size]);

  const filtered = useMemo(()=>{
    const items = (data?.content || []);
    const qq = q.toLowerCase().trim();
    return items.filter(p =>
      !qq ||
      p.name.toLowerCase().includes(qq) ||
      (p.slug||"").toLowerCase().includes(qq)
    );
  }, [data, q]);

  const totalPages = data?.totalPages ?? 0;

  async function reload() {
    const pg = await listProducts(page, size);
    setData(pg);
  }

  async function onDelete(id:number){
    if (!confirm("Delete this product? This is a soft delete (marks as inactive).")) return;
    try{
      await deleteProduct(id);
      setToast({kind:"ok", msg:"Product deleted"});
      await reload();
    }catch(e:any){
      setToast({kind:"bad", msg: e?.response?.data?.message || "Delete failed"});
    }
  }

  // Toggle VISIBLE — use updateProduct(id, { visible: ... })
  async function onToggleVisible(p: Product, nextVisible: boolean){
    if (isLocked(p.id)) return;
    setBusyVisible(m => ({ ...m, [p.id]: true }));
    // optimistic
    const prevVisible = Boolean((p as any).visible ?? (p as any).isVisible);
    setData(d => d ? ({...d, content: d.content.map(x => x.id===p.id ? {...x, visible: nextVisible} : x)}) : d);
    try{
      const updated = await updateProduct(p.id, { visible: nextVisible } as any);
      const serverVisible = Boolean((updated as any).visible ?? (updated as any).isVisible ?? nextVisible);
      setData(d => d ? ({...d, content: d.content.map(x => x.id===p.id ? {...x, visible: serverVisible} : x)}) : d);
      setToast({kind:"ok", msg: serverVisible ? "Product is now visible" : "Product hidden"});
    }catch(e:any){
      // revert
      setData(d => d ? ({...d, content: d.content.map(x => x.id===p.id ? {...x, visible: prevVisible} : x)}) : d);
      setToast({kind:"bad", msg: e?.response?.data?.message || "Failed to toggle visibility"});
    } finally {
      setBusyVisible(m => ({ ...m, [p.id]: false }));
    }
  }

  // Persist featured flag from the list
  async function onToggleFeatured(p: Product){
    if (isLocked(p.id)) return;
    setBusyFeature(m => ({ ...m, [p.id]: true }));
    try{
      const desired = !p.featured;
      const updated = await setProductFeatured(p.id, desired);
      setData(d =>
        d ? ({ ...d, content: d.content.map(x => x.id === p.id ? { ...x, featured: !!updated.featured } : x) }) : d
      );
      setToast({ kind:"ok", msg: (!!updated.featured ? "Marked as featured" : "Removed from featured") });
    }catch(e:any){
      setToast({ kind:"bad", msg: e?.response?.data?.message || "Failed to update featured flag" });
    } finally {
      setBusyFeature(m => ({ ...m, [p.id]: false }));
    }
  }
    const total = data?.totalElements ?? 0;
    const from = total === 0 ? 0 : page*size + 1;
    const to   = Math.min((page+1)*size, total);

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
              onChange={e=>setQ(e.target.value)}
              placeholder="Search by name or slug…"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <button className="btn" onClick={()=>setModal({mode:"add"})}>+ Add product</button>
        </div>
      </div>

      {err && <div className="alert bad">{err}</div>}

      <div className="card">
        {loading ? <SkeletonTable rows={6}/> : (
          <table className="grid">
            <thead>
              <tr>
                {[
                  <th key="id" style={{ width: 70 }}>ID</th>,
                  <th key="name">Name</th>,
                  <th key="slug">Slug</th>,
                  <th key="price" style={{ width: 120, textAlign: "right" }}>Price</th>,
                  <th key="flags" style={{ width: 200 }}>Flags</th>,
                  <th key="actions" style={{ width: 340 }}></th>,
                ]}
              </tr>
            </thead>

            <tbody>
            {filtered.map(row => {
              const isVisible = Boolean((row as any).visible ?? (row as any).isVisible);
              return (
                <tr key={row.id}>
                  <td>#{row.id}</td>
                  <td className="strong">{row.name}</td>
                  <td className="muted">{row.slug || "-"}</td>
                  <td style={{textAlign:"right"}}>₹{new Intl.NumberFormat("en-IN").format(Number(row.price||0))}</td>
                  <td>
                    <span className={"pill " + (isVisible ? "ok" : "off")}>
                      {isVisible ? "Visible" : "Hidden"}
                    </span>
                    {!!row.featured && <span className="pill gold">Featured</span>}
                    {row.active === false && <span className="pill off">Inactive</span>}
                  </td>
                  <td className="actions">
                    <StarButton
                      on={!!row.featured}
                      saving={!!busyFeature[row.id]}
                      onClick={()=>onToggleFeatured(row)}
                      title={row.featured ? "Unfeature" : "Feature"}
                    />
                    <Toggle
                      checked={isVisible}
                      onChange={(val)=>onToggleVisible(row, val)}
                      title={isVisible ? "Hide" : "Show"}
                      disabled={isLocked(row.id)}
                    />
                    <button className="ghost" onClick={()=>setModal({mode:"edit", data: row})}>Edit</button>
                    <button className="ghost bad" onClick={()=>onDelete(row.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={6} style={{textAlign:"center", padding:"28px 0"}}>No products match your search.</td></tr>
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
          onClose={()=>setModal(null)}
          onReload={reload}
          onCreated={(p)=> setModal({ mode: "edit", data: p })}
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
}:{
  initial?: Product | null;
  mode: "add" | "edit";
  busy?: boolean;
  onClose: ()=>void;
  onReload: ()=>Promise<void>;
  onCreated: (p: Product)=>void;
  setToast: React.Dispatch<React.SetStateAction<{kind:"ok"|"bad", msg:string} | null>>;
  toast?: { kind:"ok"|"bad", msg:string } | null;
  dismissToast?: () => void;
}){
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

  useEffect(() => {
    if (mode === "add" || !slug) setSlug(slugifyName(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function saveDetails(advanceToImages?: boolean){
    if (mode === "edit" && id) {
      const wasFeatured = !!initial?.featured;
      if (featured !== wasFeatured) {
        try {
          await setProductFeatured(id, featured);
        } catch (e:any) {
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
      ...(featured ? { featuredRank: featuredRank === "" ? null : Number(featuredRank) } : { featuredRank: null }),
    } as any;

    try {
      if (mode === "add"){
        const created = await createProduct(dto);
        setToast({kind:"ok", msg:"Product created"});
        onCreated(created);
        await onReload();
        if (advanceToImages) setTab("images");
      } else if (id){
        await updateProduct(id, dto);
        setToast({kind:"ok", msg:"Product updated"});
        await onReload();
        if (advanceToImages) setTab("images");
      }
    } catch (e:any) {
      setToast({kind:"bad", msg: e?.response?.data?.message || "Save failed"});
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
          <button className={"tab" + (tab==="details" ? " active" : "")} onClick={()=>setTab("details")}>Details</button>
          <button className={"tab" + (tab==="images"  ? " active" : "")} disabled={!canOpenImages} onClick={()=>setTab("images")}>Images</button>
          <button className={"tab" + (tab==="options" ? " active" : "")} disabled={!canOpenOptions} onClick={()=>setTab("options")}>Options</button>
        </div>

        {tab === "details" && (
          <>
            <div className="modal-bd">
              <div className="form">
                <div className="grid2">
                  <label>
                    <span>Name</span>
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="eg. Peach Rose Bouquet" />
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
                  <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} />
                </label>

                <div className="switches">
                  <label className="check">
                    <Toggle checked={visible} onChange={setVisible} title={visible ? "Hide" : "Show"} />
                    <span>Visible</span>
                  </label>

                  <label className="check">
                    <StarButton on={featured} onClick={()=>setFeatured(!featured)} title={featured ? "Unfeature" : "Feature"} />
                    <span>Featured</span>
                  </label>

                  {featured && (
                    <label style={{display:"flex", alignItems:"center", gap:8}}>
                      <span>Rank</span>
                      <input
                        type="number"
                        min={0}
                        value={featuredRank === "" ? "" : Number(featuredRank)}
                        onChange={(e)=> setFeaturedRank(e.target.value === "" ? "" : Number(e.target.value))}
                        style={{width:90}}
                      />
                    </label>
                  )}
                </div>

                <button className="link" type="button" onClick={()=>setShowAdvanced(v=>!v)}>
                  {showAdvanced ? "Hide" : "Show"} advanced
                </button>

                {showAdvanced && (
                  <label>
                    <span>Slug</span>
                    <input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="auto-generated-from-name" />
                    <small className="muted">Used in SEO & URLs; keep lowercase with hyphens.</small>
                  </label>
                )}
              </div>
            </div>

            <div className="modal-ft">
              <button className="ghost" onClick={onClose}>Close</button>
              {mode === "add" && !initial?.id ? (
                <button className="btn" disabled={!name.trim()} onClick={()=>saveDetails(true)}>
                  Create & go to Images
                </button>
              ) : (
                <>
                  <button className="ghost" onClick={()=>saveDetails(false)}>Save details</button>
                  <button className="btn" onClick={()=>saveDetails(true)}>Save & go to Images</button>
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


  const MAX = 5;

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





  async function onUploadSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const existing = items?.length || 0;
    const alreadyQueued = queue.length;

    // ✅ Use shared validator: enforces max files, size, and blocks HEIC
    const { valid, errors } = validateImageFile(files, {
      maxFiles: MAX,
      existingCount: existing + alreadyQueued,
    });

    if (errors.length > 0) {
      // Show only the first error to keep toast clean
      setToast({ kind: "bad", msg: errors[0] });
    }

    if (!valid.length) return;

    // Simple optimistic previews (HEIC will never be here now)
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
            undefined,
            sortBase++,
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


  function moveUp(idx: number)  { if (!items || idx<=0) return; reorder(idx, idx-1); }
  function moveDown(idx: number){ if (!items || idx>=items.length-1) return; reorder(idx, idx+1); }

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
                  <div className="progress"><div style={{width: `${Math.min(q.pct||1, 100)}%`}}/></div>
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
              <div className="empty">No images yet. Upload up to 5.</div>
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
    } catch {}
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
                      <small style={{marginRight:6}}>Visible</small>
                      <Toggle
                        checked={(o as any)?.visible !== false}
                        onChange={(val)=>onPatchOption(o, { visible: val })}
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
                          <input defaultValue={v.valueLabel} onBlur={(e)=> patchValue(o.id, v.id, { valueLabel: e.target.value })}/>
                        </div>
                        <div>
                          <input defaultValue={v.valueCode ?? ""} onBlur={(e)=> patchValue(o.id, v.id, { valueCode: e.target.value || null })}/>
                        </div>
                        <div>
                          <input
                            type="number" inputMode="decimal"
                            defaultValue={v.priceDelta ?? ""}
                            onBlur={(e)=> patchValue(o.id, v.id, { priceDelta: e.target.value === "" ? null : Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            defaultValue={v.sortOrder ?? 0}
                            onBlur={(e)=> patchValue(o.id, v.id, { sortOrder: Number(e.target.value) || 0 })}
                          />
                        </div>
                        {/* Only Visible toggle (Active removed) */}
                        <div>
                          <Toggle
                            checked={(v as any)?.visible !== false}
                            onChange={(val)=> patchValue(o.id, v.id, { visible: val })}
                            title={(v as any)?.visible === false ? "Show value" : "Hide value"}
                          />
                        </div>
                        <div className="right">
                          <button className="ghost bad" onClick={()=>removeValue(o.id, v.id)}>Delete</button>
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
function SkeletonTable({rows=6}:{rows?:number}){
  return (
    <div className="sk-wrap">
      {Array.from({length: rows}).map((_,i)=>(
        <div key={i} className="sk-row">
          <div className="sk sk-id"/>
          <div className="sk sk-wide"/>
          <div className="sk sk-mid"/>
          <div className="sk sk-price"/>
          <div className="sk sk-flags"/>
          <div className="sk sk-actions"/>
        </div>
      ))}
    </div>
  );
}

/* ---------------------- Styles ---------------------- */
const css = `
:root { color-scheme: light; }
.prod-wrap{ color:${PRIMARY}; font-synthesis-weight:none; }
.bar{
  display:flex; align-items:end; justify-content:space-between; gap:12px;
  margin-bottom:12px; padding: 10px 12px; border:1px solid ${INK}; border-radius:16px; background:#fff;
  box-shadow:0 16px 48px rgba(0,0,0,.08);
}
.bar h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.bar p{ margin:6px 0 0; opacity:.9; }
.bar-right{ display:flex; gap:10px; align-items:center; }
.search{ position:relative; display:flex; align-items:center; gap:8px; width: 340px; }
.search input{
  width:100%; height:38px; border:1px solid rgba(0,0,0,.08);
  border-radius:12px; padding:0 36px 0 12px; outline:none; background:#fff;
}
.search svg{ position:absolute; right:10px; top:50%; transform: translateY(-50%); opacity:.7; pointer-events:none; }
.btn {
  border: none; background: ${ACCENT}; color: #fff; box-shadow: 0 10px 24px rgba(240,93,139,.30);
  height:38px; padding:0 14px; border-radius:12px; cursor:pointer;
}
.btn:hover { transform: translateY(-1px); box-shadow:0 12px 28px rgba(240,93,139,.36); }
.ghost{ height:34px; padding:0 12px; border:1px solid ${INK}; background:#fff; border-radius:10px; cursor:pointer; }
.ghost.bad{ color:#8a0024; border-color: rgba(240,93,139,.3); }
.ghost.small{ height:28px; padding:0 8px; font-size:12px; }
.link{ background:transparent; border:none; color:${PRIMARY}; text-decoration:underline; font-weight:800; padding:4px 0; cursor:pointer; width:max-content; }
.alert.bad{ margin:10px 0; padding:10px; border-radius:12px; background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039; }

.card{ border:1px solid ${INK}; border-radius:16px; background:#fff; box-shadow:0 18px 60px rgba(0,0,0,.10); overflow:hidden; }
.grid{ width:100%; border-collapse:separate; border-spacing:0; table-layout: fixed; }
.grid thead th{
  position: sticky; top:0; z-index: 1; text-align:left; padding:14px 16px; font-size:12px; letter-spacing:.2px; opacity:.9;
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.92)); backdrop-filter: blur(2px);
  border-bottom:1px solid ${INK};
}
.grid tbody td{ padding:14px 16px; border-top:1px solid ${INK}; vertical-align: middle; }
.grid tbody tr:hover{ background: rgba(246,195,32,.06); }
.strong{ font-weight:800; }
.muted{ opacity:.8; }
.pill{ display:inline-flex; align-items:center; height:24px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:800; margin-right:6px; }
.pill.ok{ background: rgba(155,180,114,.2); color:#2f4b12; }
.pill.off{ background: rgba(0,0,0,.08); }
.pill.gold{ background: rgba(246,195,32,.25); }

/* star + toggle */
.star-btn{
  position:relative;
  display:inline-flex; align-items:center; gap:6px;
  height:32px; min-width:38px; padding:0 10px; border-radius:10px; border:1px solid ${INK}; background:#fff; cursor:pointer; font-weight:900;
}
.star-btn .sr{ position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
.star-btn .star-shape{
  font-size:16px; line-height:1; color:#b3b3b3;
  transition: transform .15s ease, color .15s ease, text-shadow .15s ease;
}
.star-btn:hover .star-shape{ transform: scale(1.06); }
.star-btn.on{ border-color: rgba(246,195,32,.6); background: rgba(246,195,32,.12); }
.star-btn.on .star-shape{ color:#b98500; text-shadow: 0 0 0 currentColor; }
.star-btn .spin{
  width:14px; height:14px; margin-left:6px; border-radius:50%;
  border:2px solid rgba(0,0,0,.12); border-top-color:${GOLD}; animation: rot .7s linear infinite;
}
.star-btn.saving{ opacity:.75; cursor:wait; }
@keyframes rot { to { transform: rotate(360deg); } }

.switch{ position:relative; width:44px; height:24px; border-radius:999px; border:1px solid ${INK}; background:#fff; cursor:pointer; padding:0; display:inline-flex; align-items:center; }
.switch .knob{ position:absolute; left:2px; top:2px; width:20px; height:20px; border-radius:50%; background:#ccc; transition: transform .18s ease, background .18s ease; }
.switch.on .knob{ transform: translateX(20px); background:${MINT}; }

.actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; align-items:center; }
.actions .ghost{ height:32px; padding:0 10px; border-radius:10px; }

.pager{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; }
.pager select{ height:34px; border-radius:10px; border:1px solid ${INK}; }
.pager .left{ font-size:12px; opacity:.85; }

.modal-wrap{ position: fixed; inset:0; z-index: 100; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,.28); backdrop-filter: blur(2px); padding: 16px; overflow: auto; }
.modal{ width: 860px; max-width: calc(100vw - 24px); max-height: calc(100vh - 32px); display:flex; flex-direction:column; border:1px solid rgba(0,0,0,.08); border-radius:16px; background:#fff; box-shadow:0 24px 80px rgba(0,0,0,.22); }
.modal-bd{ padding:12px; overflow:auto; flex: 1 1 auto; }
.modal-hd{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid ${INK}; }
.modal-hd .title{ font-weight:900; }
.modal-hd .x{ background:transparent; border:none; font-size:26px; line-height:1; cursor:pointer; }
.tabs{ display:flex; gap:6px; padding:10px 12px; border-bottom:1px solid ${INK}; background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.85)); }
.tab{ height:30px; padding:0 12px; border-radius:999px; border:1px solid transparent; background:#fff; font-weight:800; }
.tab.active{ background: ${GOLD}; border-color: transparent; }
.form{ display:grid; gap:12px; }
.form .grid2{ display:grid; grid-template-columns:1.4fr .6fr; gap:12px; }
.form label{ display:grid; gap:6px; }
.form input, .form textarea{ height:38px; padding: 8px 10px; border-radius:10px; border:1px solid ${INK}; outline:none; resize:vertical; }
.form textarea{ height:auto; }
.switches{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.form .check{ display:flex; align-items:center; gap:8px; }
.form small.muted{ opacity:.75; }
.modal-ft{ padding:10px 12px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid ${INK}; position: sticky; bottom: 0; background:#fff; }

/* Images */
.imgbar{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 6px 8px; border:1px dashed ${INK}; border-radius:12px; background:#fff; }
.imgbar .count{ font-weight:900; }
.imgbar .hint{ font-size:12px; opacity:.75; }
.upload{ position:relative; display:inline-flex; align-items:center; justify-content:center; height:34px; padding:0 12px; border-radius:10px; background:${ACCENT}; color:#fff; font-weight:900; cursor:pointer; box-shadow:0 12px 26px rgba(240,93,139,.3); }
.upload input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.upload.disabled{ opacity:.5; pointer-events:none; }
.gallery{ display:grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap:10px; margin-top:12px; }
.tile{ border:1px solid ${INK}; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 10px 22px rgba(0,0,0,.08); }
.thumb{ aspect-ratio: 1 / 1; background:#f7f7f7; line-height:0; }
.thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.tile .row{ display:flex; gap:8px; padding:8px; justify-content:center; }
.tile .meta{ display:grid; gap:6px; padding:8px; border-top:1px solid ${INK}; }
.progress{ height:6px; border-radius:999px; background: #eee; overflow:hidden; }
.progress > div{ height:100%; width:0; background:${ACCENT}; }
.empty{ text-align:center; padding:18px; opacity:.8; }

/* Options */
.options-bd{ max-height: calc(80vh - 140px); }
.optwrap{ border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:10px; background:#fff; margin-bottom:12px; }
.optcard{ border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:10px; background:#fff; box-shadow:0 12px 32px rgba(0,0,0,.06); }
.stack{ display:grid; gap:12px; margin-top:12px; }
.row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.row-actions{ display:flex; gap:6px; align-items:center; }
.split{ display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:10px; }
.inset{ border-top:1px dashed rgba(0,0,0,.08); margin-top:8px; padding-top:10px; }
.title{ font-weight:900; }
.micro{ font-size:12px; opacity:.75; }
.tag{ display:inline-flex; align-items:center; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:900; margin-left:6px; background:rgba(0,0,0,.06); }
.tag.off{ background: rgba(0,0,0,.08); }
.tag.gold{ background: rgba(246,195,32,.25); }
.values{ margin-top:10px; }
.table-like{ display:grid; gap:6px; overflow-x:auto; }
.table-like .thead, .table-like .trow{
  display:grid;
  grid-template-columns: 1.4fr .9fr .7fr .5fr .7fr .7fr; /* Label, Code, PriceΔ, Sort, Visible, Actions */
  gap:8px; align-items:center;
}
.table-like .thead{ font-size:12px; opacity:.8; }
.table-like .trow input{ height:34px; border:1px solid rgba(0,0,0,.08); border-radius:8px; padding:0 8px; min-width: 0; }
.table-like .right{ display:flex; justify-content:flex-end; }

/* skeleton */
.sk-wrap{ padding: 10px; }
.sk-row{
  display:grid;
  grid-template-columns: 70px 1.3fr 1fr 120px 200px 340px;
  gap:10px; align-items:center; padding:8px 12px;
}

.sk{ height:18px; border-radius:8px; background: linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size: 200% 100%; animation: wave 1.2s linear infinite; }
.sk-id{ width:44px; }
.sk-wide{ height:20px; }
.sk-mid{ width:60%; }
.sk-price{ width:80px; margin-left:auto; }
.sk-flags{ width:200px; }
.sk-actions{ height:28px; }
@keyframes wave{ 0%{background-position: 200% 0} 100%{background-position:-200% 0} }

/* toast */
.toast{ position: fixed; right: 16px; bottom: 16px; padding: 10px 12px; border-radius:12px; color:#fff; animation: slide 2.6s ease forwards; }
.toast.ok{ background: ${ACCENT}; box-shadow: 0 12px 30px rgba(240,93,139,.4); }
.toast.bad{ background: #8a0024; box-shadow: 0 12px 30px rgba(138,0,36,.35); }
@keyframes slide{ 0%{ transform: translateY(20px); opacity:0; } 10%{ transform: translateY(0); opacity:1; } 80%{ transform: translateY(0); opacity:1; } 100%{ transform: translateY(10px); opacity:0; }

.toast.in-modal{ position: absolute; right: 12px; bottom: 12px; z-index: 101; }
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08); /* INK */
}

.pgbtns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ghost {
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08); /* INK */
  background: #fff;
  color: #4A4F41; /* PRIMARY */
  cursor: pointer;
}

.ghost.sm {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12.5px;
}

select {
  height: 32px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 0 10px;
  background: #fff;
}
.card .pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.card .pgbtns {
  display: flex;
  align-items: center;
  gap: 8px;
}

`;
