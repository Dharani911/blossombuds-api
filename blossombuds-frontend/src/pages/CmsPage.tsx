import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

/** Fetch a setting by key (works for plain text, {"value": "..."} or raw string JSON) */
async function fetchSettingValue(key: string): Promise<string> {
  try {
    const res = await fetch(apiUrl(`/api/settings/${encodeURIComponent(key)}`), {
      //credentials: "include",
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

/** Map route slug -> settings key + nice title */
const SLUGS: Record<
  string,
  { key: string; title: string }
> = {
  terms: { key: "about.terms_and_conditions", title: "Terms & Conditions" },
  privacy: { key: "policy.privacy", title: "Privacy Policy" }, // optional—shows “not set” if missing
  disclaimer: { key: "about.disclaimer", title: "Disclaimer" },
  about: { key: "about.about_us", title: "About Us" },
  shipping: { key: "policy.shipping", title: "Shipping Policy" },
  refunds: { key: "policy.refund_and_return", title: "Refund & Return Policy" },
};

export default function CmsPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const meta = useMemo(() => SLUGS[slug] || null, [slug]);

  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!meta) return;
      setLoading(true);
      const v = await fetchSettingValue(meta.key);
      if (!alive) return;
      setBody(v || "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [meta]);

  if (!meta) {
    return (
      <div className="cms-wrap">
        <style>{css}</style>
        <div className="cms-inner">
          <h1>Page not found</h1>
          <p className="muted">We couldn’t find that page.</p>
        </div>
      </div>
    );
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(body);

  return (
    <div className="cms-wrap">
      <style>{css}</style>
      <div className="cms-inner">
        <h1>{meta.title}</h1>

        {loading && <div className="sk" />}

        {!loading && !body && (
          <div className="empty">
            <div className="empty-icon">📝</div>
            <p className="muted">This page hasn’t been set up yet.</p>
          </div>
        )}

        {!loading && !!body && (
          <div className="cms-card">
            {looksLikeHtml ? (
              <div
                className="cms-body prose"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <div className="cms-body prose">
                {body.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}
          </div>

        )}
      </div>
    </div>
  );
}

const css = `
.cms-wrap{ background: var(--bb-bg); color: var(--bb-primary); min-height: 60vh; }
.cms-inner{ max-width: 900px; margin: 0 auto; padding: 24px 16px 40px; }
h1{ margin: 0 0 12px; font-family: "DM Serif Display", Georgia, serif; }
.muted{ opacity: .8; }

.sk{
  height: 120px;
  border-radius: 14px;
  background: linear-gradient(90deg, #eee, #f8f8f8, #eee);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer{ from{ background-position: 200% 0; } to{ background-position: -200% 0; } }

.empty{ padding: 12px 0; }
.empty-icon{ font-size: 24px; line-height: 1; }

.prose p{ line-height: 1.6; margin: 10px 0; }
.prose ul, .prose ol{ margin: 10px 0 10px 22px; }
.prose h2{ margin: 16px 0 8px; font-size: 20px; }
.prose h3{ margin: 14px 0 8px; font-size: 17px; }
.cms-card {
  background: #fff;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(0,0,0,.06);
  margin-top: 12px;
}

`;
