import adminHttp from "./adminHttp";

/** WhatsApp template available for campaign creation. */
export type WhatsAppTemplate = {
  id: number;
  name: string;
  providerTemplateName: string;
  category: string;
  languageCode: string;
  bodyPreview: string;
  variableCount: number;
  active: boolean;
};

/** WhatsApp campaign summary shown in admin. */
export type WhatsAppCampaign = {
  id: number;
  title: string;
  templateId: number;
  audienceType: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  readCount: number;
  notes?: string;
  createdAt?: string;
  completedAt?: string;
};

/** One recipient inside a WhatsApp campaign. */
export type WhatsAppCampaignRecipient = {
  id: number;
  campaignId: number;
  customerId?: number;
  phone: string;
  recipientName?: string;
  status: string;
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  failedAt?: string;
};

/** Manual recipient request for campaign creation. */
export type ManualWhatsAppRecipient = {
  customerId?: number;
  name: string;
  phone: string;
};

/** Request body for creating a WhatsApp campaign. */
export type CreateWhatsAppCampaignRequest = {
  title: string;
  templateId: number;
  audienceType: "MANUAL" | "ALL_OPTED_IN";
  link?: string;
  offerText?: string;
  imageUrl?: string;
  orderCode?: string;
  trackingNumber?: string;
  trackingLink?: string;
  paymentLink?: string;
  notes?: string;
  recipients?: ManualWhatsAppRecipient[];
};

/** Fetches active WhatsApp templates. */
export async function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const res = await adminHttp.get("/api/admin/whatsapp/templates");
  return res.data;
}

/** Fetches WhatsApp campaigns. */
export async function getWhatsAppCampaigns(): Promise<WhatsAppCampaign[]> {
  const res = await adminHttp.get("/api/admin/whatsapp/campaigns");
  return res.data;
}

/** Creates a WhatsApp campaign. */
export async function createWhatsAppCampaign(
  payload: CreateWhatsAppCampaignRequest
): Promise<WhatsAppCampaign> {
  const res = await adminHttp.post("/api/admin/whatsapp/campaigns", payload);
  return res.data;
}

/** Sends a WhatsApp campaign. */
export async function sendWhatsAppCampaign(
  campaignId: number
): Promise<WhatsAppCampaign> {
  const res = await adminHttp.post(`/api/admin/whatsapp/campaigns/${campaignId}/send`);
  return res.data;
}

/** Fetches recipients for a WhatsApp campaign. */
export async function getWhatsAppCampaignRecipients(
  campaignId: number
): Promise<WhatsAppCampaignRecipient[]> {
  const res = await adminHttp.get(`/api/admin/whatsapp/campaigns/${campaignId}/recipients`);
  return res.data;
}
/** Generic key/value setting returned by backend settings API. */
export type AdminSetting = {
  key: string;
  value: string;
};

/** WhatsApp integration status derived from existing settings. */
export type WhatsAppIntegrationStatus = {
  cloudEnabled: boolean;
  apiVersion: string;
  phoneNumberIdConfigured: boolean;
  businessAccountIdConfigured: boolean;
  accessTokenConfigured: boolean;
  verifyTokenConfigured: boolean;
  readyForLive: boolean;
};

/** Fetches WhatsApp integration status using the existing settings API. */
export async function getWhatsAppIntegrationStatus(): Promise<WhatsAppIntegrationStatus> {
  const res = await adminHttp.get<AdminSetting[]>("/api/settings");
  const settings = res.data || [];

  const valueOf = (key: string) =>
    settings.find((item) => item.key === key)?.value?.trim() || "";

  const cloudEnabled = valueOf("whatsapp.cloud.enabled") === "true";
  const apiVersion = valueOf("whatsapp.cloud.api_version") || "v25.0";
  const phoneNumberId = valueOf("whatsapp.cloud.phone_number_id");
  const businessAccountId = valueOf("whatsapp.cloud.business_account_id");
  const accessToken = valueOf("whatsapp.cloud.access_token");
  const verifyToken = valueOf("whatsapp.cloud.verify_token");

  return {
    cloudEnabled,
    apiVersion,
    phoneNumberIdConfigured: phoneNumberId.length > 0,
    businessAccountIdConfigured: businessAccountId.length > 0,
    accessTokenConfigured: accessToken.length > 0,
    verifyTokenConfigured: verifyToken.length > 0,
    readyForLive:
      cloudEnabled &&
      phoneNumberId.length > 0 &&
      businessAccountId.length > 0 &&
      accessToken.length > 0 &&
      verifyToken.length > 0,
  };
}
/** WhatsApp customer opt-in preference used for campaign audiences. */
export type WhatsAppPreference = {
  id: number;
  customerId?: number | null;
  phone: string;
  optedIn: boolean;
  source?: string;
  optedInAt?: string;
  optedOutAt?: string;
  active: boolean;
};

/** Request body for creating a manual WhatsApp opt-in preference. */
export type CreateWhatsAppPreferenceRequest = {
  customerId?: number;
  phone: string;
};

/** Fetches active WhatsApp opt-in preferences. */
export async function getWhatsAppPreferences(): Promise<WhatsAppPreference[]> {
  const res = await adminHttp.get("/api/admin/whatsapp/preferences");
  return res.data;
}

/** Creates a manual WhatsApp opt-in preference for testing campaigns. */
export async function createManualWhatsAppPreference(
  payload: CreateWhatsAppPreferenceRequest
): Promise<WhatsAppPreference> {
  const res = await adminHttp.post("/api/admin/whatsapp/preferences/manual", payload);
  return res.data;
}

/** Disables a WhatsApp opt-in preference. */
export async function disableWhatsAppPreference(id: number): Promise<void> {
  await adminHttp.delete(`/api/admin/whatsapp/preferences/${id}`);
}

/** Uploads a campaign header image and returns the presigned URL for Meta to fetch. */
export async function uploadWhatsAppCampaignImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await adminHttp.post<{ url: string }>("/api/admin/whatsapp/upload-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url;
}