// src/components/WhatsappFab.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useWhatsAppNumber, waHrefFor } from "../lib/whatsapp";

type View = "menu" | "general" | "custom" | "tracking";

/** Prefer opening the WhatsApp app; fallback to web if it fails. */
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

export default function WhatsappFab() {
  const { number, loading } = useWhatsAppNumber();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");

  const effectiveNumber = number || "910000000000"; // safe fallback

  const defaultMsg = useMemo(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    return `Hi! I have a question about something I saw here: ${url}`;
  }, []);

  // Lock background scroll when the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    setOpen(false);
    setTimeout(() => setView("menu"), 250);
  };

  return (
    <>
      <style>{styles}</style>

      <button
        className="wa-fab"
        onClick={() => setOpen(true)}
        aria-label="Chat on WhatsApp"
        title={loading ? "Loading…" : "Chat on WhatsApp"}
      >
        <WaIcon />
      </button>

      {open && (
        <>
          <div className="wa-scrim" onClick={close} aria-hidden />
          <div className="wa-sheet in" role="dialog" aria-label="WhatsApp support">
            <header className="wa-head">
              {view !== "menu" ? (
                <button className="wa-icon-btn" onClick={() => setView("menu")} aria-label="Back">
                  <ArrowLeftIcon />
                </button>
              ) : (
                <span />
              )}
              <div className="wa-title">How can we help?</div>
              <button className="wa-icon-btn" aria-label="Close" onClick={close}>
                <CloseIcon />
              </button>
            </header>

            {/* Sheet interior: 1) scrollable content  2) fixed footer */}
            <div className="wa-view">
              {view === "menu" && <Menu onPick={setView} />}
              {view === "general" && <GeneralView number={effectiveNumber} />}
              {view === "custom" && <CustomView number={effectiveNumber} />}
              {view === "tracking" && <TrackingView number={effectiveNumber} />}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- Menu ---------------- */
function Menu({ onPick }: { onPick: (v: View) => void }) {
  return (
    <>
      <div className="scroll-area">
        <div className="menu fade-in">
          <button className="menu-item" onClick={() => onPick("general")}>
            <span className="mi-ic">💬</span>
            <div className="mi-text">
              <div className="mi-title">General queries</div>
              <div className="mi-sub">Browse quick FAQs or ask us directly</div>
            </div>
            <ArrowRightIcon />
          </button>

          <button className="menu-item" onClick={() => onPick("custom")}>
            <span className="mi-ic">🎨</span>
            <div className="mi-text">
              <div className="mi-title">Customization order</div>
              <div className="mi-sub">Describe your idea — colors, flowers, dates</div>
            </div>
            <ArrowRightIcon />
          </button>

          <button className="menu-item" onClick={() => onPick("tracking")}>
            <span className="mi-ic">📦</span>
            <div className="mi-text">
              <div className="mi-title">Tracking queries</div>
              <div className="mi-sub">Find shipping info or chat with us</div>
            </div>
            <ArrowRightIcon />
          </button>
        </div>
      </div>
      {/* no footer for menu */}
    </>
  );
}

/* ---------------- Views ---------------- */
function GeneralView({ number }: { number: string }) {
  const [query, setQuery] = useState("");

  const faqs = [
    { q: "What materials do you use?", a: "We use lightweight, skin-friendly materials with reinforced floral wiring for durability." },
    { q: "Do you ship across India?", a: "Yes, we ship pan-India with tracking. Express options are available at checkout." },
    { q: "How long does a custom order take?", a: "Most custom pieces take 5–7 working days depending on complexity and queue." },
    { q: "Can you match outfit colors?", a: "Absolutely. Share references or photos, and we’ll match closely." },
    { q: "Are the pieces heavy?", a: "We focus on all-day comfort with light builds and reinforced joinery." },
    { q: "How do I care for them?", a: "Store flat, away from moisture. Wipe gently with a dry cloth after use." },
  ];

  const message = `General query: ${query || "(no message entered)"}`;
  const canSend = query.trim().length > 0;


  const send = () => {
    if (!canSend) return;
    openWhatsAppPreferApp(number, message);
    setQuery(""); // clear after sending
  };


  const onSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!canSend) return;
    send();
  };


  return (
    <>
      {/* SCROLLABLE FAQs (only this area scrolls) */}
      <div className="scroll-area">
        <div className="panel fade-in">
          <div className="section">
            <h3 className="panel-title">FAQs</h3>
            <div className="faq">
              {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
            </div>
          </div>
        </div>
      </div>

      {/* FIXED FOOTER with input + CTA */}
      <div className="sticky-footer">
        <div className="footer-inner">
          <form className="wa-form" onSubmit={onSubmit}>
            <input
              className="wa-input"
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Type your question…"
              aria-label="Your general question"
            />
            <button
              type="submit"
              className="wa-btn green"
              onClick={send}
              disabled={!canSend}
            >
              Chat on WhatsApp
            </button>

          </form>
        </div>
      </div>
    </>
  );
}

function CustomView({ number }: { number: string }) {
  const [msg, setMsg] = useState("");
  const message = `Customization order: ${msg || "(no message entered)"}`;
  const canSend = msg.trim().length > 0;


  const send = () => {
    if (!canSend) return;
    openWhatsAppPreferApp(number, message);
    setMsg("");
  };


  const onSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!canSend) return;
    send();
  };


  return (
    <>
      <div className="scroll-area">
        <div className="panel fade-in">
          <div className="section">
            <h3 className="panel-title">Tell us about your custom</h3>
            <p className="panel-copy">Share the occasion, colors, reference flowers, and need-by date.</p>
          </div>
        </div>
      </div>

      <div className="sticky-footer">
        <div className="footer-inner">
          <form className="wa-form" onSubmit={onSubmit}>
            <input
              className="wa-input"
              value={msg}
              onChange={e=>setMsg(e.target.value)}
              placeholder="e.g., Pastel bridal set for Oct 20, blush + ivory"
              aria-label="Describe your customization"
            />
            <button
              type="submit"
              className="wa-btn pink"
              onClick={send}
              disabled={!canSend}
            >
              Chat on WhatsApp
            </button>

          </form>
        </div>
      </div>
    </>
  );
}

function TrackingView({ number }: { number: string }) {
  const [q, setQ] = useState("");
  const info = `Most ready-to-ship items dispatch the same day if ordered before 2pm IST. Custom orders typically dispatch within 5–7 working days. You’ll receive an email/SMS with your tracking link once the parcel is handed to the courier.`;
  const message = `Tracking query: ${q || "(no message entered)"}`;
  const canSend = q.trim().length > 0;


  const send = () => {
    if (!canSend) return;
    openWhatsAppPreferApp(number, message);
    setQ("");
  };


  const onSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!canSend) return;
    send();
  };


  return (
    <>
      <div className="scroll-area">
        <div className="panel fade-in">
          <div className="section">
            <h3 className="panel-title">Tracking & Dispatch</h3>
            <p className="panel-copy">{info}</p>
          </div>
        </div>
      </div>

      <div className="sticky-footer">
        <div className="footer-inner">
          <form className="wa-form" onSubmit={onSubmit}>
            <input
              className="wa-input"
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="e.g., Can you expedite my order? Order #BB1234"
              aria-label="Your tracking question"
            />
            <button
              type="submit"
              className="wa-btn green"
              onClick={send}
              disabled={!canSend}
            >
              Chat on WhatsApp
            </button>

          </form>
        </div>
      </div>
    </>
  );
}

/* --------------- Bits --------------- */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="faq-item" open={open} onToggle={e=>setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="faq-q">
        <span>{q}</span>
        <span className="faq-icon">{open ? "−" : "+"}</span>
      </summary>
      <div className="faq-a">{a}</div>
    </details>
  );
}

function WaIcon() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden>
      <path fill="#fff" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm7.4 18.6c-.3.8-1.7 1.5-2.3 1.6-.6.1-1.3.2-2.1-.1-.5-.1-1.1-.4-1.9-.7-3.4-1.5-5.6-4.8-5.8-5-.2-.2-1.4-1.8-1.4-3.5 0-1.6.8-2.4 1.1-2.8.3-.4.8-.6 1-.6h.7c.2 0 .5.1.7.6.3.8.9 2.6 1 2.8.1.2.1.4 0 .6-.1.2-.2.3-.4.5l-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.1 1.4 2.4 1.6.2.1.5.1.6 0 .2-.1 1.5-.7 1.7-.8.2-.1.3-.1.5 0s1.6.8 1.9 1c.3.2.5.3.5.5 0 .3.1 1-.2 1.8z"/>
    </svg>
  );
}
function ArrowLeftIcon(){
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M15 18l-6-6 6-6" fill="none" stroke="var(--bb-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ArrowRightIcon(){
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M9 6l6 6-6 6" fill="none" stroke="var(--bb-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CloseIcon(){
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="var(--bb-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---------------- Styles ---------------- */
const styles = `
:root{
  --wa-maxw: 440px;
}

/* Floating button */
.wa-fab{
  position: fixed;
  right: clamp(12px, 2.4vw, 22px);
  bottom: clamp(12px, 2.4vw, 22px);
  width: 56px; height: 56px; border-radius: 999px; border: none;
  background: #25D366; color: #fff; display: grid; place-items: center; cursor: pointer;
  box-shadow: 0 14px 36px rgba(0,0,0,.18);
  z-index: 90;
}

/* Backdrop */
.wa-scrim{
  position: fixed; inset: 0; background: rgba(0,0,0,.25); backdrop-filter: blur(2px);
  z-index: 89; animation: fade .18s ease;
}

/* Panel (sheet) */
.wa-sheet{
  position: fixed;
  right: clamp(12px, 2.4vw, 22px);
  bottom: calc(clamp(12px, 2.4vw, 22px) + 64px);
  width: min(var(--wa-maxw), calc(100vw - 24px));
  max-height: min(68vh, 700px);
  background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 20px 54px rgba(0,0,0,.20);
  z-index: 91; overflow: hidden; display: grid; grid-template-rows: auto 1fr;
  transform-origin: 100% 100%;
  animation: pop-in .22s cubic-bezier(.2,.8,.2,1);
}
@media (min-width: 900px){ :root{ --wa-maxw: 500px; } }
@media (min-width: 1400px){ :root{ --wa-maxw: 520px; } }

.wa-head{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding: 12px 14px; background: linear-gradient(135deg, rgba(246,195,32,.16), rgba(240,93,139,.12));
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.wa-title{ font-weight: 900; color: var(--bb-primary); }
.wa-icon-btn{
  width:32px; height:32px; border-radius:10px; border:1px solid rgba(0,0,0,.1); background:#fff; cursor:pointer;
  display:grid; place-items:center;
}

/* Interior grid: 1fr scrollable + auto footer */
.wa-view{
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 0;              /* required for nested scrolling */
}

/* The only scrollable area (hide scrollbars) */
.scroll-area{
  overflow: auto;
  padding: 10px 12px;
  min-height: 0;              /* allow it to shrink and scroll */
  -ms-overflow-style: none;   /* IE/Edge */
  scrollbar-width: none;      /* Firefox */
}
.scroll-area::-webkit-scrollbar{ display: none; } /* Chrome/Safari */

/* Sticky footer (fixed INSIDE the sheet) */
.sticky-footer{
  position: sticky; bottom: 0; background: #fff;
  border-top: 1px solid rgba(0,0,0,.06);
}
.footer-inner{
  padding: 10px 12px;
  max-width: calc(var(--wa-maxw) - 24px);
  margin: 0 auto;
}

/* Content blocks */
.menu{ display:grid; gap:10px; }
.menu-item{
  display:flex; align-items:center; gap:12px; padding:12px;
  border-radius:14px; border:1px solid rgba(0,0,0,.10); background:#fff; cursor:pointer;
  transition: background .12s ease, transform .12s ease;
}
.menu-item:hover{ background:#fafafa; transform: translateY(-1px); }
.mi-ic{ font-size:18px; }
.mi-text{ display:grid; gap:2px; flex:1; }
.mi-title{ font-weight:900; color: var(--bb-primary); }
.mi-sub{ opacity:.9; }

.panel{ display:grid; gap: 16px; }
.section{ display:grid; gap:10px; }
.panel-title{ margin:0; color: var(--bb-primary); font-weight:900; }
.panel-sub{ margin:0; color: var(--bb-primary); font-weight:900; }
.panel-copy{ margin:0; opacity:.92; color: var(--bb-primary); }

.faq{
  display:grid;
  gap:8px;
}

.faq-item{
  border-radius:12px;
  padding:10px 12px;
  background: rgba(255,255,255,0.06);           /* softer card on dark bg */
  border:1px solid rgba(255,255,255,0.14);
}

.faq-q{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  cursor:pointer;
  list-style:none;
  color: inherit;                               /* use your light text */
  font-weight:600;
}

.faq-q::-webkit-details-marker{ display:none; }

.faq-a{
  margin-top:6px;
  opacity:.85;
  color: inherit;                               /* no forced dark color */
  font-size:0.92rem;
}

/* Form */
.wa-form{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.wa-input{
  flex:1 1 auto; height:44px; border-radius:12px; border:1px solid rgba(0,0,0,.14);
  padding: 8px 12px; outline:none; background:#fff; color: var(--bb-primary);
}
.wa-btn{
  display:inline-flex; align-items:center; justify-content:center; height:44px; padding: 0 12px;
  border-radius:12px; border:none; text-decoration:none; font-weight:900; color:#fff;
}
.wa-btn.green{ background: #25D366; }
.wa-btn.pink{ background: var(--bb-accent); }

/* Animations */
@keyframes fade { from{opacity:0} to{opacity:1} }
@keyframes pop-in { from{opacity:0; transform: scale(.96)} to{opacity:1; transform: scale(1)} }
.fade-in{ animation: fade .15s ease; }

/* Mobile bottom-sheet behavior */
@media (max-width:560px){
  .wa-sheet{
    right: 0; left: 0; bottom: 0; width: auto; border-radius: 14px 14px 0 0;
    transform-origin: 50% 100%;
    max-width: none;
  }
  .footer-inner{ max-width: none; }
}
`;
