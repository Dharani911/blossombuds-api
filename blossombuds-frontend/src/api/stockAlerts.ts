import  http  from "./http";

export type BackInStockRequest = {
  productId: number;
  email?: string;
};

export type BackInStockResponse = {
  success: boolean;
  message: string;
};

export async function notifyMeWhenBackInStock(
  payload: BackInStockRequest
): Promise<BackInStockResponse> {
  const { data } = await http.post<BackInStockResponse>(
    `/catalog/products/${payload.productId}/notify-me`,
    payload
  );
  return data;
}