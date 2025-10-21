import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

async function fetchSettingValue(key: string): Promise<string> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json === "string") return json;
      if (typeof (json as any)?.value === "string") return (json as any).value;
      return "";
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

function titleFromSlug(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}

export default function PolicyPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const key = useMemo(() => `policy.${slug.replace(/-/g, "_")}`, [slug]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const v = await fetchSettingValue(key);
      if (!alive) return;
      setBody(v || "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [key]);

  const title = titleFromSlug(slug);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(body);

  return (
    <div className="polpg-wrap">
      <style>{css}</style>
      <div className="inner">
        <div className="crumbs">
          <Link to="/policies">← All Policies</Link>
        </div>
        <h1>{title}</h1>

        {loading && <div className="sk" />}

        {!loading && !body && (
          <div className="empty">This policy hasn’t been published yet.</div>
        )}

        {!loading && !!body && (
          looksLikeHtml
            ? <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
            : <div className="prose">{body.split(/\n{2,}/).map((p,i)=><p key={i}>{p}</p>)}</div>
        )}
      </div>
    </div>
  );
}

const css = `
.polpg-wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 60vh; }
.inner{ max-width: 900px; margin: 0 auto; padding: 24px 16px 40px; }
h1{ margin: 0 0 12px; font-family: "DM Serif Display", Georgia, serif; }
.crumbs{ margin-bottom: 6px; }
.crumbs a{ text-decoration:none; }
.crumbs a:hover{ text-decoration:underline; }

.sk{ height: 120px; border-radius: 14px; background:linear-gradient(90deg,#eee,#f8f8f8,#eee); background-size:200% 100%; animation:shimmer 1.2s linear infinite; }
@keyframes shimmer{ from{background-position:200% 0} to{background-position:-200% 0} }

.prose p{ line-height:1.6; margin:10px 0; }
.prose ul, .prose ol{ margin:10px 0 10px 22px; }
.empty{ opacity:.8; }
`;
