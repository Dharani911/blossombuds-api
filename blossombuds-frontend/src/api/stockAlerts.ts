import  http  from "./http";

export type BackInStockRequest = {
  productId: number;
  email?: string;
};

export type BackInStockResponse = {
  success: boolean;
  message: string;
};

export function notifyMeWhenBackInStock(payload: {
  productId: number;
  email?: string;
}) {
  return http
    .post(`/api/catalog/products/${payload.productId}/notify-me`, {
      email: payload.email,
    })
    .then((r) => r.data);
}


export type StockAlertAdminSummary = {
  productId: number;
  productName: string;
  activeRequestCount: number;
  waitingSince: string; // ISO datetime
};

export async function listStockAlertAdminSummary(): Promise<StockAlertAdminSummary[]> {
  const { data } = await http.get<StockAlertAdminSummary[]>("/api/catalog/stock-alerts/summary");
  return data || [];
}