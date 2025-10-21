// src/api/adminShippingRules.ts
import adminHttp from "./adminHttp";

export type RuleScope = "DEFAULT" | "STATE" | "DISTRICT";
export type DeliveryFeeRule = {
  id?: number;
  scope: RuleScope | string;
  scopeId?: number | null;
  feeAmount: number | string;
  active?: boolean;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
};

export async function listRules(): Promise<DeliveryFeeRule[]> {
  const { data } = await adminHttp.get<DeliveryFeeRule[]>("/api/admin/shipping/rules");
  return data ?? [];
}

export async function saveRule(rule: DeliveryFeeRule): Promise<DeliveryFeeRule> {
  const payload = {
    id: rule.id,
    scope: String(rule.scope || "DEFAULT").toUpperCase(),
    scopeId: String(rule.scope || "DEFAULT").toUpperCase() === "DEFAULT" ? null : (rule.scopeId ?? null),
    feeAmount: Number(rule.feeAmount ?? 0),
    active: rule.active ?? true,
  };
  const { data } = await adminHttp.post<DeliveryFeeRule>("/api/admin/shipping/rules", payload);
  return data;
}

export async function updateRule(id: number, patch: Partial<DeliveryFeeRule>): Promise<DeliveryFeeRule> {
  const { data } = await adminHttp.patch<DeliveryFeeRule>(`/api/admin/shipping/rules/${id}`, patch);
  return data;
}

export async function deleteRule(id: number): Promise<void> {
  await adminHttp.delete(`/api/admin/shipping/rules/${id}`);
}
