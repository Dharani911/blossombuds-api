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
  getWhatsAppContacts,
  importWhatsAppContacts,
  deactivateWhatsAppContact,
  type WhatsAppContact,
  type ImportContactsResult,
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
  const [audienceType, setAudienceType] = useState<"MANUAL" | "ALL_OPTED_IN" | "EXPO_CONTACTS">("MANUAL");

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
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [importSource, setImportSource] = useState("");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<ImportContactsResult | null>(null);
  const [importBusy, setImportBusy] = useState(false);
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

  // Auto-select the correct audience whenever the template changes.
  // expo_outreach → EXPO_CONTACTS; everything else → ALL_OPTED_IN (MANUAL stays as-is if already chosen).
  React.useEffect(() => {
    if (!providerTemplateName) return;
    if (providerTemplateName === "expo_outreach") {
      setAudienceType("EXPO_CONTACTS");
    } else {
      setAudienceType(prev => prev === "EXPO_CONTACTS" ? "ALL_OPTED_IN" : prev);
    }
  }, [providerTemplateName]);

  // Ref always points to the current templateId so loadData never closes over a stale value.
  const templateIdRef = React.useRef<number | "">(templateId);
  React.useEffect(() => { templateIdRef.current = templateId; }, [templateId]);

  /** Loads templates, campaigns, settings status, opted-in contacts, and expo contacts. */
  async function loadData() {
    const [templateResult, campaignResult, statusResult, preferenceResult, contactsResult] =
      await Promise.allSettled([
        getWhatsAppTemplates(),
        getWhatsAppCampaigns(),
        getWhatsAppIntegrationStatus(),
        getWhatsAppPreferences(),
        getWhatsAppContacts(),
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

    if (contactsResult.status === "fulfilled") {
      setContacts(contactsResult.value);
    } else {
      setContacts([]);
    }

    if (
      templateResult.status === "rejected" ||
      campaignResult.status === "rejected" ||
      statusResult.status === "rejected"
    ) {
      setMessage("Some WhatsApp CRM data could not be loaded. Please check backend APIs.");
    }
  }

  /** Parses the import textarea (one entry per line: "phone" or "phone, name") and calls the API. */
  async function handleImportContacts() {
    const source = importSource.trim().toUpperCase().replace(/\s+/g, "_") || "IMPORT";
    const lines = importText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setMessage("Paste at least one phone number to import."); return; }

    const contacts = lines.map(line => {
      const [phone, ...rest] = line.split(",");
      return { phone: phone.trim(), name: rest.join(",").trim() || undefined };
    });

    setImportBusy(true);
    setImportResult(null);
    try {
      const result = await importWhatsAppContacts(source, contacts);
      setImportResult(result);
      setImportText("");
      await loadData();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e?.message || "Import failed.");
    } finally {
      setImportBusy(false);
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

    const IMAGE_HEADER_TEMPLATES = ["new_arrivals_campaign", "festival_offers", "expo_outreach"];
    if (IMAGE_HEADER_TEMPLATES.includes(providerTemplateName) && !imageUrl.trim()) {
      setMessage("A header image is required for this template. Please upload an image before creating the campaign.");
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
              <h2 className="whatsapp-card-title">
                <span className="whatsapp-step-chip">1</span>
                Create campaign
              </h2>
              <p className="whatsapp-card-subtitle">
                Fill in the details below and click <strong>Create Campaign</strong>. No messages are sent yet — that's Step 3.
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
                  onChange={(e) => setAudienceType(e.target.value as "MANUAL" | "ALL_OPTED_IN" | "EXPO_CONTACTS")}
                >
                  <option value="MANUAL">Manual test recipient</option>
                  {providerTemplateName !== "expo_outreach" && (
                    <option value="ALL_OPTED_IN">All opted-in customers</option>
                  )}
                  {providerTemplateName === "expo_outreach" && (
                    <option value="EXPO_CONTACTS">Expo contacts</option>
                  )}
                </select>
              </Field>
              <p className="whatsapp-audience-hint">
                {audienceType === "MANUAL" && "Send to one specific phone number. Use this first to test your message."}
                {audienceType === "ALL_OPTED_IN" && "Send to all customers who have agreed to receive WhatsApp messages from you."}
                {audienceType === "EXPO_CONTACTS" && "Send to leads collected at events. Only works with the expo_outreach template."}
              </p>

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
                  <Field label="Marketing link">
                    <input
                      className="whatsapp-input"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                    />
                  </Field>
                )}

                {(providerTemplateName === "new_arrivals_campaign" ||
                  providerTemplateName === "festival_offers" ||
                  providerTemplateName === "expo_outreach") && (
                  <Field label="Header image (required)">
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
                )}

                {(providerTemplateName === "festival_offers" ||
                  providerTemplateName === "expo_outreach") && (
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
                {loading ? "Working…" : "Create Campaign (Draft)"}
              </button>
              <p className="whatsapp-create-hint">
                This saves a draft — no messages are sent. Go to <strong>Campaign history</strong> on the right and click <strong>Send</strong> when ready.
              </p>
            </div>
          </section>

          <section className="whatsapp-main-stack">
            <section className="whatsapp-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">
                  <span className="whatsapp-step-chip">2</span>
                  Review &amp; Send
                </h2>
                <p className="whatsapp-card-subtitle">
                  Click <strong>View</strong> to inspect recipients, then <strong>Send</strong> to dispatch the campaign.
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
                              Create your first campaign using the form on the left.
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
                  Recipients{selectedCampaignId ? ` — Campaign #${selectedCampaignId}` : ""}
                </h2>
                <p className="whatsapp-card-subtitle">
                  Click <strong>View</strong> on a campaign above to see individual delivery status.
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
                              {recipient.providerMessageId || "—"}
                            </div>
                          </td>
                          <td>{recipient.errorMessage || "—"}</td>
                        </tr>
                      ))}

                      {recipients.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <div className="whatsapp-empty">
                              <strong>No recipients loaded</strong>
                              Click View on a campaign above to inspect its recipients.
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

        {/* ── Test contacts — full-width below the grid ── */}
        <section className="whatsapp-section">
          <div className="whatsapp-section-header">
            <div>
              <h2 className="whatsapp-section-title">Test contacts</h2>
              <p className="whatsapp-section-desc">
                Add your own phone number here to receive a test message before sending to all customers.
                When the audience is set to <strong>All opted-in customers</strong>, messages are sent to every phone in this list.
              </p>
            </div>
            <span className="whatsapp-section-count">
              {preferences.length} contact{preferences.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="whatsapp-contacts-row">
            <div className="whatsapp-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">Add contact</h2>
              </div>
              <div className="whatsapp-card-body whatsapp-form-grid">
                <Field label="Phone number">
                  <input
                    className="whatsapp-input"
                    placeholder="Example: 918123456789"
                    value={preferencePhone}
                    onChange={(e) => setPreferencePhone(e.target.value)}
                  />
                </Field>
                <Field label="Customer ID (optional)">
                  <input
                    className="whatsapp-input"
                    placeholder="Leave blank if unknown"
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
            </div>

            <div className="whatsapp-card whatsapp-contacts-list-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">Saved contacts ({preferences.length})</h2>
              </div>
              <div className="whatsapp-card-body">
                <div className="whatsapp-preference-list" style={{ maxHeight: "none" }}>
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
                      No test contacts yet. Add your phone number on the left to get started.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Expo Contacts — full-width ── */}
        <section className="whatsapp-section">
          <div className="whatsapp-section-header">
            <div>
              <h2 className="whatsapp-section-title">Expo contacts</h2>
              <p className="whatsapp-section-desc">
                Import phone numbers collected at expos or events. These contacts receive campaigns via the{" "}
                <strong>Expo contacts</strong> audience using the <strong>expo_outreach</strong> template
                (which includes an opt-out instruction). Registered customers are automatically skipped.
              </p>
            </div>
          </div>

          <div className="whatsapp-card" style={{ marginBottom: 16 }}>
            <div className="whatsapp-card-header">
              <h2 className="whatsapp-card-title">Import contacts</h2>
              <p className="whatsapp-card-subtitle">One phone number per line. Optionally add a name after a comma.</p>
            </div>
            <div className="whatsapp-card-body" style={{ display: "grid", gap: 12 }}>
              <Field label="Source / batch label (e.g. EXPO_JUN_2026)">
                <input
                  className="whatsapp-input"
                  value={importSource}
                  onChange={e => setImportSource(e.target.value)}
                  placeholder="EXPO_JUN_2026"
                />
              </Field>
              <Field label="Phone numbers — one per line, optionally followed by a comma and name">
                <textarea
                  className="whatsapp-input"
                  rows={6}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder={"9876543210, Priya\n9123456789\n+91 98001 23456, Ravi Kumar"}
                  style={{ resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                />
              </Field>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  className="whatsapp-btn whatsapp-btn-primary"
                  onClick={handleImportContacts}
                  disabled={importBusy || !importText.trim()}
                >
                  {importBusy ? "Importing…" : "Import"}
                </button>
                {importResult && (
                  <span style={{ fontSize: 13, color: "#166534" }}>
                    ✓ {importResult.imported} imported
                    {importResult.skippedRegistered > 0 && `, ${importResult.skippedRegistered} skipped (registered customer)`}
                    {importResult.skippedDuplicate > 0 && `, ${importResult.skippedDuplicate} skipped (duplicate)`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="whatsapp-card">
            <div className="whatsapp-card-header">
              <h2 className="whatsapp-card-title">
                All contacts
                <span className="whatsapp-section-count" style={{ marginLeft: 10, fontSize: 13 }}>
                  {contacts.filter(c => c.optedIn).length} opted-in / {contacts.filter(c => !c.optedIn).length} opted-out
                </span>
              </h2>
            </div>
            <div className="whatsapp-card-body">
              <div className="whatsapp-table-wrap">
                <table className="whatsapp-table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Name</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Opted-out at</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} style={{ opacity: c.optedIn ? 1 : 0.5 }}>
                        <td>{c.phone}</td>
                        <td>{c.name || "—"}</td>
                        <td>{c.source || "—"}</td>
                        <td>
                          <StatusBadge status={c.optedIn ? "OPTED_IN" : "OPTED_OUT"} />
                        </td>
                        <td>{c.optedOutAt ? new Date(c.optedOutAt).toLocaleDateString() : "—"}</td>
                        <td>
                          {c.optedIn && (
                            <button
                              className="whatsapp-btn whatsapp-btn-sm"
                              onClick={async () => {
                                await deactivateWhatsAppContact(c.id);
                                await loadData();
                              }}
                            >
                              Opt out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {contacts.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="whatsapp-empty">
                            <strong>No contacts imported yet</strong>
                            Use the import form above to add expo leads.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
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
