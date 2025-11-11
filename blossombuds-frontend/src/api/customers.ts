// src/api/customers.ts
import http from "./http";

/** ─────────────────── Types (aligned with backend) ─────────────────── **/

export type Customer = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export type CustomerDto = Partial<{
  name: string;
  email: string;
  phone: string;
  active: boolean;
}>;

/**
 * AddressView (what your controller returns) — uses id refs for region fields.
 * This matches what CheckoutPage and Admin use (countryId/stateId/districtId).
 */
export type Address = {
  id: number;
  customerId: number;
  name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  stateId?: number | null;
  districtId?: number | null;
  countryId?: number | null;
  pincode?: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export type AddressDto = Partial<{
  name: string;
  phone: string;
  line1: string;
  line2: string;
  stateId: number;
  districtId: number;
  countryId: number;
  pincode: string;
  isDefault: boolean;
  active: boolean;
}>;

export type OrderSummary = {
  id: number;
  orderNumber?: string | null;
  status?: string | null;
  totalAmount?: number | null;
  currency?: string | null; // e.g., "INR"
  placedAt?: string | null;
};

/** ─────────────────── Customer endpoints ─────────────────── **/

// GET /api/customers  (admin only)
export async function listCustomers(): Promise<Customer[]> {
  const { data } = await http.get<Customer[]>("/api/customers");
  return data ?? [];
}

// GET /api/customers/{customerId}
export async function getCustomer(customerId: number): Promise<Customer> {
  const { data } = await http.get<Customer>(`/api/customers/${customerId}`);
  return data;
}

// POST /api/customers  (admin only)
export async function createCustomer(dto: CustomerDto): Promise<Customer> {
  const { data } = await http.post<Customer>("/api/customers", dto);
  return data;
}

// PATCH /api/customers/{customerId}  (admin only)
export async function updateCustomer(customerId: number, dto: CustomerDto): Promise<Customer> {
  const { data } = await http.patch<Customer>(`/api/customers/${customerId}`, dto);
  return data;
}

/** ─────────────────── Address endpoints ─────────────────── **/

// GET /api/customers/{customerId}/addresses
export async function listAddresses(customerId: number): Promise<Address[]> {
  const { data } = await http.get<Address[]>(`/api/customers/${customerId}/addresses`);
  return data ?? [];
}

// POST /api/customers/{customerId}/addresses
export async function addAddress(customerId: number, dto: AddressDto): Promise<Address> {
  const { data } = await http.post<Address>(`/api/customers/${customerId}/addresses`, dto);
  return data;
}

// PATCH /api/customers/addresses/{addressId}
export async function updateAddress(addressId: number, dto: AddressDto): Promise<Address> {
  const { data } = await http.patch<Address>(`/api/customers/addresses/${addressId}`, dto);
  return data;
}

// POST /api/customers/addresses/{addressId}/set-default
export async function setDefaultAddress(addressId: number): Promise<Address> {
  const { data } = await http.post<Address>(`/api/customers/addresses/${addressId}/set-default`);
  return data;
}

// DELETE /api/customers/addresses/{addressId}
export async function deleteAddress(addressId: number): Promise<void> {
  await http.delete(`/api/customers/addresses/${addressId}`);
}

/** ─────────────────── Orders by customer (admin) ─────────────────── **/

// GET /api/orders/by-customer/{customerId}  (adjust if your real route differs)
export async function listOrdersByCustomer(customerId: number): Promise<OrderSummary[]> {
  const { data } = await http.get<OrderSummary[]>(`/api/orders/by-customer/${customerId}`);
  return data ?? [];
}
