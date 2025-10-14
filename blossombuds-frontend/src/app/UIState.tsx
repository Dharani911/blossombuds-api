import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";

type ModalKind = "none" | "login";
type UIContextType = { modal: ModalKind; openLogin: () => void; close: () => void; };
const UIContext = createContext<UIContextType>(null!);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalKind>("none");
  useEffect(()=>{ document.body.style.overflow = modal==="none" ? "" : "hidden"; return ()=>{document.body.style.overflow="";};},[modal]);
  const value = useMemo(()=>({ modal, openLogin:()=>setModal("login"), close:()=>setModal("none") }),[modal]);
  return (
    <UIContext.Provider value={value}>
      {children}
      <ModalPortal active={modal!=="none"}>{modal==="login" && <LoginModal/>}</ModalPortal>
    </UIContext.Provider>
  );
}
export const useUI = ()=>useContext(UIContext);

function ModalPortal({active, children}:{active:boolean; children?:React.ReactNode}){
  if (!active) return null;
  return createPortal(
    <div aria-modal role="dialog" style={{
      position:"fixed", inset:0, zIndex:1000,
      background:"rgba(250,247,231,0.55)", backdropFilter:"blur(8px) saturate(140%)"
    }}>
      <div style={{minHeight:"100%", display:"grid", placeItems:"center", padding:16}}>{children}</div>
    </div>,
    document.body
  );
}

function LoginModal(){
  const { login } = useAuth();
  const { close } = useUI();
  const nav = useNavigate();
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false); const [error,setError] = useState<string|null>(null);

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try { await login(email,password); close(); nav("/profile",{replace:true}); }
    catch(err:any){ setError(err?.response?.data?.message || "Login failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      width:"100%", maxWidth:440, background:"#fff", borderRadius:20,
      boxShadow:"0 24px 60px rgba(0,0,0,.18)", overflow:"hidden", border:"1px solid rgba(0,0,0,.06)"
    }}>
      <div style={{padding:"16px 18px", background:"linear-gradient(180deg, rgba(246,195,32,.28), rgba(246,195,32,.06))"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{margin:0, color:"var(--bb-primary)"}}>Welcome back</h3>
          <button onClick={close} aria-label="Close" style={{
            width:36,height:36,border:"none",borderRadius:999,cursor:"pointer",background:"#fff",boxShadow:"var(--bb-shadow)",fontWeight:800
          }}>×</button>
        </div>
      </div>
      <form onSubmit={submit} style={{padding:18, display:"grid", gap:12}}>
        <label style={{display:"grid", gap:6}}>
          <span style={{fontWeight:700, color:"var(--bb-primary)"}}>Email</span>
          <input required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle}/>
        </label>
        <label style={{display:"grid", gap:6}}>
          <span style={{fontWeight:700, color:"var(--bb-primary)"}}>Password</span>
          <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}/>
        </label>
        {error && <div style={{color:"#b00020", fontWeight:700}}>{error}</div>}
        <button type="submit" className="btn" disabled={loading}>{loading? "Signing in…" : "Login"}</button>
        <div style={{display:"flex",gap:12,justifyContent:"space-between",fontSize:14,opacity:.85}}>
          <span>New here? <a href="/register">Create account</a></span>
          <a href="/login?reset=1">Forgot password?</a>
        </div>
      </form>
    </div>
  );
}
const inputStyle: React.CSSProperties = {
  height:44, padding:"8px 12px", borderRadius:12,
  border:"1px solid rgba(0,0,0,.12)", outline:"none",
  background:"#fff", boxShadow:"inset 0 1px 0 rgba(0,0,0,.03)"
};
