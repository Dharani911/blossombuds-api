import adminHttp from "./adminHttp";

/** Server DTO */
export type FeatureImage = {
  key: string;
  url: string;
  altText?: string | null;
  sortOrder?: number | null;
};

/** GET /api/settings/ui/feature-images (public read for storefront) */
export async function listFeatureImagesPublic(): Promise<FeatureImage[]> {
  const { data } = await adminHttp.get<FeatureImage[]>("/api/settings/ui/feature-images");
  return data ?? [];
}

/**
 * POST /api/settings/feature-images/upload  (ADMIN)
 * Multipart upload — mirrors product image upload (no presign/CORS hassle).
 */
export async function uploadFeatureImage(
  file: File,
  opts?: { altText?: string; sortOrder?: number }
): Promise<FeatureImage> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.altText) fd.append("altText", opts.altText);
  if (typeof opts?.sortOrder === "number") fd.append("sortOrder", String(opts.sortOrder));

  const { data } = await adminHttp.post<FeatureImage>(
    "/api/settings/admin/feature-images",
    fd,
    { headers: { /* let the browser set multipart boundary */ } }
  );
  return data;
}

/**
 * PUT /api/settings/feature-images  (ADMIN)
 * Replace entire list (order + text).
 */
export async function replaceFeatureImages(items: Array<{
  key: string;
  altText?: string | null;
  sortOrder?: number | null;
}>) {
  await adminHttp.put("/api/settings/feature-images", items);
}

/**
 * DELETE /api/settings/feature-images?key=...&deleteObject=false  (ADMIN)
 * Removes an entry from settings; optionally delete R2 object.
 */
export async function deleteFeatureImage(key: string, deleteObject = false) {
  await adminHttp.delete("/api/settings/admin/feature-images", {
    params: { key, deleteObject },
  });
}
export async function reorderFeatureImages(keys: string[]) {
  await adminHttp.put(
    "/api/settings/admin/feature-images/order",
    { keys },                                     // <— wrap in object
    { headers: { "Content-Type": "application/json" } }
  );
}
export async function updateFeatureImageMeta(key: string, altText?: string, sortOrder?: number) {
  await adminHttp.patch("/api/settings/admin/feature-images/meta", null, {
    params: { key, altText, sortOrder },
  });
}

/* -------- Optional: keep presign finalize if you still need it somewhere --------
   POST /api/settings/feature-images/from-key (ADMIN)
   Finalize a previously uploaded tmp key (if you keep presign flow around). */
export async function finalizeFeatureImageFromKey(
  key: string,
  altText?: string,
  sortOrder?: number
) {
  const { data } = await adminHttp.post<FeatureImage>(
    "/api/settings/feature-images/from-key",
    null,
    { params: { key, altText, sortOrder } }
  );
  return data;
}
