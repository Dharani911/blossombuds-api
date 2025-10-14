// src/pages/admin/components/AdminCarouselImagesSetting.tsx
import React, { useEffect, useState } from "react";
import {
  listCarouselImages,
  uploadCarouselImage,
  replaceCarouselImages,
  deleteCarouselImage,
  type CarouselImage,
} from "../../api/carouselImages";

const INK = "rgba(0,0,0,.1)";

export default function AdminCarouselImagesSetting() {
  const [items, setItems] = useState<CarouselImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try { setItems(await listCarouselImages()); } catch {}
    })();
  }, []);

  function bumpToast(m:string){ setToast(m); setTimeout(()=>setToast(null), 1800); }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const created = await uploadCarouselImage(f, { sortOrder: items.length });
      setItems(prev => [...prev, created].sort(cmp));
      bumpToast("Uploaded");
    } catch (err:any) {
      bumpToast(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function cmp(a:CarouselImage,b:CarouselImage){
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }

  function move(index:number, dir:-1|1){
    setItems(prev=>{
      const arr = [...prev];
      const j = index + dir;
      if (j<0 || j>=arr.length) return prev;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return arr.map((it, k)=>({...it, sortOrder:k}));
    });
  }

  async function saveOrder(){
    setBusy(true);
    try { await replaceCarouselImages(items.map((it, i)=>({...it, sortOrder:i}))); bumpToast("Saved"); }
    catch(e:any){ bumpToast(e?.message || "Save failed"); }
    finally{ setBusy(false); }
  }

  async function removeOne(key:string){
    if (!confirm("Remove this image?")) return;
    setBusy(true);
    try {
      await deleteCarouselImage(key);
      setItems(prev=>prev.filter(i=>i.key!==key).map((it,i)=>({...it, sortOrder:i})));
      bumpToast("Removed");
    } catch(e:any){ bumpToast(e?.message || "Delete failed"); }
    finally{ setBusy(false); }
  }

  return (
    <section className="acis">
      <style>{css}</style>
      {toast && <div className="toast">{toast}</div>}

      <div className="head">
        <h3>Home Carousel Images</h3>
        <div className="actions">
          <label className={`pick ${busy?"disabled":""}`}>
            <input type="file" accept="image/*" onChange={onPick} disabled={busy} />
            + Upload
          </label>
          <button className="ghost" onClick={saveOrder} disabled={busy}>Save order</button>
        </div>
      </div>

      {items.length===0 ? (
        <div className="empty">No images yet.</div>
      ) : (
        <ul className="list">
          {items.sort(cmp).map((it, idx)=>(
            <li key={it.key} className="row">
              <img src={it.url} alt={it.altText || ""} />
              <div className="meta">
                <div className="path">{it.key}</div>
                <div className="controls">
                  <button className="ghost" onClick={()=>move(idx, -1)} disabled={idx===0 || busy}>↑</button>
                  <button className="ghost" onClick={()=>move(idx, +1)} disabled={idx===items.length-1 || busy}>↓</button>
                  <button className="ghost bad" onClick={()=>removeOne(it.key)} disabled={busy}>Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const css = `
.acis{ border:1px solid ${INK}; border-radius:12px; padding:12px; background:#fff; }
.head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.actions{ display:flex; gap:8px; }

.pick{ border:1px dashed ${INK}; border-radius:10px; padding:6px 10px; cursor:pointer; background:#fafafa; }
.pick input{ display:none; }
.pick.disabled{ opacity:.6; cursor:default; }

.ghost{ height:32px; padding:0 10px; border-radius:8px; border:1px solid ${INK}; background:#fff; cursor:pointer; }
.ghost.bad{ border-color:#e57373; color:#b00020; }

.list{ list-style:none; display:grid; gap:10px; padding:0; margin:0; }
.row{ display:grid; grid-template-columns: 160px 1fr; gap:10px; align-items:center; border:1px solid ${INK}; border-radius:10px; padding:8px; }
.row img{ width:160px; height:106px; object-fit:cover; border-radius:8px; }
.meta{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.path{ font-size:12px; opacity:.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.controls{ display:flex; gap:6px; }

.empty{ padding:16px; opacity:.8; }
.toast{ position:fixed; right:14px; bottom:14px; background:#333; color:#fff; padding:8px 10px; border-radius:8px; }
`;
