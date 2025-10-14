// src/components/home/HomeCarousel.tsx
import React, { useEffect, useState } from "react";
import { listCarouselImages, type CarouselImage } from "../../api/carouselImages";

const FALLBACKS = [
  "/images/placeholder/1.jpg",
  "/images/placeholder/2.jpg",
  "/images/placeholder/3.jpg",
];

export default function HomeCarousel(){
  const [imgs, setImgs] = useState<CarouselImage[]>([]);
  const [i, setI] = useState(0);

  useEffect(()=>{ (async ()=>{
    try{
      const got = await listCarouselImages();
      setImgs(got.length ? got : FALLBACKS.map((u,idx)=>({ key:`ph-${idx}`, url:u, sortOrder:idx } as any)));
    }catch{
      setImgs(FALLBACKS.map((u,idx)=>({ key:`ph-${idx}`, url:u, sortOrder:idx } as any)));
    }
  })(); }, []);

  useEffect(()=>{
    if (imgs.length<2) return;
    const t = setInterval(()=> setI(p => (p+1)%imgs.length), 4000);
    return ()=> clearInterval(t);
  }, [imgs]);

  if (imgs.length === 0) return null;

  return (
    <div className="hc">
      <style>{css}</style>
      <div className="viewport">
        {imgs.map((im, idx)=>(
          <img key={im.key} src={im.url} alt={im.altText || ""} className={`slide ${idx===i?"on":""}`} />
        ))}
      </div>
      {imgs.length>1 && (
        <div className="dots">
          {imgs.map((_, idx)=>(
            <button key={idx} className={idx===i?"on":""} onClick={()=>setI(idx)} aria-label={`Go to slide ${idx+1}`} />
          ))}
        </div>
      )}
    </div>
  );
}

const css = `
.hc{ position:relative; border-radius:16px; overflow:hidden; }
.viewport{ position:relative; aspect-ratio: 3 / 2; background:#eee; }
.slide{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  opacity:0; transform: scale(1.02); transition: opacity .4s ease, transform .6s ease;
}
.slide.on{ opacity:1; transform:none; }

.dots{ position:absolute; left:0; right:0; bottom:10px; display:flex; gap:6px; justify-content:center; }
.dots button{
  width:9px; height:9px; border-radius:999px; border:none; background:rgba(255,255,255,.6); cursor:pointer;
}
.dots button.on{ background:#fff; }
`;
