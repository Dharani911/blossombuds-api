import { authFetch } from "./authFetch";

/** Server Customer model (admin view). */
export type Customer = {
  id: number;
  /** Backend returns `name` on read; `fullName` is used only for create/update DTOs. */
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
};

/** Address model as returned by the new AddressView (IDs + readable names). */
export type Address = {
  id: number;
  customerId?: number | null;
  name?: string | null;
  phone?: string | null;
  line1?: string | null;
  line2?: string | null;

  /** Geo IDs */
  stateId?: number | null;
  districtId?: number | null;
  countryId?: number | null;

  /** Readable names provided by backend (NEW) */
  districtName?: string | null;
  stateName?: string | null;
  countryName?: string | null;

  pincode?: string | null;
  isDefault?: boolean | null;
  active?: boolean | null;

  /** Optional audit fields if your backend sends them */
  createdAt?: string | null;
  modifiedAt?: string | null;
};

/** Minimal order summary for admin lists. (We normalize in the component) */
export type OrderSummary = {
  id: number;
  orderNumber?: string | null; // will map from publicCode
  status?: string | null;
  totalAmount?: number | null; // will map from grandTotal
  currency?: string | null;
  placedAt?: string | null;    // will map from createdDate
};

/** DTOs */
export type CustomerDto = Partial<{
  id: number;
  fullName: string; // server expects fullName on write
  email: string;
  phone: string;
  active: boolean;
}>;

export type AddressDto = Partial<{
  name: string;
  phone: string;
  line1: string;
  line2: string;

  /** Geo IDs (write-side) */
  stateId: number;
  districtId: number;
  countryId: number;

  pincode: string;
  isDefault: boolean;
  active: boolean;
}>;

/* ----------------------- helpers ----------------------- */
async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(() => "HTTP " + res.status));
  return res.json() as Promise<T>;
}
async function jVoid(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await res.text().catch(() => "HTTP " + res.status));
}

/* ----------------------- Customers --------------------- */

/** GET /api/customers (ADMIN) */
export async function listCustomers(): Promise<Customer[]> {
  return j(await authFetch("/api/customers"));
}

/** GET /api/customers/{customerId} (ADMIN) */
export async function getCustomer(customerId: number): Promise<Customer> {
  return j(await authFetch(`/api/customers/${customerId}`));
}

/** POST /api/customers (ADMIN) */
export async function createCustomer(dto: CustomerDto): Promise<Customer> {
  return j(
    await authFetch(`/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    })
  );
}

/** PATCH /api/customers/{customerId} (ADMIN) */
export async function updateCustomer(customerId: number, dto: CustomerDto): Promise<Customer> {
  return j(
    await authFetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    })
  );
}

/* ----------------------- Addresses --------------------- */

/** GET /api/customers/{customerId}/addresses */
export async function listCustomerAddresses(customerId: number): Promise<Address[]> {
  return j(await authFetch(`/api/customers/${customerId}/addresses`));
}

/** POST /api/customers/{customerId}/addresses */
export async function addAddress(customerId: number, dto: AddressDto): Promise<Address> {
  return j(
    await authFetch(`/api/customers/${customerId}/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    })
  );
}

/** PATCH /api/customers/addresses/{addressId} */
export async function updateAddress(addressId: number, dto: AddressDto): Promise<Address> {
  return j(
    await authFetch(`/api/customers/addresses/${addressId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    })
  );
}

/** POST /api/customers/addresses/{addressId}/set-default */
export async function setDefaultAddress(addressId: number): Promise<Address> {
  return j(
    await authFetch(`/api/customers/addresses/${addressId}/set-default`, {
      method: "POST",
    })
  );
}

/** DELETE /api/customers/addresses/{addressId} */
export async function deleteAddress(addressId: number): Promise<void> {
  return jVoid(
    await authFetch(`/api/customers/addresses/${addressId}`, {
      method: "DELETE",
    })
  );
}

/* ----------------------- Orders ------------------------ */

/** GET /api/orders/by-customer/{customerId} */
export async function listOrdersByCustomer(customerId: number): Promise<any[]> {
  // Keep as `any[]` at the transport layer and normalize in the component (as you already do).
  return j(await authFetch(`/api/orders/by-customer/${customerId}`));
}
