// src/components/profile/ReviewModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { submitReview as submitReviewApi } from "../../api/reviews";
import {
  presignReviewUpload,
  putToPresignedUrl,
  attachImageFromTempKey,
  deleteTempUpload,
} from "../../api/reviewUploads";

/* ---------------- 3s "thank you" popup (top-most layer) ---------------- */
// ⬇ drop-in replacement for showThankYouPopup()
function showThankYouPopup() {
  const host = document.createElement("div");
  host.setAttribute("data-rv-toast", "1");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    display: "grid",
    placeItems: "center",
    background: "transparent",
  } as CSSStyleDeclaration);

  const card = document.createElement("div");
  card.setAttribute("role", "alert");
  Object.assign(card.style, {
    pointerEvents: "auto",
    background: "#ffffff",                           // SOLID background
    border: "1px solid rgba(0,0,0,.10)",
    borderRadius: "16px",
    boxShadow: "0 28px 88px rgba(0,0,0,.28)",
    padding: "16px 18px",
    maxWidth: "92vw",
    minWidth: "min(460px, 92vw)",
    color: "#2b2b2b",
    font: "14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    transform: "translateY(8px) scale(.98)",
    opacity: "0",
    transition: "opacity .18s ease, transform .18s cubic-bezier(.2,.8,.2,1)",
    position: "relative",
    overflow: "hidden",
  } as CSSStyleDeclaration);

  // top accent bar (brand color)
  const bar = document.createElement("div");
  Object.assign(bar.style, {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "4px",
    background: "#F05D8B",
  } as CSSStyleDeclaration);
  card.appendChild(bar);

  const title = document.createElement("div");
  Object.assign(title.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontWeight: "900",
    marginBottom: "6px",
    letterSpacing: ".2px",
  } as CSSStyleDeclaration);
  title.innerHTML = `
    <span style="width:10px;height:10px;border-radius:999px;background:#F05D8B;box-shadow:0 0 0 6px rgba(240,93,139,.18);display:inline-block"></span>
    <span style="color:#4A4F41">Thank you for your review!</span>
  `;

  const msg = document.createElement("div");
  Object.assign(msg.style, { fontSize: "13px", opacity: ".9" } as CSSStyleDeclaration);
  msg.textContent = "We received your review! We might feature your review with your consent.❤️";

  const actions = document.createElement("div");
  Object.assign(actions.style, { marginTop: "10px", display: "flex", gap: "8px" } as CSSStyleDeclaration);

  const btn = document.createElement("button");
  btn.textContent = "Close";
  Object.assign(btn.style, {
    border: "none",
    background: "#F05D8B",
    color: "#fff",
    height: "34px",
    padding: "0 14px",
    fontWeight: "900",
    borderRadius: "12px",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(240,93,139,.30)",
  } as CSSStyleDeclaration);

  actions.appendChild(btn);
  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(actions);

  host.appendChild(card);
  document.body.appendChild(host);

  requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translateY(0) scale(1)";
  });

  const remove = () => {
    card.style.opacity = "0";
    card.style.transform = "translateY(8px) scale(.98)";
    setTimeout(() => { try { document.body.removeChild(host); } catch {} }, 180);
  };

  const t = setTimeout(remove, 3000);
  btn.addEventListener("click", () => { clearTimeout(t); remove(); }, { once: true });
  host.addEventListener("click", (e) => { if (e.target === host) { clearTimeout(t); remove(); } }, { once: true });
}


/* ---------------------------------------------------------------------- */

type Props = {
  open: boolean;
  onClose: (submitted?: boolean) => void;
  productId: number;
  productName?: string;
  customerId: number;
  orderId?: number;
  orderItemId?: number;
};

type QueueItem = {
  id: string;
  name: string;
  previewUrl: string; // data: URL or generic canvas preview
  isHeic: boolean;
  pct?: number;
  err?: string;
  tempKey?: string; // uploads/reviews/tmp/...
};

export default function ReviewModal({
  open,
  onClose,
  productId,
  productName,
  customerId,
  orderId,
  orderItemId,
}: Props) {
  const { token } = useAuth() as any;

  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [concern, setConcern] = useState<boolean>(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHover(0);
    setTitle("");
    setText("");
    setConcern(false);
    setQueue([]);
    setErr(null);
    setBusy(false);
    setUpBusy(false);
  }, [open]);

  // ⬇ NEW: robust page scroll lock to stop iOS "floating" / rubber-band
  useEffect(() => {
    if (!open) return;
    const { scrollY } = window;
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlTouch = (html.style as any).touchAction;
    const prevBody = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    html.style.overflow = "hidden";
    (html.style as any).touchAction = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      (html.style as any).touchAction = prevHtmlTouch || "";
      body.style.position = prevBody.position;
      body.style.top = prevBody.top;
      body.style.width = prevBody.width;
      body.style.overflow = prevBody.overflow;
      const y = Math.abs(parseInt(prevBody.top || "0", 10)) || scrollY;
      window.scrollTo(0, y);
    };
  }, [open]);

  // CHANGED: allow submit even if uploads are in progress; we will attach only ready tempKeys.
  const canSubmit = useMemo(() => rating >= 1 && rating <= 5 && !busy, [rating, busy]);
  const remainingChars = 1000 - (text?.length || 0);

  /* ----------------------- Preview helpers ----------------------- */
  function isHeic(file: File) {
    const n = (file.name || "").toLowerCase();
    return /image\/hei[cf]/i.test(file.type) || n.endsWith(".heic") || n.endsWith(".heif");
  }

  function drawGenericPreview(): string {
    const w = 360, h = 240;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f6f6f6"; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#e5e5e5";
    for (let x = -h; x < w + h; x += 18) ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = "#666";
    ctx.font = "bold 14px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Preview available after upload", w/2, h/2 - 6);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("(HEIC placeholder)", w/2, h/2 + 12);
    return c.toDataURL("image/png");
  }

  function placeholderPreview() {
    const c = document.createElement("canvas");
    c.width = 120; c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fafafa"; ctx.fillRect(0,0,120,80);
    ctx.fillStyle = "#ddd"; ctx.fillRect(10,10,100,60);
    return c.toDataURL("image/png");
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(fr.error || new Error("FileReader failed"));
      fr.readAsDataURL(file);
    });
  }

  async function removeQueued(id: string) {
    const qItem = queue.find((q) => q.id === id);
    if (qItem?.tempKey && token) {
      try { await deleteTempUpload(qItem.tempKey, token); } catch {}
    }
    setQueue((q) => q.filter((x) => x.id !== id));
  }

  /* ------------------------------ Upload flow ------------------------------ */
 async function onPickFiles(files: FileList | null, inputEl?: HTMLInputElement | null) {
   if (!files || !files.length) return;
   if (!token) {
     setErr("You need to be logged in to upload images.");
     return;
   }

   const MAX = 3;
   const remainingSlots = Math.max(0, MAX - queue.length);
   if (remainingSlots <= 0) {
     setErr("You already attached 3 images.");
     if (inputEl) inputEl.value = "";
     return;
   }

   const MAX_BYTES = 10 * 1024 * 1024;
   const EXT_OK = [
     ".jpg", ".jpeg", ".png", ".webp",
     ".tif", ".tiff",
     ".heic", ".heif",
     ".bmp", ".gif"
   ];

   // ---- PICK FILES WITH iOS STABILITY ----
   const picked = Array.from(files).slice(0, remainingSlots);

   // DEBUG (optional)
   console.log("Picked files:", picked.map(f => ({
     name: f.name,
     type: f.type,
     size: f.size,
     ext: f.name.split(".").pop(),
   })));


   const valid: File[] = [];
   const errors: string[] = [];

   // ---- VALIDATION FIXED FOR iPHONE ----
   for (const f of picked) {
     const name = f.name || "file";
     const lower = name.toLowerCase();

     const typeOk = f.type?.startsWith("image/") || false;
     const extOk = EXT_OK.some(ext => lower.endsWith(ext));

     if (!(typeOk || extOk)) {
       errors.push(`“${name}” is not a supported image format.`);
       continue;
     }

     if (f.size > MAX_BYTES) {
       errors.push(`“${name}” exceeds 10 MB.`);
       continue;
     }

     valid.push(f);
   }

   if (errors.length > 0) setErr(errors.join("\n"));

   if (!valid.length) {
     if (inputEl) inputEl.value = "";
     return;
   }

   // ---- OPTIMISTIC UI PREVIEW ----
   const optimistic: QueueItem[] = valid.map((f) => ({
     id: crypto.randomUUID(),
     name: f.name,
     previewUrl: placeholderPreview(),
     isHeic: isHeic(f),
     pct: 1
   }));

   setQueue((q) => [...q, ...optimistic]);
   setUpBusy(true);

   try {
     for (let i = 0; i < valid.length; i++) {
       const f = valid[i];
       const tempId = optimistic[i].id;

       // ---- GENERATE PREVIEW ----
       try {
         let previewUrl = "";
         if (!isHeic(f)) {
           try {
             previewUrl = await fileToDataUrl(f);
           } catch (e) {
             console.warn("Preview failed", e);
             previewUrl = "";
           }
         }


         setQueue((q) =>
           q.map((x) => (x.id === tempId ? { ...x, previewUrl } : x))
         );
       } catch (e) {
         console.warn("Preview failed:", e);
       }

       // ---- UPLOAD TO PRESIGNED URL ----
       try {
         const p = await presignReviewUpload(
           f.name,
           f.type || "application/octet-stream",
           token
         );

         setQueue((q) =>
           q.map((x) => (x.id === tempId ? { ...x, tempKey: p.key } : x))
         );

         await putToPresignedUrl(p.url, f, (pct) => {
           setQueue((q) =>
             q.map((x) => (x.id === tempId ? { ...x, pct } : x))
           );
         });

         setQueue((q) =>
           q.map((x) =>
             x.id === tempId ? { ...x, pct: 100 } : x
           )
         );
       } catch (e: any) {
         setQueue((q) =>
           q.map((x) =>
             x.id === tempId
               ? { ...x, err: e?.message || "Upload failed" }
               : x
           )
         );
       }
     }
   } finally {
     setUpBusy(false);
     if (inputEl) inputEl.value = "";
   }
 }


  /* ------------------------------ Submit flow ------------------------------ */
  async function submit() {
    if (!open) return;
    if (!canSubmit) { setErr("Please select a rating (1–5 stars)."); return; }
    if (!token) { setErr("You need to be logged in to submit a review."); return; }

    setErr(null);
    setBusy(true);
    try {
      // 1) Create the review
      const created = await submitReviewApi(
        {
          productId,
          customerId,
          orderId,
          orderItemId,
          rating,
          title: title?.trim() || undefined,
          content: text?.trim() || undefined,
          concern,
          images: [],
        },
        token
      );

      const reviewId = created?.id;
      if (!reviewId) throw new Error("Server did not return a review id.");

      // 2) Attach uploaded tempKeys — FIRE-AND-FORGET (do NOT await)
      // CHANGED: This makes submit return in ms.
      const attachables = queue.filter((q) => q.tempKey && !q.err).slice(0, 3);
      if (attachables.length > 0) {
        attachables.forEach((q) => {
          attachImageFromTempKey(reviewId, q.tempKey!, token).catch(() => {});
        });
      }

      // 3) Close immediately and show solid toast
      setQueue([]);
      onClose(true);
      showThankYouPopup();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Could not submit review. Please try again.";
      setErr(msg);
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div className="rv-veil" role="dialog" aria-modal="true">
      <style>{css}</style>
      <div className="rv-modal">
        <div className="rv-hd">
          <div className="rv-title">
            <span className="dot" />
            <strong>Leave a review</strong>
          </div>
          {/* ⬇ NEW: Close button in header */}
          <button className="rv-x" type="button" aria-label="Close" onClick={() => onClose(false)}>✕</button>
        </div>

        <div className="rv-body">
          <div className="row">
            <div className="label">Product</div>
            <div className="value">{productName || `#${productId}`}</div>
          </div>

          <div className="row">
            <div className="label">Rating</div>
            <div className="value">
              <div className="stars" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    filled={(hover || rating) >= n}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                  />
                ))}
                <span className="stars-hint">{rating ? `${rating}/5` : "Select"}</span>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="label">Title (optional)</div>
            <div className="value">
              <input
                className="in"
                placeholder="Short headline"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>

          <div className="row">
            <div className="label">Your review</div>
            <div className="value">
              <textarea
                className="ta"
                rows={6}
                placeholder="Share what you liked, quality, delivery experience, etc."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
              />
              <div className="char">{remainingChars} characters left</div>
            </div>
          </div>

          <div className="row">
            <div className="label">Can we feature your review in our website?</div>
            <div className="value">
              {/* ⬇ compact checkbox row */}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={concern}
                  onChange={(e) => setConcern(e.target.checked)}
                />
                <span>Yes, you can feature it</span>
              </label>
            </div>
          </div>

          <div className="row">
            <div className="label">Images (up to 3)</div>
            <div className="value">
              <div className="img-uploader">
                <button
                  className="upload-trigger"
                  type="button"
                  onClick={() => document.getElementById("rv-upload-input")?.click()}
                >
                  Upload
                </button>
                <input
                  id="rv-upload-input"
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    onPickFiles(e.target.files, e.target);
                    console.log("onPickFiles called with files:", files?.length);

                  }}

                />

              </div>


              <div className="imgs">
                {queue.map((q) => (
                  <div key={q.id} className="img-row">
                    <div className="thumb">
                      {q.previewUrl ? (
                        <>
                          <img loading="eager" decoding="async" src={q.previewUrl} alt={q.name} />
                          {q.isHeic && <span className="badge">HEIC</span>}
                        </>
                      ) : (
                        <div style={{ fontSize: "12px", textAlign: "center", padding: "6px" }}>
                          <strong>{q.name}</strong>
                          <div style={{ opacity: 0.6, marginTop: "4px" }}>Preview not available</div>
                        </div>
                      )}
                    </div>

                    <div className="meta">
                      <div className="name">{q.name}</div>
                      <div className="progress">
                        <div style={{ width: `${Math.min(q.pct || 1, 100)}%` }} />
                      </div>
                      <div className="row-actions">
                        {q.err ? <span className="err">⚠ {q.err}</span> : <span className="muted">{q.pct && q.pct >= 100 ? "Uploaded" : "Uploading…"}</span>}
                        <button className="ghost sm" type="button" onClick={() => removeQueued(q.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>


            </div>
          </div>

          {err && <div className="alert">{err}</div>}
        </div>

        <div className="rv-ft">
          <button className="btn ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </button>
          <button className="btn" onClick={submit} disabled={!canSubmit}>
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Star({
  filled,
  onMouseEnter,
  onClick,
}: {
  filled: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <svg
      className={"star " + (filled ? "filled" : "")}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      width="26"
      height="26"
      viewBox="0 0 24 24"
      role="button"
      aria-label={filled ? "selected" : "not selected"}
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

const css = `
.rv-veil{
  position:fixed; inset:0; z-index:10000;
  background: rgba(0,0,0,.45);
  display:grid; place-items:center;
  padding:16px; backdrop-filter: blur(2px);
  overscroll-behavior: contain;
  touch-action: none;
}
.rv-modal{
  position: fixed;
  left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 720px; max-width: calc(100vw - 24px);
  border:1px solid rgba(0,0,0,.12); border-radius:16px; background:#fff;
  box-shadow:0 24px 80px rgba(0,0,0,.28);
  display:flex; flex-direction:column; max-height: calc(100vh - 32px); overflow:hidden;
}
@supports (height: 100dvh){
  .rv-modal{ max-height: calc(100dvh - 32px); }
}
.rv-hd{
  display:flex; align-items:center; justify-content:space-between; padding:12px 14px;
  background: linear-gradient(180deg, rgba(246,195,32,.12), rgba(255,255,255,.9));
  border-bottom:1px solid rgba(0,0,0,.1);
}
.rv-title{ display:flex; align-items:center; gap:10px; }
.rv-title .dot{ width:8px; height:8px; border-radius:999px; background:#F05D8B; box-shadow:0 0 0 4px rgba(240,93,139,.18); }

/* ⬇ header close button */
.rv-x{
  height:36px; min-width:36px; padding:0 10px;
  border-radius:10px; border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer; font-weight:900; color:#333;
}

.rv-body{
  padding:12px 14px; overflow:auto; display:grid; gap:12px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
}
.row{ display:grid; grid-template-columns: 160px 1fr; gap:12px; align-items:flex-start; }
.label{ font-weight:800; opacity:.85; padding-top:6px; }
.value{ display:grid; gap:6px; }

/* compact checkbox + label */
.checkbox-row{ display:inline-flex; align-items:center; gap:8px; font-size:14px; }
.value input[type="checkbox"]{ width:18px; height:18px; }

.in, .ta{
  width:100%; border:1px solid rgba(0,0,0,.1); border-radius:10px; padding:8px 10px; outline:none; background:#fff;
  transition: box-shadow .12s ease, border-color .12s ease;
  font-size:16px; /* prevent iOS zoom while typing */
}
.in:focus-visible, .ta:focus-visible{ box-shadow:0 0 0 3px rgba(240,93,139,.18); border-color: rgba(240,93,139,.45); }
.char{ font-size:12px; opacity:.65; text-align:right; }

.stars{ display:flex; align-items:center; gap:6px; flex-wrap: wrap; }
.star{ cursor:pointer; fill:#ddd; transition: transform .06s ease, fill .12s ease; }
.star:hover{ transform: translateY(-1px) scale(1.04); }
.star.filled{ fill:#F6C320; }
.stars-hint{ font-size:12px; opacity:.8; margin-left:6px; }

.img-uploader{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
.up-btn{ position:relative; display:inline-flex; align-items:center; justify-content:center; height:32px; padding:0 12px; border-radius:10px; background:#F05D8B; color:#fff; font-weight:800; cursor:pointer; box-shadow:0 10px 24px rgba(240,93,139,.3); }
.up-btn.disabled{ opacity:.6; pointer-events:none; }
.up-btn input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
.minihelp{ font-size:12px; opacity:.75; }

.imgs{ display:grid; gap:10px; }
.img-row{ display:grid; grid-template-columns:120px 1fr; gap:10px; align-items:center; }
.thumb{ position:relative; width:120px; height:80px; border-radius:10px; border:1px solid rgba(0,0,0,.08); background:#fafafa; display:grid; place-items:center; overflow:hidden; }
.thumb img{ width:100%; height:100%; object-fit:cover; }
.thumb .badge{
  position:absolute; right:6px; top:6px; font-size:10px; font-weight:900;
  background:rgba(0,0,0,.72); color:#fff; padding:2px 6px; border-radius:999px;
  letter-spacing:.2px;
}
.meta .name{ font-weight:700; font-size:13px; }
.progress{ height:6px; border-radius:999px; background:#eee; overflow:hidden; }
.progress > div{ height:100%; background:#F05D8B; }
.row-actions{ display:flex; align-items:center; gap:8px; margin-top:6px; }
.err{ color:#b0003a; font-size:12px; }
.muted{ font-size:12px; opacity:.7; }

.alert{ padding:10px 12px; border:1px solid rgba(240,93,139,.25); border-radius:12px; background:#fff3f5; color:#b0003a; }

.rv-ft{
  padding:12px 14px; border-top:1px solid rgba(0,0,0,.1); display:flex; justify-content:flex-end; gap:10px; background:#fff;
}
.ghost{
  height:44px; padding:0 16px; border-radius:12px; border:1px solid rgba(0,0,0,.12);
  background:#fff; cursor:pointer;
}
.ghost.sm{ height:28px; padding:0 10px; border-radius:8px; font-size:12.5px; }
.btn{
  border:none; background:#F05D8B; color:#fff; height:44px; padding:0 16px; border-radius:12px; cursor:pointer;
  box-shadow: 0 12px 28px rgba(240,93,139,.3);
}
.btn:disabled{ opacity:.7; cursor:not-allowed; }

@media (max-width: 640px){
  .rv-veil{ padding: 0; }
  .rv-modal{
    left: 0; top: 0; transform: none;
    width: 100vw; max-width: 100vw;
    height: 100vh; max-height: 100vh;
    border-radius: 0;
  }
  @supports (height: 100dvh){
    .rv-modal{ height: 100dvh; max-height: 100dvh; }
  }

  .rv-body{ padding: 12px 14px 10px; }
  .row{ grid-template-columns: 1fr; gap: 8px; }
  .label{ padding-top:0; }

  .star{ width:26px; height:26px; }
  .img-row{ grid-template-columns: 96px 1fr; gap: 8px; }
  .thumb{ width:96px; height:64px; border-radius:8px; }

  .rv-ft{
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
    gap: 10px;
  }
  .rv-veil {
    z-index: 2147483000;
  }

}

@supports (padding: max(0px)){
  .rv-ft{
    padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom)));
  }
}
.upload-trigger {
  height: 36px;
  padding: 0 16px;
  background: #f05d8b;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(240, 93, 139, 0.3);
  font-size: 15px;
}
input[type="file"] {
  z-index: 99999;
  position: relative;
}

`;
