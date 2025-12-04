// src/api/auth.ts
import http from "./http";

/** POST /api/customers/auth/login -> { token } */
export async function customerLogin(payload: { identifier: string; password: string; }) {
  const { data } = await http.post("/api/customers/auth/login", payload);
  return data as { token: string };
}

/** POST /api/customers/auth/register -> { token } */
export async function customerRegister(payload: { name: string; email: string; password: string; phone: string; }) {
  const { data } = await http.post("/api/customers/auth/register", payload);
  return data as { token: string };
}
