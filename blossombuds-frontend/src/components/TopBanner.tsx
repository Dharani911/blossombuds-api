import React, { useEffect, useState } from "react";
import { getSetting } from "../api/settings";

type Cfg = { threshold: string | null; couponRaw: string | null };

export default function TopBanner() {
  const [cfg, setCfg] = useState<Cfg | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [threshold, couponRaw] = await Promise.all([
        getSetting("shipping.free_threshold", ""),
        getSetting("ui.topbanner_coupon", ""),
      ]);
      if (!live) return;
      setCfg({ threshold: threshold || null, couponRaw: couponRaw || null });
    })();
    return () => { live = false; };
  }, []);

  if (!cfg) return null;

  // Build message list with fallbacks
  const msgs: JSX.Element[] = [];

  // 1) Shipping message
  const n = cfg.threshold ? Number(cfg.threshold) : NaN;
  if (isFinite(n)) {
    if (n === 0) {
      msgs.push(
        <span className="bb-item" key="ship-free-all">
          <i className="bb-dot" />
          Free shipping for all
        </span>
      );
    } else if (n > 0) {
      msgs.push(
        <span className="bb-item" key="ship-threshold">
          <i className="bb-dot" />
          Free shipping on orders over ₹{formatINR(cfg.threshold!)}
        </span>
      );
    } else {
      // invalid/negative → fallback
      msgs.push(defaultQuoteA());
    }
  } else {
    // missing → fallback
    msgs.push(defaultQuoteA());
  }

  // 2) Coupon message (or fallback)
  const coupon = parseCoupon(cfg.couponRaw || "");
  if (coupon) {
    msgs.push(
      <span className="bb-item" key="coupon">
        <i className="bb-dot" />
        Use coupon <span className="bb-chip">{coupon.code}</span> for {coupon.offer}
      </span>
    );
  } else {
    msgs.push(defaultQuoteB());
  }

  return (
    <div className="bb-topbar" role="region" aria-label="Store announcement">
      <style>{styles}</style>
      <div className="bb-wrap">
        <div className="bb-lane" aria-live="polite">
          <div className="bb-track">
            <div className="bb-inner">{msgs}</div>
            <div className="bb-inner" aria-hidden="true">{msgs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Fallback quotes ---------- */
function defaultQuoteA() {
  return (
    <span className="bb-item" key="qA">
      <i className="bb-dot" />
      Fresh, <span className="bb-kicker">made-to-order</span> floral accessories
    </span>
  );
}
function defaultQuoteB() {
  return (
    <span className="bb-item" key="qB">
      <i className="bb-dot" />
      Handcrafted with love, <span className="bb-kicker">designed to last</span>
    </span>
  );
}

/* ---------- Helpers ---------- */
function parseCoupon(raw: string): { code: string; offer: string } | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;

  const sep = s.match(/[:\-–—]| for | gets | = /i);
  if (sep) {
    const idx = s.indexOf(sep[0]);
    const left = s.slice(0, idx).trim();
    const right = s.slice(idx + sep[0].length).trim();
    const code = pickCode(left) || pickCode(right);
    const offer = pickOffer(left, right);
    if (code && offer) return { code, offer };
  }
  const code = pickCode(s);
  const offer = pickOffer(s, "");
  return code && offer ? { code, offer } : null;
}
function pickCode(text: string) {
  const m = text.match(/\b[A-Z0-9]{4,}\b/i);
  return m ? m[0].toUpperCase() : null;
}
function pickOffer(a: string, b: string) {
  const src = `${a} ${b}`.trim();
  const p1 = src.match(/(\bflat\s*)?(\d{1,3})\s*%(\s*off)?/i);
  if (p1) return `${p1[2]}% off`;
  const p2 = src.match(/(?:₹|rs\.?\s*|inr\s*)(\d{2,6})\s*(off)?/i);
  if (p2) return `₹${Number(p2[1]).toLocaleString("en-IN")} off`;
  const cleaned = src.replace(/\b[A-Z0-9]{4,}\b/i, "").replace(/[:\-–—]/, "").trim();
  return cleaned || null;
}
function formatINR(raw: string) {
  const n = Number(raw);
  if (!isFinite(n)) return raw;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* ---------- Styles (same look) ---------- */
const styles = `
.bb-topbar{
  position: sticky; top: 0; z-index: 80;
  background: linear-gradient(180deg, rgba(74,79,65,0.55) 0%, rgba(74,79,65,0.38) 55%, rgba(74,79,65,0.12) 85%, rgba(74,79,65,0) 100%),
              linear-gradient(180deg, rgba(246,195,32,0.06), rgba(246,195,32,0));
  backdrop-filter: saturate(160%) blur(8px);
}
.bb-wrap{ max-width:1200px; margin:0 auto; padding:4px 12px; }
.bb-lane{ position:relative; height:28px; overflow:hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
}
.bb-track{ display:flex; align-items:center; height:28px; gap:56px; white-space:nowrap; animation: bb-marquee 18s linear infinite; }
.bb-topbar:hover .bb-track{ animation-play-state: paused; }
.bb-inner{ display:flex; gap:56px; padding-left:8px; }
.bb-item{ display:inline-flex; align-items:center; gap:10px; color:#fff; font-weight:800; letter-spacing:.2px; font-size:14px; line-height:1;
  text-shadow: 0 1px 0 rgba(0,0,0,.25), 0 6px 18px rgba(0,0,0,.20); }
.bb-chip{ font-size:12px; font-weight:900; color:#fff; background: linear-gradient(90deg,#F6C320 0%,#F05D8B 100%);
  border:none; border-radius:999px; padding:4px 10px; box-shadow:0 6px 16px rgba(240,93,139,.35), 0 2px 0 rgba(0,0,0,.08) inset; }
.bb-dot{ width:6px; height:6px; border-radius:999px; background: var(--bb-accent-2, #F6C320);
  box-shadow: 0 0 0 3px rgba(246,195,32,.22), 0 0 10px rgba(246,195,32,.45); }
.bb-kicker{ color:#fff; padding:2px 8px; border-radius:999px; background: rgba(246,195,32,.28); box-shadow: 0 6px 14px rgba(246,195,32,.25) inset; }
@keyframes bb-marquee { from{ transform: translateX(0); } to{ transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce){ .bb-track{ animation:none; } }
@media (max-width:520px){
  .bb-wrap{ padding:3px 12px; }
  .bb-track{ gap:40px; }
  .bb-inner{ gap:40px; }
  .bb-item{ font-size:13px; }
}
`;
