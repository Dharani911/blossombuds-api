// src/api/globalSaleConfig.ts
import http from "./http";

export type GlobalSaleConfig = {
  id: number;
  enabled: boolean;
  percentOff: number;                // BigDecimal -> number
  label?: string | null;
  startsAt?: string | null;          // ISO string
  endsAt?: string | null;            // ISO string
  createdAt?: string | null;
  modifiedAt?: string | null;
};

function normalizeDiscount(d: any): GlobalSaleConfig {
  return {
    id: Number(d?.id ?? 0),
    enabled: Boolean(d?.enabled),
    percentOff: Number(d?.percentOff ?? 0),
    label: d?.label ?? null,
    startsAt: d?.startsAt ?? null,
    endsAt: d?.endsAt ?? null,
    createdAt: d?.createdAt ?? null,
    modifiedAt: d?.modifiedAt ?? null,
  };
}

/** Public: effective discount now (can be null). */
export async function getEffectiveDiscount(): Promise<GlobalSaleConfig | null> {
  const { data } = await http.get(`/api/catalog/discounts/effective`);
  if (!data) return null;
  return normalizeDiscount(data);
}

export default { getEffectiveDiscount };
