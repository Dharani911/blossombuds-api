// src/api/carouselImages.ts
import http from "./http";
import adminHttp from "./adminHttp";

export type CarouselImage = {
  key: string;
  url: string;
  altText?: string | null;
  sortOrder?: number | null;
};

export async function listCarouselImages(): Promise<CarouselImage[]> {
  const { data } = await http.get("/api/settings/ui/carousel-images");
  return data;
}

export async function uploadCarouselImage(file: File, opts?: { altText?: string; sortOrder?: number }) {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.altText) fd.append("altText", opts.altText);
  if (typeof opts?.sortOrder === "number") fd.append("sortOrder", String(opts.sortOrder));
  const { data } = await adminHttp.post("/api/settings/admin/carousel-images", fd, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as CarouselImage;
}

export async function replaceCarouselImages(items: CarouselImage[]) {
  await adminHttp.put("/api/settings/admin/carousel-images", items, { withCredentials: true });
}

export async function deleteCarouselImage(key: string) {
  await adminHttp.delete("/api/settings/admin/carousel-images", {
    params: { key },
    withCredentials: true,
  });
}
