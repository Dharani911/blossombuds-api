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
  /** When true, sending this campaign also auto-sends a matching email to customers with no phone on file. */
  alsoEmailPhoneless?: boolean;
  /** Id of the linked email campaign once sent, if alsoEmailPhoneless was enabled. */
  linkedEmailCampaignId?: number;
  /** Outcome of that linked email send. Surfaced here because there is no separate
   *  Email Marketing page any more. */
  linkedEmailTotalRecipients?: number | null;
  linkedEmailSentCount?: number | null;
  linkedEmailFailedCount?: number | null;
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

/** Expo / external contact imported from events or lists. */
export type WhatsAppContact = {
  id: number;
  phone: string;
  name?: string;
  source?: string;
  optedIn: boolean;
  optedOutAt?: string;
  active: boolean;
  createdAt?: string;
  /** When this contact last messaged the business number. Null means WhatsApp will almost
   *  certainly drop a marketing message to them (Meta error 131049). */
  lastInboundAt?: string | null;
};

/** How much of the expo audience WhatsApp will actually deliver to. */
export type ContactReachability = {
  /** Expo contacts (EXPO_CONTACTS audience). */
  optedIn: number;
  reachable: number;
  unreachable: number;
  /** Registered customers (ALL_OPTED_IN audience). Website consent does not make a customer
   *  reachable on WhatsApp — only messaging the business number does. */
  customersOptedIn: number;
  customersReachable: number;
  customersUnreachable: number;
  /** Deep link to encode as a QR code at events — opens WhatsApp with the opt-in text pre-filled. */
  optInLink: string;
};

/** Fetches expo audience reachability plus the opt-in deep link. */
export async function getContactReachability(): Promise<ContactReachability> {
  const res = await adminHttp.get<ContactReachability>("/api/admin/whatsapp/contacts/reachability");
  return res.data;
}

/** Distinct people reachable on each channel right now — not a running total of past sends. */
export type CampaignAudienceSummary = {
  /** Distinct customers opted in for WhatsApp. */
  whatsAppOptedIn: number;
  /** Distinct customers eligible for the email fallback (no phone, has email), minus unsubscribed. */
  emailAudience: number;
};

/** Fetches the distinct, de-duplicated audience size per channel for the dashboard header. */
export async function getCampaignAudienceSummary(): Promise<CampaignAudienceSummary> {
  const res = await adminHttp.get<CampaignAudienceSummary>("/api/admin/whatsapp/campaigns/audience-summary");
  return res.data;
}

/** Result returned after an import batch. */
export type ImportContactsResult = {
  imported: number;
  skippedRegistered: number;
  skippedDuplicate: number;
  /** Previously opted-out contacts brought back by this re-import. */
  reactivated: number;
};

/** Request body for creating a WhatsApp campaign. */
export type CreateWhatsAppCampaignRequest = {
  title: string;
  templateId: number;
  audienceType: "MANUAL" | "ALL_OPTED_IN" | "EXPO_CONTACTS";
  link?: string;
  offerText?: string;
  imageUrl?: string;
  orderCode?: string;
  trackingNumber?: string;
  trackingLink?: string;
  paymentLink?: string;
  notes?: string;
  recipients?: ManualWhatsAppRecipient[];
  /** When true, sending this campaign also auto-sends a matching email to customers with no
   *  phone on file. Only valid when audienceType is ALL_OPTED_IN. */
  alsoEmailPhoneless?: boolean;
  /** Optional: restrict the send to contacts who have messaged the business number.
   *  Defaults to false — campaigns go to everyone who opted in. No UI exposes this; it exists
   *  for the case where a campaign comes back with mass 131049 failures and you want to retry
   *  against the subset WhatsApp is most likely to deliver to. */
  warmOnly?: boolean;
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

/** Removes a campaign from the list. The record is retained for audit, not destroyed. */
export async function deleteWhatsAppCampaign(campaignId: number): Promise<void> {
  await adminHttp.delete(`/api/admin/whatsapp/campaigns/${campaignId}`);
}

/** Fetches the message as a recipient would see it, with placeholders filled in. */
export async function getWhatsAppCampaignPreview(campaignId: number): Promise<string> {
  const res = await adminHttp.get<{ preview: string }>(
    `/api/admin/whatsapp/campaigns/${campaignId}/preview`
  );
  return res.data.preview;
}

/** Fetches recipients for a WhatsApp campaign. */
export async function getWhatsAppCampaignRecipients(
  campaignId: number
): Promise<WhatsAppCampaignRecipient[]> {
  const res = await adminHttp.get(`/api/admin/whatsapp/campaigns/${campaignId}/recipients`);
  return res.data;
}
/** WhatsApp integration status — booleans only, resolved server-side. */
export type WhatsAppIntegrationStatus = {
  cloudEnabled: boolean;
  apiVersion: string;
  phoneNumberIdConfigured: boolean;
  businessAccountIdConfigured: boolean;
  accessTokenConfigured: boolean;
  verifyTokenConfigured: boolean;
  readyForLive: boolean;
};

/** Fetches WhatsApp integration status.
 *  Previously this pulled the whole settings table and inspected raw values in the browser,
 *  which meant the access token and verify token were sent to the client on every page load.
 *  The backend now answers with configured/not-configured flags and never sends the values. */
export async function getWhatsAppIntegrationStatus(): Promise<WhatsAppIntegrationStatus> {
  const res = await adminHttp.get<WhatsAppIntegrationStatus>(
    "/api/admin/whatsapp/integration-status"
  );
  return res.data;
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

/** Fetches all active expo/external contacts. */
export async function getWhatsAppContacts(): Promise<WhatsAppContact[]> {
  const res = await adminHttp.get("/api/admin/whatsapp/contacts");
  return res.data;
}

/** Imports a batch of external contacts from a source (e.g. EXPO_JUN_2026). */
export async function importWhatsAppContacts(
  source: string,
  contacts: { phone: string; name?: string }[]
): Promise<ImportContactsResult> {
  const res = await adminHttp.post("/api/admin/whatsapp/contacts/import", { source, contacts });
  return res.data;
}

/** Manually deactivates an expo contact from the admin. */
export async function deactivateWhatsAppContact(id: number): Promise<void> {
  await adminHttp.delete(`/api/admin/whatsapp/contacts/${id}`);
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

/** Result of the one-time pre-feature consent migration. */
export type ConsentMigrationResult = {
  eligible: number;
  optedIn: number;
  emailFailed: number;
  /** Opted in but never notified — no email address on file to send the policy notice to. */
  noEmailOnFile: number;
};

/** Counts customers eligible for the one-time consent migration, without running it. */
export async function getConsentMigrationEligibleCount(): Promise<number> {
  const res = await adminHttp.get<{ eligible: number }>("/api/admin/whatsapp/consent-migration/eligible-count");
  return res.data.eligible;
}

/** Runs the one-time consent migration: opts in pre-feature customers and emails each the policy notice. */
export async function runConsentMigration(): Promise<ConsentMigrationResult> {
  const res = await adminHttp.post("/api/admin/whatsapp/consent-migration/run");
  return res.data;
}