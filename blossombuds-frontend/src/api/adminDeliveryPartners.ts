import adminHttp from "./adminHttp";

export type DeliveryPartner = {
  id?: number;
  name: string;
  code: string;
  trackingUrlTemplate?: string | null;
  active?: boolean;
};

export async function listPartners(): Promise<DeliveryPartner[]> {
  const { data } = await adminHttp.get<DeliveryPartner[]>("/api/partners");
  return data ?? [];
}

export async function createPartner(payload: DeliveryPartner): Promise<DeliveryPartner> {
  const { data } = await adminHttp.post<DeliveryPartner>("/api/partners", payload);
  return data;
}

export async function updatePartner(id: number, payload: DeliveryPartner): Promise<DeliveryPartner> {
  const { data } = await adminHttp.patch<DeliveryPartner>(`/api/partners/${id}`, payload);
  return data;
}

export async function togglePartnerActive(id: number, active: boolean): Promise<DeliveryPartner> {
  const { data } = await adminHttp.post<DeliveryPartner>(`/api/partners/${id}/active/${active}`);
  return data;
}

export async function deletePartner(id: number): Promise<void> {
  await adminHttp.delete(`/api/partners/${id}`);
}
