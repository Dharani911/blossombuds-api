import React, { useState } from "react";

/** Keep presets minimal & optional */
const QUICK = [
  "Pastel bridal set (Sept, Pune)",
  "Hair vine with jasmine + gypso",
  "Earrings for yellow lehenga",
];

export default function CustomOrderCTA() {
  const [waMsg, setWaMsg] = useState("Hi! I’d like a custom floral accessory for…");
  const whatsappHref = `https://wa.me/910000000000?text=${encodeURIComponent(waMsg)}`;

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

        {/* Optional quick presets (subtle, not crowded) */}
        <div className="chips" aria-label="Quick message presets">
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => setWaMsg(q)}>{q}</button>
          ))}
        </div>

        {/* Message + WhatsApp */}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            window.open(whatsappHref, "_blank");
          }}
        >
          <label htmlFor="wa-input" className="sr-only">Describe your custom order</label>
          <input
            id="wa-input"
            className="input"
            value={waMsg}
            onChange={(e) => setWaMsg(e.target.value)}
            placeholder="Describe your custom order…"
            aria-label="Describe your custom order"
          />
          <a className="btn" href={whatsappHref} target="_blank" rel="noreferrer">
            Send on WhatsApp
          </a>
        </form>
      </div>
    </section>
  );
}

const styles = `
/* Clean band, lots of air, zero shadows */
.co{
  padding: 56px 0;                  /* generous breathing room */
  margin-top: 40px;                 /* clear from previous section */
  scroll-margin-top: 140px;         /* anchor safety */
  background: var(--bb-bg);         /* #FAF7E7 */
  border-top: 1px solid rgba(0,0,0,.06);   /* subtle divider */
}
.container{
  max-width: 920px;                 /* tighter measure for elegance */
  margin: 0 auto;
  padding: 0 16px;
  text-align: center;
}

/* Header */
.head h2{
  margin: 0 0 10px;
  color: var(--bb-primary);         /* #4A4F41 */
  font-weight: 900;
  font-size: clamp(26px, 4vw, 36px);
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
}

/* Form — big pill input + pill button */
.form{
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
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
  background: var(--bb-accent);     /* #F05D8B */
  color: #fff;
  font-weight: 900;
  text-decoration: none;
}

/* Accessibility helper (visually hidden) */
.sr-only{
  position:absolute !important;
  width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,1,1); white-space:nowrap; border:0;
}

/* Mobile: stack neatly */
@media (max-width: 560px){
  .form{ grid-template-columns: 1fr; }
  .btn{ width: 100%; }
}
`;
