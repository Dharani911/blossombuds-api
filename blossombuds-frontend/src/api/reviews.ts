// src/api/reviews.ts
// Public + authenticated Reviews API — uses window.fetch (no axios interceptors)
import { apiUrl } from "./base";
export type ReviewImage = {
  id?: number;        // present when reading from server
  publicId?: string;  // used when submitting / returned from BE
  url: string;
  sortOrder?: number;
};

export type Review = {
  id: number;
  productId: number;
  productName?: string;
  rating: number;          // 1..5
  title?: string;
  content?: string;        // (a.k.a. body/comment)
  authorName?: string;
  createdAt: string;       // ISO
  images?: ReviewImage[];  // optional images
};

export type ReviewPage = {
  rows: Review[];
  page: number;
  size: number;
  total: number; // total rows across all pages
};

export type RemainingCapacity = { remaining: number };

// Resolve base URL
const BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Small helper to build query strings */
function qs(params: Record<string, any>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((vv) => u.append(k, String(vv)));
    } else {
      u.set(k, String(v));
    }
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** GET (public-safe) */
async function getJson<T>(
  path: string,
  params?: Record<string, any>,
  authToken?: string
): Promise<T> {
  const url = apiUrl(`${path}${qs(params || {})}`);
  const res = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "X-Public": "1",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status} on ${path}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return {} as T;
}

/** POST/PUT/PATCH JSON */
async function sendJson<T>(
  method: "POST" | "PUT" | "PATCH",
  path: string,
  body: any,
  authToken?: string
): Promise<T> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method,
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status} on ${path}`);
  }
  if (res.status === 204) return {} as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return {} as T;
}

/** DELETE */
async function del(path: string, authToken?: string): Promise<void> {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status} on ${path}`);
  }
}

/** Normalize backend payload → Review */
function toReview(r: any): Review {
  const product = r?.product ?? {};
  const productId =
    r?.productId ??
    product?.id ??
    (typeof r?.product_id === "number" ? r.product_id : undefined);

  // pick up firstImageUrl from the public page payloads (camel or snake)
  const firstImageUrl: string | undefined =
    r?.firstImageUrl ?? r?.first_image_url ?? undefined;

  // map images[] if present
  let imgs: ReviewImage[] | undefined = Array.isArray(r?.images)
    ? r.images
        .map((im: any) => ({
          id: im?.id != null ? Number(im.id) : undefined,
          publicId: im?.publicId ?? im?.public_id,
          url: im?.url,
          sortOrder:
            im?.sortOrder != null
              ? Number(im.sortOrder)
              : im?.sort_order != null
              ? Number(im.sort_order)
              : undefined,
        }))
        .filter((im: ReviewImage) => !!im.url)
    : undefined;

  // if images[] is absent or empty, synthesize from firstImageUrl
  if ((!imgs || imgs.length === 0) && firstImageUrl) {
    imgs = [{ url: firstImageUrl }];
  }

  return {
    id: Number(r?.id ?? 0),
    productId: Number(productId ?? 0),
    productName: r?.productName ?? product?.name ?? r?.product_name ?? undefined,
    rating: Number(r?.rating ?? 0),
    title: r?.title ?? r?.headline ?? undefined,
    content: r?.body ?? r?.content ?? r?.comment ?? undefined,
    authorName: r?.authorName ?? r?.author_name ?? r?.customerName ?? undefined,
    createdAt: r?.createdAt ?? r?.created_at ?? r?.created ?? new Date().toISOString(),
    images: imgs,
  };
}

/* ===================== Public listing APIs ===================== */

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

  if (opts?.productId) {
    const data = await getJson<any[]>(`/api/reviews/product/${opts.productId}`);
    const rowsAll = (data ?? []).map(toReview);

    const rowsSorted =
      sortKey === "rating"
        ? rowsAll.sort(
            (a, b) =>
              b.rating - a.rating ||
              Date.parse(b.createdAt) - Date.parse(a.createdAt)
          )
        : rowsAll.sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
          );

    const start = page * size;
    const slice = rowsSorted.slice(start, start + size);

    return { rows: slice, page, size, total: rowsSorted.length };
  }

  const sortParam = sortKey === "rating" ? "rating,desc" : "createdAt,desc";

  const data = await getJson<any>(`/api/reviews`, {
    page,
    size,
    sort: sortParam,
    q,
  });

  const content = data?.content ?? data?.rows ?? data ?? [];
  const total =
    data?.totalElements ?? data?.total ?? (Array.isArray(content) ? content.length : 0);
  const pageNum = data?.number ?? page;
  const pageSize = data?.size ?? size;

  const rows = (content as any[]).map(toReview);
  return { rows, page: pageNum, size: pageSize, total };
}

/* ===================== Authenticated customer/admin APIs ===================== */

/** Submit a review (PENDING) — requires auth. */
export async function submitReview(
  payload: {
    productId: number;
    customerId: number;
    orderId?: number;
    orderItemId?: number;
    rating: number;
    title?: string;
    content?: string;
    concern?: boolean; // NEW
    images?: Array<{ publicId?: string; url: string; sortOrder?: number }>;
  },
  authToken: string
): Promise<Review> {
  const dto = {
    productId: payload.productId,
    customerId: payload.customerId,
    orderId: payload.orderId,
    orderItemId: payload.orderItemId,
    rating: payload.rating,
    title: payload.title,
    body: payload.content,
    concern: payload.concern ?? false,
    images: payload.images?.map((im, i) => ({
      publicId: im.publicId,
      url: im.url,
      sortOrder: im.sortOrder ?? i,
    })),
  };
  const res = await sendJson<any>("POST", `/api/reviews`, dto, authToken);
  return toReview(res);
}

/** List reviews authored by a given customer — requires auth & ownership or admin. */
export async function listReviewsByCustomer(
  customerId: number,
  authToken: string
): Promise<Review[]> {
  const data = await getJson<any[]>(
    `/api/reviews/by-customer/${customerId}`,
    undefined,
    authToken
  );
  return (data ?? []).map(toReview);
}

/** Add images to an existing review (server caps total at 3). */
export async function addReviewImages(
  reviewId: number,
  images: Array<{ publicId?: string; url: string; sortOrder?: number }>,
  authToken: string
): Promise<RemainingCapacity> {
  const res = await sendJson<RemainingCapacity>(
    "POST",
    `/api/reviews/${reviewId}/images`,
    images,
    authToken
  );
  return res;
}

/** Presign a temp upload (PUT) for this review flow. Likely requires auth. */
export async function presignReviewUpload(filename: string, contentType: string) {
  const res = await fetch(apiUrl(`/api/reviews/images/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ filename, contentType }),
    credentials: "omit",
  }));
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { key: string; url: string; contentType: string };
}

export async function putToPresignedUrl(url: string, file: File, onProgress?: (pct: number)=>void) {
  // Native fetch can't stream progress; use XHR for progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

export async function attachImageFromTempKey(reviewId: number, key: string, authToken: string) {
  const res = await fetch(apiUrl(`/api/reviews/${reviewId}/images/attach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ key }),
    credentials: "omit",
  }));
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    id: number;
    publicId: string;
    url: string;       // signed GET (30 min)
    sortOrder: number;
  };
}

