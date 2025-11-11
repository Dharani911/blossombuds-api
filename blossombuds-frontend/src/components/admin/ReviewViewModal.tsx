// src/components/admin/ReviewViewModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAdminReviewDetail, type ProductReviewDetailView } from "../../api/adminReviews";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import adminHttp from "../../api/adminHttp";

type Props = { open: boolean; reviewId: number; onClose: () => void };

export default function ReviewViewModal({ open, reviewId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ProductReviewDetailView | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await getAdminReviewDetail(reviewId);
        setData(res);
        setImgIndex(0);
      } catch (e: any) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load review.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, reviewId]);

  const stars = useMemo(() => {
    const v = Math.max(0, Math.min(5, Math.round(data?.rating || 0)));
    return "★★★★★☆☆☆☆☆".slice(5 - v, 10 - v);
  }, [data?.rating]);

  const selected = data?.images?.[imgIndex];
  const selectedSignedUrl = selected?.url ?? ""; // on-screen only
  const selectedImageId = selected?.id;

  // Fetch same-origin bytes for the selected image via backend inline endpoint
  async function fetchInlineBlobUrl(reviewId: number, imageId: number): Promise<string> {
    const res = await adminHttp.get<ArrayBuffer>(`/api/reviews/${reviewId}/images/${imageId}/inline`, {
      responseType: "blob", // important
      withCredentials: true,
    });
    // Axios with responseType 'blob' returns a Blob in res.data
    const blob = res.data as unknown as Blob;
    return URL.createObjectURL(blob);
  }

  // Download poster with selected image embedded (same-origin blob)
  async function downloadPosterPng() {
    if (!posterRef.current || !data) return;
    const node = posterRef.current;

    const restore: Array<() => void> = [];

    // White background to avoid transparent PNG with dark mode
    const prevBg = node.style.backgroundColor;
    node.style.backgroundColor = "#ffffff";
    restore.push(() => (node.style.backgroundColor = prevBg));

    // Hide thumbnails
    const thumbs = node.querySelector<HTMLElement>(".thumbs");
    if (thumbs) {
      const prev = thumbs.style.display;
      thumbs.style.display = "none";
      restore.push(() => (thumbs.style.display = prev));
    }

    // Replace hero <img> with same-origin blob URL
    const heroImg = node.querySelector<HTMLImageElement>(".hero-img");
    let blobUrl: string | null = null;
    if (heroImg && selectedImageId) {
      const prevSrc = heroImg.src;
      restore.push(() => {
        heroImg.src = prevSrc;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
      });

      try {
        blobUrl = await fetchInlineBlobUrl(data.id, selectedImageId);
        heroImg.removeAttribute("crossorigin"); // ensure browser treats it same-origin
        heroImg.src = blobUrl;
        // let layout settle
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      } catch (e: any) {
        console.warn("Inline image fetch failed:", e?.message || e);
        // If it fails, remove heroImg to avoid cross-origin taint and show neutral box
        const parent = heroImg.parentElement;
        const placeholder = document.createElement("div");
        placeholder.style.width = "100%";
        placeholder.style.height = "100%";
        placeholder.style.display = "flex";
        placeholder.style.alignItems = "center";
        placeholder.style.justifyContent = "center";
        placeholder.style.background = "#f5f5f5";
        placeholder.style.color = "#888";
        placeholder.style.fontSize = "13px";
        placeholder.textContent = "(image unavailable)";
        if (parent) {
          const idxSibling = heroImg.nextSibling;
          heroImg.remove();
          parent.insertBefore(placeholder, idxSibling);
          restore.push(() => {
            placeholder.remove();
            if (idxSibling) parent.insertBefore(heroImg, idxSibling);
            else parent.appendChild(heroImg);
          });
        }
      }
    }

    // Remove all other <img> (brand logo etc.) to avoid any accidental cross-origin taint
    const otherImgs = Array.from(node.querySelectorAll<HTMLImageElement>("img")).filter(
      (el) => el !== heroImg
    );
    type ImgRecord = { el: HTMLImageElement; parent: Node; next: ChildNode | null; src: string };
    const removedImgs: ImgRecord[] = [];
    for (const el of otherImgs) {
      const rec: ImgRecord = { el, parent: el.parentNode as Node, next: el.nextSibling, src: el.src };
      removedImgs.push(rec);
      el.remove();
    }
    restore.push(() => {
      for (const r of removedImgs) {
        if (r.next) r.parent.insertBefore(r.el, r.next);
        else r.parent.appendChild(r.el);
        r.el.src = r.src;
      }
    });

    // Strip CSS background-images in poster to be extra safe
    const bgTweaks: Array<() => void> = [];
    node.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const cs = getComputedStyle(el);
      const hasBg = cs.backgroundImage && cs.backgroundImage !== "none" && cs.backgroundImage.includes("url(");
      if (hasBg) {
        const prev = el.style.backgroundImage;
        el.style.backgroundImage = "none";
        bgTweaks.push(() => (el.style.backgroundImage = prev));
      }
    });
    restore.push(() => bgTweaks.forEach((fn) => fn()));

    try {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: false,   // we swapped to same-origin blob
        allowTaint: false,
        logging: false,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
      });
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to generate image blob.");
          return;
        }
        saveAs(blob, `review-${data.id}.png`);
      }, "image/png");
    } catch (e) {
      alert("Failed to generate image.");
    } finally {
      for (const fn of restore.reverse()) {
        try { fn(); } catch {}
      }
    }
  }

  if (!open) return null;

  return (
    <div className="rvv-veil">
      <style>{css}</style>
      <div className="rvv-modal">
        <header className="rvv-hd">
          <h3>Customer Review</h3>
          <button className="close" onClick={onClose}>×</button>
        </header>

        <div className="rvv-body">
          {loading && <p className="muted center">Loading…</p>}
          {err && <p className="muted center">⚠ {err}</p>}

          {!loading && !err && data && (
            <div ref={posterRef} className="poster">
              <div className="brand">
                <img src="/BB_logo.png" alt="logo" className="brand-logo" />
                <div>
                  <h2>Blossom Buds Floral Artistry</h2>
                  <p className="muted">Customer Review</p>
                </div>
              </div>

              <div className="hero-frame">
                <div className="hero">
                  <div className="hero-inner">
                    {selectedSignedUrl ? (
                      <img src={selectedSignedUrl} alt="review" className="hero-img" />
                    ) : (
                      <div className="hero-fallback">(No image)</div>
                    )}
                  </div>
                </div>

                {data.images?.length ? (
                  <div className="thumbs">
                    {data.images.map((m, i) => (
                      <button
                        key={m.id ?? i}
                        className={i === imgIndex ? "active" : ""}
                        onClick={() => setImgIndex(i)}
                        title={`Select image ${i + 1}`}
                      >
                        <img src={m.url} alt={`thumb-${i + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="review-text">
                <div className="stars">{stars}</div>
                {data.title && <h4>{data.title}</h4>}
                {data.body && <p>“{data.body}”</p>}
                <div className="meta">
                  <div>
                    <strong>{data.customerName || `Customer #${data.customerId}`}</strong>
                    <span> — {new Date(data.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="muted small">
                    {data.productName || `Product #${data.productId}`} •{" "}
                    {data.concern ? "Consent ✅" : "No Consent ❌"}
                  </div>
                </div>
              </div>

              <div className="poster-footer">
                <p>Handcrafted with ❤️ by Blossom Buds</p>
                <p className="muted">@blossombuds · blossombuds.in</p>
              </div>
            </div>
          )}
        </div>

        <footer className="rvv-ft">
          <button className="btn" onClick={downloadPosterPng}>Download Poster (PNG)</button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------- CSS -------------------------- */
const css = `
.rvv-veil { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: grid; place-items: center; z-index: 9999; padding: 16px; }
.rvv-modal { background: #fff; width: 680px; max-width: 95vw; border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.25); overflow: hidden; display: flex; flex-direction: column; max-height: 560px; }
.rvv-hd { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(0,0,0,.08); background: linear-gradient(180deg, rgba(246,195,32,.12), #fff); }
.rvv-hd h3 { margin: 0; font-weight: 900; color: #4A4F41; font-size: 17px; }
.close { background: transparent; border: none; font-size: 22px; cursor: pointer; }

.rvv-body { flex: 1; padding: 14px; overflow-y: auto; scrollbar-width: thin; }

.poster { display: flex; flex-direction: column; border: 1px solid rgba(0,0,0,.08); border-radius: 12px; background: #fff; box-shadow: 0 3px 14px rgba(0,0,0,.05); }
.brand { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid rgba(0,0,0,.05); background: linear-gradient(90deg, rgba(246,195,32,.10), rgba(240,93,139,.08)); }
.brand-logo { width: 42px; height: 42px; border-radius: 10px; object-fit: contain; }

.hero-frame { display: flex; flex-direction: column; align-items: center; padding: 10px 0; background: #fdfdfd; }
.hero { width: 90%; max-width: 480px; height: 300px; border-radius: 14px; border: 1px solid rgba(0,0,0,.1); overflow: hidden; background: #fafafa; display: flex; align-items: center; justify-content: center; }
.hero-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.hero-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.hero-fallback { color: #888; font-size: 13px; }

.thumbs { display: flex; gap: 6px; padding: 6px; justify-content: center; }
.thumbs button { border: 1px solid rgba(0,0,0,.08); border-radius: 6px; width: 52px; height: 52px; background: #fff; cursor: pointer; }
.thumbs button.active { outline: 2px solid #F6C320; }
.thumbs img { width: 100%; height: 100%; object-fit: cover; }

.review-text { padding: 12px 14px; display: grid; gap: 6px; }
.stars { color: #F6C320; font-size: 18px; letter-spacing: 1px; }
.review-text h4 { margin: 0; font-size: 16px; color: #4A4F41; }
.review-text p { margin: 2px 0; line-height: 1.4; color: #333; }
.meta { margin-top: 8px; font-size: 13px; }
.muted { opacity: 0.7; }
.small { font-size: 12px; }
.center { text-align: center; }

.poster-footer { text-align: center; border-top: 1px solid rgba(0,0,0,.05); padding: 10px 0; background: linear-gradient(90deg, rgba(246,195,32,.08), rgba(240,93,139,.06)); font-size: 13px; }
.rvv-ft { flex-shrink: 0; padding: 10px 14px; border-top: 1px solid rgba(0,0,0,.08); display: flex; gap: 8px; justify-content: flex-end; background: #fff; }
.btn { background: #F05D8B; color: #fff; border: none; border-radius: 10px; padding: 7px 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(240,93,139,.25); transition: background .2s ease; font-size: 14px; }
.btn:hover { background: #d64d7a; }
`;
