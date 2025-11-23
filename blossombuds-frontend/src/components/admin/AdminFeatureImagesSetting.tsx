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
      try { cropperRef.current.destroy(); } catch {}
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
    const c = cropperRef.current;
    if (!c) return;

    try {
      setBusy(true);

      const canvas = c.getCroppedCanvas({
        width: 1920,
        height: 1080,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high",
      });

      // 1) Convert to Blob
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

      // 2) Build form data
      const base = (originalName.replace(/\.[^.]+$/, "") || "image") + "_16x9";
      const fname = `${base}.jpg`;

      const fd = new FormData();
      fd.append("file", new File([blob], fname, { type: "image/jpeg" }));
      fd.append("altText", "");
      fd.append("sortOrder", String(items.length));

      // DO NOT set Content-Type manually (axios sets boundary)
      const { data } = await adminHttp.post<FeatureImage>(
        "/api/settings/admin/feature-images",
        fd
      );

      setItems((prev) => [...prev, data].sort(cmp));
      bumpToast("Uploaded");
      closeCropper();
    } catch (err: any) {
      console.error("Crop & upload failed:", err);
      bumpToast(err?.response?.data?.message || err?.message || "Upload failed");
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
        <h3>Home Carousel Images</h3>
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
.acis{ border:1px solid ${INK}; border-radius:12px; padding:12px; background:#fff; }
.head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.actions{ display:flex; gap:8px; }

.pick{ border:1px dashed ${INK}; border-radius:10px; padding:6px 10px; cursor:pointer; background:#fafafa; }
.pick input{ display:none; }
.pick.disabled{ opacity:.6; cursor:default; }

.ghost{ height:32px; padding:0 10px; border-radius:8px; border:1px solid ${INK}; background:#fff; cursor:pointer; }
.ghost.bad{ border-color:#e57373; color:#b00020; }

.list{ list-style:none; display:grid; gap:10px; padding:0; margin:0; }
.row{ display:grid; grid-template-columns: 200px 1fr; gap:10px; align-items:center; border:1px solid ${INK}; border-radius:10px; padding:8px; }
.row img{ width:200px; height:112px; object-fit:cover; border-radius:8px; }
.meta{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.path{ font-size:12px; opacity:.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.controls{ display:flex; gap:6px; }

.empty{ padding:16px; opacity:.8; }
.toast{ position:fixed; right:14px; bottom:14px; background:#333; color:#fff; padding:8px 10px; border-radius:8px; }

/* -------- Cropper modal -------- */
.cropper-veil{ position:fixed; inset:0; z-index:100; background: rgba(0,0,0,.45); display:grid; place-items:center; padding:16px; backdrop-filter: blur(2px); }
.cropper{
  width: 980px; max-width: calc(100vw - 24px);
  border:1px solid rgba(0,0,0,.12); border-radius:16px; background:#fff;
  box-shadow:0 24px 80px rgba(0,0,0,.28);
  display:flex; flex-direction:column; max-height: calc(100vh - 32px); overflow:hidden;
}
.crop-hd{
  display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
  background: linear-gradient(180deg, rgba(246,195,32,.12), rgba(255,255,255,.9));
  border-bottom:1px solid rgba(0,0,0,.1);
}
.crop-hd .title{ display:flex; align-items:center; gap:10px; }
.crop-hd .title .dot{ width:8px; height:8px; border-radius:999px; background:#F05D8B; box-shadow:0 0 0 4px rgba(240,93,139,.18); }
.crop-hd .hint{ font-size:12px; opacity:.75; }
.x{ background:transparent; border:none; font-size:26px; line-height:1; cursor:pointer; }

.toolbar{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:10px 14px; border-bottom:1px solid rgba(0,0,0,.08);
  background:linear-gradient(180deg, #fff, rgba(255,255,255,.92));
  flex-wrap:wrap;
}
.group{ display:flex; align-items:center; gap:8px; }
.btn-icon{
  height:34px; min-width:34px; padding:0 10px; border-radius:10px; border:1px solid ${INK};
  background:#fff; cursor:pointer; font-weight:900;
}
.btn-chip{
  height:34px; padding:0 12px; border-radius:999px; border:1px solid ${INK}; background:#fff; font-weight:800; cursor:pointer;
}
.group.range{ margin-left:auto; gap:10px; }
.group.range input[type="range"]{
  width:180px; appearance:none; height:4px; border-radius:999px; background:#e9e9e9; outline:none;
}
.group.range input[type="range"]::-webkit-slider-thumb{
  appearance:none; width:14px; height:14px; border-radius:50%; background:#F05D8B; border:none;
}
.zoom-label{ font-size:12px; opacity:.8; min-width: 44px; text-align:right; }

/* Body */
.crop-bd{ padding:12px 14px; overflow:auto; display:grid; gap:10px; }
.stage{
  position:relative; width:100%; max-width: 940px;
  aspect-ratio: 16 / 9; border-radius:14px; overflow:hidden;
  background: #f6f6f6; border:1px solid rgba(0,0,0,.08);
}
.stage img{ display:block; width:100%; height:100%; object-fit:contain; }

/* Make sure cropper fills stage without layout thrash */
.stage .cropper-container,
.stage .cropper-wrap-box,
.stage .cropper-canvas,
.stage .cropper-crop-box{
  width:100% !important; height:100% !important;
}

/* Footer */
.crop-ft{
  padding:12px 14px; border-top:1px solid rgba(0,0,0,.1);
  display:flex; justify-content:flex-end; gap:10px; background:#fff; position:sticky; bottom:0;
}
.btn{
  border:none; background:#F05D8B; color:#fff; height:36px; padding:0 16px; border-radius:12px; cursor:pointer;
  box-shadow: 0 12px 28px rgba(240,93,139,.3);
}
.btn:hover{ transform: translateY(-1px); box-shadow: 0 14px 32px rgba(240,93,139,.36); }

@media (max-width: 720px){
  .toolbar{ gap:6px; }
  .group.range input[type="range"]{ width:140px; }
}
`;
