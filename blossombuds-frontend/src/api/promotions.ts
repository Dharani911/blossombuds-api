// src/api/promotions.ts
import http from "./http";

export type Coupon = {
  id: number;
  code: string;
  active?: boolean;
  // You might have more fields like type/amount/percent/minOrder etc.
};

export async function getCoupon(code: string): Promise<Coupon> {
  const { data } = await http.get(`/api/promotions/coupons/${encodeURIComponent(code)}`);
  return data as Coupon;
}

/** Preview discount amount for a coupon & order total (public). */
export async function previewCoupon(
  code: string,
  body: { customerId: number; orderTotal: number | string }
): Promise<{ code: string; orderTotal: number; discount: number }> {
  const { data } = await http.post(
    `/api/promotions/coupons/${encodeURIComponent(code)}/preview`,
    body
  );
  // data: { code, orderTotal, discount }
  return data;
}

export default { getCoupon, previewCoupon };
