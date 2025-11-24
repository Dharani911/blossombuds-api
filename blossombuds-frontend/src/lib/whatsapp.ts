// src/lib/whatsapp.ts
// Self-contained: no imports from your api layer.
// Fetches /api/settings/brand.whatsapp directly with credentials.

let cachedNumber: string | null = null;

/** Normalize to WhatsApp digits-only (no spaces, dashes, or '+') */
export function normalizeWhatsApp(input: string): string {
  if (!input) return "";
  return (input.match(/\d+/g) || []).join("");
}

/** Build a WhatsApp deeplink for a given number and optional message */
export function waHrefFor(number: string, message?: string) {
  const n = normalizeWhatsApp(number);
  const base = n ? `https://wa.me/${n}` : "https://wa.me";
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Try common response shapes from /api/settings/{key} */
function extractNumberFromSetting(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data.value === "string") return data.value;
  if (typeof data.phone === "string") return data.phone;
  if (typeof data.number === "string") return data.number;
  return "";
}

/** Fetch from /api/settings/brand.whatsapp and memo-cache it */
export async function fetchWhatsAppNumber(): Promise<string> {
  if (cachedNumber !== null) return cachedNumber;

  try {
    const res = await fetch(apiUrl(`/api/settings/${encodeURIComponent("brand.whatsapp")}`), {
      method: "GET",
      //credentials: "include", // in case your backend uses cookies/session
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      cachedNumber = "";
      return cachedNumber;
    }

    // Some backends return JSON, some return plain text. Handle both.
    const text = await res.text();
    let raw: string = "";
    try {
      const json = JSON.parse(text);
      raw = extractNumberFromSetting(json);
    } catch {
      // not JSON, treat as raw string
      raw = text;
    }

    cachedNumber = normalizeWhatsApp(raw);
    return cachedNumber;
  } catch {
    cachedNumber = "";
    return cachedNumber;
  }
}

/** React hook: gives normalized number and loading state */
import { useEffect, useState } from "react";
export function useWhatsAppNumber() {
  const [number, setNumber] = useState<string>(cachedNumber ?? "");
  const [loading, setLoading] = useState<boolean>(cachedNumber === null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const n = await fetchWhatsAppNumber();
      if (!alive) return;
      setNumber(n);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { number, loading };
}
