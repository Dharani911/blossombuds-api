import React from "react";

export default function ProfileHero({
  initials,
  fullName,
  ordersCount,
  onLogout,
}: {
  initials: string;
  fullName: string;
  ordersCount: number;
  onLogout: () => void;
}) {
  return (
    <section className="pro2-hero">
      <style>{styles}</style>
      <div className="pro2-hero-inner">
        <div className="pro2-id">
          <div className="ring"><div className="avatar">{initials}</div></div>
          <div className="idtext">
            <h1>Hii {fullName}</h1>
          </div>
        </div>
        <div className="stats">
          <div className="s">
            <div className="s-num">{ordersCount}</div>
            <div className="s-lbl">Orders</div>
          </div>
          <button className="btn ghost" onClick={onLogout}>Logout</button>
        </div>
      </div>
      <div className="p2 a" aria-hidden />
      <div className="p2 b" aria-hidden />
    </section>
  );
}

const styles = `
.pro2-hero{
  position: relative;
  background:
    radial-gradient(1000px 320px at -10% -50%, rgba(240,93,139,.16), transparent 60%),
    radial-gradient(900px 280px at 110% -40%, rgba(246,195,32,.18), transparent 58%),
    #fff;
  border-bottom: 1px solid rgba(0,0,0,.06);
}
.pro2-hero-inner{
  max-width: 1200px; margin: 0 auto; padding: 22px 16px;
  display:flex; align-items:center; justify-content: space-between; gap: 14px;
}
.pro2-id{ display:flex; align-items:center; gap: 12px; }
.idtext{
  min-width: 0;
}
.ring{ --sz: 64px; width: var(--sz); height: var(--sz); border-radius: 999px; padding: 2px;
  background: conic-gradient(from 220deg, #F05D8B, #F6C320, #F05D8B); box-shadow: 0 10px 30px rgba(0,0,0,.10); }
.avatar{ width:100%; height:100%; border-radius:999px; display:grid; place-items:center; background:#fff; color:var(--bb-primary);
  font-weight:900; font-family:"DM Serif Display", Georgia, serif; letter-spacing:.5px; }
.idtext h1{
  margin:0;
  font-family:"DM Serif Display", Georgia, serif;
  letter-spacing:.2px;
  color:var(--bb-primary);
  font-size: clamp(18px, 4.6vw, 24px);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.stats{ display:flex; align-items:center; gap: 14px; }
.s{ display:grid; gap: 2px; place-items:end; }
.s-num{ font-weight: 900; font-size: 20px; }
.s-lbl{ font-weight: 700; font-size: 12px; opacity:.9; }

.p2{ position:absolute; filter: blur(26px); opacity:.5; pointer-events:none; }
.p2.a{ width:240px; height:240px; background: radial-gradient(circle at 40% 40%, rgba(240,93,139,.28), transparent 60%); left:-60px; top:-60px; }
.p2.b{ width:280px; height:280px; background: radial-gradient(circle at 60% 40%, rgba(246,195,32,.28), transparent 60%); right:-80px; top:-90px; }

.btn{ height: 38px; border-radius: 12px; border:none; padding: 0 14px; font-weight: 900; cursor:pointer; background: var(--bb-accent); color:#fff; box-shadow: 0 14px 34px rgba(240,93,139,.35); }
.btn.ghost{ background: #fff; color: var(--bb-primary); border: 1px solid rgba(0,0,0,.10); box-shadow:none; }

@media (max-width: 480px){
  .ring{
    --sz: 56px;
  }
  .idtext h1{
    font-size: 17px;
    max-width: 60vw;
  }
}

`;
