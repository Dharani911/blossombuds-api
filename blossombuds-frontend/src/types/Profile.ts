// src/types/profile.ts
export type Customer = {
  id: number;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  googleSubject?: string; // present if user logged in via Google
};

export type Address = {
  id: number;
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
  active?: boolean;
};

export type OrderLite = {
  id: number;
  publicCode?: string;

  status?: string;

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
  couponId?: number | null;
};
