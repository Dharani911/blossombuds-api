// src/api/adminReviews.ts
import http from "./adminHttp";

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProductReview = {
  id?: number;
  productId?: number;
  productName?: string;
  customerId?: number;
  customerName?: string;
  rating?: number;
  title?: string;
  body?: string;
  status?: ReviewStatus;
  createdAt?: string; // ISO
  active?: boolean;
  concern?: boolean;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

export type ProductReviewImageDto = {
  id?: number;
  publicId?: string;
  url: string;        // signed GET (30 min)
  sortOrder?: number;
};

export type ProductReviewDetailView = {
  id: number;
  productId: number;
  orderId?: number;
  orderItemId?: number;
  customerId: number;
  rating: number;
  title?: string;
  body?: string;
  status: ReviewStatus;
  concern: boolean;
  createdAt: string; // ISO
  images: ProductReviewImageDto[];
  productName?: string;  // optional if BE enriches
  customerName?: string; // optional if BE enriches
};

export async function listAdminReviews(params: {
  status?: ReviewStatus;
  q?: string;
  page?: number;
  size?: number;
  concern?: boolean;
}): Promise<Page<ProductReview>> {
  const res = await http.get<Page<ProductReview>>("/api/reviews/admin", { params });
  return {
    content: res.data?.content ?? [],
    totalElements: res.data?.totalElements ?? 0,
    totalPages: res.data?.totalPages ?? 0,
    size: res.data?.size ?? (params.size ?? 20),
    number: res.data?.number ?? (params.page ?? 0),
  };
}

export async function getAdminReviewDetail(reviewId: number) {
  const res = await http.get<ProductReviewDetailView>(`/api/reviews/${reviewId}`);
  return res.data;
}

export async function moderateReview(
  reviewId: number,
  status: Exclude<ReviewStatus, "PENDING">,
  override = false
) {
  const res = await http.post<ProductReview>(
    `/api/reviews/${reviewId}/moderate/${status}`,
    null,
    { params: { override } }
  );
  return res.data;
}

export async function deleteReviewById(reviewId: number) {
  await http.delete<void>(`/api/reviews/${reviewId}`);
}
