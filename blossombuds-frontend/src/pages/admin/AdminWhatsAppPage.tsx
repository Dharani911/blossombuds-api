import React, { useEffect, useMemo, useState } from "react";
import "./AdminWhatsAppPage.css";
import {
createManualWhatsAppPreference,
disableWhatsAppPreference,
getWhatsAppPreferences,
type WhatsAppPreference,
  createWhatsAppCampaign,
  getWhatsAppCampaignRecipients,
  getWhatsAppCampaigns,
  getWhatsAppTemplates,
  sendWhatsAppCampaign,
  getWhatsAppIntegrationStatus,
  uploadWhatsAppCampaignImage,
  type WhatsAppIntegrationStatus,
  type CreateWhatsAppCampaignRequest,
  type WhatsAppCampaign,
  type WhatsAppCampaignRecipient,
  type WhatsAppTemplate,
} from "../../api/adminWhatsapp";

/** Admin page for creating and sending WhatsApp CRM campaigns. */
export default function AdminWhatsAppPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [recipients, setRecipients] = useState<WhatsAppCampaignRecipient[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
const [integrationStatus, setIntegrationStatus] = useState<WhatsAppIntegrationStatus | null>(null);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [audienceType, setAudienceType] = useState<"MANUAL" | "ALL_OPTED_IN">("MANUAL");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [link, setLink] = useState("https://www.blossom-buds-floral-artistry.com/categories");
  const [offerText, setOfferText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [orderCode, setOrderCode] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingLink, setTrackingLink] = useState(
    "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx"
  );
  const [paymentLink, setPaymentLink] = useState("https://www.blossom-buds-floral-artistry.com");
  const [notes, setNotes] = useState("");
const [preferences, setPreferences] = useState<WhatsAppPreference[]>([]);
const [preferencePhone, setPreferencePhone] = useState("");
const [preferenceCustomerId, setPreferenceCustomerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === Number(templateId)),
    [templates, templateId]
  );

  const stats = useMemo(() => {
    return {
      campaigns: campaigns.length,
      recipients: campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0),
      sent: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
      failed: campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0),
    };
  }, [campaigns]);

  const providerTemplateName = selectedTemplate?.providerTemplateName || "";

  // Ref always points to the current templateId so loadData never closes over a stale value.
  const templateIdRef = React.useRef<number | "">(templateId);
  React.useEffect(() => { templateIdRef.current = templateId; }, [templateId]);

  /** Loads templates, campaigns, settings status, and opted-in contacts safely. */
  async function loadData() {
    const [templateResult, campaignResult, statusResult, preferenceResult] =
      await Promise.allSettled([
        getWhatsAppTemplates(),
        getWhatsAppCampaigns(),
        getWhatsAppIntegrationStatus(),
        getWhatsAppPreferences(),
      ]);

    if (templateResult.status === "fulfilled") {

      const marketingTemplates = templateResult.value.filter(
        (template) => template.category === "MARKETING"
      );

      setTemplates(marketingTemplates);

      // Use ref to always see the latest templateId — avoids resetting user selection on refresh
      if (!templateIdRef.current && marketingTemplates.length > 0) {
        setTemplateId(marketingTemplates[0].id);
      }
    }

    if (campaignResult.status === "fulfilled") {
      setCampaigns(campaignResult.value);
    }

    if (statusResult.status === "fulfilled") {
      setIntegrationStatus(statusResult.value);
    }

    if (preferenceResult.status === "fulfilled") {
      setPreferences(preferenceResult.value);
    } else {
      setPreferences([]);
      console.warn("Failed to load WhatsApp preferences", preferenceResult.reason);
    }

    if (
      templateResult.status === "rejected" ||
      campaignResult.status === "rejected" ||
      statusResult.status === "rejected"
    ) {
      setMessage("Some WhatsApp CRM data could not be loaded. Please check backend APIs.");
    }
  }

  /** Loads recipients for the selected campaign. */
  async function loadRecipients(campaignId: number) {
    setSelectedCampaignId(campaignId);
    const data = await getWhatsAppCampaignRecipients(campaignId);
    setRecipients(data);
  }

  /** Uploads a header image to R2 and stores the presigned URL. */
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const url = await uploadWhatsAppCampaignImage(file);
      setImageUrl(url);
    } catch {
      setMessage("Image upload failed. Please try again.");
      setImagePreview("");
      setImageUrl("");
    } finally {
      setImageUploading(false);
    }
  }

  /** Creates a WhatsApp campaign in draft mode. */
  async function handleCreateCampaign() {
    setMessage("");

    if (!title.trim()) {
      setMessage("Campaign title is required.");
      return;
    }

    if (!templateId) {
      setMessage("Please select a template.");
      return;
    }

    if (audienceType === "MANUAL" && !recipientPhone.trim()) {
      setMessage("Manual recipient phone is required.");
      return;
    }

    const payload: CreateWhatsAppCampaignRequest = {
      title,
      templateId: Number(templateId),
      audienceType,
      link,
      offerText,
      imageUrl: imageUrl.trim() || undefined,
      orderCode,
      trackingNumber,
      trackingLink,
      paymentLink,
      notes,
      recipients:
        audienceType === "MANUAL"
          ? [
              {
                name: recipientName || "Customer",
                phone: recipientPhone,
              },
            ]
          : undefined,
    };

    setLoading(true);
    try {
      const campaign = await createWhatsAppCampaign(payload);
      setMessage(`Campaign created successfully. ID: ${campaign.id}`);
      await loadData();
      await loadRecipients(campaign.id);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to create campaign.");
    } finally {
      setLoading(false);
    }
  }

  /** Sends a WhatsApp campaign using dry-run or real mode based on backend settings. */
  async function handleSendCampaign(campaignId: number) {
    const campaign = campaigns.find((c) => c.id === campaignId);
    const recipientCount = campaign?.totalRecipients ?? "?";
    const isLive = integrationStatus?.cloudEnabled === true;
    const modeLabel = isLive ? "LIVE MODE — real WhatsApp messages WILL be sent" : "dry-run mode — no real messages will be sent";
    const confirmed = window.confirm(
      `Send this campaign to ${recipientCount} recipient(s)?\n\n⚠️  ${modeLabel}.`
    );

    if (!confirmed) return;

    setMessage("");
    setLoading(true);

    try {
      const campaign = await sendWhatsAppCampaign(campaignId);
      setMessage(`Campaign processed successfully. Status: ${campaign.status}`);
      await loadData();
      await loadRecipients(campaignId);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to send campaign.");
    } finally {
      setLoading(false);
    }
  }
/** Adds a manual WhatsApp opt-in contact for ALL_OPTED_IN campaign testing. */
async function handleAddPreference() {
  setMessage("");

  if (!preferencePhone.trim()) {
    setMessage("Phone number is required.");
    return;
  }

  setLoading(true);

  try {
    await createManualWhatsAppPreference({
      phone: preferencePhone.trim(),
      customerId: preferenceCustomerId.trim() ? Number(preferenceCustomerId) : undefined,
    });

    setPreferencePhone("");
    setPreferenceCustomerId("");
    setMessage("WhatsApp test contact added successfully.");
    await loadData();
  } catch (err: any) {
    setMessage(err?.response?.data?.message || "Failed to add WhatsApp test contact.");
  } finally {
    setLoading(false);
  }
}

/** Disables a manual WhatsApp opt-in contact. */
async function handleDisablePreference(id: number) {
  const confirmed = window.confirm("Disable this WhatsApp contact?");
  if (!confirmed) return;

  setLoading(true);

  try {
    await disableWhatsAppPreference(id);
    setMessage("WhatsApp contact disabled.");
    await loadData();
  } catch (err: any) {
    setMessage(err?.response?.data?.message || "Failed to disable WhatsApp contact.");
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    loadData().catch(() => setMessage("Failed to load WhatsApp CRM data."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-shell">
        <header className="whatsapp-hero">
          <div className="whatsapp-hero-row">
            <div>
              <div className="whatsapp-kicker">WhatsApp Business CRM</div>
              <h1 className="whatsapp-title">WhatsApp Marketing Campaigns</h1>
              <p className="whatsapp-subtitle">
                Create and send approved marketing campaigns to opted-in customers. Order and payment updates are handled automatically.
              </p>
            </div>

            <div className="whatsapp-hero-actions">
              <button className="whatsapp-btn whatsapp-btn-light" onClick={() => loadData()}>
                Refresh Data
              </button>

              <a className="whatsapp-btn whatsapp-btn-light" href="/admin/settings">
                Open Settings
              </a>

              <button
                className={
                  integrationStatus?.cloudEnabled
                    ? "whatsapp-btn whatsapp-btn-danger"
                    : "whatsapp-btn whatsapp-btn-light"
                }
                disabled
              >
                {integrationStatus?.cloudEnabled ? "🔴 Live Mode" : "🧪 Dry-run Mode"}
              </button>
            </div>
          </div>
        </header>

        <section className="whatsapp-stats">
          <StatCard label="Campaigns" value={stats.campaigns} />
          <StatCard label="Recipients" value={stats.recipients} />
          <StatCard label="Sent / Dry-run" value={stats.sent} />
          <StatCard label="Failed" value={stats.failed} danger />
        </section>
        <section className="whatsapp-integration-card">
          <div>
            <h2>Integration status</h2>
            <p>
              API {integrationStatus?.apiVersion || "v25.0"} ·{" "}
              {integrationStatus?.readyForLive
                ? "Ready for live WhatsApp sending"
                : "Safe for dry-run testing"}
            </p>
          </div>

          <div className="whatsapp-integration-items">
            <StatusDot label="Phone ID" ok={!!integrationStatus?.phoneNumberIdConfigured} />
            <StatusDot label="Business ID" ok={!!integrationStatus?.businessAccountIdConfigured} />
            <StatusDot label="Access Token" ok={!!integrationStatus?.accessTokenConfigured} />
            <StatusDot label="Verify Token" ok={!!integrationStatus?.verifyTokenConfigured} />
          </div>
        </section>

        {message && <div className="whatsapp-message">{message}</div>}

        <main className="whatsapp-layout">
          <section className="whatsapp-card">
            <div className="whatsapp-card-header">
              <h2 className="whatsapp-card-title">Create campaign</h2>
              <p className="whatsapp-card-subtitle">
                Start with one manual test recipient before using the full opted-in audience.
              </p>
            </div>

            <div className="whatsapp-card-body whatsapp-form-grid">
              <Field label="Campaign title">
                <input
                  className="whatsapp-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>

              <Field label="Template">
                <select
                  className="whatsapp-select"
                  value={templateId}
                  onChange={(e) => setTemplateId(Number(e.target.value))}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </option>
                  ))}
                </select>
              </Field>

              {selectedTemplate && (
                <div className="whatsapp-preview">
                  <div className="whatsapp-preview-top">
                    <span className="whatsapp-chip">{selectedTemplate.category}</span>
                    <span className="whatsapp-chip">
                      {selectedTemplate.variableCount} variables
                    </span>
                  </div>
                  <div className="whatsapp-bubble">
                    <div className="whatsapp-bubble-name">
                      {selectedTemplate.providerTemplateName}
                    </div>
                    {selectedTemplate.bodyPreview}
                  </div>
                </div>
              )}

              <Field label="Audience">
                <select
                  className="whatsapp-select"
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as "MANUAL" | "ALL_OPTED_IN")}
                >
                  <option value="MANUAL">Manual test recipient</option>
                  <option value="ALL_OPTED_IN">All opted-in customers</option>
                </select>
              </Field>

              {audienceType === "MANUAL" && (
                <div className="whatsapp-section-box whatsapp-section-box-muted">
                  <div className="whatsapp-two">
                    <Field label="Recipient name">
                      <input
                        className="whatsapp-input"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                      />
                    </Field>

                    <Field label="Recipient phone">
                      <input
                        className="whatsapp-input"
                        placeholder="918123456789"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <div className="whatsapp-section-box">
                {(providerTemplateName === "new_arrivals_campaign" ||
                  providerTemplateName === "festival_offers") && (
                  <>
                    <Field label="Marketing link">
                      <input
                        className="whatsapp-input"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                      />
                    </Field>
                    <Field label="Header image (required if template has an image header)">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="whatsapp-input"
                        onChange={handleImageUpload}
                        disabled={imageUploading}
                      />
                      {imageUploading && (
                        <p className="whatsapp-card-subtitle">Uploading image...</p>
                      )}
                      {imagePreview && !imageUploading && (
                        <img
                          src={imagePreview}
                          alt="Campaign header preview"
                          className="whatsapp-image-preview"
                        />
                      )}
                    </Field>
                  </>
                )}

                {providerTemplateName === "festival_offers" && (
                  <Field label="Offer / discount text">
                    <input
                      className="whatsapp-input"
                      placeholder="e.g. 20% off, Flat ₹200 off"
                      value={offerText}
                      onChange={(e) => setOfferText(e.target.value)}
                    />
                  </Field>
                )}

                {!providerTemplateName && (
                  <p className="whatsapp-card-subtitle">Select a template to see variables.</p>
                )}
              </div>

              <Field label="Internal notes">
                <textarea
                  className="whatsapp-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>

              <button
                className="whatsapp-btn whatsapp-btn-primary"
                disabled={loading}
                onClick={handleCreateCampaign}
              >
                {loading ? "Working..." : "Create Campaign"}
              </button>
              <div className="whatsapp-mini-panel">
                <div className="whatsapp-mini-panel-head">
                  <div>
                    <h3>Opted-in test contacts</h3>
                    <p>Use these contacts when testing the ALL_OPTED_IN audience.</p>
                  </div>
                  <span>{preferences.length}</span>
                </div>

                <div className="whatsapp-form-grid">
                  <Field label="Phone number">
                    <input
                      className="whatsapp-input"
                      placeholder="Example: 918123456789"
                      value={preferencePhone}
                      onChange={(e) => setPreferencePhone(e.target.value)}
                    />
                  </Field>

                  <Field label="Customer ID optional">
                    <input
                      className="whatsapp-input"
                      placeholder="Optional"
                      value={preferenceCustomerId}
                      onChange={(e) => setPreferenceCustomerId(e.target.value)}
                    />
                  </Field>

                  <button
                    className="whatsapp-btn whatsapp-btn-outline"
                    disabled={loading}
                    onClick={handleAddPreference}
                  >
                    Add Test Contact
                  </button>
                </div>

                <div className="whatsapp-preference-list">
                  {preferences.map((preference) => (
                    <div className="whatsapp-preference-item" key={preference.id}>
                      <div>
                        <strong>{preference.phone}</strong>
                        <small>
                          {preference.customerId ? `Customer #${preference.customerId}` : "Manual contact"}
                        </small>
                      </div>

                      <button
                        className="whatsapp-btn whatsapp-btn-danger"
                        disabled={loading}
                        onClick={() => handleDisablePreference(preference.id)}
                      >
                        Disable
                      </button>
                    </div>
                  ))}

                  {preferences.length === 0 && (
                    <div className="whatsapp-empty-small">
                      No opted-in test contacts yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="whatsapp-main-stack">
            <section className="whatsapp-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">Campaign history</h2>
                <p className="whatsapp-card-subtitle">
                  Review created campaigns, send dry-runs, and inspect recipients.
                </p>
              </div>

              <div className="whatsapp-card-body">
                <div className="whatsapp-table-wrap">
                  <table className="whatsapp-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Recipients</th>
                        <th>Sent</th>
                        <th>Failed</th>
                        <th>Read</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id}>
                          <td>#{campaign.id}</td>
                          <td>
                            <div className="whatsapp-table-title">{campaign.title}</div>
                            <div className="whatsapp-card-subtitle">{campaign.audienceType}</div>
                          </td>
                          <td>
                            <StatusBadge status={campaign.status} />
                          </td>
                          <td>{campaign.totalRecipients}</td>
                          <td>{campaign.sentCount}</td>
                          <td>{campaign.failedCount}</td>
                          <td>{campaign.readCount}</td>
                          <td>
                            <div className="whatsapp-actions">
                              <button
                                className="whatsapp-btn whatsapp-btn-outline"
                                onClick={() => loadRecipients(campaign.id)}
                              >
                                View
                              </button>
                              <button
                                className="whatsapp-btn whatsapp-btn-primary"
                                disabled={loading || ["COMPLETED", "FAILED", "PARTIAL", "SENDING"].includes(campaign.status)}
                                title={["FAILED", "PARTIAL"].includes(campaign.status) ? "Campaign ended — create a new one to retry failed recipients" : undefined}
                                onClick={() => handleSendCampaign(campaign.id)}
                              >
                                Send
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {campaigns.length === 0 && (
                        <tr>
                          <td colSpan={8}>
                            <div className="whatsapp-empty">
                              <strong>No campaigns yet</strong>
                              Create your first manual dry-run campaign.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="whatsapp-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">
                  Recipients {selectedCampaignId ? `#${selectedCampaignId}` : ""}
                </h2>
                <p className="whatsapp-card-subtitle">
                  Track individual phone status, provider message IDs, and delivery errors.
                </p>
              </div>

              <div className="whatsapp-card-body">
                <div className="whatsapp-table-wrap">
                  <table className="whatsapp-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Provider ID</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <td className="whatsapp-table-title">
                            {recipient.recipientName || "Customer"}
                          </td>
                          <td>{recipient.phone}</td>
                          <td>
                            <StatusBadge status={recipient.status} />
                          </td>
                          <td>
                            <div className="whatsapp-provider-id">
                              {recipient.providerMessageId || "-"}
                            </div>
                          </td>
                          <td>{recipient.errorMessage || "-"}</td>
                        </tr>
                      ))}

                      {recipients.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <div className="whatsapp-empty">
                              <strong>No recipients selected</strong>
                              Click View on a campaign to inspect recipients.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
  }

/** Reusable form field wrapper for WhatsApp admin inputs. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="whatsapp-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** Small statistic card used at the top of the WhatsApp CRM page. */
function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="whatsapp-stat-card">
      <p className="whatsapp-stat-label">{label}</p>
      <p className="whatsapp-stat-value" style={danger ? { color: "#dc2626" } : undefined}>
        {value}
      </p>
    </div>
  );
}

/** Status badge for campaigns and recipients. */
function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase?.() || "UNKNOWN";

  let className = "whatsapp-status whatsapp-status-default";

  if (["COMPLETED", "SENT", "DELIVERED", "READ"].includes(normalized)) {
    className = "whatsapp-status whatsapp-status-success";
  } else if (normalized === "FAILED") {
    className = "whatsapp-status whatsapp-status-error";
  } else if (normalized === "PARTIAL") {
    className = "whatsapp-status whatsapp-status-warning";
  } else if (["SENDING", "QUEUED", "DRAFT"].includes(normalized)) {
    className = "whatsapp-status whatsapp-status-progress";
  }

  return <span className={className}>{normalized}</span>;
}
/** Small readiness indicator for WhatsApp integration settings. */
function StatusDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={ok ? "whatsapp-dot whatsapp-dot-ok" : "whatsapp-dot whatsapp-dot-missing"}>
      <span />
      {label}
    </span>
  );

}
