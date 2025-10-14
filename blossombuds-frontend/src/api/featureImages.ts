// src/api/featureImages.ts
import http from "./http";
import adminHttp from "./adminHttp";

export type FeatureImage = {
  key: string;
  url: string;
  altText?: string | null;
  sortOrder?: number | null;
};

export type PresignResponse = {
  key: string;             // R2 object key you must send back in /from-key
  url: string;             // presigned PUT URL
  headers?: Record<string, string>; // optional headers to include on PUT
};

/** Public list for homepage */
export async function listFeatureImages(): Promise<FeatureImage[]> {
  const { data } = await http.get("/api/settings/ui/feature-images");
  return data;
}

/** ADMIN: get a presigned PUT (NOTE: use query params, not JSON body) */
export async function presignFeatureImage(filename: string, contentType?: string): Promise<PresignResponse> {
  const { data } = await adminHttp.post("/api/catalog/uploads/presign", null, {
    params: { filename, contentType },
    withCredentials: true,
  });
  return data;
}

/** ADMIN: finalize by telling backend the temp key to store in settings */
export async function addFeatureImageFromKey(p: { key: string; altText?: string; sortOrder?: number }) {
  const { data } = await adminHttp.post("/api/settings/feature-images/from-key", null, {
    params: { key: p.key, altText: p.altText, sortOrder: p.sortOrder },
    withCredentials: true,
  });
  return data as FeatureImage;
}

/** ADMIN: replace all images (keys + alt/sort) */
export async function replaceFeatureImages(items: Array<{ key: string; altText?: string; sortOrder?: number }>) {
  await adminHttp.put("/api/settings/feature-images", items, { withCredentials: true });
}

/** ADMIN: delete one (optionally delete the object too) */
export async function deleteFeatureImage(key: string, deleteObject = false) {
  await adminHttp.delete("/api/settings/feature-images", {
    params: { key, deleteObject },
    withCredentials: true,
  });
}
