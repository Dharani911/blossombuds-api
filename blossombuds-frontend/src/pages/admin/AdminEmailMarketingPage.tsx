import React, { useEffect, useMemo, useState } from "react";
import { Sensitive } from "../../components/admin/Sensitive";
import {
  createEmailCampaign,
  getEmailCampaigns,
  getEmailCampaignRecipients,
  sendEmailCampaign,
  type CreateEmailCampaignRequest,
  type EmailCampaign,
  type EmailCampaignRecipient,
} from "../../api/adminEmailMarketing";

/* ─── brand palette (matches other admin pages) ─── */
const PRIMARY = "#4A4F41";
const ACCENT = "#F05D8B";
const GOLD = "#F6C320";
const INK = "rgba(0,0,0,.08)";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "SENT" || status === "COMPLETED" ? "em-badge ok" :
    status === "FAILED" ? "em-badge bad" :
    status === "PARTIAL" ? "em-badge warn" :
    status === "SENDING" ? "em-badge pending" :
    "em-badge muted";
  return <span className={cls}>{status}</span>;
}

/** Admin page for creating and sending marketing email campaigns. Audience is always the same
 *  fixed rule — customers with no phone on file, not unsubscribed — phone/WhatsApp is the
 *  priority channel; there is no per-campaign audience picker like the WhatsApp CRM page has. */
export default function AdminEmailMarketingPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [recipients, setRecipients] = useState<EmailCampaignRecipient[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => ({
    campaigns: campaigns.length,
    recipients: campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0),
    sent: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
    failed: campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0),
  }), [campaigns]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const list = await getEmailCampaigns();
      setCampaigns(list || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCampaigns(); }, []);

  useEffect(() => {
    if (!selectedCampaignId) { setRecipients([]); return; }
    (async () => {
      try {
        const list = await getEmailCampaignRecipients(selectedCampaignId);
        setRecipients(list || []);
      } catch {
        setRecipients([]);
      }
    })();
  }, [selectedCampaignId]);

  async function handleCreate() {
    setErr(null);
    setMessage(null);
    if (!title.trim() || !subject.trim() || !bodyText.trim()) {
      setErr("Title, subject, and body are all required.");
      return;
    }
    setCreating(true);
    try {
      const payload: CreateEmailCampaignRequest = {
        title: title.trim(),
        subject: subject.trim(),
        bodyText,
      };
      const created = await createEmailCampaign(payload);
      setCampaigns((prev) => [created, ...prev]);
      setSelectedCampaignId(created.id);
      setTitle("");
      setSubject("");
      setBodyText("");
      setMessage(`Draft created — ${created.totalRecipients} eligible recipient(s) resolved.`);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not create campaign.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSend(campaign: EmailCampaign) {
    if (!window.confirm(
      `Send "${campaign.title}" to ${campaign.totalRecipients} recipient(s) now? This sends real email immediately.`
    )) {
      return;
    }
    setErr(null);
    setMessage(null);
    setSendingId(campaign.id);
    try {
      const updated = await sendEmailCampaign(campaign.id);
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedCampaignId === campaign.id) {
        const list = await getEmailCampaignRecipients(campaign.id);
        setRecipients(list || []);
      }
      setMessage(`"${updated.title}" finished — ${updated.sentCount} sent, ${updated.failedCount} failed.`);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not send campaign.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="em-wrap">
      <style>{css}</style>

      <div className="em-head">
        <div>
          <h1>Email Marketing</h1>
          <p className="muted">
            Sends only to customers with <b>no phone number on file</b> — phone/WhatsApp is the
            priority channel, email is the fallback for customers unreachable there. Unsubscribed
            customers are always excluded.
          </p>
        </div>
      </div>

      <div className="em-stats">
        <div className="em-stat"><span className="n">{stats.campaigns}</span><span className="l">Campaigns</span></div>
        <div className="em-stat"><span className="n">{stats.recipients}</span><span className="l">Total Recipients</span></div>
        <div className="em-stat ok"><span className="n">{stats.sent}</span><span className="l">Sent</span></div>
        <div className="em-stat bad"><span className="n">{stats.failed}</span><span className="l">Failed</span></div>
      </div>

      {err && <div className="em-alert bad">{err}</div>}
      {message && <div className="em-alert ok">{message}</div>}

      <section className="em-card">
        <h3>New campaign</h3>
        <label className="em-field">
          <span>Internal title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. August newsletter" />
        </label>
        <label className="em-field">
          <span>Subject line</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New arrivals this week 🌸" />
        </label>
        <label className="em-field">
          <span>Body</span>
          <textarea
            rows={8}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder={`Write the email body here.\nFor a link, use: {{A|Shop now|https://www.blossom-buds-floral-artistry.com}}`}
          />
          <span className="hint">
            Use <code>{"{{A|Label|URL}}"}</code> for links — the same format used by every other
            outgoing email. An unsubscribe link is added automatically.
          </span>
        </label>
        <button className="em-btn primary" disabled={creating} onClick={handleCreate}>
          {creating ? "Creating…" : "Create Campaign (Draft)"}
        </button>
      </section>

      <section className="em-card">
        <h3>Campaigns</h3>
        {loading && <div className="muted pad">Loading…</div>}
        {!loading && campaigns.length === 0 && <div className="muted pad">No campaigns yet.</div>}
        {!loading && campaigns.length > 0 && (
          <div className="em-table">
            <div className="em-trow em-thead">
              <div>Title</div>
              <div>Subject</div>
              <div>Status</div>
              <div>Recipients</div>
              <div>Sent</div>
              <div>Failed</div>
              <div></div>
            </div>
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={"em-trow" + (selectedCampaignId === c.id ? " active" : "")}
                onClick={() => setSelectedCampaignId(c.id === selectedCampaignId ? null : c.id)}
              >
                <div className="strong">{c.title}</div>
                <div className="muted">{c.subject}</div>
                <div><StatusBadge status={c.status} /></div>
                <div>{c.totalRecipients}</div>
                <div>{c.sentCount}</div>
                <div>{c.failedCount}</div>
                <div>
                  {(c.status === "DRAFT" || c.status === "PARTIAL" || c.status === "FAILED") && (
                    <button
                      className="em-btn sm"
                      disabled={sendingId === c.id}
                      onClick={(e) => { e.stopPropagation(); handleSend(c); }}
                    >
                      {sendingId === c.id ? "Sending…" : "Send"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedCampaignId && (
        <section className="em-card">
          <h3>Recipients</h3>
          {recipients.length === 0 && <div className="muted pad">No recipients to show.</div>}
          {recipients.length > 0 && (
            <div className="em-table">
              <div className="em-trow em-thead">
                <div>Name</div>
                <div>Email</div>
                <div>Status</div>
                <div>Error</div>
              </div>
              {recipients.map((r) => (
                <div className="em-trow" key={r.id}>
                  <Sensitive as="div">{r.recipientName || "—"}</Sensitive>
                  <Sensitive as="div">{r.email}</Sensitive>
                  <div><StatusBadge status={r.status} /></div>
                  <div className="muted">{r.errorMessage || "—"}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------- Styles ---------------------------------- */
const css = `
.em-wrap{ max-width: 1200px; margin: 0 auto; padding: 4px 2px 24px; color: ${PRIMARY}; }
.em-head h1{ margin: 0 0 4px; font-size: 22px; font-weight: 900; }
.em-head .muted{ opacity: .8; font-size: 13px; max-width: 720px; }

.em-stats{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0; }
.em-stat{
  background:#fff; border:1px solid ${INK}; border-radius:14px; padding:14px;
  display:flex; flex-direction:column; gap:2px; box-shadow: 0 8px 20px rgba(0,0,0,.05);
}
.em-stat .n{ font-size: 22px; font-weight: 900; }
.em-stat .l{ font-size: 12px; opacity: .75; }
.em-stat.ok .n{ color: #2e7d32; }
.em-stat.bad .n{ color: ${ACCENT}; }

.em-alert{ padding: 10px 14px; border-radius: 12px; margin-bottom: 12px; font-weight: 700; font-size: 13px; }
.em-alert.bad{ background: #fff3f5; color: #b0003a; border: 1px solid rgba(240,93,139,.25); }
.em-alert.ok{ background: rgba(46,125,50,.08); color: #2e7d32; border: 1px solid rgba(46,125,50,.25); }

.em-card{
  background:#fff; border:1px solid ${INK}; border-radius:14px; padding:16px; margin-bottom: 14px;
  box-shadow: 0 8px 20px rgba(0,0,0,.05);
}
.em-card h3{ margin: 0 0 12px; font-size: 15px; font-weight: 900; }

.em-field{ display:grid; gap:6px; margin-bottom: 12px; }
.em-field > span:first-child{ font-size: 12px; font-weight: 800; opacity: .85; }
.em-field input, .em-field textarea{
  border:1px solid ${INK}; border-radius:10px; padding:9px 12px; font: inherit; color: inherit;
  font-family: inherit; resize: vertical;
}
.em-field .hint{ font-size: 11px; opacity: .65; }
.em-field .hint code{ background:#f3f3f3; border-radius:4px; padding:1px 4px; }

.em-btn{
  height:38px; padding:0 16px; border-radius:10px; border:1px solid ${INK}; background:#fff;
  cursor:pointer; font-weight:800; color: ${PRIMARY};
}
.em-btn.primary{ background: ${ACCENT}; border-color: transparent; color:#fff; }
.em-btn.primary:disabled{ opacity:.6; cursor:default; }
.em-btn.sm{ height:30px; padding:0 12px; font-size:12px; }

.em-table{ display:grid; gap:2px; }
.em-trow{
  display:grid; grid-template-columns: 1.2fr 1.6fr .8fr .8fr .6fr .6fr .8fr; gap:10px;
  align-items:center; padding: 9px 8px; border-radius:8px; font-size: 13px;
}
.em-trow:not(.em-thead){ cursor:pointer; border-bottom: 1px solid ${INK}; }
.em-trow:not(.em-thead):hover{ background: #faf9fb; }
.em-trow.active{ background: rgba(246,195,32,.10); }
.em-thead{ font-size: 11px; text-transform: uppercase; opacity: .6; font-weight: 900; cursor: default; }
.em-trow .strong{ font-weight: 800; }
.em-trow .muted{ opacity: .7; }
.pad{ padding: 8px 2px; }

.em-badge{
  display:inline-block; font-size: 11px; font-weight: 900; padding: 3px 9px; border-radius: 999px;
  text-transform: uppercase;
}
.em-badge.ok{ background: rgba(46,125,50,.12); color:#2e7d32; }
.em-badge.bad{ background: rgba(240,93,139,.14); color:#b0003a; }
.em-badge.warn{ background: rgba(246,195,32,.20); color:#8a6d00; }
.em-badge.pending{ background: rgba(0,0,0,.06); color:#555; }
.em-badge.muted{ background: rgba(0,0,0,.05); color:#777; }
`;
