// src/components/admin/AdminFeatureImagesSetting.tsx
import React, { useEffect, useRef, useState } from "react";
import "cropperjs/dist/cropper.css";
import Cropper from "cropperjs";




import adminHttp from "../../api/adminHttp";
import {
  listFeatureImagesPublic,
  reorderFeatureImages,
  deleteFeatureImage,
  type FeatureImage,
} from "../../api/featureImages";

const INK = "rgba(0,0,0,.1)";

export default function AdminFeatureImagesSetting() {
  const [items, setItems] = useState<FeatureImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Cropper modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("image");

  // DOM / Cropper refs
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);

  // Zoom slider state
  const [zoomPct, setZoomPct] = useState(100);     // 100% == “cover” baseline
  const coverScaleRef = useRef(1);                 // computed on ready()
  const isReadyRef = useRef(false);                // blocks handlers until ready

  useEffect(() => {
    (async () => {
      try {
        const list = await listFeatureImagesPublic();
        setItems((list || []).sort(cmp));
      } catch {
        // leave empty
      }
    })();
  }, []);

  function bumpToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  }

  function cmp(a: FeatureImage, b: FeatureImage) {
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!f) return;

    try {
      const name = f.name || "image";
      setOriginalName(name);

      // Just use the original file — no HEIC conversion
      const blob: Blob = f;

      if (cropSrc) URL.revokeObjectURL(cropSrc);
      const url = URL.createObjectURL(blob);

      // Show modal; Cropper is created after <img> onLoad
      setCropSrc(url);
      isReadyRef.current = false;
      setZoomPct(100);
    } catch (err: any) {
      bumpToast(err?.message || "Could not open image for cropping");
    }
  }

  async function removeOne(key: string) {
    if (!confirm("Remove this image?")) return;
    setBusy(true);
    try {
      await deleteFeatureImage(key, true); // delete R2 object too
      setItems((prev) =>
        prev.filter((i) => i.key !== key).map((it, i) => ({ ...it, sortOrder: i }))
      );
      bumpToast("Removed");
    } catch (e: any) {
      bumpToast(e?.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function destroyCropper() {
    if (cropperRef.current) {
      try { cropperRef.current.destroy(); } catch { }
      cropperRef.current = null;
    }
  }

  function initCropper() {
    const el = imgRef.current;
    if (!el) return;

    destroyCropper();

    cropperRef.current = new Cropper(el, {
      aspectRatio: 16 / 9,
      viewMode: 2,
      dragMode: "move",
      autoCropArea: 1,
      background: false,
      movable: true,
      zoomable: true,
      zoomOnWheel: true,
      zoomOnTouch: true,
      wheelZoomRatio: 0.08,
      scalable: false,
      rotatable: true,
      responsive: true,
      checkOrientation: true,
      cropBoxMovable: false,   // stage is fixed; user pans the image
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      guides: false,
      center: true,
      highlight: false,
      minContainerWidth: 760,
      minContainerHeight: 420,

      ready: () => {
        try {
          const c = cropperRef.current!;
          const container = c.getContainerData();
          const img = c.getImageData();
          if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

          // compute “cover” baseline (fill stage entirely)
          const cover = Math.max(
            container.width / img.naturalWidth,
            container.height / img.naturalHeight
          );
          coverScaleRef.current = cover;

          // apply cover and lock crop box to full stage
          c.zoomTo(cover, { x: container.width / 2, y: container.height / 2 });
          c.setCropBoxData({
            left: 0,
            top: 0,
            width: container.width,
            height: container.height,
          });

          // slider reflects baseline
          setZoomPct(100);
          isReadyRef.current = true;
        } catch {
          // ignore
        }
      },

      // IMPORTANT: do not call setState() here; it causes flicker while Cropper animates
      zoom: () => {
        // no-op; we read the value lazily when needed
      },
    });
  }

  function onImgLoad() {
    // Initialize cropper only after pixels are ready → no flicker
    initCropper();
  }

  function coverFit() {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    const container = c.getContainerData();
    const img = c.getImageData();
    if (!container || !img) return;

    const cover = Math.max(
      container.width / img.naturalWidth,
      container.height / img.naturalHeight
    );
    coverScaleRef.current = cover;
    c.zoomTo(cover, { x: container.width / 2, y: container.height / 2 });
    c.setCropBoxData({ left: 0, top: 0, width: container.width, height: container.height });
    setZoomPct(100);
  }

  function fitWithin() {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    const container = c.getContainerData();
    const img = c.getImageData();
    if (!container || !img) return;

    const fit = Math.min(
      container.width / img.naturalWidth,
      container.height / img.naturalHeight
    );
    c.zoomTo(fit, { x: container.width / 2, y: container.height / 2 });
    c.setCropBoxData({ left: 0, top: 0, width: container.width, height: container.height });

    // express fit relative to cover baseline
    const pct = Math.round(Math.max(1, (fit / coverScaleRef.current) * 100));
    setZoomPct(pct);
  }

  function resetAll() {
    const c = cropperRef.current;
    if (!c) return;
    c.reset();
    // reapply cover after reset to keep full-stage framing
    requestAnimationFrame(() => coverFit());
  }

  function rotate(delta: number) {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    c.rotate(delta);
    // after rotation, container/img metrics change; re-normalize cover baseline
    requestAnimationFrame(() => coverFit());
  }

  function zoomBy(delta: number) {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    c.zoom(delta);
    // don’t set state here; avoid flicker. Update slider lazily:
    requestAnimationFrame(syncSliderFromCropper);
  }

  function syncSliderFromCropper() {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    const img = c.getImageData();
    const canvas = c.getCanvasData();
    if (!img || !canvas || !img.naturalWidth) return;
    const currentScale = canvas.width / img.naturalWidth;
    const pct = Math.max(1, Math.round((currentScale / coverScaleRef.current) * 100));
    setZoomPct(pct);
  }

  function onZoomSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const c = cropperRef.current;
    if (!c || !isReadyRef.current) return;
    const pct = Number(e.target.value);              // 50..300
    setZoomPct(pct);
    const targetScale = coverScaleRef.current * (pct / 100);
    const container = c.getContainerData();
    c.zoomTo(targetScale, { x: container.width / 2, y: container.height / 2 });
  }

  useEffect(() => {
    if (!cropSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (!cropperRef.current) return;
      if (e.key === "ArrowLeft") { cropperRef.current.move(-10, 0); e.preventDefault(); }
      if (e.key === "ArrowRight") { cropperRef.current.move(10, 0); e.preventDefault(); }
      if (e.key === "ArrowUp") { cropperRef.current.move(0, -10); e.preventDefault(); }
      if (e.key === "ArrowDown") { cropperRef.current.move(0, 10); e.preventDefault(); }
      if (e.key === "r") { rotate(90); e.preventDefault(); }
      if (e.key === "R") { rotate(-90); e.preventDefault(); }
      if (e.key === "Escape") { closeCropper(); }
      if (e.key === "Enter") { doCropAndUpload(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropSrc]);

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const arr = [...prev];
      const j = index + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return arr.map((it, k) => ({ ...it, sortOrder: k }));
    });
  }

  async function saveOrder() {
    setBusy(true);
    try {
      const orderedKeys = items.map((i) => i.key);
      await reorderFeatureImages(orderedKeys); // your new endpoint
      bumpToast("Saved");
    } catch (e: any) {
      bumpToast(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function doCropAndUpload() {
    if (!cropperRef.current) return;

    setBusy(true);
    try {
      const canvas = cropperRef.current.getCroppedCanvas({
        width: 1920,
        height: 1080,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      // 1) Wrap toBlob in a Promise properly
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Could not create image blob"));
            } else {
              resolve(b);
            }
          },
          "image/jpeg",
          0.92
        );
      });

      // 2) Build FormData
      const base = (originalName.replace(/\.[^.]+$/, "") || "image") + "_16x9";
      const fname = `${base}.jpg`;

      const fd = new FormData();
      fd.append("file", new File([blob], fname, { type: "image/jpeg" }));
      fd.append("altText", "");
      fd.append("sortOrder", String(items.length));

      // 3) Call backend
      const { data } = await adminHttp.post<FeatureImage>(
        "/api/settings/admin/feature-images",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      // 4) Update list + close
      setItems((prev) => [...prev, data].sort(cmp));
      bumpToast("Uploaded");
      closeCropper();
    } catch (err: any) {
      console.error("Crop & Upload failed", err);
      bumpToast(
        err?.response?.data?.message ||
        err?.message ||
        "Upload failed"
      );
    } finally {
      setBusy(false);
    }
  }




  function closeCropper() {
    destroyCropper();
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setOriginalName("image");
    isReadyRef.current = false;
    setZoomPct(100);
  }

  return (
    <section className="acis">
      <style>{css}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="head">
        <h3><span style={{ fontSize: "24px", color: "initial", marginRight: "12px", WebkitTextFillColor: "initial" }}>🖼️</span> Home Carousel Images</h3>
        <div className="actions">
          <label className={`pick ${busy ? "disabled" : ""}`}>
            <input
              type="file"
              accept="image/*"
              onChange={onPick}
              disabled={busy}
            />

            + Upload
          </label>
          <button className="ghost" onClick={saveOrder} disabled={busy}>
            Save order
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">No images yet.</div>
      ) : (
        <ul className="list">
          {items.sort(cmp).map((it, idx) => (
            <li key={it.key} className="row">
              <img src={it.url} alt={it.altText || ""} />
              <div className="meta">
                <div className="path">{it.key}</div>
                <div className="controls">
                  <button className="ghost" onClick={() => move(idx, -1)} disabled={idx === 0 || busy}>↑</button>
                  <button className="ghost" onClick={() => move(idx, +1)} disabled={idx === items.length - 1 || busy}>↓</button>
                  <button className="ghost bad" onClick={() => removeOne(it.key)} disabled={busy}>Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Cropper modal */}
      {cropSrc && (
        <div className="cropper-veil" role="dialog" aria-modal="true">
          <div className="cropper">
            <div className="crop-hd">
              <div className="title">
                <span className="dot" /> <strong>Crop to 16:9</strong>
                <span className="hint">Drag to pan • Scroll to zoom • Enter to save</span>
              </div>
              <button className="x" onClick={closeCropper} aria-label="Close">×</button>
            </div>

            <div className="toolbar">
              <div className="group">
                <button className="btn-icon" title="Zoom out" onClick={() => zoomBy(-0.1)}>−</button>
                <button className="btn-icon" title="Zoom in" onClick={() => zoomBy(+0.1)}>+</button>
              </div>
              <div className="group">
                <button className="btn-icon" title="Rotate -90°" onClick={() => rotate(-90)}>⟲</button>
                <button className="btn-icon" title="Rotate +90°" onClick={() => rotate(90)}>⟳</button>
              </div>
              <div className="group">
                <button className="btn-chip" onClick={coverFit} title="Scale to Cover">Cover</button>
                <button className="btn-chip" onClick={fitWithin} title="Scale to Fit">Fit</button>
                <button className="btn-chip" onClick={resetAll} title="Reset">Reset</button>
              </div>
              <div className="group range">
                <label aria-label="Zoom">
                  <input
                    type="range"
                    min={50}
                    max={300}
                    step={1}
                    value={zoomPct}
                    onChange={onZoomSliderChange}
                  />
                </label>
                <span className="zoom-label">{zoomPct}%</span>
              </div>
            </div>

            <div className="crop-bd">
              <div className="stage">
                {/* Cropper is created only after this image fully loads -> no flicker */}
                <img ref={imgRef} src={cropSrc} alt="to-crop" onLoad={onImgLoad} />
              </div>
            </div>

            <div className="crop-ft">
              <button className="ghost" onClick={closeCropper} type="button">Cancel</button>
              <button className="btn" onClick={doCropAndUpload} type="button" disabled={!isReadyRef.current || busy}>
                Crop & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* -------- Styles -------- */
const css = `
.acis{
  border:1px solid rgba(0,0,0,.08); border-radius:20px; padding:0;
  background:#fff; margin-bottom:24px;
  box-shadow:0 8px 32px rgba(0,0,0,.06);
  overflow:hidden;
}

/* ─────────────── HEADER ─────────────── */
.head{
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 24px; 
  background:linear-gradient(180deg, rgba(246,195,32,.08), #fff);
  border-bottom:1px solid rgba(0,0,0,.08);
  position:relative;
}
.head::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, #F05D8B, #F6C320, #4BE0B0);
}
.head h3{
  margin:0; font-size:20px; font-weight:900; letter-spacing:.3px;
  background:linear-gradient(135deg, #F05D8B, #F6C320);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
  display:flex; align-items:center;
}
.actions{ display:flex; gap:10px; }

/* ─────────────── UPLOAD BUTTON ─────────────── */
.pick{
  display:inline-flex; align-items:center; gap:6px;
  border:2px dashed rgba(240,93,139,.3); border-radius:14px;
  padding:10px 18px; cursor:pointer;
  background:linear-gradient(135deg, rgba(240,93,139,.05), rgba(246,195,32,.05));
  font-weight:700; font-size:14px; color:#2B2E2A;
  transition: all .15s ease;
}
.pick:hover{
  border-color:#F05D8B;
  background:linear-gradient(135deg, rgba(240,93,139,.10), rgba(246,195,32,.10));
  transform:translateY(-1px);
  box-shadow:0 6px 20px rgba(240,93,139,.15);
}
.pick input{ display:none; }
.pick.disabled{ opacity:.6; cursor:default; transform:none; }

/* ─────────────── BUTTONS ─────────────── */
.ghost{
  height:36px; padding:0 14px; border-radius:12px;
  border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer;
  font-size:13px; font-weight:600;
  transition: all .15s ease;
}
.ghost:hover{
  background:#fafafa;
  border-color:rgba(0,0,0,.15);
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.08);
}
.ghost.bad{
  border-color:rgba(240,93,139,.3); color:#8E1743;
}
.ghost.bad:hover{
  background:rgba(240,93,139,.06);
  border-color:#F05D8B;
}

/* ─────────────── IMAGE LIST ─────────────── */
.list{
  list-style:none; display:grid; gap:12px;
  padding:20px; margin:0;
}
.row{
  display:grid; grid-template-columns:220px 1fr;
  gap:16px; align-items:center;
  border:1px solid rgba(0,0,0,.08); border-radius:16px;
  padding:12px; background:#fff;
  transition: all .15s ease;
}
.row:hover{
  border-color:rgba(240,93,139,.2);
  background:linear-gradient(90deg, rgba(240,93,139,.02), rgba(246,195,32,.02));
  transform:translateX(4px);
  box-shadow:0 6px 20px rgba(0,0,0,.06);
}
.row img{
  width:220px; height:124px; object-fit:cover;
  border-radius:12px;
  box-shadow:0 4px 16px rgba(0,0,0,.10);
}
.meta{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex:1;
}
.path{
  font-size:13px; font-weight:600; opacity:.7;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  flex:1;
}
.controls{ display:flex; gap:8px; }

/* ─────────────── EMPTY STATE ─────────────── */
.empty{
  padding:48px 24px; text-align:center;
  font-size:16px; opacity:.6; font-weight:600;
}

/* ─────────────── TOAST ─────────────── */
.toast{
  position:fixed; right:20px; bottom:20px;
  background:linear-gradient(135deg, #0f5132, #1a7d4e);
  color:#fff; padding:14px 20px; border-radius:14px;
  z-index:9999; font-weight:600;
  box-shadow:0 8px 32px rgba(0,0,0,.25);
  animation: slideIn 2s forwards ease;
}
@keyframes slideIn {
  0%{ transform:translateX(120%); opacity:0; }
  8%{ transform:translateX(0); opacity:1; }
  85%{ transform:translateX(0); opacity:1; }
  100%{ transform:translateX(120%); opacity:0; }
}

/* ─────────────── CROPPER MODAL ─────────────── */
.cropper-veil{
  position:fixed; inset:0; z-index:100;
  background: rgba(0,0,0,.55);
  display:grid; place-items:center;
  padding:16px;
  backdrop-filter: blur(4px);
}
.cropper{
  width: 1000px; max-width: calc(100vw - 32px);
  border:none; border-radius:24px; background:#fff;
  box-shadow:0 32px 100px rgba(0,0,0,.40);
  display:flex; flex-direction:column;
  max-height: calc(100vh - 48px); overflow:hidden;
  animation: modalPop .18s ease-out;
}
@keyframes modalPop {
  from{ transform:scale(.96) translateY(10px); opacity:0; }
  to{ transform:scale(1) translateY(0); opacity:1; }
}

.crop-hd{
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px;
  background: linear-gradient(180deg, rgba(246,195,32,.10), #fff);
  border-bottom:1px solid rgba(0,0,0,.08);
  position:relative;
}
.crop-hd::after{
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, #F05D8B, #F6C320, #4BE0B0);
}
.crop-hd .title{
  display:flex; align-items:center; gap:12px;
}
.crop-hd .title .dot{
  width:10px; height:10px; border-radius:999px;
  background:#F05D8B;
  box-shadow:0 0 0 5px rgba(240,93,139,.18);
}
.crop-hd strong{
  font-size:18px;
}
.crop-hd .hint{
  font-size:12px; opacity:.65; font-weight:500;
}
.x{
  background:rgba(0,0,0,.06); border:none; width:36px; height:36px;
  border-radius:12px; font-size:22px; line-height:1; cursor:pointer;
  display:grid; place-items:center;
  transition: all .12s ease;
}
.x:hover{ background:rgba(0,0,0,.10); transform:scale(1.05); }

/* ─────────────── TOOLBAR ─────────────── */
.toolbar{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 20px; border-bottom:1px solid rgba(0,0,0,.06);
  background:#fafafa;
  flex-wrap:wrap;
}
.group{ display:flex; align-items:center; gap:8px; }
.btn-icon{
  height:38px; min-width:38px; padding:0 12px; border-radius:12px;
  border:1px solid rgba(0,0,0,.1);
  background:#fff; cursor:pointer; font-weight:900; font-size:18px;
  transition: all .12s ease;
}
.btn-icon:hover{
  background:#f5f5f5;
  border-color:rgba(0,0,0,.15);
  transform:translateY(-1px);
}
.btn-chip{
  height:34px; padding:0 14px; border-radius:999px;
  border:1px solid rgba(0,0,0,.1); background:#fff;
  font-weight:700; font-size:13px; cursor:pointer;
  transition: all .12s ease;
}
.btn-chip:hover{
  background:linear-gradient(135deg, rgba(240,93,139,.08), rgba(246,195,32,.08));
  border-color:rgba(240,93,139,.3);
}
.group.range{ margin-left:auto; gap:12px; }
.group.range input[type="range"]{
  width:180px; appearance:none; height:6px;
  border-radius:999px; background:rgba(0,0,0,.08); outline:none;
}
.group.range input[type="range"]::-webkit-slider-thumb{
  appearance:none; width:18px; height:18px; border-radius:50%;
  background:linear-gradient(135deg, #F05D8B, #E34B7C);
  border:none; cursor:pointer;
  box-shadow:0 2px 8px rgba(240,93,139,.3);
}
.zoom-label{
  font-size:13px; font-weight:700; opacity:.7;
  min-width: 48px; text-align:right;
}

/* ─────────────── CROPPER BODY ─────────────── */
.crop-bd{ padding:16px 20px; overflow:auto; display:grid; gap:12px; }
.stage{
  position:relative; width:100%; max-width: 960px;
  aspect-ratio: 16 / 9; border-radius:16px; overflow:hidden;
  background: linear-gradient(135deg, #f5f5f5, #ececec);
  border:1px solid rgba(0,0,0,.06);
  box-shadow:0 4px 20px rgba(0,0,0,.08);
}
.stage img{ display:block; width:100%; height:100%; object-fit:contain; }

/* Make sure cropper fills stage without layout thrash */
.stage .cropper-container,
.stage .cropper-wrap-box,
.stage .cropper-canvas,
.stage .cropper-crop-box{
  width:100% !important; height:100% !important;
}

/* ─────────────── CROPPER FOOTER ─────────────── */
.crop-ft{
  padding:16px 20px; border-top:1px solid rgba(0,0,0,.08);
  display:flex; justify-content:flex-end; gap:12px;
  background:#fafafa; position:sticky; bottom:0;
}
.btn{
  border:none;
  background:linear-gradient(135deg, #F05D8B, #E34B7C);
  color:#fff; height:42px; padding:0 24px; border-radius:14px;
  cursor:pointer; font-weight:800; font-size:14px;
  box-shadow: 0 10px 28px rgba(240,93,139,.30);
  transition: all .12s ease;
}
.btn:hover{
  transform: translateY(-2px);
  box-shadow: 0 14px 36px rgba(240,93,139,.40);
}
.btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; }

/* ─────────────── RESPONSIVE ─────────────── */
@media (max-width: 768px){
  .head{ flex-direction:column; align-items:stretch; gap:12px; }
  .actions{ justify-content:flex-start; }
  .row{ grid-template-columns:160px 1fr; }
  .row img{ width:160px; height:90px; }
  .toolbar{ gap:8px; }
  .group.range input[type="range"]{ width:120px; }
}
@media (max-width: 480px){
  .row{ grid-template-columns:1fr; }
  .row img{ width:100%; height:auto; aspect-ratio:16/9; }
  .meta{ flex-direction:column; align-items:flex-start; gap:8px; }
}
@media (prefers-reduced-motion: reduce){
  .cropper, .toast, .btn, .ghost, .row{ animation:none; transition:none; }
}
`;
