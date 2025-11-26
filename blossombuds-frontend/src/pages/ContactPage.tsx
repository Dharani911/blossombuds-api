// src/pages/ContactPage.tsx
import React, { useEffect, useState } from "react";
import { apiUrl } from "../api/base";

/** Fetch a setting by key directly (robust to JSON or plain text) */
async function fetchSettingValue(key: string): Promise<string> {
  try {
    const res = await fetch(apiUrl(`/api/settings/${encodeURIComponent(key)}`), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json === "string") return json;
      if (typeof (json as any)?.value === "string") return (json as any).value;
      if (typeof (json as any)?.url === "string") return (json as any).url;
      if (typeof (json as any)?.link === "string") return (json as any).link;
      return "";
    } catch {
      // plain string
      return text;
    }
  } catch {
    return "";
  }
}

/** Normalize a URL; if missing protocol, add https:// */
function normalizeUrl(u: string) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

type ContactDetails = {
  name: string | null;
  address: string | null;
  email: string | null;
  instagram: string | null;
  website: string | null;
  whatsapp: string | null;
};

export default function ContactPage() {
  const [contact, setContact] = useState<ContactDetails>({
    name: null,
    address: null,
    email: null,
    instagram: null,
    website: null,
    whatsapp: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const envIg = (import.meta as any)?.env?.VITE_BRAND_INSTAGRAM || "";

        const [name, address, email, insta, url, wa] = await Promise.all([
          fetchSettingValue("brand.name"),
          fetchSettingValue("brand.address"),
          fetchSettingValue("brand.support_email"),
          fetchSettingValue("brand.instagram"),
          fetchSettingValue("brand.url"),
          fetchSettingValue("brand.whatsapp"),
        ]);

        if (!alive) return;

        const finalIg = normalizeUrl(insta || envIg || "");
        setContact({
          name: name || null,
          address: address || null,
          email: email || null,
          instagram: finalIg || null,
          website: url || null,
          whatsapp: wa || null,
        });
      } catch (e) {
        console.error("Failed to load contact settings", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const websiteHref = normalizeUrl(contact.website || "");

  return (
    <main className="contact-page" aria-labelledby="contact-heading">
      <style>{styles}</style>

      <div className="cp-container">
        <header className="cp-header">
          <p className="cp-eyebrow">Contact</p>
          <h1 id="contact-heading">We&apos;d love to hear from you</h1>
          <p className="cp-lead">
            Have a question about an order, customization, or shipping? Reach out using
            any of the options below.
          </p>
        </header>

        {loading ? (
          <section aria-busy="true" className="cp-loading">
            Loading contact details…
          </section>
        ) : (
          <div className="cp-grid">
            <section className="cp-card cp-info" aria-label="Contact details">
              <div className="cp-card-head">
                <h2>Reach us</h2>
                {contact.name && <p className="cp-brand">{contact.name}</p>}
                <p className="cp-small">
                  For order queries, please include your name &amp; order ID when you contact us.
                </p>
              </div>

              <ul className="cp-list">
                {contact.address && (
                  <li className="cp-item">
                    <span className="cp-icon" aria-hidden>
                      📍
                    </span>
                    <div>
                      <div className="cp-label">Studio address</div>
                      <div className="cp-value">{contact.address}</div>
                    </div>
                  </li>
                )}

                {contact.email && (
                  <li className="cp-item">
                    <span className="cp-icon" aria-hidden>
                      ✉️
                    </span>
                    <div>
                      <div className="cp-label">Email</div>
                      <a className="cp-value cp-link" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </div>
                  </li>
                )}

                {contact.whatsapp && (
                  <li className="cp-item">
                    <span className="cp-icon" aria-hidden>
                      💬
                    </span>
                    <div>
                      <div className="cp-label">WhatsApp</div>
                      <div className="cp-value">{contact.whatsapp}</div>
                      <p className="cp-note">
                        For fastest replies, message us on WhatsApp with your name &amp; query.
                      </p>
                    </div>
                  </li>
                )}

                {contact.instagram && (
                  <li className="cp-item">
                    <span className="cp-icon" aria-hidden>
                      📷
                    </span>
                    <div>
                      <div className="cp-label">Instagram</div>
                      <a
                        className="cp-value cp-link"
                        href={contact.instagram}
                        target="_blank"
                        rel="noreferrer"
                      >
                        @blossom_buds_floral_artistry
                      </a>
                    </div>
                  </li>
                )}

                {websiteHref && (
                  <li className="cp-item">
                    <span className="cp-icon" aria-hidden>
                      🌐
                    </span>
                    <div>
                      <div className="cp-label">Website</div>
                      <a
                        className="cp-value cp-link"
                        href={websiteHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {contact.website}
                      </a>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

const styles = `
.contact-page{
  background: var(--bb-bg, #FAF7E7);
  min-height: calc(100vh - 200px); /* leaves room for header/footer */
  padding: clamp(24px, 5vw, 40px) 0;
}

.cp-container{
  max-width: 900px;
  margin: 0 auto;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
}

/* Header */
.cp-header{
  text-align: left;
  margin-bottom: clamp(18px, 4vw, 24px);
}
.cp-eyebrow{
  margin:0 0 4px;
  text-transform: uppercase;
  letter-spacing: .16em;
  font-size: 11px;
  color: rgba(0,0,0,.6);
}
.cp-header h1{
  margin: 0 0 6px;
  font-size: clamp(24px, 4.4vw, 32px);
  font-weight: 900;
  color: var(--bb-primary, #4A4F41);
}
.cp-lead{
  margin:0;
  max-width: 55ch;
  color: var(--bb-primary, #4A4F41);
  opacity:.9;
}

/* Layout wrapper */
.cp-grid{
  margin-top: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

/* Card */
.cp-card{
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 14px 32px rgba(0,0,0,.08);
  padding: 18px 18px 16px;
}
.cp-card-head{
  margin-bottom: 10px;
}
.cp-card h2{
  margin:0 0 4px;
  font-size: 18px;
  font-weight: 900;
  color: var(--bb-primary, #4A4F41);
}
.cp-brand{
  margin:0;
  font-weight: 700;
  color: var(--bb-primary, #4A4F41);
}
.cp-small{
  margin-top: 6px;
  font-size: 12px;
  opacity:.75;
}

/* Info list */
.cp-list{
  list-style:none;
  padding:0;
  margin: 10px 0 0;
  display:grid;
  gap: 10px;
}
.cp-item{
  display:flex;
  gap:10px;
  align-items:flex-start;
}
.cp-icon{
  width:26px; height:26px;
  border-radius:999px;
  display:grid; place-items:center;
  background: rgba(0,0,0,.03);
  font-size:14px;
}
.cp-label{
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: rgba(0,0,0,.55);
  margin-bottom: 2px;
}
.cp-value{
  font-size: 14px;
  color: var(--bb-primary, #4A4F41);
}
.cp-note{
  margin: 4px 0 0;
  font-size: 12px;
  opacity:.8;
}
.cp-link{
  text-decoration:none;
  font-weight:600;
}
.cp-link:hover{ text-decoration:underline; }

.cp-loading{
  margin-top: 32px;
  font-size: 14px;
  color: rgba(0,0,0,.65);
}

/* Responsive */
@media (max-width: 560px){
  .cp-card{
    border-radius: 14px;
    box-shadow: 0 10px 26px rgba(0,0,0,.08);
    padding: 16px 14px 14px;
  }
  .cp-item{
    align-items:flex-start;
  }
}
`;
