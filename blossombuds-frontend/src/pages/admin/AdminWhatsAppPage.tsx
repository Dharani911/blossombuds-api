import React, { useEffect, useMemo, useState } from "react";
import "./AdminWhatsAppPage.css";
import QRCode from "qrcode";
import bbLogo from "../../assets/BB_logo.png";
import { Sensitive } from "../../components/admin/Sensitive";
import {
disableWhatsAppPreference,
getWhatsAppPreferences,
type WhatsAppPreference,
  createWhatsAppCampaign,
  getWhatsAppCampaignRecipients,
  getWhatsAppCampaignPreview,
  deleteWhatsAppCampaign,
  getWhatsAppCampaigns,
  getCampaignAudienceSummary,
  getWhatsAppTemplates,
  sendWhatsAppCampaign,
  getWhatsAppIntegrationStatus,
  uploadWhatsAppCampaignImage,
  getWhatsAppContacts,
  deactivateWhatsAppContact,
  getContactReachability,
  type ContactReachability,
  type WhatsAppContact,
  type WhatsAppIntegrationStatus,
  type CreateWhatsAppCampaignRequest,
  type WhatsAppCampaign,
  type WhatsAppCampaignRecipient,
  type WhatsAppTemplate,
  type CampaignAudienceSummary,
} from "../../api/adminWhatsapp";

/** Admin page for creating and sending WhatsApp CRM campaigns. */
export default function AdminWhatsAppPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [audience, setAudience] = useState<CampaignAudienceSummary | null>(null);
  const [recipients, setRecipients] = useState<WhatsAppCampaignRecipient[]>([]);
  const [preview, setPreview] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
const [integrationStatus, setIntegrationStatus] = useState<WhatsAppIntegrationStatus | null>(null);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [audienceType, setAudienceType] = useState<"MANUAL" | "ALL_OPTED_IN" | "EXPO_CONTACTS">("MANUAL");
  const [alsoEmailPhoneless, setAlsoEmailPhoneless] = useState(false);

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
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savedContactsSearch, setSavedContactsSearch] = useState("");
  const [expoContactsSearch, setExpoContactsSearch] = useState("");
  const [reachability, setReachability] = useState<ContactReachability | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === Number(templateId)),
    [templates, templateId]
  );

  const stats = useMemo(() => {
    return {
      campaigns: campaigns.length,
      // "sent" and "failed" are cumulative message outcomes across all campaigns — a running total
      // of activity, which is correct. We deliberately do NOT show a cumulative recipient total
      // here: it summed each campaign's audience, so mailing the same people twice read as double
      // the real reach. The distinct per-channel audience is shown from `audience` instead.
      sent: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
      failed: campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0),
    };
  }, [campaigns]);

  const providerTemplateName = selectedTemplate?.providerTemplateName || "";

  const filteredPreferences = useMemo(
    () => preferences.filter(p =>
      !savedContactsSearch ||
      p.phone.includes(savedContactsSearch)
    ),
    [preferences, savedContactsSearch]
  );

  const filteredContacts = useMemo(
    () => contacts.filter(c =>
      !expoContactsSearch ||
      c.phone.includes(expoContactsSearch) ||
      (c.name || "").toLowerCase().includes(expoContactsSearch.toLowerCase()) ||
      (c.source || "").toLowerCase().includes(expoContactsSearch.toLowerCase())
    ),
    [contacts, expoContactsSearch]
  );

  const isExpoTemplate = (name: string) =>
    name === "expo_outreach" || name === "expo_outreach_v2";

  // Auto-select the correct audience whenever the template changes.
  // expo templates → EXPO_CONTACTS; everything else → ALL_OPTED_IN (MANUAL stays as-is if already chosen).
  React.useEffect(() => {
    if (!providerTemplateName) return;
    if (isExpoTemplate(providerTemplateName)) {
      setAudienceType("EXPO_CONTACTS");
    } else {
      setAudienceType(prev => prev === "EXPO_CONTACTS" ? "ALL_OPTED_IN" : prev);
    }
  }, [providerTemplateName]);

  // "Also email phone-less customers" only makes sense for the All Opted-In audience —
  // MANUAL is a single test send and EXPO_CONTACTS are external leads with no customer record.
  React.useEffect(() => {
    if (audienceType !== "ALL_OPTED_IN") setAlsoEmailPhoneless(false);
  }, [audienceType]);

  // Ref always points to the current templateId so loadData never closes over a stale value.
  const templateIdRef = React.useRef<number | "">(templateId);
  React.useEffect(() => { templateIdRef.current = templateId; }, [templateId]);

  /** Loads templates, campaigns, settings status, opted-in contacts, and expo contacts. */
  async function loadData() {
    const [templateResult, campaignResult, statusResult, preferenceResult, contactsResult, reachabilityResult, audienceResult] =
      await Promise.allSettled([
        getWhatsAppTemplates(),
        getWhatsAppCampaigns(),
        getWhatsAppIntegrationStatus(),
        getWhatsAppPreferences(),
        getWhatsAppContacts(),
        getContactReachability(),
        getCampaignAudienceSummary(),
      ]);

    if (reachabilityResult.status === "fulfilled") {
      setReachability(reachabilityResult.value);
    }

    if (audienceResult.status === "fulfilled") {
      setAudience(audienceResult.value);
    }

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

  /** Loads recipients for the selected campaign. */
  async function loadRecipients(campaignId: number) {
    setSelectedCampaignId(campaignId);
    const [data, rendered] = await Promise.allSettled([
      getWhatsAppCampaignRecipients(campaignId),
      getWhatsAppCampaignPreview(campaignId),
    ]);
    setRecipients(data.status === "fulfilled" ? data.value : []);
    setPreview(rendered.status === "fulfilled" ? rendered.value : "");
  }

  /** Removes a campaign from the list after confirming. */
  async function handleDeleteCampaign(campaignId: number, campaignTitle: string) {
    if (!window.confirm(`Delete "${campaignTitle}"? It will be removed from this list.`)) return;
    setLoading(true);
    try {
      await deleteWhatsAppCampaign(campaignId);
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId(null);
        setRecipients([]);
        setPreview("");
      }
      setMessage("Campaign deleted.");
      await loadData();
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Could not delete that campaign.");
    } finally {
      setLoading(false);
    }
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

    const IMAGE_HEADER_TEMPLATES = ["new_arrivals_campaign", "festival_offers", "expo_outreach", "expo_outreach_v2"];
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
      alsoEmailPhoneless: audienceType === "ALL_OPTED_IN" ? alsoEmailPhoneless : undefined,
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
      setMessage(`Campaign saved. It will go to ${campaign.totalRecipients} recipient(s) — press Send when you are ready.`);
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
    const modeLabel = isLive
      ? "These are real WhatsApp messages and cannot be recalled."
      : "Practice mode is on, so nothing will actually be sent.";
    const confirmed = window.confirm(
      `Send this campaign to ${recipientCount} recipient(s)?\n\n⚠️  ${modeLabel}.`
    );

    if (!confirmed) return;

    setMessage("");
    setLoading(true);

    try {
      const campaign = await sendWhatsAppCampaign(campaignId);
      setMessage(`Campaign finished — ${statusLabel(campaign.status).toLowerCase()}. Check the Sent and Failed columns.`);
      await loadData();
      await loadRecipients(campaignId);
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Failed to send campaign.");
    } finally {
      setLoading(false);
    }
  }
/** Removes a number from the opted-in list. */
async function handleDisablePreference(id: number) {
  const confirmed = window.confirm("Remove this number from the opted-in list?");
  if (!confirmed) return;

  setLoading(true);

  try {
    await disableWhatsAppPreference(id);
    setMessage("Number removed from the list.");
    await loadData();
  } catch (err: any) {
    setMessage(err?.response?.data?.message || "Could not remove that number.");
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
                title={
                  integrationStatus?.cloudEnabled
                    ? "Campaigns you send will reach real customers."
                    : "Practice mode: campaigns are recorded but no message leaves the system."
                }
              >
                {integrationStatus?.cloudEnabled
                  ? "Live — real messages will be sent"
                  : "Practice mode — nothing is sent"}
              </button>
            </div>
          </div>
        </header>

        <section className="whatsapp-stats">
          <StatCard label="Campaigns" value={stats.campaigns} />
          <StatCard label="WhatsApp opted-in" value={audience?.whatsAppOptedIn ?? "—"} />
          <StatCard label="Email audience" value={audience?.emailAudience ?? "—"} />
          <StatCard label="Messages sent" value={stats.sent} />
          <StatCard label="Failed" value={stats.failed} danger />
        </section>

        {/* A campaign always sends to the full email audience. The cap is only a safety ceiling
            against an accidental mass send; we warn only in the rare case the audience exceeds it. */}
        {audience && (
          <p
            style={{
              margin: "10px 2px 0",
              fontSize: 13,
              color: audience.emailAudience > audience.emailCampaignCap ? "#b45309" : "#6b7280",
            }}
          >
            Campaigns send to all <strong>{audience.emailAudience}</strong> in the email audience
            {" "}(safety cap {audience.emailCampaignCap} per campaign)
            {audience.emailAudience > audience.emailCampaignCap && (
              <> — this audience exceeds the cap, so the send will be blocked. Raise the cap if intentional.</>
            )}
          </p>
        )}
        {/* Connection health. The four underlying settings are developer concerns — an operator
            only needs to know whether they can send, so the detail is collapsed behind a toggle
            and only surfaces by default when something is actually wrong. */}
        <section className="whatsapp-integration-card">
          <div>
            <h2>WhatsApp connection</h2>
            <p>
              {integrationStatus?.readyForLive
                ? "Connected and ready to send."
                : integrationStatus?.cloudEnabled === false
                  ? "Connected, but sending is switched off — campaigns run in practice mode."
                  : "Setup is incomplete. Campaigns cannot be delivered until this is fixed — ask your developer to check the WhatsApp settings."}
            </p>
          </div>

          <details className="whatsapp-integration-items">
            <summary style={{ cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
              Technical details
            </summary>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <StatusDot label="Phone ID" ok={!!integrationStatus?.phoneNumberIdConfigured} />
              <StatusDot label="Business ID" ok={!!integrationStatus?.businessAccountIdConfigured} />
              <StatusDot label="Access Token" ok={!!integrationStatus?.accessTokenConfigured} />
              <StatusDot label="Verify Token" ok={!!integrationStatus?.verifyTokenConfigured} />
              <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>
                API {integrationStatus?.apiVersion || "v25.0"}
              </span>
            </div>
          </details>
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
                Fill in the details below and click <strong>Create Campaign</strong>. Nothing is sent yet — you review and send it in step 2.
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
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedTemplate && (
                <div className="whatsapp-preview">
                  <div className="whatsapp-preview-top">
                    <span className="whatsapp-chip">Preview</span>
                  </div>
                  <div className="whatsapp-bubble">
                    {/* The provider name (expo_outreach_v2) is kept only as a tooltip — it is
                        how Meta identifies the template, not something an operator needs. */}
                    <div className="whatsapp-bubble-name" title={selectedTemplate.providerTemplateName}>
                      {selectedTemplate.name}
                    </div>
                    {selectedTemplate.bodyPreview}
                  </div>
                  <p className="whatsapp-card-subtitle" style={{ marginTop: 8 }}>
                    The <strong>{"{{1}}"}</strong>, <strong>{"{{2}}"}</strong> placeholders are filled in
                    automatically with each customer's name and the details you enter below.
                  </p>
                </div>
              )}

              <Field label="Audience">
                <select
                  className="whatsapp-select"
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as "MANUAL" | "ALL_OPTED_IN" | "EXPO_CONTACTS")}
                >
                  <option value="MANUAL">Test message to one number</option>
                  {!isExpoTemplate(providerTemplateName) && (
                    <option value="ALL_OPTED_IN">All opted-in customers</option>
                  )}
                  {isExpoTemplate(providerTemplateName) && (
                    <option value="EXPO_CONTACTS">Event contacts</option>
                  )}
                </select>
              </Field>
              <p className="whatsapp-audience-hint">
                {audienceType === "MANUAL" && "Sends to one phone number you type in. Always do this first to check how the message looks."}
                {audienceType === "ALL_OPTED_IN" && "Send to all customers who have agreed to receive WhatsApp messages from you."}
                {audienceType === "EXPO_CONTACTS" && "Sends to people who gave you their number at an event. Only works with event templates."}
              </p>

              {audienceType === "ALL_OPTED_IN" && (
                <label
                  className="whatsapp-audience-hint"
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed", opacity: 0.55 }}
                  title="Email sending is being switched to a new provider — available again shortly."
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    readOnly
                  />
                  Also send this offer by email to customers with no phone number on file
                  {" "}<em>(temporarily unavailable — email sending is being set up)</em>
                </label>
              )}

              {audienceType === "MANUAL" && (
                <div className="whatsapp-section-box whatsapp-section-box-muted">
                  <div className="whatsapp-two">
                    <Field label="Their name">
                      <input
                        className="whatsapp-input"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                      />
                    </Field>

                    <Field label="Their WhatsApp number">
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
                  isExpoTemplate(providerTemplateName)) && (
                  <Field label="Header image (required)">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
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
                  isExpoTemplate(providerTemplateName)) && (
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
                <Sensitive
                  as="textarea"
                  unblurOnFocus
                  className="whatsapp-textarea"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                />
              </Field>

              <button
                className="whatsapp-btn whatsapp-btn-primary"
                disabled={loading}
                onClick={handleCreateCampaign}
              >
                {loading ? "Working…" : "Create Campaign"}
              </button>
              <p className="whatsapp-create-hint">
                This only saves the campaign — nothing is sent. Check the recipient count on the right, then press <strong>Send</strong> when you are ready.
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
                <div className="whatsapp-table-wrap" style={{ maxHeight: 290, overflowY: "auto" }}>
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
                            <div className="whatsapp-card-subtitle">
                              {audienceLabel(campaign.audienceType)}
                              {campaign.linkedEmailCampaignId && (
                                <>
                                  {" · ✉ Email to phone-less customers: "}
                                  {campaign.linkedEmailSentCount ?? 0} sent
                                  {(campaign.linkedEmailFailedCount ?? 0) > 0 &&
                                    `, ${campaign.linkedEmailFailedCount} failed`}
                                  {typeof campaign.linkedEmailTotalRecipients === "number" &&
                                    ` of ${campaign.linkedEmailTotalRecipients}`}
                                </>
                              )}
                              {!campaign.linkedEmailCampaignId && campaign.alsoEmailPhoneless && " · Email will send with this campaign"}
                            </div>
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
                                title={["FAILED", "PARTIAL"].includes(campaign.status)
                                  ? "This campaign has finished. To reach the ones that failed, create a new campaign."
                                  : undefined}
                                onClick={() => handleSendCampaign(campaign.id)}
                              >
                                Send
                              </button>
                              {/* Only unsent campaigns can be deleted. Once messages have gone out,
                                  the campaign is the record of what real customers received. */}
                              {campaign.status === "DRAFT" && (
                                <button
                                  className="whatsapp-btn whatsapp-btn-danger"
                                  disabled={loading}
                                  title="Delete this campaign — it has not been sent"
                                  onClick={() => handleDeleteCampaign(campaign.id, campaign.title)}
                                >
                                  Delete
                                </button>
                              )}
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
                {/* The message exactly as it goes out, with the placeholders filled in — the only
                    place an operator can check the real wording before or after sending. */}
                {preview && (
                  <div className="whatsapp-preview" style={{ marginBottom: 16 }}>
                    <div className="whatsapp-preview-top">
                      <span className="whatsapp-chip">What the customer receives</span>
                    </div>
                    <div className="whatsapp-bubble" style={{ whiteSpace: "pre-wrap" }}>
                      {preview}
                    </div>
                  </div>
                )}

                <div className="whatsapp-table-wrap" style={{ maxHeight: 290, overflowY: "auto" }}>
                  <table className="whatsapp-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>WhatsApp reference</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <Sensitive as="td" className="whatsapp-table-title">
                            {recipient.recipientName || "Customer"}
                          </Sensitive>
                          <Sensitive as="td">{recipient.phone}</Sensitive>
                          <td>
                            <StatusBadge status={recipient.status} />
                          </td>
                          <td>
                            <div className="whatsapp-provider-id">
                              {recipient.providerMessageId || "—"}
                            </div>
                          </td>
                          <Sensitive as="td">{recipient.errorMessage || "—"}</Sensitive>
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

            {/* ── Opted-in customers — sits directly under the recipients table in the right
                 column. Read-only: numbers arrive when a customer opts in, not by hand. ── */}
            <section className="whatsapp-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">
                  Opted-in customers ({preferences.length})
                </h2>
                <p className="whatsapp-card-subtitle">
                  Everyone who receives the <strong>All opted-in customers</strong> audience. Numbers
                  appear here automatically when a customer opts in.
                </p>
              </div>
              <div className="whatsapp-card-body">
                <input
                  className="whatsapp-input"
                  placeholder="Search by phone…"
                  value={savedContactsSearch}
                  onChange={(e) => setSavedContactsSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <div className="whatsapp-table-wrap" style={{ maxHeight: 290, overflowY: "auto" }}>
                  <table className="whatsapp-table">
                    <thead>
                      <tr>
                        <th>Phone</th>
                        <th>Linked customer</th>
                        <th aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreferences.map((p) => (
                        <tr key={p.id}>
                          <Sensitive as="td" className="whatsapp-table-title">{p.phone}</Sensitive>
                          <td>{p.customerId ? `Customer #${p.customerId}` : "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="whatsapp-btn whatsapp-btn-danger"
                              disabled={loading}
                              onClick={() => handleDisablePreference(p.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredPreferences.length === 0 && (
                        <tr>
                          <td colSpan={3}>
                            <div className="whatsapp-empty">
                              <strong>No opted-in customers</strong>
                              {savedContactsSearch
                                ? "No numbers match your search."
                                : "Numbers appear here when customers opt in."}
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

        {/* ── Event contacts: QR sign-up + who has joined ── */}
        <section className="whatsapp-section">
          <div className="whatsapp-section-header">
            <div>
              <h2 className="whatsapp-section-title">Event contacts</h2>
              <p className="whatsapp-section-desc">
                People who joined by scanning your QR code at a stall or event. Scanning opens
                WhatsApp with a short message already written — when they send it, they are added
                here automatically and can be reached with the <strong>Event contacts</strong> audience.
                Anyone who already has a customer account is skipped, so nobody gets the same offer twice.
              </p>
            </div>
          </div>

          <div className="whatsapp-contacts-row">
            {reachability?.optInLink ? (
              <OptInQrCard link={reachability.optInLink} />
            ) : (
              <div className="whatsapp-card">
                <div className="whatsapp-card-header">
                  <h2 className="whatsapp-card-title">Sign-up QR code</h2>
                </div>
                <div className="whatsapp-card-body">
                  {/* Two very different causes, and blaming the wrong one sends people to change
                      settings that are already correct. reachability === null means the request
                      itself failed; a present object with no link means the number really is unset. */}
                  <p className="whatsapp-card-subtitle">
                    {reachability === null ? (
                      <>
                        The QR code could not be loaded. This usually means the server has not been
                        updated with the latest release yet — it will appear once the update is live.
                      </>
                    ) : (
                      <>
                        The QR code cannot be created because the WhatsApp sending number is not
                        set. Ask your developer to add <strong>whatsapp.cloud.own_phone_number</strong> in
                        Settings.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="whatsapp-card whatsapp-contacts-list-card">
              <div className="whatsapp-card-header">
                <h2 className="whatsapp-card-title">How to use it</h2>
              </div>
              <div className="whatsapp-card-body">
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
                  <li>Download the QR code and print it large — around 10cm across.</li>
                  <li>Display it at your stall with a line such as
                    <em> "Scan for offers and new arrivals on WhatsApp"</em>.</li>
                  <li>A visitor scans it and sends the message that appears. That is their consent.</li>
                  <li>They appear in the list below straight away, and receive a welcome message.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="whatsapp-card" style={{ marginTop: 16 }}>
            <div className="whatsapp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 className="whatsapp-card-title">People who have joined</h2>
                <p className="whatsapp-card-subtitle">
                  {contacts.filter(c => c.optedIn).length} subscribed ·{" "}
                  {contacts.filter(c => !c.optedIn).length} unsubscribed
                </p>
              </div>
              <input
                className="whatsapp-input"
                style={{ maxWidth: 260 }}
                placeholder="Search by name or number…"
                value={expoContactsSearch}
                onChange={e => setExpoContactsSearch(e.target.value)}
              />
            </div>
            <div className="whatsapp-card-body">
              <div className="whatsapp-table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
                <table className="whatsapp-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>WhatsApp number</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Unsubscribed</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map(c => (
                      <tr key={c.id} style={{ opacity: c.optedIn ? 1 : 0.55 }}>
                        <Sensitive as="td" className="whatsapp-table-title">{c.name || "—"}</Sensitive>
                        <Sensitive as="td">{c.phone}</Sensitive>
                        <td title={c.lastInboundAt ? new Date(c.lastInboundAt).toLocaleString() : undefined}>
                          {c.lastInboundAt
                            ? new Date(c.lastInboundAt).toLocaleDateString()
                            : c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString()
                              : "—"}
                        </td>
                        <td><StatusBadge status={c.optedIn ? "OPTED_IN" : "OPTED_OUT"} /></td>
                        <td>{c.optedOutAt ? new Date(c.optedOutAt).toLocaleDateString() : "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          {c.optedIn && (
                            <button
                              className="whatsapp-btn whatsapp-btn-sm"
                              title="Remove this person from future marketing messages"
                              onClick={async () => {
                                if (!window.confirm(`Unsubscribe ${c.name || c.phone} from marketing messages?`)) return;
                                await deactivateWhatsAppContact(c.id);
                                await loadData();
                              }}
                            >
                              Unsubscribe
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredContacts.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="whatsapp-empty">
                            <strong>
                              {expoContactsSearch ? "Nobody matches your search" : "Nobody has joined yet"}
                            </strong>
                            {expoContactsSearch
                              ? "Try a different name or number."
                              : "Print the QR code above and display it at your next event."}
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

/**
 * The sign-up QR code for events, with the Blossom Buds logo in the centre.
 *
 * Rendered client-side at 1024px so a printed copy stays sharp at A4 — scanning from a metre away
 * across a busy stall is the actual use case, and a screen-resolution export prints fuzzy.
 * Displayed smaller via CSS; the download keeps the full resolution.
 *
 * "H" error correction (30% recoverable) is used specifically because the centre logo covers part
 * of the pattern — at the ~20% coverage below, an "H" code still scans reliably. The logo is a
 * same-origin bundled asset, so drawing it does not taint the canvas and the PNG download still works.
 */
function OptInQrCard({ link }: { link: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!link || !canvas) return;
    QRCode.toCanvas(
      canvas,
      link,
      { width: 1024, margin: 2, errorCorrectionLevel: "H" },
      (err: Error | null | undefined) => {
        if (err) { setError("Could not create the QR code."); return; }
        setError("");
        // qrcode.toCanvas sets the canvas's own inline style.width/height to the 1024px option,
        // which overrides the React style and blows the QR up to the container width. Pin the
        // on-screen size back to a small square here, after the library has written its style.
        const DISPLAY_PX = 260;
        canvas.style.width = `${DISPLAY_PX}px`;
        canvas.style.height = `${DISPLAY_PX}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          const size = canvas.width * 0.2;              // logo ~20% of the QR (within "H" budget)
          const pos = (canvas.width - size) / 2;
          const pad = size * 0.14;                      // white quiet-zone around the logo
          const x = pos - pad, y = pos - pad, w = size + pad * 2, h = size + pad * 2;
          const r = w * 0.16;                           // rounded backdrop
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
          ctx.fill();
          ctx.drawImage(img, pos, pos, size, size);
        };
        img.src = bbLogo;
      }
    );
  }, [link]);

  function downloadPng() {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "blossom-buds-whatsapp-qr.png";
    a.click();
  }

  return (
    <div className="whatsapp-card">
      <div className="whatsapp-card-header">
        <h2 className="whatsapp-card-title">Sign-up QR code</h2>
        <p className="whatsapp-card-subtitle">
          Print this and display it at your stall. Scanning it is how people join your event list.
        </p>
      </div>
      <div className="whatsapp-card-body" style={{ display: "grid", gap: 12, justifyItems: "center" }}>
        {error ? (
          <p className="whatsapp-card-subtitle">{error}</p>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label="QR code that opens WhatsApp to join Blossom Buds updates"
            width={1024}
            height={1024}
            style={{ width: 260, height: 260, display: "block", border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="whatsapp-btn whatsapp-btn-primary" onClick={downloadPng} disabled={!!error}>
            Download QR code
          </button>
          <a className="whatsapp-btn whatsapp-btn-light" href={link} target="_blank" rel="noopener noreferrer">
            Test it
          </a>
        </div>
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
  value: number | string;
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

/**
 * Plain-English names for the audience types.
 * The stored values (MANUAL / ALL_OPTED_IN / EXPO_CONTACTS) are database vocabulary and mean
 * nothing to the person running a campaign.
 */
const AUDIENCE_LABELS: Record<string, string> = {
  MANUAL: "Test message to one number",
  ALL_OPTED_IN: "All opted-in customers",
  EXPO_CONTACTS: "Event contacts",
};

function audienceLabel(type?: string) {
  if (!type) return "";
  return AUDIENCE_LABELS[type.toUpperCase()] || type;
}

/**
 * Plain-English names for campaign and per-recipient statuses.
 * "PARTIAL" in particular gave no clue what to do next; the wording now says what happened.
 */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Not sent yet",
  SENDING: "Sending…",
  COMPLETED: "Sent",
  PARTIAL: "Partly sent",
  FAILED: "Failed",
  PENDING: "Waiting",
  SENT: "Sent",
  DELIVERED: "Delivered",
  READ: "Read",
  OPTED_IN: "Subscribed",
  OPTED_OUT: "Unsubscribed",
};

function statusLabel(status?: string) {
  if (!status) return "Unknown";
  return STATUS_LABELS[status.toUpperCase()] || status;
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

  // Keep the raw value in the tooltip — support conversations still refer to it.
  return <span className={className} title={normalized}>{statusLabel(normalized)}</span>;
}
/** Generic modal overlay for WhatsApp CRM lists. */
function WhatsAppModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="wa-modal-overlay" onClick={onClose}>
      <div className="wa-modal" onClick={e => e.stopPropagation()}>
        <div className="wa-modal-header">
          <h3 className="wa-modal-title">{title}</h3>
          <button className="wa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wa-modal-body">{children}</div>
      </div>
    </div>
  );
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
