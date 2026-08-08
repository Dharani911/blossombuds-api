import adminHttp from "./adminHttp";

/** Email campaign summary shown in admin. Audience is always fixed — customers with no
 *  phone on file and not unsubscribed — there is no per-campaign audience selection. */
export type EmailCampaign = {
  id: number;
  title: string;
  subject: string;
  bodyText: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt?: string;
  completedAt?: string;
};

/** One recipient inside an email campaign. */
export type EmailCampaignRecipient = {
  id: number;
  campaignId: number;
  customerId?: number;
  email: string;
  recipientName?: string;
  status: string;
  errorMessage?: string;
  sentAt?: string;
  failedAt?: string;
};

/** Request body for creating an email campaign. */
export type CreateEmailCampaignRequest = {
  title: string;
  subject: string;
  bodyText: string;
};

/** Fetches email campaigns. */
export async function getEmailCampaigns(): Promise<EmailCampaign[]> {
  const res = await adminHttp.get("/api/admin/email-marketing/campaigns");
  return res.data;
}

/** Creates an email campaign (recipients resolved automatically server-side). */
export async function createEmailCampaign(
  payload: CreateEmailCampaignRequest
): Promise<EmailCampaign> {
  const res = await adminHttp.post("/api/admin/email-marketing/campaigns", payload);
  return res.data;
}

/** Sends an email campaign. */
export async function sendEmailCampaign(campaignId: number): Promise<EmailCampaign> {
  const res = await adminHttp.post(`/api/admin/email-marketing/campaigns/${campaignId}/send`);
  return res.data;
}

/** Fetches recipients for an email campaign. */
export async function getEmailCampaignRecipients(
  campaignId: number
): Promise<EmailCampaignRecipient[]> {
  const res = await adminHttp.get(`/api/admin/email-marketing/campaigns/${campaignId}/recipients`);
  return res.data;
}
