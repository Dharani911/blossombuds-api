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
    .post(`/catalog/products/${payload.productId}/notify-me`, {
      email: payload.email,
    })
    .then((r) => r.data);
}