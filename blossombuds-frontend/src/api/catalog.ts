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
  valueLabel: string;
  priceDelta?: number | null;
  active?: boolean | null;
};

export type ProductOptionWithValues = {
  id: number;
  name: string;
  required?: boolean | null;
  active?: boolean | null;
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
  if (Array.isArray(data?.content)) {
    return {
      content: data.content as T[],
      totalPages: Number(data.totalPages ?? 1),
      totalElements: Number(data.totalElements ?? (data.content?.length ?? 0)),
      number: Number(data.number ?? 0),
      size: Number(data.size ?? (data.content?.length ?? 0)),
    };
  }
  if (Array.isArray(data?.items)) {
    return {
      content: data.items as T[],
      totalPages: 1,
      totalElements: data.items.length,
      number: 0,
      size: data.items.length || 0,
    };
  }
  return { content: [], totalPages: 0, totalElements: 0, number: 0, size: 0 };
}

/* =========================
 * Categories (public)
 * Controller: CategoryController @ /api/catalog/categories
 * ========================= */

/** List all active categories (public). */
export async function listCategories(params?: Record<string, any>): Promise<Category[]> {
  const { data } = await http.get("/api/catalog/categories", { params });
  return Array.isArray(data) ? (data as Category[]) : [];
}

// alias to avoid mismatched imports across files
export const getCategories = listCategories;

/** Get one category by id (public). */
export async function getCategory(id: number): Promise<Category> {
  const { data } = await http.get(`/api/catalog/categories/${id}`);
  return data as Category;
}

/** List products under a category, normalized to PageResp (public). */
export async function listProductsByCategory(
  categoryId: number,
  page = 0,
  size = 24
): Promise<PageResp<Product>> {
  const { data } = await http.get(`/api/catalog/categories/${categoryId}/products`, {
    params: { page, size },
  });
  return normalizePage<Product>(data);
}

/** Build children list on FE by filtering all categories by parentId. */
export async function listChildCategories(parentId: number): Promise<Category[]> {
  const all = await listCategories();
  return (all || []).filter((c: any) => Number(c.parentId ?? c.parent?.id ?? c.parent_id) === Number(parentId));
}

/* =========================
 * Products (public)
 * Controller: CatalogController @ /api/catalog/products
 * ========================= */

/** Get product by id (public). */
export async function getProduct(id: number): Promise<Product> {
  const { data } = await http.get(`/api/catalog/products/${id}`);
  return data as Product;
}

/** Optional: list all products paged (not required for categories page). */
export async function listProductsPage(page = 0, size = 24): Promise<PageResp<Product>> {
  const { data } = await http.get("/api/catalog/products", { params: { page, size } });
  return normalizePage<Product>(data);
}

/**
 * New Arrivals (public).
 * Tries common server patterns:
 *  - sort by createdAt desc
 *  - fallback to id desc
 *  - final fallback to first page
 */
export async function listNewArrivals(limit = 12): Promise<Product[]> {
  // helper to unwrap Page/content/array shapes
  const unwrap = (data: any): Product[] => {
    if (Array.isArray(data)) return data as Product[];
    if (Array.isArray(data?.content)) return data.content as Product[];
    if (Array.isArray(data?.items)) return data.items as Product[];
    return [];
  };

  // 1) explicit “new-arrivals” endpoint
  try {
    const r1 = await http.get("/api/catalog/products/new-arrivals", { params: { size: limit } });
    const rows = unwrap(r1.data).slice(0, limit);
    if (rows.length) return rows;
  } catch { /* ignore and try next */ }

  // 2) sort by createdAt desc on general products list
  try {
    const r2 = await http.get("/api/catalog/products", {
      params: { page: 0, size: limit, sort: "createdAt,desc", active: true },
    });
    const rows = unwrap(r2.data).slice(0, limit);
    if (rows.length) return rows;
  } catch { /* ignore and try next */ }

  // 3) flag-style filter
  try {
    const r3 = await http.get("/api/catalog/products", {
      params: { page: 0, size: limit, newArrivals: true, active: true },
    });
    const rows = unwrap(r3.data).slice(0, limit);
    if (rows.length) return rows;
  } catch { /* ignore */ }

  // last resort: empty list (component shows "No new arrivals" message)
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
 * Controllers:
 *  - GET /api/catalog/products/{productId}/options
 *  - GET /api/catalog/options/{optionId}/values
 * ========================= */

/** Fetch options for a product (without values). */
export async function listProductOptions(
  productId: number
): Promise<{ id: number; name: string; required?: boolean | null; active?: boolean | null }[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/options`);
  return Array.isArray(data) ? data : [];
}

/** Fetch values for a specific option. */
export async function listOptionValues(optionId: number): Promise<ProductOptionValue[]> {
  const { data } = await http.get(`/api/catalog/options/${optionId}/values`);
  return Array.isArray(data) ? (data as ProductOptionValue[]) : [];
}

/** Public helper: options + their values in one call for the Product page. */
export async function getProductOptionsWithValues(
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
}

/* =========================
 * Categories for a product (public)
 * Controller: GET /api/catalog/products/{productId}/categories
 * ========================= */
export async function listCategoriesForProduct(productId: number): Promise<Category[]> {
  const { data } = await http.get(`/api/catalog/products/${productId}/categories`);
  return Array.isArray(data) ? (data as Category[]) : [];
}

export default {
  // categories
  listCategories,
  getCategories, // alias
  getCategory,
  listChildCategories,
  listProductsByCategory,
  // products
  getProduct,
  listProductsPage,
  listNewArrivals,
  // images
  listProductImages,
  // options + values
  listProductOptions,
  listOptionValues,
  getProductOptionsWithValues,
  // reverse lookup
  listCategoriesForProduct,
};
