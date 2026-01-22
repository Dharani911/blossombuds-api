// src/api/catalog.ts
import http from "./http";

/* =========================
 * Shared types
 * ========================= */
export type Category = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: number | null;
  active?: boolean | null;
  sortOrder?: number | null;
};

export type Product = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  price?: number;
  currency?: string | null;
  primaryImageUrl?: string | null;
  active?: boolean | null;
  visible?: boolean | null;     // ✅ add if backend sends it
  isVisible?: boolean | null;   // ✅ add if backend sends it
  inStock?: boolean | null;
  excludeFromGlobalDiscount?: boolean | null;

    originalPrice?: number | null;
    finalPrice?: number | null;
    discountPercentOff?: number | null;
    discountLabel?: string | null;
    discounted?: boolean | null;
};

export type ProductImage = {
  id?: number;
  url: string;
  altText?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
};

export type ProductOptionValue = {
  id: number;
  optionId?: number;
  valueCode?: string | null;
  valueLabel: string;

  priceDelta?: number | null;     // kept (absolute variant price in your backend)
  sortOrder?: number | null;
  visible?: boolean | null;
  active?: boolean | null;

  // ✅ discount helpers
  originalPrice?: number | null;
  finalPrice?: number | null;
  discounted?: boolean | null;
};

export type ProductOptionWithValues = {
  id: number;
  productId?: number;
  name: string;
  inputType?: string | null;
  required?: boolean | null;
  maxSelect?: number | null;
  sortOrder?: number | null;
  visible?: boolean | null;
  active?: boolean | null;

  // ✅ discount context for UI (same for all values)
  discounted?: boolean | null;
  discountPercentOff?: number | null;
  discountLabel?: string | null;

  values: ProductOptionValue[];
};


/** Generic Page shape (Spring-style). */
export type PageResp<T> = {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number; // current page index
  size: number;
};

/* =========================
 * Normalizers
 * ========================= */

function normalizeProduct(p: any): Product {
  if (!p) return p as Product;

  const inStock =
    typeof p.inStock === "boolean" ? p.inStock :
    typeof p.instock === "boolean" ? p.instock :
    typeof p.in_stock === "boolean" ? p.in_stock :
    null;

  const visible =
    typeof p.visible === "boolean" ? p.visible :
    typeof p.isVisible === "boolean" ? p.isVisible :
    null;

  const originalPrice =
    typeof p.originalPrice === "number" ? p.originalPrice :
    typeof p.original_price === "number" ? p.original_price :
    (typeof p.price === "number" ? p.price : null);

  const finalPrice =
    typeof p.finalPrice === "number" ? p.finalPrice :
    typeof p.final_price === "number" ? p.final_price :
    (typeof p.price === "number" ? p.price : null);

  const discounted =
    typeof p.discounted === "boolean" ? p.discounted :
    (originalPrice != null && finalPrice != null ? finalPrice < originalPrice : null);

  return {
    ...p,
    inStock,
    visible,
    isVisible:
      typeof p.isVisible === "boolean" ? p.isVisible :
      typeof p.visible === "boolean" ? p.visible :
      p.isVisible,

    originalPrice,
    finalPrice,
    discounted,
    discountPercentOff:
      typeof p.discountPercentOff === "number" ? p.discountPercentOff :
      typeof p.discount_percent_off === "number" ? p.discount_percent_off :
      null,
    discountLabel:
      typeof p.discountLabel === "string" ? p.discountLabel :
      typeof p.discount_label === "string" ? p.discount_label :
      null,
    excludeFromGlobalDiscount:
      typeof p.excludeFromGlobalDiscount === "boolean" ? p.excludeFromGlobalDiscount :
      typeof p.exclude_from_global_discount === "boolean" ? p.exclude_from_global_discount :
      null,
  } as Product;
}


/** Normalizes common page shapes (Spring Page / CachedPage / legacy array). */
function normalizePage<T>(data: any): PageResp<T> {
  if (Array.isArray(data)) {
    return {
      content: data as T[],
      totalPages: 1,
      totalElements: data.length,
      number: 0,
      size: data.length || 0,
    };
  }

  // Spring Page OR CachedPage
  const content = Array.isArray(data?.content) ? (data.content as T[]) : null;
  if (content) {
    const pageNumber = data.number ?? data.page ?? data.pageNumber ?? 0;
    const pageSize = data.size ?? data.pageSize ?? content.length ?? 0;

    return {
      content,
      totalPages: Number(data.totalPages ?? 1),
      totalElements: Number(data.totalElements ?? content.length ?? 0),
      number: Number(pageNumber),
      size: Number(pageSize),
    };
  }

  // other legacy shapes
  if (Array.isArray(data?.items)) {
    return {
      content: data.items as T[],
      totalPages: Number(data.totalPages ?? 1),
      totalElements: Number(data.totalElements ?? data.items.length),
      number: Number(data.number ?? data.page ?? 0),
      size: Number(data.size ?? data.pageSize ?? (data.items?.length || 0)),
    };
  }

  return { content: [], totalPages: 0, totalElements: 0, number: 0, size: 0 };
}

/* =========================
 * Categories (public)
 * Controller: CategoryController @ /api/catalog/categories
 * ========================= */

export async function listCategories(params?: Record<string, any>): Promise<Category[]> {
  const { data } = await http.get("/api/catalog/categories", { params });
  return Array.isArray(data) ? (data as Category[]) : [];
}

// alias
export const getCategories = listCategories;

export async function getCategory(id: number): Promise<Category> {
  const { data } = await http.get(`/api/catalog/categories/${id}`);
  return data as Category;
}

export async function listProductsByCategory(
  categoryId: number,
  page = 0,
  size = 24
): Promise<PageResp<Product>> {
  const { data } = await http.get(`/api/catalog/categories/${categoryId}/products`, {
    params: { page, size },
  });

  const pageResp = normalizePage<Product>(data);
  return {
    ...pageResp,
    content: (pageResp.content || []).map(normalizeProduct),
  };
}

export async function listChildCategories(parentId: number): Promise<Category[]> {
  const all = await listCategories();
  return (all || []).filter(
    (c: any) => Number(c.parentId ?? c.parent?.id ?? c.parent_id) === Number(parentId)
  );
}

/* =========================
 * Products (public)
 * Controller: CatalogController @ /api/catalog/products
 * ========================= */

export async function getProduct(id: number): Promise<Product> {
  const { data } = await http.get(`/api/catalog/products/${id}`);
  return normalizeProduct(data);
}

export async function listProductsPage(page = 0, size = 24): Promise<PageResp<Product>> {
  const { data } = await http.get("/api/catalog/products", { params: { page, size } });
  const pageResp = normalizePage<Product>(data);
  return {
    ...pageResp,
    content: (pageResp.content || []).map(normalizeProduct),
  };
}

export async function listNewArrivals(limit = 12): Promise<Product[]> {
  const unwrap = (data: any): Product[] => {
    if (Array.isArray(data)) return data as Product[];
    if (Array.isArray(data?.content)) return data.content as Product[];
    if (Array.isArray(data?.items)) return data.items as Product[];
    return [];
  };

  // 1) explicit endpoint
  try {
    const r1 = await http.get("/api/catalog/products/new-arrivals", { params: { limit } });
    const rows = unwrap(r1.data).slice(0, limit).map(normalizeProduct);
    if (rows.length) return rows;
  } catch {}

  // 2) sort createdAt desc
  try {
    const r2 = await http.get("/api/catalog/products", {
      params: { page: 0, size: limit, sort: "createdAt", dir: "DESC" },
    });
    const rows = unwrap(r2.data).slice(0, limit).map(normalizeProduct);
    if (rows.length) return rows;
  } catch {}

  // 3) flag-style filter
  try {
    const r3 = await http.get("/api/catalog/products", {
      params: { page: 0, size: limit, newArrivals: true, active: true },
    });
    const rows = unwrap(r3.data).slice(0, limit).map(normalizeProduct);
    if (rows.length) return rows;
  } catch {}

  return [];
}

/* =========================
 * Product images (public)
 * Controller: GET /api/catalog/products/{productId}/images
 * ========================= */
export async function listProductImages(productId: number): Promise<ProductImage[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/images`);
  return (Array.isArray(data) ? data : []) as ProductImage[];
}

/* =========================
 * Options + Values (public)
 * ========================= */

export async function listProductOptions(
  productId: number
): Promise<{ id: number; name: string; required?: boolean | null; active?: boolean | null }[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/options`);
  return Array.isArray(data) ? data : [];
}

export async function listOptionValues(optionId: number): Promise<ProductOptionValue[]> {
  const { data } = await http.get(`/api/catalog/options/${optionId}/values`);
  return Array.isArray(data) ? (data as ProductOptionValue[]) : [];
}
export async function getProductOptionsWithValues(productId: number): Promise<ProductOptionWithValues[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/options`);
  return Array.isArray(data) ? (data as ProductOptionWithValues[]) : [];
}


/* export async function getProductOptionsWithValues(
  productId: number
): Promise<ProductOptionWithValues[]> {
  const options = await listProductOptions(productId);
  const withValues = await Promise.all(
    options.map(async (o) => {
      const values = await listOptionValues(o.id);
      return {
        id: o.id,
        name: o.name,
        required: o.required ?? false,
        active: o.active ?? true,
        values: values || [],
      } as ProductOptionWithValues;
    })
  );
  return withValues;
} */

/* =========================
 * Categories for a product (public)
 * ========================= */
export async function listCategoriesForProduct(productId: number): Promise<Category[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/categories`);
  return Array.isArray(data) ? (data as Category[]) : [];
}

export default {
  listCategories,
  getCategories,
  getCategory,
  listChildCategories,
  listProductsByCategory,
  getProduct,
  listProductsPage,
  listNewArrivals,
  listProductImages,
  listProductOptions,
  listOptionValues,
  getProductOptionsWithValues,
  listCategoriesForProduct,
};
