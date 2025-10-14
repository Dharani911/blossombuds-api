import { authFetch } from "./authFetch";

export type Customer = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
};

export type Address = {
  id: number;
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  isDefault?: boolean | null;
  active?: boolean | null;
  createdAt?: string | null;
};

export type OrderSummary = {
  id: number;
  orderNumber?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  placedAt?: string | null;
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(() => "HTTP " + res.status));
  return res.json() as Promise<T>;
}

export async function listCustomers(): Promise<Customer[]> {
  return j(await authFetch("/api/customers"));
}

export async function listCustomerAddresses(customerId: number): Promise<Address[]> {
  return j(await authFetch(`/api/customers/${customerId}/addresses`));
}

/**
 * Assumes your orders API supports filtering by customer:
 * GET /api/orders?customerId=123
 * If your real path differs, just tweak this one line.
 */

export async function listOrdersByCustomer(customerId: number) {
  return j(await authFetch(`/api/orders/by-customer/${customerId}`));
}

