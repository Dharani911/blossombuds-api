import React, { useEffect, useMemo, useState } from "react";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductActive,
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
  slugifyName
} from "../../api/adminCatalog";


const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD   = "#F6C320";
const INK    = "rgba(0,0,0,.08)";

export default function ProductsPage(){
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [data, setData] = useState<Page<Product> | null>(null);
  const [q, setQ] = useState("");

  const [modal, setModal] = useState<null | { mode:"add" | "edit"; data?: Product }>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<null | { kind:"ok"|"bad", msg:string }>(null);
  const dismissToast = () => setToast(null);

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
    const items = data?.content || [];
    if (!q.trim()) return items;
    const qq = q.toLowerCase();
    return items.filter(p =>
      p.name.toLowerCase().includes(qq) || (p.slug||"").toLowerCase().includes(qq)
    );
  }, [data, q]);

  const totalPages = data?.totalPages ?? 0;

  async function reload() {
    const pg = await listProducts(page, size);
    setData(pg);
  }

  async function onDelete(id:number){
    if (!confirm("Delete this product? This is a soft delete (inactive).")) return;
    try{
      await deleteProduct(id);
      setToast({kind:"ok", msg:"Product deleted"});
      await reload();
    }catch(e:any){
      setToast({kind:"bad", msg: e?.response?.data?.message || "Delete failed"});
    }
  }

  async function onToggle(p: Product){
    try{
      // optimistic
      setData(d => d ? ({...d, content: d.content.map(x => x.id===p.id ? {...x, active: !x.active} : x)}) : d);
      await toggleProductActive(p);
    }catch{
      // revert
      setData(d => d ? ({...d, content: d.content.map(x => x.id===p.id ? {...x, active: p.active} : x)}) : d);
      setToast({kind:"bad", msg:"Failed to toggle active"});
    }
  }

  return (
    <div className="prod-wrap">
      <style>{css}</style>

      <div className="bar">
        <div className="bar-left">
          <h2>Products</h2>
          <p>Create, edit, enable/disable, and delete products.</p>
        </div>
        <div className="bar-right">
          <div className="search">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or slug…" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <button className="btn" onClick={()=>setModal({mode:"add"})}>+ Add product</button>
        </div>
      </div>

      {err && <div className="alert bad">{err}</div>}

      <div className="card">
        {loading ? <Loader/> : (
          <table className="grid">
            <thead>
              <tr>
                <th style={{width:60}}>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th style={{width:120, textAlign:"right"}}>Price</th>
                <th style={{width:110}}>Status</th>
                <th style={{width:260}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>#{row.id}</td>
                  <td className="strong">{row.name}</td>
                  <td className="muted">{row.slug || "-"}</td>
                  <td style={{textAlign:"right"}}>₹{new Intl.NumberFormat("en-IN").format(row.price)}</td>
                  <td>
                    <span className={"pill " + (row.active ? "ok" : "off")}>
                      {row.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="ghost" title={row.active ? "Disable" : "Enable"} onClick={()=>onToggle(row)}>
                      {row.active ? "Disable" : "Enable"}
                    </button>
                    <button className="ghost" onClick={()=>setModal({mode:"edit", data: row})}>Edit</button>
                    <button className="ghost bad" onClick={()=>onDelete(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{textAlign:"center", padding:"28px 0"}}>No products found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="pager">
        <div className="left">Page {page+1} of {Math.max(totalPages,1)}</div>
        <div className="right">
          <button className="ghost" disabled={page<=0} onClick={()=>setPage(p=>Math.max(p-1,0))}>Prev</button>
          <button className="ghost" disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
          <select value={size} onChange={e=>{ setSize(Number(e.target.value)); setPage(0); }}>
            {[10,20,30,50].map(s=><option key={s} value={s}>{s}/page</option>)}
          </select>
        </div>
      </div>

      {/* Modal with tabs (Details + Images) */}
      {modal && (
        <ProductModal
          initial={modal.data}
          mode={modal.mode}
          busy={busy}
          onClose={()=>setModal(null)}
          onReload={reload}
          onCreated={(p)=> setModal({ mode: "edit", data: p })}
          setToast={setToast}
          toast={toast}                 // <-- NEW
          dismissToast={dismissToast}   // <-- NEW
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

function ProductModal({
  initial, mode, onClose, busy, onReload, onCreated, setToast,
  toast,                    // NEW
  dismissToast              // NEW
}:{
  initial?: Product | null;
  mode: "add" | "edit";
  busy?: boolean;
  onClose: ()=>void;
  onReload: ()=>Promise<void>;
  onCreated: (p: Product)=>void;
  setToast: React.Dispatch<React.SetStateAction<{kind:"ok"|"bad", msg:string} | null>>;
  toast?: { kind:"ok"|"bad", msg:string } | null;   // NEW
  dismissToast?: () => void;                        // NEW
}){
  const [tab, setTab] = useState<"details" | "images" | "options">("details");

  // ----- DETAILS STATE -----
  const [name, setName] = useState(initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [price, setPrice] = useState<number | "">(initial?.price ?? "");
  const [description, setDescription] = useState(initial?.description || "");
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const id = initial?.id;

  useEffect(() => {
    if (mode === "add" || !slug) {
      setSlug(slugifyName(name));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function saveDetails(advanceToImages?: boolean){
    const dto: ProductDto = {
      id,
      name: name.trim(),
      slug: slug ? slug.trim() : undefined,
      description: description || undefined,
      price: Number(price) || 0,
      active
    };

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

        {/* Tabs */}
        <div className="tabs">
          <button
            className={"tab" + (tab==="details" ? " active" : "")}
            onClick={()=>setTab("details")}
          >Details</button>
          <button
            className={"tab" + (tab==="images" ? " active" : "")}
            title={canOpenImages ? "" : "Save Details first"}
            disabled={!canOpenImages}
            onClick={()=>setTab("images")}
          >Images</button>
          <button
            className={"tab" + (tab==="options" ? " active" : "")}
            title={canOpenOptions ? "" : "Save Details first"}
            disabled={!canOpenOptions}
            onClick={()=>setTab("options")}
          >
            Options
          </button>
        </div>

        {/* Tab content */}
        {tab === "details" && (
          <>
            <div className="modal-bd">
              <div className="form">
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setPrice(v === "" ? "" : Number(v));
                    }}
                  />
                </label>

                <label>
                  <span>Description</span>
                  <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} />
                </label>

                <label className="check">
                  <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
                  <span>Active</span>
                </label>

                <button className="link" type="button" onClick={()=>setShowAdvanced(v=>!v)}>
                  {showAdvanced ? "Hide" : "Show"} advanced
                </button>

                {showAdvanced && (
                  <label>
                    <span>Slug</span>
                    <input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="auto-generated-from-name" />
                    <small className="muted">Used in product URLs; keep lowercase with hyphens.</small>
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
            setToast={setToast}
          />
        )}

        {tab === "options" && !!initial?.id && (
          <OptionsTab
            productId={initial.id}
            setToast={setToast}
            onDone={onClose}
          />
        )}

        {/* In-modal toast (renders above the blur) */}
        {toast && (
          <div className={"toast in-modal " + toast.kind} onAnimationEnd={dismissToast}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}



/* ---------------------- Images Tab (HEIC logo placeholder) ---------------------- */
type ImagesTabProps = {
  productId: number;
  onDone: () => void;
  onChanged: () => Promise<void>;
  setToast: React.Dispatch<React.SetStateAction<{ kind: "ok" | "bad"; msg: string } | null>>;
};

// optional: put your logo file into public/ as /logo-mark.png
const BRAND_LOGO_URL = "/BB_logo.png"; //

export function ImagesTab({ productId, onDone, onChanged, setToast }: ImagesTabProps) {
  const [items, setItems] = React.useState<ProductImage[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // optimistic queue (only client-side UI)
  const [queue, setQueue] = React.useState<
    { id: string; name: string; previewUrl: string; isHeic: boolean; error?: string }[]
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
      // revoke any blob URLs we created
      queue.forEach((q) => {
        if (q.previewUrl.startsWith("blob:")) URL.revokeObjectURL(q.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function refresh() {
    const imgs = await listProductImages(productId);
    setItems(imgs);
    await onChanged();
  }

  // ---------- tiny helpers ----------
  function isHeicNameOrType(file: File): boolean {
    const n = (file.name || "").toLowerCase();
    return /image\/hei[cf]/i.test(file.type) || n.endsWith(".heic") || n.endsWith(".heif");
  }

  function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function drawLogoPlaceholder(logo: HTMLImageElement | null, name: string): string {
    const w = 640, h = 420;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    // background
    ctx.fillStyle = "#f6f6f6";
    ctx.fillRect(0, 0, w, h);

    // very subtle diagonal texture
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#eaeaea";
    for (let x = -h; x < w + h; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // soft inner shadow frame
    ctx.strokeStyle = "#dfdfdf";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

    // center mark (logo or fallback)
    const cx = w / 2;
    const cy = h / 2;
    if (logo) {
      // fit logo into a safe box
      const maxLogoW = Math.floor(w * 0.28);
      const maxLogoH = Math.floor(h * 0.28);
      const scale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height, 1);
      const lw = Math.max(60, Math.floor(logo.width * scale));
      const lh = Math.max(60, Math.floor(logo.height * scale));

      // faint circle backdrop
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fill();

      // draw logo
      ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
    } else {
      // fallback glyph (two interleaved circles)
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fill();

      // minimalist monogram
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const initials = "BB";
      const tw = ctx.measureText(initials).width;
      ctx.fillText(initials, cx - tw / 2, cy + 7);
    }

    // tiny status chip at bottom (no HEIC text; neutral loader hint)
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const chip = "Uploading…";
    const padX = 10, padY = 6;
    const chipW = ctx.measureText(chip).width + padX * 2;
    const chipH = 22;
    const chipX = cx - chipW / 2;
    const chipY = h - 28;
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(chipX, chipY, chipW, chipH);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(chipX + 0.5, chipY + 0.5, chipW - 1, chipH - 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(chip, chipX + padX, chipY + chipH - padY);

    return c.toDataURL("image/png");
  }

  async function previewUrlFor(file: File): Promise<{ url: string; isHeic: boolean }> {
    if (isHeicNameOrType(file)) {
      const logo = await loadImage(BRAND_LOGO_URL);
      return { url: drawLogoPlaceholder(logo, file.name), isHeic: true };
    }
    return { url: URL.createObjectURL(file), isHeic: false };
  }
  // ----------------------------------

  async function onUploadSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const MAX_BYTES = 10 * 1024 * 1024;
    const EXT_OK = [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".heif", ".bmp", ".gif"];

    const existing = items?.length || 0;
    const alreadyQueued = queue.length;
    const remaining = Math.max(0, MAX - (existing + alreadyQueued));
    if (remaining === 0) {
      setToast({ kind: "bad", msg: "You already have 5 images" });
      return;
    }

    const all = Array.from(files);
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const f of all) {
      const name = f.name || "file";
      const lower = name.toLowerCase();
      const looksLikeImage =
        (f.type && f.type.startsWith("image/")) || EXT_OK.some((ext) => lower.endsWith(ext));
      if (!looksLikeImage) { rejected.push(`“${name}” is not an image`); continue; }
      if (f.size > MAX_BYTES) { rejected.push(`“${name}” exceeds 10 MB`); continue; }
      valid.push(f);
      if (valid.length >= remaining) break;
    }

    if (valid.length === 0) {
      setToast({ kind: "bad", msg: rejected[0] || "No valid files to upload" });
      return;
    }
    if (rejected.length > 0) {
      setToast({ kind: "bad", msg: `${rejected[0]} (some files skipped)` });
    }

    // optimistic tiles
    const optimistic = await Promise.all(
      valid.map(async (f) => {
        const p = await previewUrlFor(f);
        return { id: crypto.randomUUID(), name: f.name, previewUrl: p.url, isHeic: p.isHeic };
      })
    );
    setQueue((q) => [...q, ...optimistic]);

    setBusy(true);
    try {
      let sortBase = items?.length || 0;

      // upload sequentially → stable sortOrder
      for (let i = 0; i < valid.length; i++) {
        const f = valid[i];
        const tempId = optimistic[i].id;

        try {
          await uploadProductImage(productId, f, undefined, sortBase++);
          // success: drop tile from queue
          setQueue((q) => {
            const found = q.find((x) => x.id === tempId);
            if (found?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(found.previewUrl);
            return q.filter((x) => x.id !== tempId);
          });
        } catch (e: any) {
          // failure: keep tile, mark error
          setQueue((q) =>
            q.map((x) =>
              x.id === tempId ? { ...x, error: e?.response?.data?.message || e?.message || "Upload failed" } : x
            )
          );
        }
      }

      await refresh();
      setToast({ kind: "ok", msg: `Uploaded ${valid.length} image(s)` });
    } catch (e: any) {
      setToast({ kind: "bad", msg: e?.response?.data?.message || e?.message || "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  function moveUp(idx: number) {
    if (!items) return;
    if (idx <= 0) return;
    reorder(idx, idx - 1);
  }
  function moveDown(idx: number) {
    if (!items) return;
    if (idx >= items.length - 1) return;
    reorder(idx, idx + 1);
  }

  async function reorder(a: number, b: number) {
    if (!items) return;
    const next = items.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setItems(next.map((it, i) => ({ ...it, sortOrder: i })));
    try {
      await Promise.all(next.map((it, i) => updateImageMeta(productId, it.id, { sortOrder: i })));
    } catch {
      setToast({ kind: "bad", msg: "Reorder failed" });
    }
  }

  async function markPrimary(img: ProductImage) {
    try {
      await setPrimaryImage(productId, img.id);
      await refresh();
      setToast({ kind: "ok", msg: "Primary image set" });
    } catch {
      setToast({ kind: "bad", msg: "Could not set primary" });
    }
  }

  async function remove(img: ProductImage) {
    if (!confirm("Remove this image?")) return;
    try {
      await deleteProductImage(productId, img.id);
      await refresh();
      setToast({ kind: "ok", msg: "Image removed" });
    } catch {
      setToast({ kind: "bad", msg: "Delete failed" });
    }
  }

  const count = (items?.length || 0) + queue.length;

  return (
    <>
      <div className="modal-bd">
        <div className="imgbar">
          <div>
            <div className="count">{count}/{MAX} images</div>
            <div className="hint">
              Any image (JPG/PNG/WebP/TIFF/HEIC…) up to ~10MB. Watermark is applied on the server.
            </div>
          </div>
          <label className={"upload" + (count >= MAX ? " disabled" : "")}>
            <input
              type="file"
              accept="image/*,.heic,.heif"
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
            {/* Optimistic uploading tiles */}
            {queue.map((q) => (
              <div key={q.id} className="tile" aria-busy={true}>
                <div className="thumb">
                  {q.previewUrl ? (
                    <img src={q.previewUrl} alt={q.name} />
                  ) : (
                    <span className="muted">Preparing preview…</span>
                  )}
                </div>
                <div className="row">
                  <button className="ghost small" disabled>↑</button>
                  <button className="ghost small" disabled>↓</button>
                  <button className="ghost small" disabled title="Make primary">★</button>
                  <button
                    className="ghost small bad"
                    onClick={() =>
                      setQueue((qq) => {
                        const found = qq.find((x) => x.id === q.id);
                        if (found?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(found.previewUrl);
                        return qq.filter((x) => x.id !== q.id);
                      })
                    }
                  >
                    Cancel
                  </button>
                </div>
                <div className="meta">
                  <span className="muted">{q.error ? "Failed" : "Uploading…"}</span>
                </div>
              </div>
            ))}

            {/* Server images */}
            {(items || []).map((img, idx) => (
              <div key={img.id} className="tile">
                <div className="thumb">
                  {(() => {
                    const src = img.watermarkVariantUrl || img.url || "";
                    return src ? <img src={src} alt={img.altText || ""} /> : <span className="muted">No image</span>;
                  })()}
                </div>
                <div className="row">
                  <button className="ghost small" onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                  <button
                    className="ghost small"
                    onClick={() => moveDown(idx)}
                    disabled={idx === (items!.length - 1)}
                  >
                    ↓
                  </button>
                  <button className="ghost small" onClick={() => markPrimary(img)} title="Make primary">★</button>
                  <button className="ghost small bad" onClick={() => remove(img)}>Delete</button>
                </div>
                <div className="meta">
                  <span className="muted">#{img.id}</span>
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
      </div>
    </>
  );
}




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
        active: true,
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

  async function onToggleOption(o: any) {
    try {
      const updated = await updateOption(o.id, { active: !o.active });
      setOpts((list) => (list || []).map((x) => (x.id === o.id ? updated : x)));
      setToast({ kind: "ok", msg: updated.active ? "Option enabled" : "Option disabled" });
    } catch {
      setToast({ kind: "bad", msg: "Toggle failed" });
    }
  }

  async function onSaveOption(o: any, patch: Partial<typeof o>) {
    try {
      const updated = await updateOption(o.id, patch);
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
        active: true,
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
      <div className="modal-bd">
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
                      {!o.active && <span className="tag off">disabled</span>}
                      {o.required && <span className="tag gold">required</span>}
                    </div>
                    <div className="micro">Sort: {o.sortOrder ?? 0} · Max: {o.maxSelect ?? (o.inputType === "multiselect" ? 2 : 1)}</div>
                  </div>
                  <div className="row-actions">
                    <button className="ghost" onClick={() => onToggleOption(o)}>{o.active ? "Disable" : "Enable"}</button>
                    <button className="ghost" onClick={() => onSaveOption(o, { sortOrder: (o.sortOrder ?? 0) + 1 })}>Sort +1</button>
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
                        if (val && val !== o.name) onSaveOption(o, { name: val });
                      }} />
                    </label>

                    <label>
                      <span>Required</span>
                      <select
                        defaultValue={String(!!o.required)}
                        onChange={(e) => onSaveOption(o, { required: e.target.value === "true" })}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>

                    {o.inputType === "multiselect" && (
                      <label>
                        <span>Max select</span>
                        <input
                          type="number"
                          min={1}
                          defaultValue={o.maxSelect ?? 2}
                          onBlur={(e) => onSaveOption(o, { maxSelect: Number(e.target.value) || 1 })}
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
                      <div>Status</div>
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
                        <div>
                          <select defaultValue={String(!!v.active)} onChange={(e)=> patchValue(o.id, v.id, { active: e.target.value === "true" })}>
                            <option value="true">Active</option>
                            <option value="false">Disabled</option>
                          </select>
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
                      <div className="muted">active</div>
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

// picks the best available image url from whatever shape your product has
function coverUrlOf(p: any): string | null {
  if (p?.primaryImage?.url) return p.primaryImage.url;
  if (p?.primaryImageUrl) return p.primaryImageUrl;
  if (p?.imageUrl) return p.imageUrl;
  if (p?.coverUrl) return p.coverUrl;

  if (Array.isArray(p?.images) && p.images.length) {
    const prim = p.images.find((i: any) => i?.primary || i?.isPrimary);
    if (prim?.url) return prim.url;
    const active = p.images.find((i: any) => i?.active && i?.url);
    if (active?.url) return active.url;
    if (p.images[0]?.url) return p.images[0].url;
  }
  return null;
}

/* ---------------------- Loader ---------------------- */
function Loader(){
  return (
    <div className="loading">
      <div className="bar"/>
    </div>
  );
}

/* ---------------------- Styles ---------------------- */
const css = `
.prod-wrap{ color:${PRIMARY}; }
.bar{
  display:flex; align-items:end; justify-content:space-between; gap:12px;
  margin-bottom:12px; padding: 10px 12px; border:1px solid ${INK}; border-radius:16px; background:#fff;
  box-shadow:0 16px 48px rgba(0,0,0,.08);
}
.bar h2{ margin:0; font-family:"DM Serif Display", Georgia, serif; }
.bar p{ margin:6px 0 0; opacity:.9; }
.bar-right{ display:flex; gap:10px; align-items:center; }
/* search (admin list header) */
.search{
  position:relative;
  display:flex; align-items:center; gap:8px;
  width: 320px;
}
.search input{
  width:100%; height:38px;
  border:1px solid rgba(0,0,0,.08);
  border-radius:12px; padding:0 36px 0 12px;
  outline:none; background:#fff;
}
.search svg{
  position:absolute; right:10px; top:50%;
  transform: translateY(-50%);
  opacity:.7; pointer-events:none;
}

.btn {
  border: none;
  background: ${ACCENT};
  color: #fff;
  box-shadow: 0 10px 24px rgba(240,93,139,.30);
  height:38px; padding:0 14px; border-radius:12px; cursor:pointer;
}
.btn:hover { transform: translateY(-1px); box-shadow:0 12px 28px rgba(240,93,139,.36); }
.ghost{
  height:34px; padding:0 12px; border:1px solid ${INK}; background:#fff; border-radius:10px; cursor:pointer;
}
.ghost.bad{ color:#8a0024; border-color: rgba(240,93,139,.3); }
.ghost.small{ height:28px; padding:0 8px; font-size:12px; }
.link{
  background:transparent; border:none; color:${PRIMARY}; text-decoration:underline; font-weight:800;
  padding:4px 0; cursor:pointer; width:max-content;
}
.alert.bad{ margin:10px 0; padding:10px; border-radius:12px; background:#fff3f5; border:1px solid rgba(240,93,139,.25); color:#a10039; }

/* table */
.card{
  border:1px solid ${INK}; border-radius:16px; background:#fff;
  box-shadow:0 18px 60px rgba(0,0,0,.10); overflow:hidden;
}
.grid{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  table-layout: fixed;
}
.grid thead th{
  position: sticky; top:0; z-index: 1;
  text-align:left;
  padding:14px 16px;
  font-size:12px; letter-spacing:.2px;
  opacity:.9;
  background:linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.92));
  backdrop-filter: blur(2px);
  border-bottom:1px solid ${INK};
}
.grid tbody td{
  padding:14px 16px;
  border-top:1px solid ${INK};
  vertical-align: middle;
}
.grid tbody tr:hover{ background: rgba(246,195,32,.06); }
.strong{ font-weight:800; }
.muted{ opacity:.8; }
.pill{ display:inline-flex; align-items:center; height:24px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:800; }
.pill.ok{ background: rgba(155,180,114,.2); color:#2f4b12; }
.pill.off{ background: rgba(0,0,0,.08); }

/* actions – make buttons feel balanced */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.actions .ghost{ height:32px; padding:0 10px; border-radius:10px; }
.actions .ghost.bad{ color:#8a0024; border-color: rgba(240,93,139,.3); }

/* pager */
.pager{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; }
.pager select{ height:34px; border-radius:10px; border:1px solid ${INK}; }
.pager .left{ font-size:12px; opacity:.85; }

/* modal */
.modal-wrap{
  position: fixed; inset:0; z-index: 100;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,.28); backdrop-filter: blur(2px);
  padding: 16px;
  overflow: auto;
}
.modal{
  width: 820px; max-width: calc(100vw - 24px);
  max-height: calc(100vh - 32px);
  display: flex; flex-direction: column;
  border:1px solid rgba(0,0,0,.08); border-radius:16px; background:#fff;
  box-shadow:0 24px 80px rgba(0,0,0,.22);
}
.modal-bd{
  padding:12px;
  overflow: auto;
  flex: 1 1 auto;
}

.modal-hd{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid ${INK}; }
.modal-hd .title{ font-weight:900; }
.modal-hd .x{ background:transparent; border:none; font-size:26px; line-height:1; cursor:pointer; }
.tabs{ display:flex; gap:6px; padding:10px 12px; border-bottom:1px solid ${INK}; background: linear-gradient(180deg, rgba(246,195,32,.10), rgba(255,255,255,.85)); }
.tab{ height:30px; padding:0 12px; border-radius:999px; border:1px solid transparent; background:#fff; font-weight:800; }
.tab.active{ background: ${GOLD}; border-color: transparent; }
.tab.disabled{ opacity:.55; cursor:not-allowed; }

.form{ display:grid; gap:12px; }
.form label{ display:grid; gap:6px; }
.form input, .form textarea{
  height:38px; padding: 8px 10px; border-radius:10px; border:1px solid ${INK}; outline:none; resize:vertical;
}
.form textarea{ height:auto; }
.form .check{ display:flex; align-items:center; gap:8px; }
.form small.muted{ opacity:.75; }
.modal-ft{ padding:10px 12px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid ${INK}; }

/* images */
.imgbar{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding: 6px 8px; border:1px dashed ${INK}; border-radius:12px; background:#fff; }
.imgbar .count{ font-weight:900; }
.imgbar .hint{ font-size:12px; opacity:.75; }
.upload{ position:relative; display:inline-flex; align-items:center; justify-content:center; height:34px; padding:0 12px; border-radius:10px; background:${ACCENT}; color:#fff; font-weight:900; cursor:pointer; box-shadow:0 12px 26px rgba(240,93,139,.3); }
.upload input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.upload.disabled{ opacity:.5; pointer-events:none; }
.gallery{ display:grid; grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); gap:10px; margin-top:12px; }
.tile{ border:1px solid ${INK}; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 10px 28px rgba(0,0,0,.08); }
.thumb{ height:160px; background:#f7f7f7; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.tile .row{ display:flex; gap:6px; padding:8px; justify-content:center; }
.tile .meta{ display:flex; align-items:center; gap:6px; padding:8px; border-top:1px solid ${INK}; justify-content:center; }
.empty{ text-align:center; padding:18px; opacity:.8; }

/* options */
.optwrap{ border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:10px; background:#fff; margin-bottom:12px; }
.optcard{ border:1px solid rgba(0,0,0,.08); border-radius:12px; padding:10px; background:#fff; box-shadow:0 12px 32px rgba(0,0,0,.06); }
.stack{ display:grid; gap:12px; margin-top:12px; }
.row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.row-actions{ display:flex; gap:8px; }
.split{ display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:10px; }
.inset{ border-top:1px dashed rgba(0,0,0,.08); margin-top:8px; padding-top:10px; }
.title{ font-weight:900; }
.micro{ font-size:12px; opacity:.75; }
.tag{ display:inline-flex; align-items:center; height:22px; padding:0 8px; border-radius:999px; font-size:11px; font-weight:900; margin-left:6px; background:rgba(0,0,0,.06); }
.tag.off{ background: rgba(0,0,0,.08); }
.tag.gold{ background: rgba(246,195,32,.25); }
.values{ margin-top:10px; }
.table-like{ display:grid; gap:6px; }
.table-like .thead, .table-like .trow{
  display:grid; grid-template-columns: 1.4fr .9fr .7fr .5fr .7fr .7fr; gap:8px; align-items:center;
}
.table-like .thead{ font-size:12px; opacity:.8; }
.table-like .trow input, .table-like .trow select{
  height:34px; border:1px solid rgba(0,0,0,.08); border-radius:8px; padding:0 8px;
}
.table-like .right{ display:flex; justify-content:flex-end; }

.split{ grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); }
.modal .table-like{ overflow: auto; }
.modal .table-like .thead, .modal .table-like .trow{
  grid-template-columns:
    minmax(160px, 1.2fr)
    minmax(110px, 0.9fr)
    minmax(110px, 0.8fr)
    minmax(80px, 0.5fr)
    minmax(110px, 0.7fr)
    minmax(90px, 0.6fr);
  min-width: 720px;
}
.table-like .trow input,
.table-like .trow select{
  width: 100%;
  box-sizing: border-box;
}

/* optional: keep footer visible while scrolling */
.modal-ft{
  position: sticky;
  bottom: 0;
  background:#fff;
}

/* loader */
.loading{ padding: 26px; text-align:center; }
.loading .bar{
  height:8px; border-radius:999px; background: linear-gradient(90deg,#eee,#f8f8f8,#eee);
  background-size: 200% 100%; animation: wave 1.2s linear infinite;
}
/* ---- Products list polish ---- */
.plist{ display:grid; gap:10px; }

.plist .item{
  display:grid;
  grid-template-columns: 96px 1fr auto;
  align-items:center; gap:12px;
  padding:10px 12px;
  border:1px solid rgba(0,0,0,.08);
  border-radius:14px; background:#fff;
  min-height:104px;
  box-shadow:0 10px 26px rgba(0,0,0,.06);
}

.plist .thumb{
  width:96px; height:96px;
  border-radius:12px; overflow:hidden;
  background:#f6f6f1;
  display:flex; align-items:center; justify-content:center;
}
.plist .thumb img{ width:100%; height:100%; object-fit:cover; display:block; }

.plist .meta .name{ font-weight:900; line-height:1.2; }
.plist .meta .muted{ font-size:12px; opacity:.75; margin-top:2px; }

.plist .actions{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

.ghost.small, .btn.small, .ghost.sm, .btn.sm {
  padding: 6px 10px;
  min-height: 28px;
  font-size: 12.5px;
  border-radius: 8px;
}
.ghost{ border:1px solid rgba(0,0,0,.12); background:#fff; }
.ghost:hover { background:#fafafa; }
.ghost.bad { color:#8a0024; border-color: rgba(240,93,139,.3); }

@keyframes wave{ 0%{background-position: 200% 0} 100%{background-position:-200% 0} }

/* toast */
.toast{
  position: fixed; right: 16px; bottom: 16px; padding: 10px 12px; border-radius:12px;
  color:#fff; animation: slide 2.6s ease forwards;
}
.toast.ok{ background: ${ACCENT}; box-shadow: 0 12px 30px rgba(240,93,139,.4); }
.toast.bad{ background: #8a0024; box-shadow: 0 12px 30px rgba(138,0,36,.35); }
@keyframes slide{
  0%{ transform: translateY(20px); opacity:0; }
  10%{ transform: translateY(0); opacity:1; }
  80%{ transform: translateY(0); opacity:1; }
  100%{ transform: translateY(10px); opacity:0; }
}

/* make modal toast live inside modal */
.toast.in-modal{
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 101; /* higher than .modal-wrap (100) */
}
`;
