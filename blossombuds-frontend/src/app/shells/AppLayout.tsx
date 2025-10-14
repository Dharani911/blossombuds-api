import { useEffect } from "react";
import { Outlet,useNavigate  } from "react-router-dom";
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
        // Optional: toast if you have a global toaster here
        // toasts.push("Session ended. Please log in again.", "bad");

        // Redirect home immediately (single time)
        navigate("/", { replace: true });
        // reset flag for future sessions after navigation
        setTimeout(() => { (window as any).__bbAuthBounced = false; }, 0);
      };

      window.addEventListener("bb-session-expired", onExpired);
      return () => window.removeEventListener("bb-session-expired", onExpired);
    }, [navigate]);
  return (
    <div style={{minHeight:"100dvh",display:"flex",flexDirection:"column",background:"var(--bb-bg)"}}>
      <TopBanner />
      <Header/>
      <EmailVerifyBanner/>
      <main style={{flex:1, filter: blurred ? "blur(6px)" : "none", transition:"filter .2s ease"}}>
        <Outlet/>
      </main>
      <Footer/>
      <WhatsappFab/>
    </div>
  );
}
