import React, { useState } from "react";
import { useWhatsAppNumber } from "../../lib/whatsapp";
import customizationFlowers from "../../assets/home/customization_flowers.jpeg";
import customizationGarland from "../../assets/home/customization_garland.jpeg";

function openWhatsAppPreferApp(phone: string, text: string) {
  const encodedText = encodeURIComponent(text || "");
  const appUrl = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodedText}`;
  const webUrl = `https://wa.me/${encodeURIComponent(phone)}?text=${encodedText}`;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isMobile =
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ||
    (typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 0);

  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  let didNavigate = false;
  const timeout = setTimeout(() => {
    if (!didNavigate) window.location.href = webUrl;
  }, 700);

  try {
    window.location.href = appUrl;
    didNavigate = true;
  } catch {
    clearTimeout(timeout);
    window.location.href = webUrl;
  }
}

const quickChips = [
  "Bridal hair flowers",
  "Custom garland",
  "Colour matched set",
  "Temple / pooja styling",
];

export default function CustomOrderCTA() {
  const [waMsg, setWaMsg] = useState("");
  const { number: waNumber } = useWhatsAppNumber();
  const canSend = !!waNumber && waMsg.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    openWhatsAppPreferApp(
      waNumber!,
      `Customization order: ${waMsg.trim()}`
    );
    setWaMsg("");
  };

  const addChip = (chip: string) => {
    setWaMsg((prev) => (prev ? `${prev}, ${chip}` : chip));
  };

  return (
    <section className="cta-wrap" id="custom" aria-labelledby="cta-title">
      <style>{styles}</style>

      <div className="cta-shell">
        <div className="cta-inner">
          {/* Left: image grid */}
          <div className="cta-images" aria-hidden="true">
            <img src={customizationFlowers} alt="" loading="lazy" />
            <img src={customizationGarland} alt="" loading="lazy" />
          </div>

          {/* Right: content */}
          <div className="cta-content">
            <span className="cta-eyebrow">Custom orders</span>
            <h2 id="cta-title">
              Real customized floral pieces made for our customers
            </h2>
            <p>
              These are real custom pieces created based on customer ideas,
              colours, and occasion needs. If you want something similar, send
              us a quick WhatsApp message with your idea and we'll help create
              it beautifully.
            </p>

            <div className="cta-chips">
              {quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="cta-chip"
                  onClick={() => addChip(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            <form className="cta-form" onSubmit={onSubmit}>
              <input
                className="cta-input"
                value={waMsg}
                onChange={(e) => setWaMsg(e.target.value)}
                placeholder="Share your colour, occasion, or reference idea…"
                aria-label="Describe your custom order"
              />
              <button type="submit" className="cta-btn" disabled={!canSend}>
                Send on WhatsApp
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = `
.cta-wrap{
  width:100%;
  padding:clamp(36px,5vw,72px) clamp(14px,5vw,48px);
  background:#F5F0E8;
}

.cta-shell{
  max-width:1160px;
  margin:0 auto;
  background:#fff;
  border-radius:24px;
  overflow:hidden;
}

.cta-inner{
  display:grid;
  grid-template-columns:1fr 1fr;
}

.cta-images{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  padding:24px;
  background:#F5F0E8;
  align-content:start;
}

.cta-images img{
  width:100%;
  height:clamp(200px,28vw,380px);
  object-fit:cover;
  border-radius:14px;
  display:block;
}

.cta-content{
  padding:clamp(24px,4vw,52px);
  display:flex;
  flex-direction:column;
  justify-content:center;
  gap:16px;
}

.cta-eyebrow{
  display:inline-flex;
  align-items:center;
  min-height:28px;
  padding:0 12px;
  border-radius:999px;
  background:rgba(240,93,139,.08);
  border:1px solid rgba(240,93,139,.14);
  color:var(--bb-accent);
  font-size:11px;
  font-weight:800;
  letter-spacing:.14em;
  text-transform:uppercase;
  width:fit-content;
}

.cta-content h2{
  margin:0;
  font-family:'DM Serif Display',Georgia,serif;
  font-size:clamp(24px,3vw,36px);
  font-weight:400;
  line-height:1.15;
  color:var(--bb-primary);
}

.cta-content p{
  margin:0;
  color:#687163;
  font-size:14px;
  line-height:1.75;
}

.cta-chips{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.cta-chip{
  min-height:36px;
  padding:0 14px;
  border:1px solid rgba(240,93,139,.18);
  border-radius:999px;
  background:rgba(240,93,139,.06);
  color:var(--bb-primary);
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  transition:transform .18s ease,background .18s ease,border-color .18s ease;
}

.cta-chip:hover{
  transform:translateY(-1px);
  background:rgba(240,93,139,.12);
  border-color:rgba(240,93,139,.26);
}

.cta-form{
  display:grid;
  grid-template-columns:1fr auto;
  gap:10px;
}

.cta-input{
  height:52px;
  border-radius:999px;
  border:1px solid rgba(0,0,0,.12);
  background:#fff;
  padding:0 18px;
  font-size:14px;
  color:var(--bb-primary);
  outline:none;
}

.cta-input:focus{
  border-color:var(--bb-accent);
  box-shadow:0 0 0 4px rgba(240,93,139,.10);
}

.cta-btn{
  height:52px;
  padding:0 20px;
  border:none;
  border-radius:999px;
  background:#25D366;
  color:#fff;
  font-size:14px;
  font-weight:800;
  cursor:pointer;
  white-space:nowrap;
  box-shadow:0 10px 26px rgba(37,211,102,.22);
  transition:transform .18s ease,box-shadow .18s ease;
}

.cta-btn:hover:not(:disabled){
  transform:translateY(-1px);
  box-shadow:0 14px 30px rgba(37,211,102,.28);
}

.cta-btn:disabled{
  opacity:.5;
  cursor:not-allowed;
  box-shadow:none;
}

@media (max-width:840px){
  .cta-inner{
    grid-template-columns:1fr;
  }

  .cta-images{
    grid-template-columns:1fr 1fr;
    padding:16px;
    gap:10px;
  }

  .cta-images img{
    height:clamp(140px,38vw,240px);
  }

  .cta-content{
    padding:clamp(20px,5vw,36px);
  }
}

@media (max-width:540px){
  .cta-wrap{
    padding:24px 10px 36px;
  }

  .cta-shell{
    border-radius:18px;
  }

  .cta-form{
    grid-template-columns:1fr;
  }

  .cta-input,
  .cta-btn{
    width:100%;
    height:48px;
  }
}
`;
