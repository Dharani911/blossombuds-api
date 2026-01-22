// src/api/adminGlobalSale.ts
import adminHttp from "./adminHttp";

export type GlobalSaleConfigDto = {
  id?: number;
  enabled: boolean;
  percentOff: number;                // BigDecimal -> number
  label?: string | null;
  startsAt?: string | null;          // ISO string
  endsAt?: string | null;            // ISO string
  createdAt?: string | null;
  modifiedAt?: string | null;
};

function normalize(d: any): GlobalSaleConfigDto {
  return {
    id: d?.id == null ? undefined : Number(d.id),
    enabled: Boolean(d?.enabled),
    percentOff: Number(d?.percentOff ?? 0),
    label: d?.label ?? null,
    startsAt: d?.startsAt ?? null,
    endsAt: d?.endsAt ?? null,
    createdAt: d?.createdAt ?? null,
    modifiedAt: d?.modifiedAt ?? null,
  };
}

/** Admin: list all discount configs (newest first). */
export async function listDiscounts(): Promise<GlobalSaleConfigDto[]> {
  const { data } = await adminHttp.get(`/api/catalog/discounts`);
  return (Array.isArray(data) ? data : []).map(normalize);
}

/** Admin: get one by id. */
export async function getDiscount(id: number): Promise<GlobalSaleConfigDto> {
  const { data } = await adminHttp.get(`/api/catalog/discounts/${id}`);
  return normalize(data);
}

/** Admin: create. */
export async function createDiscount(dto: GlobalSaleConfigDto): Promise<GlobalSaleConfigDto> {
  const payload = { ...dto, percentOff: Number(dto.percentOff ?? 0) };
  const { data } = await adminHttp.post(`/api/catalog/discounts`, payload);
  return normalize(data);
}

/** Admin: update. */
export async function updateDiscount(id: number, dto: GlobalSaleConfigDto): Promise<GlobalSaleConfigDto> {
  const payload = { ...dto, percentOff: Number(dto.percentOff ?? 0) };
  const { data } = await adminHttp.put(`/api/catalog/discounts/${id}`, payload);
  return normalize(data);
}

/** Admin: delete. */
export async function deleteDiscount(id: number): Promise<void> {
  await adminHttp.delete(`/api/catalog/discounts/${id}`);
}
