import adminHttp from "./adminHttp";

export type DiscountType = "PERCENT" | "FLAT";

export type Coupon = {
  id?: number;
  code: string;
  discountType: DiscountType;                 // maps to column "type"
  discountValue: string | number;             // maps to column "amount"
  minOrderTotal?: string | number | null;     // maps to "min_order_value"
  validFrom?: string | null;                  // maps to "starts_at" (ISO string)
  validTo?: string | null;                    // maps to "ends_at"   (ISO string)
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  active?: boolean;
  visible?: boolean;                          // visibility flag (hide from customers)
  minItems?: number | null;                   // maps to "min_items"
};

export async function listCoupons(): Promise<Coupon[]> {
  const { data } = await adminHttp.get<Coupon[]>("/api/promotions/admin/coupons");
  return data ?? [];
}

export async function createCoupon(payload: Coupon): Promise<Coupon> {
  const { data } = await adminHttp.post<Coupon>(
    "/api/promotions/admin/coupons",
    sanitizeCouponPayload(payload)
  );
  return data;
}

type CouponUpdate = Partial<Coupon>;
export async function updateCoupon(id: number, patch: CouponUpdate): Promise<Coupon> {
  const { data } = await adminHttp.put<Coupon>(
    `/api/promotions/admin/coupons/${id}`,
    sanitizeCouponPayload(patch as Coupon)
  );
  return data;
}

export async function setCouponActive(id: number, active: boolean): Promise<void> {
  await adminHttp.post(`/api/promotions/admin/coupons/${id}/active`, null, { params: { active } });
}

export async function setCouponVisible(id: number, visible: boolean): Promise<void> {
  await adminHttp.post(`/api/promotions/admin/coupons/${id}/visible`, null, { params: { visible } });
}

export async function getCoupon(id: number): Promise<Coupon> {
  const { data } = await adminHttp.get<Coupon>(`/api/promotions/admin/coupons/${id}`);
  return data;
}

/* ------------------------ helpers ------------------------ */

function toNum(x: unknown): number | undefined {
  if (x === null || x === undefined || x === "") return undefined;
  const n = typeof x === "string" ? Number(x) : (x as number);
  return Number.isFinite(n) ? n : undefined;
}

function toIsoOffset(s?: string | null): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString(); // OffsetDateTime compatible
}

/** Only fields your backend actually understands (matches DB/DTO). */
export function sanitizeCouponPayload(c: Coupon): Partial<Coupon> {
  return {
    id: c.id,
    code: c.code?.trim().toUpperCase(),
    discountType: c.discountType,
    discountValue: toNum(c.discountValue)!,                // required on create
    minOrderTotal: toNum(c.minOrderTotal ?? undefined),
    validFrom: toIsoOffset(c.validFrom ?? undefined),
    validTo: toIsoOffset(c.validTo ?? undefined),
    usageLimit: c.usageLimit ?? undefined,
    perCustomerLimit: c.perCustomerLimit ?? undefined,
    active: c.active ?? undefined,
    visible: c.visible ?? undefined,
    minItems: typeof c.minItems === "number" ? c.minItems : (c.minItems == null ? undefined : Number(c.minItems)),
  };
}

export default {
  listCoupons,
  createCoupon,
  updateCoupon,
  setCouponActive,
  setCouponVisible,
  getCoupon,
  sanitizeCouponPayload,
};
