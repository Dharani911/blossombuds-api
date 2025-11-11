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

/** Your backend may return RZP order inline OR a WhatsApp URL (intl flow). */
export type CheckoutResponse =
  | {
      type: "RZP_ORDER";
      /** useful to keep track of which order to verify against */
      orderId?: number;
      currency?: string;
      razorpayOrder?: Record<string, any>;
      whatsappUrl?: undefined;
    }
  | {
      type: "WHATSAPP";
      orderId?: number;
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

/** If you choose to create the Razorpay order in a separate step. */
export async function createRzpOrder(orderId: number) {
  const { data } = await http.post<Record<string, any>>(
    `/api/payments/razorpay/orders/${orderId}`
  );
  return data; // { id, amount, currency, ... }
}

/** Payload to verify the payment on the server. */
export type RzpVerifyPayload = {
  orderId: number;                // your internal order id
  razorpayOrderId: string;        // resp.razorpay_order_id
  razorpayPaymentId: string;      // resp.razorpay_payment_id
  razorpaySignature: string;      // resp.razorpay_signature
  amount?: number;                // optional (for record-keeping)
  currency?: string;              // optional (default INR)
};

/** Verify success with the backend (signature + record Payment row). */
export async function verifyRzp(payload: RzpVerifyPayload) {
  await http.post("/api/payments/razorpay/verify", payload);
}
export async function getRzpConfig(): Promise<{ keyId: string }> {
  const { data } = await http.get<{ keyId: string }>("/api/payments/razorpay/config");
  return data;
}


/** Load Razorpay script once. */
let rzpLoaded = false;
export async function loadRazorpay(): Promise<boolean> {
  if (rzpLoaded || (window as any).Razorpay) {
    rzpLoaded = true;
    return true;
  }
  // avoid adding multiple <script> tags
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
  );
  if (existing) {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        rzpLoaded = true;
        resolve(true);
      } else {
        existing.addEventListener("load", () => {
          rzpLoaded = true;
          resolve(true);
        });
        existing.addEventListener("error", () => resolve(false));
      }
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      rzpLoaded = true;
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}
