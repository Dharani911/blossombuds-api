import axios from "axios";

/**
 * Returns product IDs that are included in global discount.
 */
export async function listDiscountProductIds(): Promise<number[]> {
  const res = await axios.get("/api/admin/discount-products");
  return res.data || [];
}

/**
 * Saves the full set of discounted product IDs (bulk replace).
 */
export async function saveDiscountProductIds(ids: number[]): Promise<void> {
  await axios.put("/api/admin/discount-products", { productIds: ids });
}
