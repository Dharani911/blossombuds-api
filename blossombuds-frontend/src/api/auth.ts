// src/api/auth.ts
import http from "./http";

/** POST /api/customers/auth/login -> { token } */
export async function customerLogin(payload: { identifier: string; password: string; }) {
  const { data } = await http.post("/api/customers/auth/login", payload);
  return data as { token: string };
}

/** POST /api/customers/auth/register */
export async function customerRegister(payload: {
  name: string;
  email?: string;
  password?: string;
  phone?: string;
  whatsAppOptIn?: boolean;
  smsOptIn?: boolean;
}) {
  const { data } = await http.post("/api/customers/auth/register", payload);
  return data;
}

/** POST /api/customers/auth/verify-phone-otp -> { token } (signup verification) */
export async function verifyPhoneOtp(payload: { phone: string; code: string }) {
  const { data } = await http.post("/api/customers/auth/verify-phone-otp", payload);
  return data as { token: string };
}

/** POST /api/customers/auth/resend-phone-otp (signup verification resend) */
export async function resendPhoneOtp(payload: { phone: string }) {
  await http.post("/api/customers/auth/resend-phone-otp", payload);
}

/** POST /api/customers/auth/phone-login/request — sends login OTP to existing phone */
export async function requestPhoneLoginOtp(payload: { phone: string }) {
  await http.post("/api/customers/auth/phone-login/request", payload);
}

/** POST /api/customers/auth/phone-login/verify -> { token } */
export async function verifyPhoneLoginOtp(payload: { phone: string; code: string }) {
  const { data } = await http.post("/api/customers/auth/phone-login/verify", payload);
  return data as { token: string };
}
