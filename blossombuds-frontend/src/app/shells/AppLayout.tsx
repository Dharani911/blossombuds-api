import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import WhatsappFab from "../../components/WhatsappFab";
import { useUI } from "../UIState";
import TopBanner from "../../components/TopBanner";
import EmailVerifyBanner from "../../components/EmailVerifyBanner";

export default function AppLayout() {
  const navigate = useNavigate();
  const { modal } = useUI();
  const blurred = modal !== "none";

  useEffect(() => {
    const onExpired = () => {
      navigate("/", { replace: true });
      setTimeout(() => { (window as any).__bbAuthBounced = false; }, 0);
    };
    window.addEventListener("bb-session-expired", onExpired);
    return () => window.removeEventListener("bb-session-expired", onExpired);
  }, [navigate]);

  return (
    <div className="app-wrap">
      <a href="#app-main" className="skip">Skip to content</a>

      <TopBanner />
      <Header />
      <EmailVerifyBanner />

      <main
        id="app-main"
        className={"app-main" + (blurred ? " blurred" : "")}
        role="main"
        aria-busy={blurred ? "true" : "false"}
      >
        <Outlet />
      </main>

      <Footer />
      <WhatsappFab />

      {/* Global toast mount (no logic; safe place for 2–3s toasts) */}
      <div id="bb-toaster-root" aria-live="polite" aria-atomic="true"></div>

      <style>{css}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mobile-first layout + safe-area padding; no business logic touched        */
/* ────────────────────────────────────────────────────────────────────────── */
const css = `
.app-wrap{
  --pad: 12px;
  --pad-lg: 16px;
  --maxw: 1200px;
  --ink: rgba(0,0,0,.06);
  --shadow: var(--bb-shadow, 0 10px 24px rgba(0,0,0,.08));
  background: var(--bb-bg, #FAF7E7);
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto; /* TopBanner, Header, VerifyBanner, main, footer */
}

/* Accessible skip link */
.skip{
  position:absolute; left:-9999px; top:auto; width:1px; height:1px; overflow:hidden;
}
.skip:focus{
  position:fixed; left:12px; top:12px; width:auto; height:auto;
  background:#000; color:#fff; padding:8px 10px; border-radius:10px; z-index:99999;
}

.app-main{
  /* Mobile first paddings with safe-area */
  padding: calc(var(--pad) + env(safe-area-inset-top, 0px)) var(--pad)
           calc(var(--pad) + env(safe-area-inset-bottom, 0px));
  max-width: var(--maxw);
  width: 100%;
  margin: 0 auto;
  min-height: 0; /* prevent overflow issues on mobile */
  transition: filter .2s ease;
}
.app-main.blurred{ filter: blur(6px); }

/* Give a gentle card spacing rhythm inside pages that render plain blocks */
.app-main > * { margin-block: 0; }
.app-main > * + * { margin-top: 12px; }

/* Larger screens get a bit more breathing room */
@media (min-width: 920px){
  .app-main{
    padding: var(--pad-lg) var(--pad-lg) calc(var(--pad-lg) + env(safe-area-inset-bottom, 0px));
  }
}

/* Ensure footer/WhatsApp FAB won’t clash on small screens with notches */
@supports (padding: max(0px)){
  .app-main{
    padding-bottom: max(14px, calc(var(--pad) + env(safe-area-inset-bottom, 0px)));
  }
}

/* Toast mount styles: top-center, mobile-safe, 2–3s can be controlled by caller */
#bb-toaster-root{
  position: fixed;
  inset: 8px 8px auto;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  pointer-events: none;
  display: grid;
  gap: 8px;
  max-width: min(92vw, 520px);
  padding-top: env(safe-area-inset-top, 0px);
}
@media (max-width: 520px){
  #bb-toaster-root{ inset: 8px 8px auto; }
}

/* Utility: make any inline toasts look on-brand if you inject them here */
#bb-toaster-root .bb-toast{
  pointer-events: auto;
  background: #fff;
  border: 1px solid var(--ink);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 12px 14px;
  color: var(--bb-primary, #4A4F41);
  font: 14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
}
#bb-toaster-root .bb-toast.good{ border-color: rgba(19,111,42,.25); background:#f0fff3; }
#bb-toaster-root .bb-toast.bad{ border-color: rgba(176,0,58,.25); background:#fff3f5; }
`;
