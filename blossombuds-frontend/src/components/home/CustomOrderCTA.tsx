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
        <div className="cta-card">
          <div className="cta-head">
            <span className="cta-eyebrow">Custom orders</span>
            <h2 id="cta-title">
              Real customized floral pieces made for our customers
            </h2>
            <p>
              These are real custom pieces created based on customer ideas,
              colours, and occasion needs. If you want something similar,
              send us a quick WhatsApp message with your idea and we’ll help
              create it beautifully.
            </p>
          </div>

          <div className="cta-gallery" aria-hidden="true">
            <figure className="cta-shot">
              <div className="cta-shot-media">
                <img src={customizationFlowers} alt="" loading="lazy" />
              </div>
              <figcaption>Custom floral set</figcaption>
            </figure>

            <figure className="cta-shot">
              <div className="cta-shot-media">
                <img src={customizationGarland} alt="" loading="lazy" />
              </div>
              <figcaption>Custom garland design</figcaption>
            </figure>
          </div>

          <div className="cta-actions">


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
  padding: clamp(36px, 5vw, 72px) clamp(14px, 5vw, 48px) clamp(46px, 6vw, 86px);
}

.cta-shell{
  max-width: 1160px;
  margin: 0 auto;
}

.cta-card{
  border-radius: 34px;
  padding: clamp(18px, 2.4vw, 28px);
  background:
    radial-gradient(circle at top left, rgba(240,93,139,.08), transparent 24%),
    radial-gradient(circle at bottom right, rgba(246,195,32,.08), transparent 24%),
    linear-gradient(180deg, #fff, #fffafc);
  border: 1px solid rgba(74,79,65,.08);
  box-shadow:
    0 20px 46px rgba(0,0,0,.08),
    inset 0 1px 0 rgba(255,255,255,.92);
}

.cta-head{
  max-width: 760px;
  margin: 0 auto 22px;
  text-align: center;
}

.cta-eyebrow{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 12px;
  margin-bottom: 12px;
  border-radius: 999px;
  background: rgba(240,93,139,.08);
  border: 1px solid rgba(240,93,139,.14);
  color: var(--bb-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.cta-head h2{
  margin: 0 0 12px;
  font-family: "Cinzel","DM Serif Display",Georgia,serif;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
  color: var(--bb-primary);
}

.cta-head p{
  margin: 0 auto;
  max-width: 62ch;
  color: #687163;
  font-size: 15px;
  line-height: 1.75;
}

.cta-gallery{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.cta-shot{
  margin: 0;
  border-radius: 26px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255,255,255,.84), rgba(255,255,255,.66)),
    #f7f1ea;
  border: 1px solid rgba(74,79,65,.08);
  box-shadow:
    0 18px 36px rgba(0,0,0,.08),
    inset 0 1px 0 rgba(255,255,255,.74);
}

.cta-shot-media{
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background:
    radial-gradient(circle at top, rgba(255,255,255,.50), rgba(255,255,255,0) 34%),
    linear-gradient(180deg, #f8f4ee 0%, #f2ece4 100%);
  min-height: clamp(240px, 42vw, 480px);
}

.cta-shot-media img{
  width: 100%;
  height: 100%;
  max-height: 430px;
  object-fit: contain;
  object-position: center;
  display: block;
}

.cta-shot figcaption{
  padding: 12px 14px 14px;
  text-align: center;
  color: var(--bb-primary);
  font-size: 13px;
  font-weight: 700;
}

.cta-actions{
  max-width: 820px;
  margin: 0 auto;
}

.cta-chips{
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 18px;
}

.cta-chip{
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(240,93,139,.12);
  border-radius: 999px;
  background: rgba(240,93,139,.06);
  color: var(--bb-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}

.cta-chip:hover{
  transform: translateY(-1px);
  background: rgba(240,93,139,.12);
  border-color: rgba(240,93,139,.20);
}

.cta-form{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.cta-input{
  height: 54px;
  border-radius: 999px;
  border: 1px solid rgba(0,0,0,.12);
  background: #fff;
  padding: 0 18px;
  font-size: 15px;
  color: var(--bb-primary);
  outline: none;
}

.cta-input:focus{
  border-color: var(--bb-accent);
  box-shadow: 0 0 0 4px rgba(240,93,139,.12);
}

.cta-btn{
  height: 54px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: #25D366;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(37,211,102,.22);
  transition: transform .18s ease, box-shadow .18s ease;
}

.cta-btn:hover:not(:disabled){
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(37,211,102,.26);
}

.cta-btn:disabled{
  opacity: .5;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 700px){
  .cta-wrap{
    padding: 26px 10px 38px;
  }

  .cta-card{
    border-radius: 22px;
    padding: 14px;
  }

  .cta-head{
    margin-bottom: 16px;
  }

  .cta-head h2{
    font-size: clamp(24px, 7.6vw, 32px);
  }

  .cta-head p{
    font-size: 14px;
    line-height: 1.62;
  }

  .cta-gallery{
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .cta-shot{
    border-radius: 18px;
  }

  .cta-shot-media{
    min-height: 220px;
    padding: 10px;
  }

  .cta-shot-media img{
    max-height: 280px;
  }

  .cta-shot figcaption{
    padding: 10px 12px 12px;
    font-size: 12px;
  }

  .cta-chips{
    justify-content: center;
    margin-bottom: 14px;
  }

  .cta-chip{
    min-height: 34px;
    padding: 0 12px;
    font-size: 12px;
  }

  .cta-form{
    grid-template-columns: 1fr;
  }

  .cta-input,
  .cta-btn{
    width: 100%;
    height: 48px;
  }

  .cta-input{
    font-size: 14px;
  }

  .cta-btn{
    font-size: 13px;
  }
}
`;