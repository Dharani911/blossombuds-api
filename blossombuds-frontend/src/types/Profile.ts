// src/types/profile.ts
export type Customer = {
  id: number;
  fullName?: string;
  email?: string;
  phone?: string;
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
  publicCode: string;
  status: string;
  total?: number;
  createdAt?: string;
};
