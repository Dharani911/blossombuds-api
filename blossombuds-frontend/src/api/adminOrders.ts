// src/api/adminOrders.ts
import adminHttp from "./adminHttp";

/** ---------- Pagination shape ---------- */
export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based page index
  size: number;
};

/** Backend status enum as per controller/docs */
export type OrderStatus =
  | "ORDERED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURNED_REFUNDED";

/** A light order shape for the list/summary panes. */
export type OrderLite = {
  id: number;
  publicCode?: string;

  status?: OrderStatus | string;

  customerId?: number;

  // timestamps (your API returns createdDate)
  createdAt?: string;
  created_at?: string;
  created?: string;
  modifiedAt?: string;
  modified_at?: string;
  createdDate?: string;

  grandTotal?: number;
  shippingFee?: number;

  // shipping/contact echoes
  shipName?: string;
  shipPhone?: string;
  shipLine1?: string;
  shipLine2?: string;
  shipPincode?: string;

  shipDistrictId?: number;
  shipStateId?: number;
  shipCountryId?: number;

  shipDistrictName?: string;
  shipStateName?: string;
  shipCountryName?: string;

  customerName?: string;

  // tracking
  deliveryPartnerId?: number | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;

  // 🔹 COUPON (read)
  couponCode?: string | null;
  couponId?:number | null;
  orderNotes?: string | null;
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
  status?: string; // e.g. "CAPTURED"
  createdAt?: string;
};

export type OrderEvent = {
  id: number;
  orderId: number;
  type: string;      // maps to server eventType
  message: string;   // maps to server note
  createdAt?: string;
};

/* ------------------- list-all endpoint ------------------- */
type Dir = "ASC" | "DESC";

export type ListAllOrdersParams = {
  page?: number;
  size?: number;
  sort?: string;                // "id" | "createdAt"
  dir?: Dir;
  from?: Date | string | null;  // inclusive
  to?: Date | string | null;    // exclusive
  status?: string | string[];   // single or multiple statuses
};

function toIso(val?: Date | string | null): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  const s = String(val).trim();
  return s || undefined;
}

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out as Partial<T>;
}

// Normalize status input to a CSV the controller can parse
function normalizeStatusParam(s?: string | string[]): string | undefined {
  if (!s) return undefined;
  if (Array.isArray(s)) {
    const parts = s
      .flatMap(x => String(x).split(","))
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => x.toUpperCase());
    return parts.length ? parts.join(",") : undefined;
  }
  const parts = String(s)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => x.toUpperCase());
  return parts.length ? parts.join(",") : undefined;
}

export async function listAllOrders(params?: ListAllOrdersParams): Promise<Page<OrderLite>> {
  const q = stripUndefined({
    page: params?.page ?? 0,
    size: params?.size ?? 20,
    sort: params?.sort ?? "id",
    dir: (params?.dir ?? "DESC") as Dir,
    from: toIso(params?.from),
    to:   toIso(params?.to),
    status: normalizeStatusParam(params?.status),
  });
  const { data } = await adminHttp.get(`/api/orders/all`, { params: q });
  return data as Page<OrderLite>;
}

/* ----------------------------- Orders ----------------------------- */

/** Public/ADMIN: fetch by YYNNNN or BBYYNNNN */
export async function getByPublicCode(publicCode: string) {
  const { data } = await adminHttp.get(`/api/orders/${encodeURIComponent(publicCode)}`);
  return data as OrderLite;
}

/** ADMIN/CUSTOMER: list by customer */
export async function getByCustomer(customerId: number) {
  const { data } = await adminHttp.get(`/api/orders/by-customer/${customerId}`);
  return data as OrderLite[];
}

export type PatchStatusPayload = {
  status: OrderStatus;
  note?: string;
  trackingNumber?: string; // required by backend when DISPATCHED
  trackingURL?: string;    // required by backend when DISPATCHED
};

/** ADMIN: update only status (server also logs event+emails) */
export async function patchStatus(orderId: number, payload: PatchStatusPayload) {
  const { data } = await adminHttp.patch(`/api/orders/${orderId}/status`, payload);
  return data as any;
}

/** ADMIN: full update (snapshots) + optionally replace items */
export async function updateOrder(orderId: number, payload: {
  order?: Partial<{
    customerId: number;
    status: OrderStatus;
    itemsSubtotal: number;
    shippingFee: number;
    discountTotal: number;
    grandTotal: number;
    currency: string;

    courierName?: string;
    orderNotes?: string;
    deliveryPartnerId?: number;
    trackingNumber?: string;
    trackingUrl?: string;

    paymentMethod?: string;
    rzpOrderId?: string;
    rzpPaymentId?: string;
    externalReference?: string;

    shipName?: string;
    shipPhone?: string;
    shipLine1?: string;
    shipLine2?: string;
    shipPincode?: string;
    shipDistrictId?: number;
    shipStateId?: number;
    shipCountryId?: number;

    // 🔹 COUPON (write)
    couponId?: number;
    couponCode?: string;

  }>;
  items?: Array<{
    productId?: number;
    productName: string;
    productSlug?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
    optionsJson?: string;
    optionsText?: string;
  }>;
  replaceItems?: boolean;
}) {
  const { data } = await adminHttp.put(`/api/orders/${orderId}`, payload);
  return data as any;
}

/** ADMIN: create order WITH items (controller maps POST /api/orders to OrderCreateRequest) */
export async function createOrderWithItems(payload: {
  order: {
    customerId: number;
    status?: OrderStatus;

    itemsSubtotal?: number;
    shippingFee?: number;
    discountTotal?: number;
    grandTotal?: number;
    currency?: string;

    courierName?: string;
    orderNotes?: string;
    deliveryPartnerId?: number;
    trackingNumber?: string;
    trackingUrl?: string;

    dispatchedAt?: string;
    deliveredAt?: string;
    cancelledAt?: string;
    refundedAt?: string;
    trackingEmailSentAt?: string;
    paidAt?: string;

    paymentMethod?: string;
    rzpOrderId?: string;
    rzpPaymentId?: string;
    externalReference?: string;

    shipName?: string;
    shipPhone?: string;
    shipLine1?: string;
    shipLine2?: string;
    shipPincode?: string;
    shipDistrictId?: number;
    shipStateId?: number;
    shipCountryId: number;

    active?: boolean;

    // 🔹 COUPON (write)
    couponId?: number;
    couponCode?: string;
  };
  items?: Array<{
    productId?: number;
    productName: string;
    productSlug?: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number;
    optionsJson?: string;
    optionsText?: string;
  }>;
}) {
  const { data } = await adminHttp.post(`/api/orders`, payload);
  return data as any;
}

/* ----------------------- Items ----------------------- */

export async function listItems(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/items`);
  return data as OrderItem[];
}

export async function addItem(orderId: number, payload: {
  productId?: number; productName: string; qty: number; unitPrice: number;
  lineTotal?: number; optionsJson?: string; optionsText?: string; productSlug?: string;
}) {
  const body = {
    productId: payload.productId,
    productName: payload.productName,
    productSlug: payload.productSlug,
    quantity: payload.qty,
    unitPrice: payload.unitPrice,
    lineTotal: payload.lineTotal,
    optionsJson: payload.optionsJson,
    optionsText: payload.optionsText,
  };
  const { data } = await adminHttp.post(`/api/orders/${orderId}/items`, body);
  return data as OrderItem;
}

/* ----------------------- Payments ----------------------- */

export async function listPayments(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/payments`);
  return data as Payment[];
}

export async function addPayment(orderId: number, payload: { amount: number; gateway?: string; ref?: string }) {
  const { data } = await adminHttp.post(`/api/orders/${orderId}/payments`, payload);
  return data as Payment;
}

/* ----------------------- Events ----------------------- */

export async function listEvents(orderId: number) {
  const { data } = await adminHttp.get(`/api/orders/${orderId}/events`);
  const arr = (data ?? []) as any[];
  return arr.map(ev => ({
    id: Number(ev.id),
    orderId: Number(ev.order?.id ?? orderId),
    type: String(ev.eventType ?? ev.type ?? ""),
    message: String(ev.note ?? ev.message ?? ""),
    createdAt: ev.createdAt as string | undefined,
  })) as OrderEvent[];
}

export async function addEvent(orderId: number, payload: { type: string; message: string }) {
  const body = { eventType: payload.type, note: payload.message };
  const { data } = await adminHttp.post(`/api/orders/${orderId}/events`, body);
  const ev = data as any;
  return {
    id: Number(ev.id),
    orderId: Number(ev.order?.id ?? orderId),
    type: String(ev.eventType ?? payload.type),
    message: String(ev.note ?? payload.message),
    createdAt: ev.createdAt as string | undefined,
  } as OrderEvent;
}

/* ----------------------- Print ----------------------- */

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

/* ----------------------- Manual create helpers ----------------------- */

export type ProductPick = {
  id: number;
  name: string;
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
  name: string;
  sortOrder?: number | null;
  values: OptionValueLite[];
};

export async function searchProductsLite(q: string): Promise<ProductPick[]> {
  const { data } = await adminHttp.get(`/api/search/products`, { params: { q } });
  const list = (data?.content ?? data ?? []) as any[];
  return list.map((p) => ({
    id: Number(p.id),
    name: String(p.name ?? p.title ?? p.slug ?? `#${p.id}`),
  }));
}

export async function fetchPackingSlipsBulk(orderIds: number[]): Promise<Blob> {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("orderIds must be a non-empty array");
  }
  const { data } = await adminHttp.post(`/api/print/orders/packing-slips`, orderIds, {
    responseType: "blob",
    withCredentials: true,
  });
  return data;
}

export function openPdfBlob(blob: Blob, filename = "packing-slips.pdf") {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function getProductOptionsLite(productId: number): Promise<ProductOptionLite[]> {
  const { data: opts } = await adminHttp.get(`/api/catalog/products/${productId}/options`);
  const options = (opts ?? []) as any[];

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

  return withValues.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Manual create helper – send exactly what the controller expects now. */
export async function createManualOrder(payload: { order: any; items: any[] }) {
  // payload.order can/should include couponId/couponCode when applicable
  const { data } = await adminHttp.post(`/api/orders`, payload);
  return data;
}

/** Admin customer search */
export async function searchCustomersLite(q: string): Promise<Array<{id:number;name?:string;email?:string;phone?:string}>> {
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

/* ======================= Dispatch helpers ======================= */

export async function upsertTracking(orderId: number, opts: {
  trackingNumber: string;
  deliveryPartnerId?: number;
  trackingUrl?: string;
}) {
  const body = {
    order: {
      trackingNumber: opts.trackingNumber,
      deliveryPartnerId: opts.deliveryPartnerId,
      ...(opts.trackingUrl ? { trackingUrl: opts.trackingUrl } : {}),
    },
  };
  const { data } = await adminHttp.put(`/api/orders/${orderId}`, body);
  return data as any;
}

export async function dispatchOrder(orderId: number, args: {
  trackingNumber: string;
  deliveryPartnerId?: number;
  trackingUrl?: string;
  note?: string;
}) {
  await upsertTracking(orderId, {
    trackingNumber: args.trackingNumber,
    deliveryPartnerId: args.deliveryPartnerId,
    trackingUrl: args.trackingUrl,
  });
  return patchStatus(orderId, {
    status: "DISPATCHED",
    note: args.note,
    trackingNumber: args.trackingNumber,
    trackingURL: args.trackingUrl,
  });
}
