// src/api/customers.ts
import http from "./http";

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
