export function toText(x: any): string {
  if (x == null) return "";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (typeof x === "object") {
    if ("name" in x && x.name != null) return String((x as any).name);
  }
  return "";
}