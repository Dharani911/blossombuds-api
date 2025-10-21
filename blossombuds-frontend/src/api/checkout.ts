// src/api/checkout.ts
import http from "./http";

/** ---- Server DTOs (align with your Java DTOs) ---- */
export type OrderDto = {
  id?: number;
  publicCode?: string;
  customerId?: number;

  itemsSubtotal?: number | string;
  shippingFee?: number | string;
  discountTotal?: number | string;
  grandTotal?: number | string;
  currency?: string;

  courierName?: string;
  orderNotes?: string;

  shipName?: string;
  shipPhone?: string;
  shipLine1?: string;
  shipLine2?: string;
  shipDistrictId?: number;
  shipStateId?: number;
  shipPincode?: string;
  shipCountryId?: number;

  // optional fields omitted for brevity (status, rzpOrderId, etc.)
};

export type OrderItemDto = {
  productId?: number;
  productName?: string;
  productSlug?: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal?: number | string;
  optionsJson?: string;
  optionsText?: string;
};

export type CheckoutRequest = {
  order: OrderDto;
  items: OrderItemDto[];
};

export type CheckoutResponse =
  | {
      type: "RZP_ORDER";
      currency?: string;
      razorpayOrder?: Record<string, any>;
      whatsappUrl?: undefined;
    }
  | {
      type: "WHATSAPP";
      currency?: undefined;
      razorpayOrder?: undefined;
      whatsappUrl?: string;
    };

/** Start checkout (calls your /api/checkout). */
export async function startCheckout(order: OrderDto, items: OrderItemDto[]) {
  const { data } = await http.post<CheckoutResponse>("/api/checkout", {
    order,
    items,
  } satisfies CheckoutRequest);
  return data;
}

/** Load Razorpay script once. Returns true on success. */
let rzpLoaded = false;
export async function loadRazorpay(): Promise<boolean> {
  if (rzpLoaded) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      rzpLoaded = true;
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
