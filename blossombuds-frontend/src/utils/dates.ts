// src/utils/dates.ts

/** Format a value as IST date + time, e.g. "07 Dec 2025, 03:45 PM" */
export function formatIstDateTime(value?: string | number | Date | null): string {
  if (value == null) return "—";
  const d = parseAsUtcIfBare(value);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function normalizeDateInput(value: string | number | Date) {
  if (value instanceof Date || typeof value === "number") return value;

  let s = value.trim();

  // Convert "2025-12-01 18:25:24.856829+00" -> "2025-12-01T18:25:24.856829+00"
  if (s.includes(" ") && !s.includes("T")) {
    const firstSpace = s.indexOf(" ");
    s = s.slice(0, firstSpace) + "T" + s.slice(firstSpace + 1);
  }

  return s;
}
function parseAsUtcIfBare(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  // ISO without timezone? treat as UTC to fix -1h bug
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !/[zZ]|[+\-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value + "Z");
  }
  return new Date(value);
}

/** Format a value as IST date only, e.g. "07 Dec 2025" */
export function formatIstDate(
  value?: string | number | Date | null
): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
