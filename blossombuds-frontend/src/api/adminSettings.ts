// src/api/adminSettings.ts
import adminHttp from "./adminHttp";

export type SettingView = { key: string; value: string };

export async function listSettings(): Promise<SettingView[]> {
  const { data } = await adminHttp.get<SettingView[]>("/api/settings");
  return data;
}

export async function upsertSetting(key: string, value: string) {
  await adminHttp.post("/api/settings", { key, value });
}

export async function deleteSetting(key: string) {
  await adminHttp.delete(`/api/settings/${encodeURIComponent(key)}`);
}
export type FeatureImage = { key: string; url: string; altText?: string; sortOrder?: number };

// presign (no auth required? you made it POST /api/catalog/uploads/presign – keep ADMIN if needed)
export async function presignCatalogUpload(filename: string, contentType?: string){
  const { data } = await adminHttp.post("/api/catalog/uploads/presign", { filename, contentType });
  return data as { key: string; url: string; contentType: string };
}

// finalize
export async function finalizeFeatureImageFromKey(key: string, altText?: string, sortOrder?: number){
  const params = new URLSearchParams({ key });
  if (altText) params.set("altText", altText);
  if (typeof sortOrder === "number") params.set("sortOrder", String(sortOrder));
  const { data } = await adminHttp.post(`/api/settings/feature-images/from-key?${params.toString()}`);
  return data as FeatureImage;
}

// list for public/home usage
export async function listFeatureImages(){
  const { data } = await adminHttp.get<FeatureImage[]>("/api/settings/ui/feature-images");
  return data;
}