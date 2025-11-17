import React, {useEffect, useState } from "react";
import { getSetting } from "../../api/settings";
import { useWhatsAppNumber } from "../../lib/whatsapp"; // your custom hook


/** Keep presets minimal & optional */
function openWhatsAppPreferApp(phone: string, text: string) {
  const encodedText = encodeURIComponent(text || "");
  const appUrl = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodedText}`;
  const webUrl = `https://wa.me/${encodeURIComponent(phone)}?text=${encodedText}`;

  // Heuristic: on desktop, go straight to web (many desktops have no app handler)
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isMobile =
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ||
    (typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 0);

  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // On mobile: try the app first
  let didNavigate = false;
  const timeout = setTimeout(() => {
    if (!didNavigate) {
      // Fallback to web—either in-app browser or default browser
      window.location.href = webUrl;
    }
  }, 700);

  try {
    // Using location.href to keep it in the same tab (better UX on mobile)
    window.location.href = appUrl;
    didNavigate = true;
  } catch {
    // If something blocks it, just fallback immediately
    clearTimeout(timeout);
    window.location.href = webUrl;
  }
}

export default function CustomOrderCTA() {
  const [waMsg, setWaMsg] = useState("");  // start empty
  const { number: waNumber } = useWhatsAppNumber();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waNumber || !waMsg.trim()) return;

    const fullMessage = `Customization order: ${waMsg.trim()}`;

    // Send
    openWhatsAppPreferApp(waNumber, fullMessage);

    // Clear input immediately after sending
    setWaMsg("");
  };

  return (
    <section className="co" id="custom" aria-labelledby="custom-title">
      <style>{styles}</style>

      <div className="container">
        <header className="head">
          <h2 id="custom-title">Custom, just for you</h2>
          <p className="sub">
            Tell us your colors, flowers, and occasion — we’ll design a bespoke, lightweight piece you’ll love.
          </p>
        </header>

        <form className="form" onSubmit={onSubmit}>
          <input
            id="wa-input"
            className="input"
            value={waMsg}
            onChange={(e) => setWaMsg(e.target.value)}
            placeholder="Describe your custom order…"
            aria-label="Describe your custom order"
          />

          <button type="submit" className="btn">
            Send on WhatsApp
          </button>
        </form>
      </div>
    </section>
  );
}

const styles = `
/* Clean band, lots of air, zero shadows */
.co{
  padding: clamp(36px, 6vw, 56px) 0;
  margin-top: 40px;
  scroll-margin-top: 140px;
  background: var(--bb-bg);
  border-top: 1px solid rgba(0,0,0,.06);
  -webkit-tap-highlight-color: transparent;
}
.container{
  max-width: 920px;
  margin: 0 auto;
  padding-left: clamp(12px, 4vw, 16px);
  padding-right: clamp(12px, 4vw, 16px);
  padding-left: max(clamp(12px, 4vw, 16px), env(safe-area-inset-left, 0px));
  padding-right: max(clamp(12px, 4vw, 16px), env(safe-area-inset-right, 0px));
  text-align: center;
}

/* Header */
.head h2{
  margin: 0 0 10px;
  color: var(--bb-primary);
  font-weight: 900;
  font-size: clamp(24px, 4vw, 36px);
}
.sub{
  margin: 0;
  color: var(--bb-primary);
  opacity: .9;
  font-size: clamp(14px, 1.6vw, 18px);
}

/* Preset chips — subtle outline, spaced */
.chips{
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 18px;
  margin-bottom: 22px;
}
.chip{
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.14);
  background: #fff;
  color: #2b2b2b;
  font-weight: 800;
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  touch-action: manipulation;
}
.chip:active{ transform: translateY(1px) scale(.995); }
.chip:hover{ background: #fafafa; }

/* Form — big pill input + pill button */
.form{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
}
.input{
  height: 52px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.16);
  background: #fff;
  padding: 0 18px;
  outline: none;
  font-size: 16px;
  color: var(--bb-primary);
  min-width: 0;
}
.input:focus{
  border-color: color-mix(in oklab, var(--bb-accent), transparent 50%);
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--bb-accent), transparent 85%);
}
.input::placeholder{ color: rgba(0,0,0,.45); }

.btn{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  padding: 0 20px;
  border-radius: 999px;
  border: none;
  background: var(--bb-accent);
  color: #fff;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(240,93,139,.22);
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
  white-space: nowrap;
}
.btn:hover{ transform: translateY(-1px); box-shadow: 0 14px 30px rgba(240,93,139,.26); }
.btn:active{ transform: translateY(0); }

.sr-only{
  position:absolute !important;
  width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,1,1); white-space:nowrap; border:0;
}

/* Mobile: stack neatly */
@media (max-width: 560px){
  .form{ grid-template-columns: 1fr; }
  .btn{ width: 100%; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce){
  .chip, .btn{ transition:none; }
}
/* Mobile: show input + button side by side */
@media (max-width: 560px){
  .form {
    grid-template-columns: 1fr ;
    justify-items:center;
  }
  .btn {
    width: 200px;
    padding: 0 16px;
  }
}

`;
