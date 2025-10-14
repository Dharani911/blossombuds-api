// src/api/adminCatalog.ts
import adminHttp from "./adminHttp";

/** ---------- Shared types ---------- */

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // 0-based
  size: number;
};

export type ProductDto = {
  id?: number;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
};

export type Product = {
  id: number;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active: boolean;
};

export type ProductImageDto = {
  id: number;
  productId: number;
  publicId: string | null;
  url: string | null;                 // short-lived signed GET
  watermarkVariantUrl: string | null; // same as url for now
  altText: string | null;
  sortOrder: number;
  active: boolean;
};

export type ProductOption = {
  id: number;
  productId: number;
  name: string;
  inputType: "select" | "multiselect" | "text";
  required?: boolean;
  maxSelect?: number | null;
  sortOrder?: number | null;
  active?: boolean;
};

export type ProductOptionValue = {
  id: number;
  optionId: number;
  valueCode?: string | null;
  valueLabel: string;
  priceDelta?: number | null;
  sortOrder?: number | null;
  active?: boolean;
};

export type Category = {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
  active?: boolean;
  parentId?: number | null;
  sortOrder?: number | null;
};

/** ---------- Products ---------- */

export async function listProducts(page = 0, size = 20) {
  const { data } = await adminHttp.get<Page<Product>>(`/api/catalog/products`, {
    params: { page, size },
  });
  return data;
}

export async function getProduct(id: number) {
  const { data } = await adminHttp.get<Product>(`/api/catalog/products/${id}`);
  return data;
}

export async function createProduct(dto: ProductDto) {
  const { data } = await adminHttp.post<Product>(`/api/catalog/products`, dto);
  return data;
}

export async function updateProduct(id: number, dto: ProductDto) {
  const { data } = await adminHttp.put<Product>(`/api/catalog/products/${id}`, dto);
  return data;
}

export async function deleteProduct(id: number) {
  await adminHttp.delete(`/api/catalog/products/${id}`);
}

export async function toggleProductActive(p: Product) {
  const payload: ProductDto = {
    name: p.name,
    slug: p.slug ?? undefined,
    description: p.description ?? undefined,
    price: p.price,
    active: !p.active,
  };
  const { data } = await adminHttp.put<Product>(`/api/catalog/products/${p.id}`, payload);
  return data;
}

/** ---------- Images (presign → PUT → from-key) ---------- */

// 1) Ask backend for a presigned PUT URL
export async function presignUpload(filename: string, contentType: string) {
  const { data } = await adminHttp.post(
    `/api/catalog/uploads/presign`,
    null,
    { params: { filename, contentType } }
  );
  return data as { key: string; url: string; contentType: string };
}

export async function attachImageFromKey(
  productId: number,
  payload: { key: string; altText?: string; sortOrder?: number }
) {
  const form = new FormData();
  form.append("key", payload.key);
  if (payload.altText) form.append("altText", payload.altText);
  if (payload.sortOrder != null) form.append("sortOrder", String(payload.sortOrder));
  const { data } = await adminHttp.post(
    `/api/catalog/products/${productId}/images/from-key`,
    form
  );
  return data;
}

/* // 2) Tell backend to process temp object and attach to product
export async function addImageFromKey(
  productId: number,
  key: string,
  altText?: string,
  sortOrder?: number
) {
  const params = new URLSearchParams({ key });
  if (altText) params.set("altText", altText);
  if (sortOrder != null) params.set("sortOrder", String(sortOrder));

  const { data } = await adminHttp.post<ProductImageDto>(
    `/api/catalog/products/${productId}/images/from-key?${params.toString()}`
  );
  return data;
} */

// List images (signed preview URLs)
export async function listProductImages(productId: number) {
  const { data } = await adminHttp.get<ProductImageDto[]>(
    `/api/catalog/products/${productId}/images`
  );
  return data;
}

// add/replace this function
export async function uploadProductImage(
  productId: number,
  file: File,
  altText?: string,
  sortOrder?: number,
  onProgress?: (pct: number) => void
){
  const fd = new FormData();
  // IMPORTANT: backend accepts "file" (and also "image"), we send "file"
  fd.append("file", file, file.name);
  if (altText != null)  fd.append("altText", String(altText));
  if (sortOrder != null) fd.append("sortOrder", String(sortOrder));

  const res = await adminHttp.post(`/api/catalog/products/${productId}/images`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
    timeout: 120000,
  });
  return res.data as ProductImage;
}






export async function updateImageMeta(
  productId: number,
  imageId: number,
  patch: { altText?: string; sortOrder?: number; active?: boolean }
) {
  const fd = new FormData();
  if (patch.altText !== undefined) fd.append("altText", patch.altText ?? "");
  if (patch.sortOrder !== undefined) fd.append("sortOrder", String(patch.sortOrder));
  if (patch.active !== undefined) fd.append("active", String(patch.active));

  const { data } = await adminHttp.put(
    `/api/catalog/products/${productId}/images/${imageId}`,
    fd,
    { headers: { /* let browser set multipart boundary */ } }
  );
  return data; // ProductImage
}

/*
export async function attachImageFromKey(
  productId: number,
  payload: { key: string; altText?: string; sortOrder?: number }
) {
  const form = new FormData();
  form.append("key", payload.key);
  if (payload.altText) form.append("altText", payload.altText);
  if (payload.sortOrder != null) form.append("sortOrder", String(payload.sortOrder));

  const res = await fetch(`/api/catalog/products/${productId}/images/from-key`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to attach image");
  return res.json(); // ProductImageDto
}
 */

// Delete image
export async function deleteProductImage(productId: number, imageId: number) {
  await adminHttp.delete(`/api/catalog/products/${productId}/images/${imageId}`);
}

// Make primary
export async function setPrimaryImage(productId: number, imageId: number) {
  await adminHttp.post(`/api/catalog/products/${productId}/images/${imageId}/primary`);
}

/** ---------- Options + Values ---------- */

export async function createOption(
  productId: number,
  dto: Omit<ProductOption, "id" | "productId">
) {
  const { data } = await adminHttp.post<ProductOption>(
    `/api/catalog/products/${productId}/options`,
    dto
  );
  return data;
}

export async function listOptions(productId: number) {
  const { data } = await adminHttp.get<ProductOption[]>(
    `/api/catalog/products/${productId}/options`
  );
  return data;
}

export async function updateOption(optionId: number, patch: Partial<ProductOption>) {
  const { data } = await adminHttp.put<ProductOption>(
    `/api/catalog/options/${optionId}`,
    patch
  );
  return data;
}

export async function deleteOption(optionId: number) {
  await adminHttp.delete(`/api/catalog/options/${optionId}`);
}

export async function listOptionValues(optionId: number) {
  const { data } = await adminHttp.get<ProductOptionValue[]>(
    `/api/catalog/options/${optionId}/values`
  );
  return data;
}

export async function createOptionValue(
  optionId: number,
  dto: Omit<ProductOptionValue, "id" | "optionId">
) {
  const { data } = await adminHttp.post<ProductOptionValue>(
    `/api/catalog/options/${optionId}/values`,
    dto
  );
  return data;
}

export async function updateOptionValue(
  optionId: number,
  valueId: number,
  patch: Partial<ProductOptionValue>
) {
  const { data } = await adminHttp.put<ProductOptionValue>(
    `/api/catalog/options/${optionId}/values/${valueId}`,
    patch
  );
  return data;
}

export async function deleteOptionValue(optionId: number, valueId: number) {
  await adminHttp.delete(`/api/catalog/options/${optionId}/values/${valueId}`);
}

/** ---------- Categories ---------- */

export async function listAllCategories(): Promise<Category[]> {
  const { data } = await adminHttp.get(`/api/catalog/categories`, {
    params: { page: 0, size: 1000 },
  });
  return Array.isArray(data) ? (data as Category[]) : (data?.content ?? []);
}

export async function createCategory(dto: Partial<Category>) {
  const { data } = await adminHttp.post(`/api/catalog/categories`, dto);
  return data as Category;
}

export async function updateCategory(id: number, dto: Partial<Category>) {
  const { data } = await adminHttp.put(`/api/catalog/categories/${id}`, dto);
  return data as Category;
}

export async function deleteCategory(id: number) {
  await adminHttp.delete(`/api/catalog/categories/${id}`);
}

export async function listProductsByCategory(
  categoryId: number,
  page = 0,
  size = 200
): Promise<Product[]> {
  const { data } = await adminHttp.get<Page<Product>>(
    `/api/catalog/categories/${categoryId}/products`,
    { params: { page, size } }
  );
  return data.content || [];
}

export async function linkProductToCategoryApi(productId: number, categoryId: number) {
  await adminHttp.post(`/api/catalog/products/${productId}/categories/${categoryId}`);
}

export async function unlinkProductFromCategoryApi(productId: number, categoryId: number) {
  await adminHttp.delete(`/api/catalog/products/${productId}/categories/${categoryId}`);
}

/** ---------- Utilities ---------- */

export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
