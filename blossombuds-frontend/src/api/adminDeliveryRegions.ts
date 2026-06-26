import adminHttp from "./adminHttp";

export type DeliveryRegion = {
  id: number;
  name: string;
  active: boolean;
  stateIds: number[];
};

export type AllowlistEntry = {
  id: { stateId: number; deliveryPartnerId: number };
};

export async function listRegions(): Promise<DeliveryRegion[]> {
  const { data } = await adminHttp.get<DeliveryRegion[]>("/api/admin/shipping/regions");
  return data ?? [];
}

export async function createRegion(name: string): Promise<DeliveryRegion> {
  const { data } = await adminHttp.post<DeliveryRegion>("/api/admin/shipping/regions", { name });
  return data;
}

export async function renameRegion(id: number, name: string): Promise<DeliveryRegion> {
  const { data } = await adminHttp.patch<DeliveryRegion>(`/api/admin/shipping/regions/${id}`, { name });
  return data;
}

export async function deleteRegion(id: number): Promise<void> {
  await adminHttp.delete(`/api/admin/shipping/regions/${id}`);
}

export async function setRegionStates(id: number, stateIds: number[]): Promise<DeliveryRegion> {
  const { data } = await adminHttp.put<DeliveryRegion>(`/api/admin/shipping/regions/${id}/states`, { stateIds });
  return data;
}

export async function getAllowlistForState(stateId: number): Promise<AllowlistEntry[]> {
  const { data } = await adminHttp.get<AllowlistEntry[]>(`/api/admin/shipping/regions/allowlist/${stateId}`);
  return data ?? [];
}

export async function addAllowlistEntry(stateId: number, deliveryPartnerId: number): Promise<AllowlistEntry> {
  const { data } = await adminHttp.post<AllowlistEntry>("/api/admin/shipping/regions/allowlist", {
    stateId,
    deliveryPartnerId,
  });
  return data;
}

export async function removeAllowlistEntry(stateId: number, deliveryPartnerId: number): Promise<void> {
  await adminHttp.delete(`/api/admin/shipping/regions/allowlist/${stateId}/${deliveryPartnerId}`);
}

export async function clearAllowlistForState(stateId: number): Promise<void> {
  await adminHttp.delete(`/api/admin/shipping/regions/allowlist/${stateId}`);
}
