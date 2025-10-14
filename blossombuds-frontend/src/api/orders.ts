// src/api/orders.ts
import http from "./http";

/** GET /api/orders/by-customer/{customerId} -> Order[] (or {items: Order[]}) */
export async function getOrdersByCustomer(customerId: string | number) {
  const { data } = await http.get(`/api/orders/by-customer/${customerId}`);
  // normalize: either an array or an envelope { items: [] }
  return Array.isArray(data) ? data : (data?.items ?? []);
}
