import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Setting = { key: string; value?: string; active?: boolean };

async function fetchAllSettings(): Promise<Setting[]> {
  try {
    const res = await fetch("/api/settings", { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function toSlug(key: string) {
  // "policy.refund_and_return" -> "refund-and-return"
  return key.replace(/^policy\./, "").replace(/[_\s]+/g, "-");
}
function titleFromKey(key: string) {
  const raw = key.replace(/^policy\./, "").replace(/[_-]+/g, " ");
  return raw.replace(/\b\w/g, (m) => m.toUpperCase());
}
function stripHtml(html: string) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export default function PoliciesIndexPage() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await fetchAllSettings();
      if (!alive) return;
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const policies = useMemo(() => {
    return (rows || [])
      .filter(s => s?.key?.startsWith("policy.") && (s.active ?? true))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  return (
    <div className="pol-wrap">
      <style>{css}</style>
      <div className="inner">
        <h1>Policies</h1>

        {loading && (
          <div className="grid">
            {Array.from({ length: 6 }).map((_,i)=><div className="card sk" key={i}/>)}
          </div>
        )}

        {!loading && policies.length === 0 && (
          <div className="empty">No policies published yet.</div>
        )}

        {!loading && policies.length > 0 && (
          <div className="grid">
            {policies.map(p => {
              const title = titleFromKey(p.key);
              const preview = (p.value || "").trim();
              const text = stripHtml(preview).slice(0, 180);
              return (
                <Link key={p.key} to={`/policies/${toSlug(p.key)}`} className="card">
                  <h3>{title}</h3>
                  <p>{text || "View policy"}{text && preview.length > 180 ? "…" : ""}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const css = `
.pol-wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 60vh; }
.inner{ max-width: 1000px; margin: 0 auto; padding: 24px 16px 40px; }
h1{ margin:0 0 12px; font-family:"DM Serif Display", Georgia, serif; }

.grid{ display:grid; gap:12px; grid-template-columns: repeat(2, 1fr); }
@media (max-width:780px){ .grid{ grid-template-columns: 1fr; } }

.card{
  display:block; text-decoration:none; color:inherit;
  background:#fff; border:1px solid rgba(0,0,0,.06);
  border-radius:14px; padding:14px; box-shadow:0 12px 30px rgba(0,0,0,.08);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.card:hover{ transform: translateY(-2px); box-shadow:0 18px 44px rgba(0,0,0,.12); border-color: rgba(246,195,32,.35); }
.card h3{ margin:0 0 6px; font-size:18px; font-weight:900; letter-spacing:.2px; }
.card p{ margin:0; opacity:.9; }

.sk{ height:86px; background:linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size:200% 100%; animation:shimmer 1.2s linear infinite; border-radius:14px; }
@keyframes shimmer{ from{background-position:200% 0} to{background-position:-200% 0} }

.empty{ padding: 16px 4px; opacity:.8; }
`;
