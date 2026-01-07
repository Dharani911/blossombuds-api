import adminHttp from "./adminHttp";
import { validateImageFile } from "../utils/imageValidations";


/** ---------- Shared types ---------- */

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number; // Spring Page
  page?: number;   // CachedPage
  size?: number;   // Spring Page
  pageSize?: number; // CachedPage
};
function pageNumber(p: Page<any>) {
  return Number((p as any).number ?? (p as any).page ?? 0);
}
function pageSize(p: Page<any>) {
  const c = Array.isArray((p as any).content) ? (p as any).content.length : 0;
  return Number((p as any).size ?? (p as any).pageSize ?? c);
}

export type ProductDto = {
  id?: number;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean;
  visible?: boolean;
  featured?: boolean;
  featuredRank?: number | null;
};

export type Product = {
  id: number;
  slug?: string | null;
  name: string;
  description?: string | null;
  price: number;
  active: boolean;
  visible?: boolean;
  featured?: boolean;
  featuredRank?: number | null;
};

export type ProductImageDto = {
  id: number;
  productId: number;
  publicId: string | null;
  url: string | null;
  watermarkVariantUrl: string | null;
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
  visible?: boolean;
};

export type ProductOptionValue = {
  id: number;
  optionId: number;
  valueCode?: string | null;
  valueLabel: string;
  priceDelta?: number | null;
  sortOrder?: number | null;
  active?: boolean;
  visible?: boolean;
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

export async function listProducts(page = 0, size = 20, sort = "createdAt", dir: "ASC" | "DESC" = "DESC") {
  const { data } = await adminHttp.get<Page<Product>>(`/api/catalog/products`, {
    params: { page, size, sort, dir },
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

/** convenience togglers that still use PUT (full update) */

export async function toggleProductActive(p: Product) {
  const payload: ProductDto = {
    name: p.name,
    slug: p.slug ?? undefined,
    description: p.description ?? undefined,
    price: p.price,
    active: !p.active,
    visible: p.visible,
    featured: p.featured,
  };
  const { data } = await adminHttp.put<Product>(`/api/catalog/products/${p.id}`, payload);
  return data;
}

export async function toggleProductVisible(p: Product) {
  const nextVisible = !Boolean(p.visible);

  // send both keys to be safe with different backends
  const payload: ProductDto & { isVisible?: boolean } = {
    name: p.name,
    slug: p.slug ?? undefined,
    description: p.description ?? undefined,
    price: p.price,
    active: p.active,                 // keep active as-is (delete uses this separately)
    visible: nextVisible,             // current API
    isVisible: nextVisible,           // alt backend key (no harm if ignored)
    featured: p.featured,
  };

  const { data } = await adminHttp.put<Product>(`/api/catalog/products/${p.id}`, payload);

  // normalize the response so caller always gets a concrete boolean
  const normalized: Product = {
    ...data,
    visible: (data as any)?.visible ?? (data as any)?.isVisible ?? nextVisible,
  };
  return normalized;
}


/**
 * New server routes for Featured flag:
 *  - POST   /api/catalog/products/{id}/featured  -> returns Product
 *  - DELETE /api/catalog/products/{id}/featured  -> 204 No Content
 *
 * setProductFeatured will POST for true, DELETE for false,
 * and return the updated Product (DELETE followed by GET).
 */
export async function setProductFeatured(id: number, featured: boolean) {
  if (featured) {
    const { data } = await adminHttp.post<Product>(`/api/catalog/products/${id}/featured`);
    return data;
  } else {
    await adminHttp.delete(`/api/catalog/products/${id}/featured`);
    // controller returns 204, so fetch the updated row
    const data = await getProduct(id);
    return data;
  }
}

/** Lists for Featured page and New Arrivals (public endpoints are fine in admin) */

export async function listFeaturedProducts(page = 0, size = 24) {
  const { data } = await adminHttp.get<Page<Product>>(
    `/api/catalog/products/featured`,
    { params: { page, size } }
  );
  return data;
}

export async function listFeaturedTop(limit = 12) {
  const { data } = await adminHttp.get<Product[]>(
    `/api/catalog/products/featured/top`,
    { params: { limit } }
  );
  return data;
}

export async function listNewArrivals(limit = 24) {
  const { data } = await adminHttp.get<Product[]>(
    `/api/catalog/products/new-arrivals`,
    { params: { limit } }
  );
  return Array.isArray(data) ? data : [];
}

/** ---------- Images (multipart) ---------- */

export async function listProductImages(productId: number) {
  const { data } = await adminHttp.get<ProductImageDto[]>(
    `/api/catalog/products/${productId}/images`
  );
  return data;
}

export type ProductImage = ProductImageDto;

export async function uploadProductImage(
  productId: number,
  file: File,
  altText?: string,
  sortOrder?: number,
  onProgress?: (pct: number) => void
) {
  const err = validateImageFile(file);
  if (err) {
    // Surface as a rejected Promise so calling UI can show the message
    return Promise.reject(new Error(err));
  }
  const fd = new FormData();
  fd.append("file", file, file.name);
  if (altText != null) fd.append("altText", String(altText));
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
    fd
  );
  return data; // ProductImage
}

export async function deleteProductImage(productId: number, imageId: number) {
  await adminHttp.delete(`/api/catalog/products/${productId}/images/${imageId}`);
}

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
  const { data } = await adminHttp.get(`/api/catalog/categories`);
  return Array.isArray(data) ? (data as Category[]) : [];
}

export async function createCategory(dto: Partial<Category>) {
  const { data } = await adminHttp.post(`/api/catalog/categories`, dto);
  return data as Category;
}

export async function updateCategory(id: number, dto: Partial<Category>) {
  const payload: any = { ...dto };

  // Option 1 contract: backend clears parent when parentId <= 0
  if ("parentId" in payload && (payload.parentId == null || payload.parentId === "")) {
    payload.parentId = 0;
  }

  const { data } = await adminHttp.put(`/api/catalog/categories/${id}`, payload);
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
  return (data as any)?.content ?? [];

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

/** Coerces price fields to numbers (defensive against stringy backends) */
export function normalizeProduct<T extends { price: any }>(p: T): T & { price: number } {
  return { ...p, price: Number(p?.price ?? 0) };
}

/** Coerces priceDelta to number (keeps nulls as null) */
export function normalizeOptionValue<T extends { priceDelta?: any | null }>(
  v: T
): T & { priceDelta: number | null } {
  return {
    ...v,
    priceDelta: v.priceDelta == null ? null : Number(v.priceDelta),
  };
}

/** Simple helper to read a product's numeric price */
export function resolveBasePrice(p: { price: any }): number {
  const n = Number(p?.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** ---------- Lite helpers for admin CreateOrder ---------- */

// Replace the whole function with this robust version
export type ProductLite = { id: number; name: string; price: number };

export async function searchProductsLite(q: string, size = 20): Promise<ProductLite[]> {
  const term = (q || "").trim();
  // Try several common keys the API might accept; backend will ignore unknown ones
  const params: any = {
    page: 0,
    size,
    q: term,
    query: term,
    search: term,
    name: term,
  };

  const { data } = await adminHttp.get<Page<Product>>(`/api/catalog/products`, { params });
  const rows = data?.content || [];

  // Normalize price
  const normalized = rows.map(p => ({
    id: p.id,
    name: p.name,
    price: Number(p.price ?? 0),
  }));

  // Fallback client-side filter in case server ignores query params
  if (!term) return normalized;

  const idWanted = /^\d+$/.test(term) ? Number(term) : null;
  const t = term.toLowerCase();

  return normalized.filter(p =>
    (idWanted != null && p.id === idWanted) ||
    p.name.toLowerCase().includes(t)
  );
}


export type ProductOptionWithValues = ProductOption & { values: ProductOptionValue[] };

/**
 * Loads product options and inlines their values.
 * All price fields are normalized to numbers (priceDelta can still be null).
 */
export async function getProductOptionsLite(productId: number): Promise<ProductOptionWithValues[]> {
  const opts = await listOptions(productId);
  if (!opts?.length) return [];

  const valuesLists = await Promise.all(
    opts.map(o => listOptionValues(o.id).catch(() => [] as ProductOptionValue[]))
  );

  return opts.map((o, i) => ({
    ...o,
    values: (valuesLists[i] || []).map(normalizeOptionValue),
  }));
}
