// src/lib/jwt.ts
export type Decoded = {
  [k: string]: any;
  sub?: string;         // e.g., "cust:123"
  id?: string | number; // sometimes present
  email?: string;
  name?: string;
};

/** Base64url decode without external deps */
export function decodeJwt(token: string): Decoded | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Extract customer fields. Supports sub like "cust:123". */
export function extractCustomerFromToken(token: string) {
  const d = decodeJwt(token) || {};
  // Try explicit claims first
  let id: string | number | undefined = (d as any).customerId ?? d.id;
  const email = (d as any).customerEmail ?? d.email;
  const name = (d as any).customerName ?? d.name;

  // If id not present, parse from sub "cust:{id}"
  if (!id && typeof d.sub === "string") {
    const m = d.sub.match(/^cust:(\d+)$/i);
    if (m) id = m[1];
  }

  return { id, email, name, raw: d };
}
