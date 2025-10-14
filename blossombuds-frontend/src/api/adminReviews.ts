import http from "./adminHttp";

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProductReview = {
  id?: number;
  productId?: number;
  productName?: string;
  customerId?: number;
  customerName?: string;
  rating?: number;         // 1..5
  title?: string;
  comment?: string;
  status?: ReviewStatus;   // PENDING | APPROVED | REJECTED
  createdAt?: string;      // ISO
  active?: boolean;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

export async function listAdminReviews(params: {
  status?: ReviewStatus;
  q?: string;
  page?: number;
  size?: number;
}) : Promise<Page<ProductReview>> {
  const res = await http.get<Page<ProductReview>>("/api/reviews/admin", { params });
  // Ensure defaults
  return {
    content: res.data?.content ?? [],
    totalElements: res.data?.totalElements ?? 0,
    totalPages: res.data?.totalPages ?? 0,
    size: res.data?.size ?? (params.size ?? 20),
    number: res.data?.number ?? (params.page ?? 0),
  };
}

export async function moderateReview(reviewId: number, status: Exclude<ReviewStatus, "PENDING">) {
  const res = await http.post<ProductReview>(`/api/reviews/${reviewId}/moderate/${status}`);
  return res.data;
}

export async function deleteReviewById(reviewId: number) {
  await http.delete<void>(`/api/reviews/${reviewId}`);
}
