// src/admin/api/customers.ts
import axios from "axios";

/* ---------- Types (mirror your backend) ---------- */
export type Customer = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export type Address = {
  id: number;
  customerId: number;
  name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  landmark?: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt?: string | null;
  modifiedAt?: string | null;
};

export type CustomerDto = Partial<
  Pick<Customer, "name" | "email" | "phone" | "active">
>;
export type AddressDto = Partial<
  Pick<
    Address,
    | "name"
    | "phone"
    | "line1"
    | "line2"
    | "city"
    | "state"
    | "postalCode"
    | "landmark"
    | "isDefault"
    | "active"
  >
>;

/* ---------- Axios client with JWT ---------- */
const api = axios.create({
  baseURL: "/api",
  timeout: 20000,
});

function getToken(): string | null {
  return (
    localStorage.getItem("admin.jwt") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token")
  );
}
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

/* ---------- Customers ---------- */

// POST /api/customers (ADMIN)
export async function createCustomer(dto: CustomerDto): Promise<Customer> {
  const { data } = await api.post<Customer>("/customers", dto);
  return data;
}

// PATCH /api/customers/{id} (ADMIN)
export async function updateCustomer(
  customerId: number,
  dto: CustomerDto
): Promise<Customer> {
  const { data } = await api.patch<Customer>(`/customers/${customerId}`, dto);
  return data;
}

// GET /api/customers/{id} (ADMIN)
export async function getCustomer(customerId: number): Promise<Customer> {
  const { data } = await api.get<Customer>(`/customers/${customerId}`);
  return data;
}

// GET /api/customers (ADMIN) — returns full list (no server paging)
// You can filter/paginate on the caller side.
export async function listCustomers(): Promise<Customer[]> {
  const { data } = await api.get<Customer[]>("/customers");
  return data ?? [];
}

/* ---------- Addresses (CUSTOMER or ADMIN) ---------- */

// GET /api/customers/{customerId}/addresses
export async function listAddresses(
  customerId: number
): Promise<Address[]> {
  const { data } = await api.get<Address[]>(
    `/customers/${customerId}/addresses`
  );
  return data ?? [];
}

// POST /api/customers/{customerId}/addresses
export async function addAddress(
  customerId: number,
  dto: AddressDto
): Promise<Address> {
  const { data } = await api.post<Address>(
    `/customers/${customerId}/addresses`,
    dto
  );
  return data;
}

// PATCH /api/customers/addresses/{addressId}
export async function updateAddress(
  addressId: number,
  dto: AddressDto
): Promise<Address> {
  const { data } = await api.patch<Address>(
    `/customers/addresses/${addressId}`,
    dto
  );
  return data;
}

// POST /api/customers/addresses/{addressId}/set-default
export async function setDefaultAddress(addressId: number): Promise<Address> {
  const { data } = await api.post<Address>(
    `/customers/addresses/${addressId}/set-default`
  );
  return data;
}

// DELETE /api/customers/addresses/{addressId}
export async function deleteAddress(addressId: number): Promise<void> {
  await api.delete(`/customers/addresses/${addressId}`);
}

/* ---------- Optional: tiny client-side helper for paging/filter ---------- */
export function paginateAndFilter<T extends Customer>(
  rows: T[],
  opts: { q?: string; page?: number; size?: number } = {}
) {
  const { q, page = 0, size = 20 } = opts;
  const needle = (q ?? "").trim().toLowerCase();
  const filtered = !needle
    ? rows
    : rows.filter((r) => {
        const hay =
          `${r.name ?? ""} ${r.email ?? ""} ${r.phone ?? ""} ${r.id}`.toLowerCase();
        return hay.includes(needle);
      });
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = page * size;
  const end = start + size;
  const content = filtered.slice(start, end);
  return { content, totalElements, totalPages };
}
