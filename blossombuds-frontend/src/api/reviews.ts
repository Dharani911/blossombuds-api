// src/api/reviews.ts
import http from "./http";

export type Review = {
  id: number;
  productId: number;
  productName?: string;
  rating: number;          // 1..5
  title?: string;
  content?: string;
  authorName?: string;
  createdAt: string;       // ISO
};

export type ReviewPage = {
  rows: Review[];
  page: number;
  size: number;
  total: number; // total rows across all pages
};

function toReview(r: any): Review {
  // Accepts a ProductReview entity or any DTO and maps it safely
  const product = r.product ?? {};
  const productId =
    r.productId ??
    product.id ??
    (typeof r.product_id === "number" ? r.product_id : undefined);

  return {
    id: Number(r.id),
    productId: Number(productId ?? 0),
    productName:
      r.productName ??
      product.name ??
      r.product_name ??
      undefined,
    rating: Number(r.rating ?? 0),
    title: r.title ?? undefined,
    content: r.content ?? undefined,
    authorName: r.authorName ?? r.author_name ?? undefined,
    createdAt: r.createdAt ?? r.created_at ?? r.created ?? new Date().toISOString(),
  };
}

/**
 * Lists reviews:
 * - If productId is provided → uses `/api/reviews/product/{id}` (public, approved only),
 *   sorts client-side and paginates client-side for convenience.
 * - Otherwise → uses `/api/reviews` (public, pageable, approved only) with optional `q` and `sort`.
 *
 * Sort options:
 *   - "new"    -> sort=createdAt,desc
 *   - "rating" -> sort=rating,desc&then(createdAt,desc on backend/defaults if configured)
 */
export async function listReviews(opts?: {
  page?: number;
  size?: number;
  productId?: number;
  sort?: "new" | "rating";
  q?: string;
}): Promise<ReviewPage> {
  const page = Math.max(0, opts?.page ?? 0);
  const size = Math.min(50, Math.max(5, opts?.size ?? 10));
  const sortKey = opts?.sort ?? "new";
  const q = opts?.q?.trim() || undefined;

  // Per-product (unpaged endpoint) → fetch, normalize, then paginate locally
  if (opts?.productId) {
    const { data } = await http.get<any[]>(`/api/reviews/product/${opts.productId}`);
    const rowsAll = (data ?? []).map(toReview);

    const rowsSorted =
      sortKey === "rating"
        ? rowsAll.sort((a, b) =>
            b.rating - a.rating || Date.parse(b.createdAt) - Date.parse(a.createdAt)
          )
        : rowsAll.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const start = page * size;
    const slice = rowsSorted.slice(start, start + size);

    return {
      rows: slice,
      page,
      size,
      total: rowsSorted.length,
    };
  }

  // All reviews (paged public endpoint)
  const sortParam = sortKey === "rating" ? "rating,desc" : "createdAt,desc";

  const { data } = await http.get<any>(`/api/reviews`, {
    params: {
      page,
      size,
      sort: sortParam, // Spring Pageable will pick this up
      q,
    },
  });

  // Handle Spring Page or a custom structure
  const content = data?.content ?? data?.rows ?? data ?? [];
  const total = data?.totalElements ?? data?.total ?? Array.isArray(content) ? content.length : 0;
  const pageNum = data?.number ?? page;
  const pageSize = data?.size ?? size;

  const rows = (content as any[]).map(toReview);

  return {
    rows,
    page: pageNum,
    size: pageSize,
    total,
  };
}
