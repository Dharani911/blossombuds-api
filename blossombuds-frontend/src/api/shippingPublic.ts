import http from "./http";

export async function quoteShipping(itemsSubtotal: number, stateId?: number, districtId?: number) {
  const { data } = await http.get("/api/shipping/quote", {
    params: { itemsSubtotal, stateId, districtId },
  });
  return data as { itemsSubtotal: number; stateId?: number; districtId?: number; fee: string | number };
}

export async function previewShipping(body: { itemsSubtotal: number; stateId?: number; districtId?: number }) {
  const { data } = await http.post("/api/shipping/preview", body);
  return data as { fee: number; free: boolean };
}
