// src/api/partners.ts
import http from "./http";

export type DeliveryPartner = {
  id: number;
  name?: string | null;
  code?: string | null;        // e.g. "DELHIVERY", "DTDC"
  trackingUrlTemplate?: string | null;
  active?: boolean;
};

async function listActivePartners(): Promise<DeliveryPartnerLite[]> {
  const res = await fetch(`/api/partners/active`); // no headers/credentials
  if (!res.ok) throw new Error("Failed to load partners");
  return await res.json();
}
export default { listActivePartners };
