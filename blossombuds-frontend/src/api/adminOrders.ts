// src/api/adminOrders.ts
import adminHttp from "./adminHttp";

/** Backend status enum as per your controller/docs */
export type OrderStatus =
  | "ORDERED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURNED_REFUNDED";

/** A light order shape for the list/summary panes */
export type OrderLite = {
  id: number;
  publicCode: string;
  status: OrderStatus;
  customerId?: number;
  createdAt?: string;
  grandTotal?: number;
  shippingFee?: number;

  // optional shipping/contact echoes if your API returns them on GET /{publicCode}
  shipName?: string;
  shipPhone?: string;
  shipLine1?: string;
  shipLine2?: string;
  shipPincode?: string;
  shipStateId?: number;
  shipDistrictId?: number;
  shipCountryId?: number;
};

export type OrderItem = {
  id: number;
  orderId: number;
  productId?: number;
  productName: string;
  productSlug?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  optionsJson?: string;
  optionsText?: string;
};

export type Payment = {
  id: number;
  orderId: number;
  gateway?: string;
  ref?: string;
  amount: number;
  status?: string;   // e.g. "CAPTURED"
  createdAt?: string;
};

export type OrderEvent = {
  id: number;
  orderId: number;
  type: string;      // e.g. "NOTE", "STATUS_CHANGED"
  message: string;
  createdAt?: string;
};

/* ------------------- NEW lightweight catalog types ------------------- */

export type ProductPick = {
  id: number;
  name: string;
  // no base price; unitPrice is derived from option value deltas
};

export type OptionValueLite = {
  id: number;
  valueLabel: string;
  priceDelta: number;
  sortOrder?: number | null;
  active?: boolean | null;
};

export type ProductOptionLite = {
  id: number;
  name: string; // label/title of the option
  sortOrder?: number | null;
  values: OptionValueLite[];
};

/* ----------------------------- Orders ----------------------------- */

export async function getByPublicCode(publicCode: string) {
  const { data } = await adminHttp.get(`/api/orders/${encodeURIComponent(publicCode)}`);
  return data as OrderLite;
}

/** Admin-list by customer */
export async function getByCustomer(customerId: number) {
  const { data } = await adminHttp.get(`/api/orders/by-customer/${customerId}`);
  return data as OrderLite[];
}

export async function patchStatus(orderId: number, status: OrderStatus, note?: string) {
  const { data } = await adminHttp.patch(`/api/orders/${orderId}/status`, { status, note });
  return data as any; // server returns Order; page uses confirmation
}

export async function listItems(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/items`);
  return data as OrderItem[];
}

export async function addItem(orderId: number, payload: { productId: number; qty: number; unitPrice: number }) {
  // Adjust keys to your OrderItemDto (quantity/unitPrice)
  const body = { productId: payload.productId, quantity: payload.qty, unitPrice: payload.unitPrice };
  const { data } = await adminHttp.post(`/api/orders/${orderId}/items`, body);
  return data as OrderItem;
}

export async function listPayments(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/payments`);
  return data as Payment[];
}

export async function addPayment(orderId: number, payload: { amount: number; gateway?: string; ref?: string }) {
  const { data } = await adminHttp.post(`/api/orders/${orderId}/payments`, payload);
  return data as Payment;
}

export async function listEvents(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/events`);
  return data as OrderEvent[];
}

export async function addEvent(orderId: number, payload: { type: string; message: string }) {
  const { data } = await adminHttp.post(`/api/orders/${orderId}/events`, payload);
  return data as OrderEvent;
}

export async function fetchInvoicePdf(orderId: number): Promise<Blob> {
  const { data } = await adminHttp.get(`/api/print/orders/${orderId}/invoice`, {
    responseType: "blob",
    withCredentials: true,
  });
  return data;
}

export async function fetchPackingSlipPdf(orderId: number): Promise<Blob> {
  const { data } = await adminHttp.get(`/api/print/orders/${orderId}/packing-slip`, {
    responseType: "blob",
    withCredentials: true,
  });
  return data;
}

/* ----------------------- NEW: Manual create helpers ----------------------- */

/**
 * Product search used by the manual-create drawer.
 * Backend: permitAll GET /api/search/products?q=...
 * If your search shape differs, tweak the mapping.
 */
export async function searchProductsLite(q: string): Promise<ProductPick[]> {
  const { data } = await adminHttp.get(`/api/search/products`, { params: { q } });
  const list = (data?.content ?? data ?? []) as any[];
  return list.map((p) => ({
    id: Number(p.id),
    name: String(p.name ?? p.title ?? p.slug ?? `#${p.id}`),
  }));
}

/**
 * Load options + values for a product.
 * Uses:
 *   GET /api/catalog/products/{productId}/options
 * And for each option:
 *   GET /api/catalog/options/{optionId}/values
 */
export async function getProductOptionsLite(productId: number): Promise<ProductOptionLite[]> {
  const { data: opts } = await adminHttp.get(`/api/catalog/products/${productId}/options`);
  const options = (opts ?? []) as any[];

  // fetch values per option
  const withValues = await Promise.all(
    options.map(async (o) => {
      const { data: vals } = await adminHttp.get(`/api/catalog/options/${o.id}/values`);
      const values = (vals ?? []) as any[];
      return {
        id: Number(o.id),
        name: String(o.name ?? o.optionName ?? "Option"),
        sortOrder: o.sortOrder ?? null,
        values: values
          .filter((v) => v == null || v.active == null || v.active === true)
          .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0))
          .map((v) => ({
            id: Number(v.id),
            valueLabel: String(v.valueLabel ?? v.label ?? v.value ?? ""),
            priceDelta: Number(v.priceDelta ?? 0),
            sortOrder: v.sortOrder ?? null,
            active: v.active ?? true,
          })) as OptionValueLite[],
      } as ProductOptionLite;
    })
  );

  // sort options too, just in case
  return withValues.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Create order manually (admin).
 * Endpoint suggestion: POST /api/admin/orders/manual
 * Payload:
 * {
 *   customerId:number,
 *   shippingFee:number,
 *   note?:string,
 *   items:[{ productId, quantity, unitPrice, optionValueIds:number[] }]
 * }
 */
export async function createManualOrder(payload: {
  customerId: number;
  shippingFee: number;
  note?: string;
  items: Array<{ productId: number; quantity: number; unitPrice: number; optionValueIds: number[] }>;
}): Promise<{ id:number; publicCode:string; customerId:number }> {
  const { data } = await adminHttp.post(`/api/admin/orders/manual`, payload);
  return data as { id:number; publicCode:string; customerId:number };
}
// after other exports…

export async function searchCustomersLite(q: string): Promise<Array<{id:number;name?:string;email?:string;phone?:string}>> {
  // If your backend supports ?q=, switch to: /api/customers?q=${encodeURIComponent(q)}
  const { data } = await adminHttp.get(`/api/customers`);
  const list = (data || []) as Array<{id:number;name?:string;email?:string;phone?:string}>;
  const k = q.trim().toLowerCase();
  if (!k) return list.slice(0, 10);
  return list
    .filter(c =>
      String(c.id).includes(k) ||
      (c.name && c.name.toLowerCase().includes(k)) ||
      (c.email && c.email.toLowerCase().includes(k)) ||
      (c.phone && c.phone.toLowerCase().includes(k))
    )
    .slice(0, 10);
}
