import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {apiUrl} from "../api/base";
type Setting = { key: string; value?: string; active?: boolean };

async function fetchAllSettings(): Promise<Setting[]> {
  try {
    const res = await fetch(apiUrl("/api/settings"), { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function toSlug(key: string) {
  return key.replace(/^policy\./, "").replace(/[_\s]+/g, "-");
}
function titleFromKey(key: string) {
  const raw = key.replace(/^policy\./, "").replace(/[_-]+/g, " ");
  return raw.replace(/\b\w/g, (m) => m.toUpperCase());
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

        {loading && <div className="sk" style={{ height: 200 }} />}

        {!loading && policies.length > 0 && (
          <>
            <div className="chip-row">
              {policies.map(p => (
                <a key={p.key} className="chip" href={`#${toSlug(p.key)}`}>
                  {titleFromKey(p.key)}
                </a>
              ))}
            </div>

            {policies.map(p => {
              const isHtml = /<\/?[a-z][\s\S]*>/i.test(p.value || "");
              return (
                <section key={p.key} id={toSlug(p.key)} className="policy-section">
                  <h2>{titleFromKey(p.key)} Policy</h2>
                  {!p.value && <div className="empty">This policy is not available.</div>}
                  {!!p.value && (
                    isHtml
                      ? <div className="prose" dangerouslySetInnerHTML={{ __html: p.value || "" }} />
                      : <div className="prose">{(p.value || "").split(/\n{2,}/).map((t, i) => <p key={i}>{t}</p>)}</div>
                  )}
                </section>
              );
            })}
          </>
        )}

        {!loading && policies.length === 0 && (
          <div className="empty">No policies published yet.</div>
        )}
      </div>
    </div>
  );
}

const css = `
.pol-wrap {
  background: var(--bb-bg);
  color: var(--bb-primary);
  min-height: 60vh;
}
.inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}
h1, h2 {
  font-family: "DM Serif Display", Georgia, serif;
  color: var(--bb-primary);
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0 30px;
}
.chip {
  display: inline-block;
  padding: 6px 14px;
  font-size: 14px;
  border-radius: 999px;
  background: var(--bb-accent-2);
  color: #2b2b2b;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s ease;
}
.chip:hover {
  background: #eabf10;
}
.policy-section {
  margin-bottom: 48px;
}
.prose p {
  line-height: 1.6;
  margin: 10px 0;
}
.prose ul, .prose ol {
  margin: 10px 0 10px 22px;
}
.empty {
  opacity: 0.8;
}
.sk {
  height: 120px;
  border-radius: 14px;
  background: linear-gradient(90deg,#eee,#f8f8f8,#eee);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
html {
  scroll-behavior: smooth;
}
.policy-section {
  margin-bottom: 48px;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.05);
}

.policy-section:not(:last-child)::after {
  content: "";
  display: block;
  height: 1px;
  background: rgba(0,0,0,0.05);
  margin: 36px 0 0;
}
.policy-section h2 {
  margin-top: 0;
  font-size: 22px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
  padding-bottom: 8px;
}

`;
